"""Acesso ao LLM da pré-computação offline (decisão 10); a orquestração fica em `grafos.py` (LangGraph).

`gemini()` devolve o Gemini Flash por langchain-google-genai, com `max_retries=0`: quem repete é o
`RetryPolicy` do nó, guiado por `deve_repetir` (cota diária esgotada não se repete). `Gerador`
envolve qualquer chat model LangChain com cache em disco por SHA-256 de (provedor, modelo, prompt)
em dados/cache-llm, limitador de taxa opcional (LLM_RPM) e a espera que o servidor sugere num 429.
O cache guarda só o texto da resposta, nunca a saída de um nó, e por isso dois nós ou dois temas
não herdam a saída um do outro. Cada chamada ao modelo deixa uma linha em
dados/cache-llm/chamadas.jsonl (tokens, latência, espera, erro).
Sem GEMINI_API_KEY, `comparar` usa dados/rascunhos/<tema>.json e o juiz usa dados/juiz.
"""
from __future__ import annotations

import hashlib
import json
import math
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
CONCORRENCIA_PADRAO = 4
MODELO_PADRAO = "gemini-3.8-flash"  # 2.5-flash: 404 para contas novas desde out/2026


def _cadeia(exc: BaseException):
    vistos = set()
    x: BaseException | None = exc
    while x is not None and id(x) not in vistos:
        vistos.add(id(x))
        yield x
        x = x.__cause__ or x.__context__


def _detalhes(exc: BaseException, tipo: str):
    """Itens `error.details[]` do corpo de erro do Google (google.rpc.<tipo>) em qualquer elo."""
    for x in _cadeia(exc):
        corpo = getattr(x, "details", None)
        erro = corpo.get("error") if isinstance(corpo, dict) else None
        for d in (erro.get("details") or []) if isinstance(erro, dict) else []:
            if isinstance(d, dict) and str(d.get("@type", "")).endswith("google.rpc." + tipo):
                yield d


def codigo_http(exc: BaseException) -> int | None:
    for x in _cadeia(exc):
        codigo = getattr(x, "code", None) or getattr(x, "status_code", None)
        if isinstance(codigo, int):
            return codigo
    return None


def cota_diaria(exc: BaseException) -> bool:
    """429 cujo QuotaFailure aponta uma cota por dia (quotaId com "PerDay"): esperar não resolve."""
    return any("PerDay" in str(v.get("quotaId", ""))
               for d in _detalhes(exc, "QuotaFailure") for v in d.get("violations") or [] if isinstance(v, dict))


def deve_repetir(exc: BaseException) -> bool:
    """True para cota por minuto/instabilidade (429, 500, 503) ou falha de rede, em qualquer elo."""
    if cota_diaria(exc):
        return False
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
    for d in _detalhes(exc, "RetryInfo"):
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
                 espera_maxima: float = ESPERA_MAXIMA_SUGERIDA, limitador=None):
        self.modelo, self.provedor, self.nome_modelo, self.pasta = modelo, provedor, nome_modelo, pasta
        self.espera_maxima, self.limitador = espera_maxima, limitador
        self.chamadas = self.do_cache = self.falhas = self.tokens_entrada = self.tokens_saida = 0
        self._trava = threading.Lock()
        self._por_chave: dict[str, threading.Lock] = {}
        self._prazo: dict[str, float] = {}  # chave -> instante antes do qual não se tenta de novo
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

    def _registrar(self, etapa: str, chave: str, inicio: float, espera: float, uso: Any,
                   erro: BaseException | None) -> None:
        uso = uso if isinstance(uso, dict) else {}
        linha = {"em": datetime.now(timezone.utc).isoformat(timespec="seconds"), "etapa": etapa,
                 "modelo": self.nome, "chave": chave, "ms": round((time.monotonic() - inicio) * 1000),
                 "espera_ms": round(espera * 1000),
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

    def _esperar(self, chave: str) -> float:
        """Dorme o que falta da espera sugerida para esta chave e a vez no limitador; devolve segundos."""
        t0 = time.monotonic()
        falta = self._prazo.pop(chave, 0.0) - t0
        if falta > 0:
            time.sleep(falta)
        if self.limitador is not None:
            self.limitador.acquire()
        return time.monotonic() - t0

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
            espera = self._esperar(arq.stem)
            if self._erro_definitivo is not None:  # outra tarefa falhou de vez enquanto esta esperava
                raise ChamadaCancelada(self._erro_definitivo)
            inicio, resposta = time.monotonic(), None
            try:
                resposta = self.modelo.invoke(prompt)
                texto = str(resposta.text)
                dados = json.loads(texto)  # texto inválido sobe ValueError
                if validar:
                    validar(dados)
            except Exception as e:
                self._registrar(etapa, arq.stem, inicio, espera, getattr(resposta, "usage_metadata", None), e)
                if not deve_repetir(e):
                    self._erro_definitivo = e
                elif (sugerida := espera_sugerida(e)) is not None:
                    self._prazo[arq.stem] = time.monotonic() + min(sugerida, self.espera_maxima)
                raise
            self._registrar(etapa, arq.stem, inicio, espera, getattr(resposta, "usage_metadata", None), None)
            self.pasta.mkdir(parents=True, exist_ok=True)
            tmp = arq.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
            tmp.write_text(json.dumps({"resposta": texto}, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, arq)
            return dados

    def resumo(self) -> str:
        return (f"LLM {self.nome}: {self.chamadas} chamadas, {self.do_cache} do cache, {self.falhas} falhas, "
                f"{self.tokens_entrada} tokens de entrada, {self.tokens_saida} de saída")


def gemini(modelo: str, chave: str, base_url: str | None = None, timeout: float = 120):
    from langchain_google_genai import ChatGoogleGenerativeAI
    extra = {"base_url": base_url} if base_url else {}
    return ChatGoogleGenerativeAI(model=modelo, google_api_key=chave, temperature=0, max_retries=0,
                                  timeout=timeout, response_mime_type="application/json", **extra)


def limitador(rpm: float):
    from langchain_core.rate_limiters import InMemoryRateLimiter
    return InMemoryRateLimiter(requests_per_second=rpm / 60, check_every_n_seconds=0.05, max_bucket_size=1)


def rpm_configurado() -> float | None:
    bruto = os.environ.get("LLM_RPM")
    if not bruto:
        return None
    try:
        rpm = float(bruto)
    except ValueError:
        rpm = math.nan
    if not math.isfinite(rpm) or rpm <= 0:
        raise SystemExit(f"ERRO: LLM_RPM deve ser um número positivo de pedidos por minuto, veio {bruto!r}")
    return rpm


def concorrencia() -> int:
    bruto = os.environ.get("LLM_CONCORRENCIA")
    if not bruto:
        return CONCORRENCIA_PADRAO
    try:
        n = int(bruto)
    except ValueError:
        n = 0
    if n < 1:
        raise SystemExit(f"ERRO: LLM_CONCORRENCIA deve ser um inteiro maior ou igual a 1, veio {bruto!r}")
    return n


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
    modelo = os.environ.get("GEMINI_MODELO") or MODELO_PADRAO
    rpm = rpm_configurado()
    return Gerador(gemini(modelo, chave), "gemini", modelo, limitador=limitador(rpm) if rpm else None)
