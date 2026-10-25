"""Cache de respostas do /ask (plano-final §11).

Chave = versão do índice (SHA-256 dos dois PDFs + modelo de embeddings) + pergunta normalizada. Sem
acerto exato, vale a pergunta já respondida mais parecida, se o cosseno for ≥ 0,92. Guarda só
respostas `gerado` (extrativo é sinal de provedor fora, não se repete do cache) e só até 30/11/2026.
Nenhum dado de quem perguntou entra aqui: só o texto da pergunta e a resposta.
"""
from __future__ import annotations

import threading
from datetime import date
from typing import Callable

import numpy as np

from . import config
from .texto import sem_acento


def normalizar_pergunta(p: str) -> str:
    return " ".join(sem_acento(p).replace("?", " ").replace("!", " ").split()).strip(" .")


class Cache:
    def __init__(self, versao: str, embeddings: Callable[[list[str]], np.ndarray],
                 limiar: float = config.LIMIAR_CACHE, validade: date = config.VALIDADE_CACHE,
                 hoje: Callable[[], date] = date.today):
        self.versao, self.embeddings, self.limiar, self.validade, self.hoje = versao, embeddings, limiar, validade, hoje
        self._respostas: dict[str, dict] = {}
        self._chaves: list[str] = []
        self._vetores = np.zeros((0, 0), dtype=np.float32)
        self._trava = threading.Lock()

    def _chave(self, pergunta: str) -> str:
        return f"{self.versao}\n{normalizar_pergunta(pergunta)}"

    def vetor(self, pergunta: str) -> np.ndarray:
        return self.embeddings([pergunta])[0]

    def obter(self, pergunta: str, vetor: np.ndarray | None = None) -> dict | None:
        if self.hoje() > self.validade:
            return None
        chave = self._chave(pergunta)
        with self._trava:
            if chave in self._respostas:
                return self._respostas[chave]
            if not self._chaves:
                return None
            v = vetor if vetor is not None else self.vetor(pergunta)
            sims = self._vetores @ v
            i = int(np.argmax(sims))
            return self._respostas[self._chaves[i]] if sims[i] >= self.limiar else None

    def guardar(self, pergunta: str, resposta: dict, vetor: np.ndarray | None = None) -> None:
        if resposta.get("origem") != "gerado" or self.hoje() > self.validade:
            return
        chave = self._chave(pergunta)
        v = vetor if vetor is not None else self.vetor(pergunta)
        with self._trava:
            if chave in self._respostas:
                return
            self._respostas[chave] = resposta
            self._chaves.append(chave)
            self._vetores = v[None, :] if self._vetores.size == 0 else np.vstack([self._vetores, v])

    def __len__(self) -> int:
        return len(self._chaves)
