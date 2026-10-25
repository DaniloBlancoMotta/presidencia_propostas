"""Índice híbrido do /ask (plano-final §11): BM25 + vetorial, buscas separadas por candidato.

Os documentos são os chunks do pipeline (dados/chunks/chunks.json), que já trazem arquivo, página e
`viradas`. O modelo de embeddings trunca a entrada em 128 tokens, então cada chunk vira janelas de
80 palavras (passo 60) e a nota vetorial do chunk é a da melhor janela. As duas listas se juntam por
Reciprocal Rank Fusion ponderada (k = 60; BM25 1,0, vetorial 0,5). As janelas embutidas ficam em
dados/indice-ask/<versao>.npz.

Ao modelo não vai o chunk inteiro (~3.900 caracteres), e sim `recortes`: as 2 janelas do chunk mais
próximas da pergunta, com os marcadores de página refeitos para o recorte. O limite de 8.000 tokens
por minuto do Groq gratuito não comporta os dois candidatos com chunks inteiros.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Protocol

import numpy as np
from rank_bm25 import BM25Okapi

from . import config, texto

RRF_K = 60
# Pesos da fusão. No conjunto-ouro (54 itens, 18/10/2026): pesos iguais 52/54, vetorial 0,5 53/54,
# vetorial 0,3 54/54, só BM25 51/54. Fica 0,5: o ouro tem perguntas montadas com o vocabulário do
# plano, o que favorece o BM25; quem pergunta com outras palavras depende do vetorial.
PESO_BM25 = 1.0
PESO_VETORIAL = 0.5


class Embeddings(Protocol):
    nome: str

    def __call__(self, textos: list[str]) -> np.ndarray:  # linhas normalizadas (norma 1)
        ...


class EmbeddingsLocais:
    """fastembed (ONNX) com o modelo baixado na imagem; nenhuma chamada externa em execução."""

    def __init__(self, nome: str = config.MODELO_EMBEDDINGS):
        from fastembed import TextEmbedding
        self.nome = nome
        self._modelo = TextEmbedding(nome)

    def __call__(self, textos: list[str]) -> np.ndarray:
        m = np.array(list(self._modelo.embed(textos)), dtype=np.float32)
        return m / np.maximum(np.linalg.norm(m, axis=1, keepdims=True), 1e-12)


def versao_indice(fontes: list[dict], modelo: str) -> str:
    """SHA-256 dos dois PDFs + id do modelo de embeddings: muda se um PDF ou o modelo mudar."""
    base = "\n".join(sorted(f["sha256"] for f in fontes)) + "\n" + modelo
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def janelas_pos(t: str, n: int = config.JANELA_PALAVRAS, passo: int = config.PASSO_PALAVRAS) -> list[tuple[int, int]]:
    """(início, fim) em caracteres de cada janela de n palavras, de `passo` em `passo`, cobrindo o texto."""
    ps = [(m.start(), m.end()) for m in re.finditer(r"\S+", t)]
    if not ps:
        return [(0, 0)]
    if len(ps) <= n:
        return [(ps[0][0], ps[-1][1])]
    inicios = list(range(0, len(ps) - n + 1, passo))
    if (len(ps) - n) % passo:
        inicios.append(len(ps) - n)
    return [(ps[i][0], ps[i + n - 1][1]) for i in inicios]


def janelas(t: str, n: int = config.JANELA_PALAVRAS, passo: int = config.PASSO_PALAVRAS) -> list[str]:
    return [" ".join(t[a:b].split()) for a, b in janelas_pos(t, n, passo)]


class Indice:
    def __init__(self, chunks: list[dict], vetores: np.ndarray, dono: np.ndarray, embeddings: Embeddings, versao: str):
        self.chunks, self.vetores, self.dono, self.embeddings, self.versao = chunks, vetores, dono, embeddings, versao
        self.pos = [p for c in chunks for p in janelas_pos(c["texto"])]  # mesma ordem de `vetores`
        self._janelas_do_chunk: dict[int, list[int]] = {}
        for j, i in enumerate(self.dono.tolist()):
            self._janelas_do_chunk.setdefault(i, []).append(j)
        self._bm25: dict[str, tuple[BM25Okapi, list[int]]] = {}
        for cid in {c["candidato"] for c in chunks}:
            ids = [i for i, c in enumerate(chunks) if c["candidato"] == cid]
            self._bm25[cid] = (BM25Okapi([texto.termos(chunks[i]["texto"]) or ["_"] for i in ids]), ids)

    @classmethod
    def construir(cls, chunks: list[dict], embeddings: Embeddings, versao: str) -> "Indice":
        textos, dono = [], []
        for i, c in enumerate(chunks):
            for j in janelas(c["texto"]):
                textos.append(j)
                dono.append(i)
        return cls(chunks, embeddings(textos), np.array(dono), embeddings, versao)

    @classmethod
    def carregar_ou_construir(cls, chunks: list[dict], embeddings: Embeddings, versao: str,
                              pasta: Path = config.INDICE) -> "Indice":
        arq = pasta / f"{versao}.npz"
        if arq.exists():
            d = np.load(arq)
            if int(d["n_chunks"]) == len(chunks):
                return cls(chunks, d["vetores"], d["dono"], embeddings, versao)
        ind = cls.construir(chunks, embeddings, versao)
        pasta.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(arq, vetores=ind.vetores, dono=ind.dono, n_chunks=np.array(len(chunks)))
        return ind

    def _rank_bm25(self, pergunta: str, cid: str) -> list[int]:
        bm25, ids = self._bm25[cid]
        notas = bm25.get_scores(texto.termos(pergunta) or ["_"])
        return [ids[k] for k in np.argsort(-notas, kind="stable") if notas[k] > 0]

    def _rank_vetorial(self, vetor_pergunta: np.ndarray, cid: str) -> list[int]:
        sims = self.vetores @ vetor_pergunta
        melhor: dict[int, float] = {}
        for s, i in zip(sims.tolist(), self.dono.tolist()):
            if self.chunks[i]["candidato"] == cid and s > melhor.get(i, -2.0):
                melhor[i] = s
        return sorted(melhor, key=lambda i: (-melhor[i], i))

    def recortes(self, chunk: dict, vetor_pergunta: np.ndarray, n: int = config.JANELAS_POR_TRECHO) -> list[dict]:
        """As n janelas do chunk mais próximas da pergunta, juntas quando se sobrepõem, na ordem do
        texto. Cada recorte tem `texto`, `pagina` (a do início) e `viradas` relativas ao recorte, que é
        o que `chunk.texto_marcado` e a correção de página do pipeline esperam."""
        i = self.chunks.index(chunk)
        js = self._janelas_do_chunk[i]
        melhores = sorted(js, key=lambda j: (-float(self.vetores[j] @ vetor_pergunta), j))[:n]
        faixas: list[list[int]] = []
        for a, b in sorted(self.pos[j] for j in melhores):
            if faixas and a <= faixas[-1][1] + 1:
                faixas[-1][1] = max(faixas[-1][1], b)
            else:
                faixas.append([a, b])
        viradas = chunk.get("viradas") or [[0, chunk["pagina"]]]
        saida = []
        for a, b in faixas:
            pag = max((v for v in viradas if v[0] <= a), key=lambda v: v[0])[1]
            dentro = [[v[0] - a, v[1]] for v in viradas if a < v[0] < b]
            saida.append({"texto": chunk["texto"][a:b], "pagina": pag, "viradas": [[0, pag]] + dentro,
                          "paginas": [pag] + [v[1] for v in dentro], "candidato": chunk["candidato"]})
        return saida

    def buscar(self, pergunta: str, cid: str, k: int = config.TRECHOS_POR_PLANO,
               vetor_pergunta: np.ndarray | None = None) -> list[dict]:
        """Os k chunks do candidato mais relevantes para a pergunta (RRF de BM25 e vetorial)."""
        v = vetor_pergunta if vetor_pergunta is not None else self.embeddings([pergunta])[0]
        nota: dict[int, float] = {}
        for peso, lista in ((PESO_BM25, self._rank_bm25(pergunta, cid)), (PESO_VETORIAL, self._rank_vetorial(v, cid))):
            for pos, i in enumerate(lista):
                nota[i] = nota.get(i, 0.0) + peso / (RRF_K + pos + 1)
        return [self.chunks[i] for i in sorted(nota, key=lambda i: (-nota[i], i))[:k]]


def carregar_chunks(arquivo: Path = config.DADOS / "chunks" / "chunks.json") -> list[dict]:
    return json.loads(arquivo.read_text(encoding="utf-8"))
