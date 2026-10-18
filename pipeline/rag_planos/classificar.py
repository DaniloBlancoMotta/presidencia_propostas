"""Classificação multirrótulo dos chunks nos temas (AC 1): palavras-chave + LLM quando houver.

Palavras-chave: cada termo de `palavras_chave` encontrado no chunk (sem acento, minúsculas,
fronteira de palavra) conta um acerto; confiança = min(1, acertos / 4). Com provedor de LLM,
a confiança final é o máximo entre as duas fontes.
"""
from __future__ import annotations

import json
import re
import unicodedata

from . import llm

ACERTOS_PARA_CONFIANCA_MAXIMA = 4


def sem_acento(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def por_palavras_chave(texto: str, temas: list[dict]) -> dict[str, float]:
    alvo = sem_acento(texto)
    saida = {}
    for t in temas:
        acertos = sum(1 for p in t["palavras_chave"]
                      if re.search(r"(?<!\w)" + re.escape(sem_acento(p)) + r"(?!\w)", alvo))
        if acertos:
            saida[t["id"]] = round(min(1.0, acertos / ACERTOS_PARA_CONFIANCA_MAXIMA), 2)
    return saida


def por_llm(texto: str, temas: list[dict], provedor) -> dict[str, float]:
    lista = "\n".join(f"- {t['id']}: {t['rotulo']} ({t['descricao']})" for t in temas)
    resposta = provedor.gerar(llm.prompt("classificar", temas=lista, chunk=texto))
    saida = {}
    for item in json.loads(resposta):
        tid, conf = item.get("theme_id"), float(item.get("confianca", 0))
        if tid in {t["id"] for t in temas} and 0 < conf <= 1:
            saida[tid] = round(conf, 2)
    return saida


def classificar(chunks: list[dict], temas: list[dict], provedor=None) -> list[dict]:
    for c in chunks:
        pontos = por_palavras_chave(c["texto"], temas)
        if provedor is not None:
            for tid, conf in por_llm(c["texto"], temas, provedor).items():
                pontos[tid] = max(conf, pontos.get(tid, 0.0))
        c["temas"] = [{"theme_id": tid, "confianca": conf}
                      for tid, conf in sorted(pontos.items(), key=lambda kv: -kv[1])]
    return chunks
