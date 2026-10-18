"""Adaptador de LLM da pré-computação offline (decisão 10).

`Provedor.gerar(prompt) -> str`. Implementação: `Gemini` (API REST do Gemini Flash, exige
GEMINI_API_KEY; retry com backoff exponencial). Sem chave, `comparar` usa um rascunho já produzido
em dados/rascunhos/<tema>.json e registra a origem em dados/geracao/<tema>.json.
`ComCache` envolve qualquer provedor com cache em disco por SHA-256 do prompt.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Protocol

from . import config


class Provedor(Protocol):
    nome: str

    def gerar(self, prompt: str) -> str: ...


class Gemini:
    nome = "gemini"
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={chave}"

    def __init__(self, modelo: str | None = None, chave: str | None = None, tentativas: int = 5):
        self.modelo = modelo or os.environ.get("GEMINI_MODELO", "gemini-2.5-flash")
        self.chave = chave or os.environ.get("GEMINI_API_KEY")
        if not self.chave:
            raise RuntimeError("GEMINI_API_KEY ausente")
        self.tentativas = tentativas

    def gerar(self, prompt: str) -> str:
        corpo = json.dumps({
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
        }).encode("utf-8")
        url = self.URL.format(modelo=self.modelo, chave=self.chave)
        espera = 2.0
        for tentativa in range(self.tentativas):
            req = urllib.request.Request(url, data=corpo, headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    dados = json.loads(r.read().decode("utf-8"))
                return "".join(p.get("text", "") for p in dados["candidates"][0]["content"]["parts"])
            except urllib.error.HTTPError as e:
                if e.code not in (429, 500, 503) or tentativa == self.tentativas - 1:
                    raise
            except urllib.error.URLError:
                if tentativa == self.tentativas - 1:
                    raise
            time.sleep(espera)
            espera *= 2
        raise RuntimeError("inalcançável")


class ComCache:
    def __init__(self, provedor: Provedor, pasta: Path = config.DADOS / "cache-llm"):
        self.provedor, self.pasta = provedor, pasta
        self.nome = provedor.nome

    def gerar(self, prompt: str) -> str:
        chave = hashlib.sha256(f"{self.provedor.nome}\n{prompt}".encode("utf-8")).hexdigest()
        arq = self.pasta / f"{chave}.json"
        if arq.exists():
            return json.loads(arq.read_text(encoding="utf-8"))["resposta"]
        resposta = self.provedor.gerar(prompt)
        self.pasta.mkdir(parents=True, exist_ok=True)
        arq.write_text(json.dumps({"resposta": resposta}, ensure_ascii=False), encoding="utf-8")
        return resposta


def prompt(nome: str, **campos: str) -> str:
    """Monta um prompt de pipeline/rag_planos/prompts/<nome>.md trocando {{campo}}."""
    texto = (config.PROMPTS / f"{nome}.md").read_text(encoding="utf-8")
    for k, v in campos.items():
        texto = texto.replace("{{" + k + "}}", v)
    return texto


def provedor_padrao() -> Provedor | None:
    return ComCache(Gemini()) if os.environ.get("GEMINI_API_KEY") else None
