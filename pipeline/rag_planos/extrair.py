"""Texto do corpo por página, com secao (diretriz/eixo) e subsecoes (AC 1).

Regras de seção (Landing):
- Lula: faixas de página do índice da pág. 3; páginas antes da 1ª entrada usam o maior título da página.
- Flávio: títulos em Montserrat-Bold 16,6 pt abrem um eixo; Montserrat-Bold 12,1 pt são subseções.
Fora do corpo: o número de página e o cabeçalho vertical "PROGRAMA DE GOVERNO" (Transducer-Bold 10 pt).
Páginas de índice/sumário não viram chunk (`indice: true`).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pymupdf

from . import config

LULA = "Programa-Governo-LULA-2026.pdf"
FLAVIO = "plano-de-governo_flavio.pdf"


def _linhas(pagina):
    for b in pagina.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            yield l["spans"]


def _eh_ruido(span, numero: int) -> bool:
    if span["text"].strip() == str(numero):
        return True
    return span["font"].startswith("Transducer-Bold") and round(span["size"], 1) == 10.0


def texto_corpo(pagina) -> str:
    numero = pagina.number + 1
    linhas = []
    for spans in _linhas(pagina):
        t = "".join(s["text"] for s in spans if not _eh_ruido(s, numero))
        if t.strip():
            linhas.append(t.rstrip())
    return "\n".join(linhas)


def indice_lula(doc) -> list[tuple[int, str]]:
    """Entradas (pagina_inicial, titulo) do índice da pág. 3, na ordem do documento."""
    bruto = " ".join(doc[2].get_text().split())
    bruto = re.sub(r"^\d+\s+", "", bruto)
    return [(int(m.group(2)), m.group(1).strip())
            for m in re.finditer(r"(.+?)\s*\.{4,}\s*(\d+)", bruto)]


def _titulo_maior(pagina) -> str:
    tam = max((s["size"] for spans in _linhas(pagina) for s in spans if s["text"].strip()), default=0)
    if not tam:
        return ""
    partes = ["".join(s["text"] for s in spans if abs(s["size"] - tam) < 0.05).strip()
              for spans in _linhas(pagina)]
    return " ".join(" ".join(p for p in partes if p).split())


def paginas_lula(doc) -> list[dict]:
    entradas = indice_lula(doc)
    primeira = min(p for p, _ in entradas)
    saida = []
    for pagina in doc:
        n = pagina.number + 1
        texto = texto_corpo(pagina)
        if n < primeira:
            secao = _titulo_maior(pagina) if texto.strip() else ""
        else:
            secao = [t for p, t in entradas if p <= n][-1]
        saida.append({"pagina": n, "texto": texto, "secao": secao, "subsecoes": [], "indice": n == 3})
    return saida


def _cabecalhos(pagina, tamanho: float):
    for spans in _linhas(pagina):
        t = "".join(s["text"] for s in spans
                    if s["font"] == "Montserrat-Bold" and abs(s["size"] - tamanho) < 0.15).strip()
        if t:
            yield " ".join(t.split())


def paginas_flavio(doc) -> list[dict]:
    saida, secao = [], ""
    for pagina in doc:
        n = pagina.number + 1
        eixos = list(_cabecalhos(pagina, 16.6))
        if eixos:
            secao = eixos[0]
        indice = secao.upper() in {"SUMÁRIO", "ÍNDICE TEMÁTICO"}
        saida.append({"pagina": n, "texto": texto_corpo(pagina), "secao": secao,
                      "subsecoes": list(_cabecalhos(pagina, 12.1)), "indice": indice})
    return saida


def extrair(corpus: Path = config.CORPUS) -> dict[str, list[dict]]:
    return {
        LULA: paginas_lula(pymupdf.open(corpus / LULA)),
        FLAVIO: paginas_flavio(pymupdf.open(corpus / FLAVIO)),
    }


def gravar(paginas: dict[str, list[dict]], destino: Path = config.DADOS / "paginas") -> None:
    destino.mkdir(parents=True, exist_ok=True)
    for arquivo, lista in paginas.items():
        (destino / (arquivo + ".json")).write_text(json.dumps(lista, ensure_ascii=False, indent=1),
                                                   encoding="utf-8")


def carregar(origem: Path = config.DADOS / "paginas") -> dict[str, list[dict]]:
    return {arq: json.loads((origem / (arq + ".json")).read_text(encoding="utf-8"))
            for arq in config.ARQUIVO_PARA_CANDIDATO}


def texto_da_pagina(paginas: dict[str, list[dict]], arquivo: str, pagina: int) -> str | None:
    lista = paginas.get(arquivo)
    if not lista or not 1 <= pagina <= len(lista):
        return None
    return lista[pagina - 1]["texto"]
