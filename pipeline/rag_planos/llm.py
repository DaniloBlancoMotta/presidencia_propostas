"""Acesso ao LLM da pré-computação offline (decisão 10); a orquestração fica em `grafos.py` (LangGraph).

`gemini()` devolve o Gemini Flash por langchain-google-genai, com `max_retries=0`: quem repete é o
`RetryPolicy` do nó, guiado por `deve_repetir`. `Gerador` envolve qualquer chat model LangChain com
cache em disco por SHA-256 de (provedor, modelo, prompt) em dados/cache-llm. O cache guarda só o
texto da resposta, nunca a saída de um nó, e por isso dois nós ou dois temas não herdam a saída um
do outro. Sem GEMINI_API_KEY, `comparar` usa dados/rascunhos/<tema>.json e o juiz usa dados/juiz.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path
from typing import Any

from . import config

CODIGOS_TRANSITORIOS = {429, 500, 503}


def deve_repetir(exc: BaseException) -> bool:
    """True para cota/instabilidade (429, 500, 503) ou falha de rede, em qualquer elo da cadeia."""
    try:
        from httpx import TransportError as rede
    except ImportError:
        rede = ConnectionError
    vistos = set()
    x: BaseException | None = exc
    while x is not None and id(x) not in vistos:
        vistos.add(id(x))
        if isinstance(x, (ConnectionError, TimeoutError, rede)):
            return True
        codigo = getattr(x, "code", None) or getattr(x, "status_code", None)
        if isinstance(codigo, int):
            return codigo in CODIGOS_TRANSITORIOS
        x = x.__cause__ or x.__context__
    return False


class Gerador:
    """`json(prompt)` -> resposta do modelo já decodificada, com cache em disco."""

    def __init__(self, modelo, provedor: str, nome_modelo: str, pasta: Path = config.DADOS / "cache-llm"):
        self.modelo, self.provedor, self.nome_modelo, self.pasta = modelo, provedor, nome_modelo, pasta
        self.chamadas = self.do_cache = 0
        self._trava = threading.Lock()

    @property
    def nome(self) -> str:
        return f"{self.provedor}:{self.nome_modelo}"

    def arquivo(self, prompt: str) -> Path:
        chave = hashlib.sha256((self.nome + "\n" + prompt).encode("utf-8")).hexdigest()
        return self.pasta / f"{chave}.json"

    def json(self, prompt: str) -> Any:
        arq = self.arquivo(prompt)
        if arq.exists():
            with self._trava:
                self.do_cache += 1
            return json.loads(json.loads(arq.read_text(encoding="utf-8"))["resposta"])
        with self._trava:
            self.chamadas += 1
        texto = str(self.modelo.invoke(prompt).text)
        dados = json.loads(texto)  # texto inválido sobe ValueError e não entra no cache
        self.pasta.mkdir(parents=True, exist_ok=True)
        tmp = arq.with_suffix(f".{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps({"resposta": texto}, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, arq)
        return dados

    def resumo(self) -> str:
        return f"LLM {self.nome}: {self.chamadas} chamadas, {self.do_cache} do cache"


def gemini(modelo: str, chave: str, base_url: str | None = None):
    from langchain_google_genai import ChatGoogleGenerativeAI
    extra = {"base_url": base_url} if base_url else {}
    return ChatGoogleGenerativeAI(model=modelo, google_api_key=chave, temperature=0, max_retries=0,
                                  timeout=120, response_mime_type="application/json", **extra)


def prompt(nome: str, **campos: str) -> str:
    """Monta um prompt de pipeline/rag_planos/prompts/<nome>.md trocando {{campo}}."""
    texto = (config.PROMPTS / f"{nome}.md").read_text(encoding="utf-8")
    for k, v in campos.items():
        texto = texto.replace("{{" + k + "}}", v)
    return texto


def provedor_padrao() -> Gerador | None:
    chave = os.environ.get("GEMINI_API_KEY")
    if not chave:
        return None
    modelo = os.environ.get("GEMINI_MODELO", "gemini-2.5-flash")
    return Gerador(gemini(modelo, chave), "gemini", modelo)
