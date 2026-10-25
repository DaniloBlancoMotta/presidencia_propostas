import hashlib
import json
import re

import numpy as np
import pytest

from ask import indice, texto
from ask.provedores import Cadeia, Provedor
from rag_planos import config as cp
from rag_planos import extrair

LULA = "Programa-Governo-LULA-2026.pdf"
FLAVIO = "plano-de-governo_flavio.pdf"


class EmbeddingsFalsas:
    """Saco de radicais em 512 posições por hash: determinístico, sem modelo, parecido o bastante
    para ordenar textos com as mesmas palavras."""
    nome = "falso"

    def __call__(self, textos):
        m = np.zeros((len(textos), 512), dtype=np.float32)
        for i, t in enumerate(textos):
            for r in texto.termos(t):
                m[i, int(hashlib.md5(r.encode()).hexdigest(), 16) % 512] += 1.0
        return m / np.maximum(np.linalg.norm(m, axis=1, keepdims=True), 1e-12)


class _Msg:
    def __init__(self, text):
        self.text = text


class ModeloFalso:
    """Chat model falso: `responder(prompt) -> str` (ou levanta). Guarda os prompts recebidos."""

    def __init__(self, responder):
        self.responder, self.prompts = responder, []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        return _Msg(self.responder(prompt))


def arquivo_do_prompt(prompt: str) -> str:
    return re.search(r"^Arquivo: (\S+)$", prompt, flags=re.M).group(1)


@pytest.fixture(scope="session")
def paginas():
    return extrair.carregar()


@pytest.fixture(scope="session")
def chunks():
    return indice.carregar_chunks()


@pytest.fixture(scope="session")
def indice_falso(chunks):
    return indice.Indice.construir(chunks, EmbeddingsFalsas(), "versao-teste")


@pytest.fixture(scope="session")
def bullets_reais():
    """Bullets verificados do tema saúde, por arquivo: texto e citações reais, literais na página."""
    comp = json.loads((cp.DADOS / "comparacoes" / "saude.json").read_text(encoding="utf-8"))
    return {cp.CANDIDATOS[cid]["arquivo"]: a["resumo"] for cid, a in comp["candidatos"].items()}


def cadeia(*respondedores, relogio=None):
    provs = [Provedor(f"p{i}", ModeloFalso(r)) for i, r in enumerate(respondedores)]
    return Cadeia(provs, relogio=relogio) if relogio else Cadeia(provs)
