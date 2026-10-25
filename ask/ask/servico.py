"""Um pedido do /ask de ponta a ponta, sem HTTP: validar → limite → triagem → cache → grafo.

Contrato (plano-final §11): resposta `{origem, camada, recusada?, motivo?, candidatos}`, mais
`modelos` e `contexto` (a pergunta processada, os termos e os recortes que foram ao modelo); erro
`{erro: <código>}` com status. O registro de cada pedido (uma linha JSON em stdout) não leva IP nem o
texto da pergunta: só um resumo de 12 hex da pergunta normalizada, para achar repetição.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from rag_planos import config as cp
from rag_planos import extrair

from . import config, triagem
from .cache import Cache, normalizar_pergunta
from .grafo import contexto, montar_grafo, responder
from .indice import EmbeddingsLocais, Indice, carregar_chunks, versao_indice
from .limite import Limite
from .provedores import Cadeia, cadeia_do_ambiente

@dataclass
class Resultado:
    status: int
    corpo: dict
    cabecalhos: dict


def _vazia() -> dict:
    return {cid: {"nao_encontrado": True, "resumo": []} for cid in cp.CANDIDATOS}


class Servico:
    def __init__(self, indice: Indice, cadeia: Cadeia, paginas: dict, cache: Cache | None = None,
                 limite: Limite | None = None, registrar: Callable[[dict], None] | None = None,
                 relogio: Callable[[], float] = time.monotonic):
        self.indice, self.cadeia, self.paginas = indice, cadeia, paginas
        self.cache = cache or Cache(indice.versao, indice.embeddings)
        self.limite = limite or Limite()
        self.registrar = registrar or (lambda linha: print(json.dumps(linha, ensure_ascii=False), file=sys.stdout, flush=True))
        self.relogio = relogio
        self.grafo = montar_grafo(indice, cadeia, paginas)

    def perguntar(self, corpo: Any, ip: str) -> Resultado:
        inicio = self.relogio()
        try:
            r = self._perguntar(corpo, ip)
        except Exception as e:  # o detalhe fica no registro, nunca na resposta
            r = Resultado(500, {"erro": "interno"}, {"x-provedores": type(e).__name__})
        resumo = None
        if isinstance(corpo, dict) and isinstance(corpo.get("pergunta"), str):
            resumo = hashlib.sha256(normalizar_pergunta(corpo["pergunta"]).encode("utf-8")).hexdigest()[:12]
        self.registrar({"em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "status": r.status,
                        "ms": round((self.relogio() - inicio) * 1000), "pergunta": resumo,
                        "origem": r.corpo.get("origem"), "recusada": r.corpo.get("recusada", False),
                        "motivo": r.corpo.get("motivo"), "erro": r.corpo.get("erro"),
                        "provedores": r.cabecalhos.pop("x-provedores", None)})
        return r

    def _perguntar(self, corpo: Any, ip: str) -> Resultado:
        if not isinstance(corpo, dict) or not isinstance(corpo.get("pergunta"), str):
            return Resultado(400, {"erro": "pedido_invalido"}, {})
        pergunta = " ".join(corpo["pergunta"].split())
        if not pergunta:
            return Resultado(400, {"erro": "pergunta_vazia"}, {})
        if len(pergunta) > config.TAM_MAX_PERGUNTA:
            return Resultado(400, {"erro": "pergunta_muito_longa"}, {})
        permitido, espera = self.limite.registrar(ip)
        if not permitido:
            return Resultado(429, {"erro": "limite"}, {"Retry-After": str(espera)})
        motivo = triagem.recusar(pergunta)
        if motivo:
            return Resultado(200, {"origem": "extrativo", "camada": "plano", "recusada": True, "motivo": motivo,
                                   "candidatos": _vazia(), "modelos": [], "contexto": contexto(pergunta)}, {})
        vetor = self.cache.vetor(pergunta)
        guardada = self.cache.obter(pergunta, vetor)
        if guardada is not None:
            return Resultado(200, {**guardada, "origem": "cache"}, {})
        resposta, provedores = responder(self.grafo, pergunta, self.relogio() + config.ORCAMENTO_S)
        self.cache.guardar(pergunta, resposta, vetor)
        return Resultado(200, resposta, {"x-provedores": provedores})


def servico_do_ambiente() -> Servico:
    """Índice de dados/indice-ask (ou construído na hora), provedores com chave no ambiente."""
    chunks = carregar_chunks()
    fontes = json.loads((cp.DADOS / "fontes.json").read_text(encoding="utf-8"))
    embeddings = EmbeddingsLocais()
    indice = Indice.carregar_ou_construir(chunks, embeddings, versao_indice(fontes, embeddings.nome))
    return Servico(indice, cadeia_do_ambiente(), extrair.carregar())
