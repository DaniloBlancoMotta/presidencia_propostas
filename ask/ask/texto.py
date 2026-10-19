"""Palavras, radicais e aderência: o vocabulário comum à busca, à triagem e às guardas."""
from __future__ import annotations

import re
import unicodedata

PARADAS = frozenset("""
a o as os um uma uns umas de da do das dos dum duma e em no na nos nas num numa para pra pro por pelo pela
pelos pelas com sem sob sobre que qual quais quem como onde quando se ao aos ou mas nem ja tambem mais menos
muito muita muitos muitas pouco seu sua seus suas meu minha nosso nossa nossos nossas esse essa esses essas
este esta estes estas isso isto aquele aquela aquilo ele ela eles elas lhe lhes nao sim ser sao foi era sera
seria tem ter tera ha havera vai vao fazer faz fazem cada entre ate apos desde contra todo toda todos todas
outro outra outros outras mesmo mesma proprio propria plano planos governo candidato candidatos candidata
propoe propoem propostas proposta preve diz dizem fala falam
""".split())


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def palavras(s: str) -> list[str]:
    """Palavras sem acento e em minúsculas."""
    return [p for p in re.split(r"[^a-z0-9]+", sem_acento(s)) if p]


def radical(p: str) -> str:
    """Sem o "s" final e cortado em 6 letras: junta plural e flexões do português ("filas" e "fila",
    "ampliar" e "ampliação") sem dicionário."""
    if len(p) > 3 and p.endswith("s"):
        p = p[:-1]
    return p[:6]


def termos_legiveis(s: str) -> list[str]:
    """As palavras de conteúdo da pergunta como entram na busca (sem acento), sem repetição."""
    vistos: list[str] = []
    for p in palavras(s):
        if p not in PARADAS and len(p) >= 2 and p not in vistos:
            vistos.append(p)
    return vistos


def termos(s: str) -> list[str]:
    """Radicais das palavras de conteúdo (fora das paradas, 2+ letras), na ordem do texto."""
    return [radical(p) for p in palavras(s) if p not in PARADAS and len(p) >= 2]


_LIGACOES = frozenset("de da do das dos e em a o".split())


def nomes_sem_base(texto: str, trechos: list[str]) -> list[str]:
    """Números, siglas e nomes próprios do texto que não aparecem nos trechos citados. Uma sigla vale
    se for as iniciais de palavras seguidas do trecho ("IA", "MCMV", "RNDS"). É a guarda contra número,
    nome ou código inventado, inclusive o que uma injeção na pergunta pedir para escrever."""
    base = palavras(" ".join(trechos))
    conhecidas = set(base)
    seq = [p for p in base if p not in _LIGACOES]
    iniciais = {"".join(w[0] for w in seq[i:i + n]) for n in range(2, 7) for i in range(len(seq) - n + 1)}
    tokens = re.findall(r"[\wÀ-ÿ][\wÀ-ÿ.-]*", texto)
    fora = []
    for k, bruto in enumerate(tokens):
        w = bruto.strip(".-")
        if not w:
            continue
        numero = any(c.isdigit() for c in w)
        sigla = len(w) >= 2 and w.isupper()
        proprio = k > 0 and w[0].isupper() and not tokens[k - 1].endswith(".")
        if not (numero or sigla or proprio):
            continue
        if all(x in conhecidas for x in palavras(w)) or (sigla and sem_acento(w) in iniciais):
            continue
        fora.append(w)
    return fora


def aderencia(texto: str, trechos: list[str]) -> float:
    """Fração das palavras de conteúdo (4+ letras) do texto cujo radical aparece nos trechos citados.
    Barra frase do modelo que não vem dos trechos (inclusive a que uma injeção na pergunta tentar)."""
    conteudo = {radical(p) for p in palavras(texto) if p not in PARADAS and len(p) >= 4}
    if not conteudo:
        return 0.0
    base = {radical(p) for t in trechos for p in palavras(t)}
    return len(conteudo & base) / len(conteudo)
