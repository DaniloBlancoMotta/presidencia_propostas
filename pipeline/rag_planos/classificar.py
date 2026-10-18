"""Classificação multirrótulo dos chunks nos temas (AC 1): palavras-chave + LLM quando houver.

Palavras-chave: cada termo de `palavras_chave` encontrado no chunk (sem acento, minúsculas,
fronteira de palavra) conta um acerto; confiança = min(1, acertos / 4). Com LLM (grafo
`classificar` de grafos.py), a confiança final é o máximo entre as duas fontes.
"""
from __future__ import annotations

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


def interpretar(resposta, temas: list[dict]) -> dict[str, float]:
    """Resposta do classificar.md -> {theme_id: confiança}; tema desconhecido ou fora de (0, 1] sai."""
    ids = {t["id"] for t in temas}
    saida = {}
    for item in resposta if isinstance(resposta, list) else []:
        if not isinstance(item, dict):
            continue
        try:
            conf = float(item.get("confianca", 0))
        except (TypeError, ValueError):
            continue
        if item.get("theme_id") in ids and 0 < conf <= 1:
            saida[item["theme_id"]] = round(conf, 2)
    return saida


def por_llm(textos: list[str], temas: list[dict], gerador: llm.Gerador) -> list[dict[str, float]]:
    """Grafo `classificar` de grafos.py (LangGraph): um pedido por chunk, em paralelo."""
    from . import grafos
    lista = "\n".join(f"- {t['id']}: {t['rotulo']} ({t['descricao']})" for t in temas)
    respostas = grafos.classificar(gerador, [llm.prompt("classificar", temas=lista, chunk=t) for t in textos])
    return [interpretar(r, temas) for r in respostas]


def classificar(chunks: list[dict], temas: list[dict], gerador: llm.Gerador | None = None) -> list[dict]:
    do_llm = por_llm([c["texto"] for c in chunks], temas, gerador) if gerador is not None else [{}] * len(chunks)
    for c, extra in zip(chunks, do_llm):
        pontos = por_palavras_chave(c["texto"], temas)
        for tid, conf in extra.items():
            pontos[tid] = max(conf, pontos.get(tid, 0.0))
        c["temas"] = [{"theme_id": tid, "confianca": conf}
                      for tid, conf in sorted(pontos.items(), key=lambda kv: -kv[1])]
    return chunks
