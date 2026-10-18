"""Acesso ao LLM da pré-computação offline (decisão 10); a orquestração fica em `grafos.py` (LangGraph).

`gemini()` devolve o Gemini Flash por langchain-google-genai, com `max_retries=0`: quem repete é o
`RetryPolicy` do nó, guiado por `deve_repetir`; com LLM_RPM, um limitador de taxa segura o ritmo
abaixo da cota da conta. `Gerador` envolve qualquer chat model LangChain com cache em disco por
SHA-256 de (provedor, modelo, prompt) em dados/cache-llm. O cache guarda só o texto da resposta,
nunca a saída de um nó, e por isso dois nós ou dois temas não herdam a saída um do outro. Cada
chamada ao modelo deixa uma linha em dados/cache-llm/chamadas.jsonl (tokens, latência, erro).
Sem GEMINI_API_KEY, `comparar` usa dados/rascunhos/<tema>.json e o juiz usa dados/juiz.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import config

CODIGOS_TRANSITORIOS = {429, 500, 503}
ESPERA_MAXIMA_SUGERIDA = 60.0


def _cadeia(exc: BaseException):
    vistos = set()
    x: BaseException | None = exc
    while x is not None and id(x) not in vistos:
        vistos.add(id(x))
        yield x
        x = x.__cause__ or x.__context__


def codigo_http(exc: BaseException) -> int | None:
    for x in _cadeia(exc):
        codigo = getattr(x, "code", None) or getattr(x, "status_code", None)
        if isinstance(codigo, int):
            return codigo
    return None


def deve_repetir(exc: BaseException) -> bool:
    """True para cota/instabilidade (429, 500, 503) ou falha de rede, em qualquer elo da cadeia."""
    try:
        from httpx import TransportError as rede
    except ImportError:
        rede = ConnectionError
    for x in _cadeia(exc):
        if isinstance(x, (ConnectionError, TimeoutError, rede)):
            return True
        codigo = getattr(x, "code", None) or getattr(x, "status_code", None)
        if isinstance(codigo, int):
            return codigo in CODIGOS_TRANSITORIOS
    return False


def espera_sugerida(exc: BaseException) -> float | None:
    """Segundos de `google.rpc.RetryInfo.retryDelay` ("37s") no corpo de erro do Gemini, se houver."""
    for x in _cadeia(exc):
        corpo = getattr(x, "details", None)
        erro = corpo.get("error") if isinstance(corpo, dict) else None
        for d in (erro.get("details") or []) if isinstance(erro, dict) else []:
            if isinstance(d, dict) and str(d.get("@type", "")).endswith("google.rpc.RetryInfo"):
                m = re.fullmatch(r"(\d+(?:\.\d+)?)s", str(d.get("retryDelay", "")))
                if m:
                    return float(m.group(1))
    return None


class ChamadaCancelada(RuntimeError):
    """Chamada não feita porque outra do mesmo Gerador já teve erro definitivo (`original`)."""

    def __init__(self, original: BaseException):
        super().__init__(f"chamada cancelada depois de erro definitivo: {original!r}"[:300])
        self.original = original


class Gerador:
    """`json(prompt)` -> resposta do modelo já decodificada, com cache em disco e telemetria local."""

    def __init__(self, modelo, provedor: str, nome_modelo: str, pasta: Path = config.DADOS / "cache-llm",
                 espera_maxima: float = ESPERA_MAXIMA_SUGERIDA):
        self.modelo, self.provedor, self.nome_modelo, self.pasta = modelo, provedor, nome_modelo, pasta
        self.espera_maxima = espera_maxima
        self.chamadas = self.do_cache = self.falhas = self.tokens_entrada = self.tokens_saida = 0
        self._trava = threading.Lock()
        self._por_chave: dict[str, threading.Lock] = {}
        self._erro_definitivo: BaseException | None = None

    @property
    def nome(self) -> str:
        return f"{self.provedor}:{self.nome_modelo}"

    def arquivo(self, prompt: str) -> Path:
        chave = hashlib.sha256((self.nome + "\n" + prompt).encode("utf-8")).hexdigest()
        return self.pasta / f"{chave}.json"

    def _trava_da(self, chave: str) -> threading.Lock:
        with self._trava:
            return self._por_chave.setdefault(chave, threading.Lock())

    def _registrar(self, etapa: str, chave: str, inicio: float, uso: Any, erro: BaseException | None) -> None:
        uso = uso if isinstance(uso, dict) else {}
        linha = {"em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "etapa": etapa,
                 "modelo": self.nome, "chave": chave, "ms": round((time.monotonic() - inicio) * 1000),
                 "tokens_entrada": int(uso.get("input_tokens") or 0),
                 "tokens_saida": int(uso.get("output_tokens") or 0),
                 "erro": None if erro is None else f"{type(erro).__name__} {codigo_http(erro) or ''}".strip()}
        with self._trava:
            self.chamadas += 1
            self.falhas += erro is not None
            self.tokens_entrada += linha["tokens_entrada"]
            self.tokens_saida += linha["tokens_saida"]
            self.pasta.mkdir(parents=True, exist_ok=True)
            with (self.pasta / "chamadas.jsonl").open("a", encoding="utf-8") as f:
                f.write(json.dumps(linha, ensure_ascii=False) + "\n")

    def json(self, prompt: str, etapa: str = "llm", validar: Callable[[Any], None] | None = None) -> Any:
        """`validar` levanta ValueError para formato errado; nada fora do formato entra no cache."""
        arq = self.arquivo(prompt)
        with self._trava_da(arq.stem):  # prompt idêntico em paralelo: o segundo lê o cache do primeiro
            if arq.exists():
                with self._trava:
                    self.do_cache += 1
                return json.loads(json.loads(arq.read_text(encoding="utf-8"))["resposta"])
            if self._erro_definitivo is not None:
                raise ChamadaCancelada(self._erro_definitivo)
            inicio, resposta = time.monotonic(), None
            try:
                resposta = self.modelo.invoke(prompt)
                texto = str(resposta.text)
                dados = json.loads(texto)  # texto inválido sobe ValueError
                if validar:
                    validar(dados)
            except Exception as e:
                self._registrar(etapa, arq.stem, inicio, getattr(resposta, "usage_metadata", None), e)
                if not deve_repetir(e):
                    self._erro_definitivo = e
                elif (espera := espera_sugerida(e)) is not None:
                    time.sleep(min(espera, self.espera_maxima))
                raise
            self._registrar(etapa, arq.stem, inicio, getattr(resposta, "usage_metadata", None), None)
            self.pasta.mkdir(parents=True, exist_ok=True)
            tmp = arq.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
            tmp.write_text(json.dumps({"resposta": texto}, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, arq)
            return dados

    def resumo(self) -> str:
        return (f"LLM {self.nome}: {self.chamadas} chamadas, {self.do_cache} do cache, {self.falhas} falhas, "
                f"{self.tokens_entrada} tokens de entrada, {self.tokens_saida} de saída")


def gemini(modelo: str, chave: str, base_url: str | None = None, rpm: float | None = None,
           timeout: float = 120):
    from langchain_google_genai import ChatGoogleGenerativeAI
    extra: dict[str, Any] = {"base_url": base_url} if base_url else {}
    if rpm:
        from langchain_core.rate_limiters import InMemoryRateLimiter
        extra["rate_limiter"] = InMemoryRateLimiter(requests_per_second=rpm / 60, check_every_n_seconds=0.05,
                                                    max_bucket_size=1)
    return ChatGoogleGenerativeAI(model=modelo, google_api_key=chave, temperature=0, max_retries=0,
                                  timeout=timeout, response_mime_type="application/json", **extra)


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
    modelo = os.environ.get("GEMINI_MODELO") or "gemini-2.5-flash"
    rpm = float(os.environ["LLM_RPM"]) if os.environ.get("LLM_RPM") else None
    if rpm is not None and rpm <= 0:
        raise SystemExit(f"ERRO: LLM_RPM deve ser positivo, veio {rpm}")
    return Gerador(gemini(modelo, chave, rpm=rpm), "gemini", modelo)
