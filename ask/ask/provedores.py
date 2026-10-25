"""Cadeia de LLM do /ask (plano-final §11): Gemini Flash → Groq → OpenRouter `:free`.

Cada provedor é um chat model do LangChain. Falha ou 10 s sem resposta passa ao próximo; 3 falhas
seguidas tiram o provedor da cadeia por 5 minutos (disjuntor). Sem provedor disponível, ou sem tempo
no orçamento do pedido, sobe `SemProvedor` e o grafo cai no modo extrativo. Não há repetição: no
caminho do eleitor, esperar um 429 custa mais do que passar ao próximo provedor.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as Esgotado
from dataclasses import dataclass, field
from typing import Any, Callable

from . import config


class SemProvedor(RuntimeError):
    pass


@dataclass
class Provedor:
    nome: str
    modelo: Any  # chat model LangChain: .invoke(prompt) -> mensagem com .text
    falhas: int = 0
    fechado_ate: float = 0.0
    chamadas: int = 0
    erros: int = 0
    ultimo_erro: str | None = None
    _trava: threading.Lock = field(default_factory=threading.Lock, repr=False)


def decodificar(texto: str) -> Any:
    """JSON da resposta; aceita a cerca ```json``` ou texto em volta do objeto, que modelos sem modo
    JSON às vezes devolvem."""
    t = texto.strip()
    m = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", t, flags=re.S)
    t = m.group(1) if m else t
    try:
        return json.loads(t)
    except ValueError:
        i, j = t.find("{"), t.rfind("}")
        if i == -1 or j <= i:
            raise
        return json.loads(t[i:j + 1])


class Cadeia:
    def __init__(self, provedores: list[Provedor], relogio: Callable[[], float] = time.monotonic,
                 timeout: float = config.TIMEOUT_PROVEDOR_S):
        self.provedores, self.relogio, self.timeout = provedores, relogio, timeout
        self._executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="llm")

    def disponiveis(self) -> list[str]:
        agora = self.relogio()
        return [p.nome for p in self.provedores if p.fechado_ate <= agora]

    def json(self, prompt: str, prazo: float, validar: Callable[[Any], None] | None = None) -> tuple[Any, str]:
        """(resposta decodificada, nome do provedor). `prazo` é instante do `relogio`."""
        for p in self.provedores:
            agora = self.relogio()
            if p.fechado_ate > agora:
                continue
            restante = prazo - agora
            if restante < 1.0:
                break
            try:
                futuro = self._executor.submit(p.modelo.invoke, prompt)
                resposta = futuro.result(timeout=min(self.timeout, restante))
                dados = decodificar(str(resposta.text))
                if validar:
                    validar(dados)
            except (Exception, Esgotado) as e:
                with p._trava:
                    p.ultimo_erro = f"{type(e).__name__}: {str(e)[:200]}"
                    p.chamadas += 1
                    p.erros += 1
                    p.falhas += 1
                    if p.falhas >= config.FALHAS_PARA_ABRIR:
                        p.fechado_ate = self.relogio() + config.PAUSA_DISJUNTOR_S
                        p.falhas = 0
                continue
            with p._trava:
                p.chamadas += 1
                p.falhas = 0
            return dados, p.nome
        raise SemProvedor("nenhum provedor respondeu a tempo")


def _modelo(nome: str, chave: str, modelo: str):
    """Raciocínio no mínimo: no gemini-3.8-flash, o padrão gastou 2.637 tokens pensando e levou 19,7 s
    numa pergunta que com "low" saiu em 4 s com a mesma resposta (18/10/2026)."""
    if nome == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=modelo, google_api_key=chave, temperature=0, max_retries=0,
                                      timeout=config.TIMEOUT_PROVEDOR_S, response_mime_type="application/json",
                                      thinking_level="low")
    from langchain_openai import ChatOpenAI
    extra: dict = {}
    if nome == "groq":  # o gpt-oss do Groq aceita modo JSON e esforço de raciocínio
        extra = {"reasoning_effort": "low", "model_kwargs": {"response_format": {"type": "json_object"}}}
    return ChatOpenAI(model=modelo, api_key=chave, base_url=config.URLS_OPENAI[nome], temperature=0,
                      max_retries=0, timeout=config.TIMEOUT_PROVEDOR_S, **extra)


def cadeia_do_ambiente() -> Cadeia:
    """Provedores de ASK_PROVEDORES (padrão gemini,groq,openrouter) que têm chave no ambiente."""
    provedores = []
    for nome in config.provedores_pedidos():
        if nome not in config.VARIAVEIS:
            raise SystemExit(f"ERRO: provedor desconhecido em ASK_PROVEDORES: {nome!r}")
        var_chave, var_modelo = config.VARIAVEIS[nome]
        chave = os.environ.get(var_chave)
        if chave:
            modelo = os.environ.get(var_modelo) or config.MODELOS_PADRAO[nome]
            provedores.append(Provedor(f"{nome}:{modelo}", _modelo(nome, chave, modelo)))
    return Cadeia(provedores)
