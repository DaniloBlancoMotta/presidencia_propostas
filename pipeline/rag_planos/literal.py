"""Checagem literal de trechos (AC 6). Único módulo com esta regra; o /ask reusa este."""
import re

_HIFEN_FIM_DE_LINHA = re.compile(r"(\w)-[ \t]*\r?\n\s*(\w)")
_ESPACOS = re.compile(r"\s+")


def normalizar(texto: str) -> str:
    """Remove hífen de fim de linha e colapsa espaços e quebras de linha num espaço só."""
    texto = _HIFEN_FIM_DE_LINHA.sub(r"\1\2", texto)
    return _ESPACOS.sub(" ", texto).strip()


def trecho_na_pagina(trecho: str, texto_pagina: str) -> bool:
    t = normalizar(trecho)
    return bool(t) and t in normalizar(texto_pagina)
