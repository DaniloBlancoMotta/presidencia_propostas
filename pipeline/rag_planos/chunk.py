"""Chunks de 400-800 tokens, sobreposição de 15%, sem cruzar `secao` (AC 4).

Token = `\\w+` ou um caractere de pontuação (Landing). O texto do chunk é normalizado por
`literal.normalizar`; as citações são conferidas contra a página, nunca contra o chunk.
`viradas` guarda onde cada página começa no texto do chunk (`texto_marcado` vai no prompt).
"""
from __future__ import annotations

import math
import re

from .literal import normalizar

_TOKEN = re.compile(r"\w+|[^\w\s]")
MIN, MAX, SOBREPOSICAO = 400, 800, 0.15
_ALVO_MAX = 780  # margem para o ajuste à fronteira de palavra


def contar_tokens(texto: str) -> int:
    return len(_TOKEN.findall(texto))


def janelas(total: int) -> list[tuple[float, float]]:
    """Intervalos [inicio, fim) em tokens para uma seção de `total` tokens."""
    if total <= MAX:
        return [(0.0, float(total))]
    n = math.ceil((total - SOBREPOSICAO * _ALVO_MAX) / ((1 - SOBREPOSICAO) * _ALVO_MAX))
    tamanho = total / (n - SOBREPOSICAO * (n - 1))
    passo = tamanho * (1 - SOBREPOSICAO)
    return [(i * passo, min(float(total), i * passo + tamanho)) for i in range(n)]


def cortar_secao(paginas: list[dict]) -> list[dict]:
    """Corta uma seção (lista de páginas consecutivas) em chunks."""
    palavras = [(w, contar_tokens(w), p["pagina"])
                for p in paginas for w in normalizar(p["texto"]).split(" ") if w]
    if not palavras:
        return []
    inicio, pos = [], 0
    for _, t, _ in palavras:
        inicio.append(pos)
        pos += t
    chunks = []
    for ini, fim in janelas(pos):
        idx = [i for i, a in enumerate(inicio) if ini - 0.5 <= a < fim - 0.5]
        if not idx:
            continue
        sel = palavras[idx[0]: idx[-1] + 1]
        viradas, posicao = [], 0
        for j, (w, _, pag) in enumerate(sel):
            if j == 0 or pag != sel[j - 1][2]:
                viradas.append([posicao, pag])
            posicao += len(w) + 1
        chunks.append({
            "texto": " ".join(w for w, _, _ in sel),
            "tokens": sum(t for _, t, _ in sel),
            "pagina": sel[0][2],
            "paginas": sorted({p for _, _, p in sel}),
            "viradas": viradas,
            "inicio_token": inicio[idx[0]],
            "fim_token": inicio[idx[-1]] + sel[-1][1],
        })
    return chunks


def texto_marcado(c: dict) -> str:
    """Texto do chunk com `[página N]` onde cada página começa (`viradas`), para o LLM citar a
    página certa de cada trecho. Chunk sem `viradas` leva um cabeçalho só, como antes."""
    viradas = c.get("viradas")
    if not viradas:
        faixa = f"{c['paginas'][0]}-{c['paginas'][-1]}" if len(c.get("paginas", [])) > 1 else str(c["pagina"])
        return f"[página {faixa}] {c['texto']}"
    partes = []
    for i, (inicio, pag) in enumerate(viradas):
        fim = viradas[i + 1][0] if i + 1 < len(viradas) else len(c["texto"])
        partes.append(f"[página {pag}] {c['texto'][inicio:fim].strip()}")
    return " ".join(partes)


def agrupar_secoes(paginas: list[dict]) -> list[list[dict]]:
    """Páginas consecutivas com a mesma secao; índices e páginas sem texto ficam fora."""
    grupos: list[list[dict]] = []
    for p in paginas:
        if p.get("indice") or not p["texto"].strip() or not p["secao"]:
            continue
        if grupos and grupos[-1][-1]["secao"] == p["secao"] and grupos[-1][-1]["pagina"] == p["pagina"] - 1:
            grupos[-1].append(p)
        else:
            grupos.append([p])
    return grupos


def cortar(paginas: list[dict], candidato: str, partido: str, arquivo: str) -> list[dict]:
    saida = []
    for g in agrupar_secoes(paginas):
        for c in cortar_secao(g):
            subs = [s for p in g if p["pagina"] == c["pagina"] for s in p.get("subsecoes", [])]
            saida.append({
                "id": f"{arquivo}#{c['pagina']}-{c['inicio_token']}",
                "candidato": candidato,
                "partido": partido,
                "arquivo": arquivo,
                "pagina": c["pagina"],
                "paginas": c["paginas"],
                "viradas": c["viradas"],
                "secao": g[0]["secao"],
                "subsecao": subs[0] if subs else None,
                "tokens": c["tokens"],
                "inicio_token": c["inicio_token"],
                "fim_token": c["fim_token"],
                "texto": c["texto"],
                "temas": [],
            })
    return saida
