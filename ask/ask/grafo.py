"""Grafo LangGraph do /ask (plano-final §11): recuperar → gerar (um por candidato, em paralelo) → montar.

Guardas da montagem, todas determinísticas, sobre o que o modelo devolveu:
- a página de cada citação é corrigida pela faixa do chunk enviado, como no pipeline (`_corrigir_paginas`);
- toda citação ocorre literalmente na página citada do PDF do próprio candidato (`rag_planos.literal`);
- o trecho é saneado antes: hífen não separável vira hífen, "..." divide o trecho em citações
  separadas (cada parte conferida) e trecho longo é cortado em 280 caracteres no último espaço;
- se o trecho não está na página citada, a página passa à faixa do recorte (como no pipeline) ou à
  única página do PDF em que ele aparece; trecho em mais de uma página não é corrigido;
- número, sigla ou nome próprio do texto do bullet está nos trechos que ele cita (`nomes_sem_base`);
- o texto adere aos trechos que cita (`texto.aderencia` ≥ LIMIAR_ADERENCIA): frase que não vem do
  plano, inclusive a que uma injeção na pergunta tentar, sai;
- no máximo 4 bullets de até 300 caracteres, 1 a 3 citações de até 280.
Se um dos dois candidatos ficar sem resposta do modelo, os dois vão para o modo extrativo (os 3 trechos
mais relevantes de cada plano): os dois lados sempre têm o mesmo tipo de resposta.

A resposta leva também `contexto` (a pergunta como foi processada, os termos da busca por palavra e os
recortes de cada plano que foram ao modelo, com página) e `modelos` (quem gerou), para o site mostrar
de onde veio cada resposta.
"""
from __future__ import annotations

import re
import time
from typing import Annotated, Any, Callable, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from rag_planos import chunk as pchunk
from rag_planos import config as cp
from rag_planos import extrair
from rag_planos.grafos import _corrigir_paginas, _juntar, _literal
from rag_planos.literal import normalizar, trecho_na_pagina

from . import config, texto
from .indice import Indice
from .provedores import Cadeia, SemProvedor

# Calibrado em 18/10/2026: nos 173 bullets verificados do site o menor valor é 0,67; paráfrases
# legítimas do gpt-oss ficaram entre 0,45 e 0,57; frases de injeção, 0,0. Número e nome inventados
# saem antes, por `nomes_sem_base`, então a aderência só precisa barrar frase alheia aos trechos.
LIMIAR_ADERENCIA = 0.4
_HIFENS = str.maketrans({"‐": "-", "‑": "-", " ": " "})


def prompt(pergunta: str, arquivo: str, trechos: list[dict]) -> str:
    """pergunta.md preenchido. A pergunta entra por último e sem `<`, `>`, `{{` e `}}`, para não
    fechar o delimitador nem abrir outro campo."""
    from pathlib import Path
    modelo = (Path(__file__).parent / "prompts" / "pergunta.md").read_text(encoding="utf-8")
    limpa = pergunta.replace("<", "‹").replace(">", "›").replace("{", "(").replace("}", ")")
    return (modelo.replace("{{arquivo}}", arquivo)
            .replace("{{trechos}}", "\n\n".join(pchunk.texto_marcado(c) for c in trechos))
            .replace("{{pergunta}}", limpa))


def _citacao_ok(ci: Any, arquivo: str) -> bool:
    return (isinstance(ci, dict) and ci.get("arquivo") == arquivo and isinstance(ci.get("trecho"), str)
            and 0 < len(ci["trecho"]) <= cp.TAMANHO_MAX_TRECHO)


def _sanear(citacoes: list) -> list:
    """Hífen não separável vira hífen; "..." ou "…" divide o trecho em partes de 20+ caracteres; parte
    acima de 280 caracteres é cortada no último espaço (o começo de um trecho literal também é literal)."""
    saida: list = []
    for ci in citacoes:
        if not isinstance(ci, dict) or not isinstance(ci.get("trecho"), str):
            saida.append(ci)
            continue
        t = ci["trecho"].translate(_HIFENS)
        partes = [p.strip() for p in re.split(r"\s*(?:\.\.\.|…)\s*", t)]
        partes = [p for p in partes if len(p) >= 20] if len(partes) > 1 else [t.strip()]
        for p in partes:
            nova = {**ci, "trecho": _cortar(p)}
            if nova not in saida:
                saida.append(nova)
    return saida


def _pagina_unica(trecho: str, arquivo: str, paginas: dict) -> int | None:
    """Página do PDF do candidato em que o trecho aparece, se aparece numa só."""
    achadas = [i + 1 for i, p in enumerate(paginas.get(arquivo, [])) if trecho_na_pagina(trecho, p["texto"] or "")]
    return achadas[0] if len(achadas) == 1 else None


def _corrigir_pelo_pdf(b: dict, arquivo: str, paginas: dict) -> dict:
    """Citação que não está na página citada passa à página única do PDF em que o trecho está (o
    modelo errou o número; o trecho é o mesmo). Sem página única, fica como está e cai na checagem."""
    cits = []
    for ci in b["citacoes"]:
        pagina = ci.get("pagina")
        texto_pag = extrair.texto_da_pagina(paginas, arquivo, pagina) if isinstance(pagina, int) else None
        if not trecho_na_pagina(ci["trecho"], texto_pag or ""):
            unica = _pagina_unica(ci["trecho"], arquivo, paginas)
            if unica:
                ci = {**ci, "pagina": unica}
        cits.append(ci)
    return {**b, "citacoes": cits}


def filtrar(resposta: Any, cid: str, enviados: list[dict], paginas: dict) -> list[dict]:
    """Bullets da resposta do modelo que passam em todas as guardas, no formato do contrato."""
    arquivo = cp.CANDIDATOS[cid]["arquivo"]
    bullets = resposta.get("resumo") if isinstance(resposta, dict) else None
    saida: list[dict] = []
    for b in bullets if isinstance(bullets, list) else []:
        if len(saida) == config.MAX_BULLETS:
            break
        if not isinstance(b, dict) or not isinstance(b.get("texto"), str) or not isinstance(b.get("citacoes"), list):
            continue
        t = " ".join(b["texto"].translate(_HIFENS).split())
        b = {**b, "citacoes": _sanear(b["citacoes"])}
        if not 0 < len(t) <= config.MAX_TEXTO or not 1 <= len(b["citacoes"]) <= 3:
            continue
        if not all(_citacao_ok(ci, arquivo) for ci in b["citacoes"]):
            continue
        b, _ = _corrigir_paginas(b, arquivo, [{"texto": c["texto"], "viradas": c.get("viradas"), "pagina": c["pagina"]}
                                               for c in enviados], paginas)
        b = _corrigir_pelo_pdf(b, arquivo, paginas)
        if not _literal(b, paginas):
            continue
        cits = [{"arquivo": ci["arquivo"], "pagina": ci["pagina"], "trecho": ci["trecho"]} for ci in b["citacoes"]]
        trechos = [ci["trecho"] for ci in cits]
        if texto.nomes_sem_base(t, trechos) or texto.aderencia(t, trechos) < LIMIAR_ADERENCIA:
            continue
        if any(t == x["texto"] for x in saida):
            continue
        saida.append({"texto": t, "citacoes": cits})
    return saida


# --- modo extrativo ---------------------------------------------------------------------------

def _frases_por_pagina(c: dict) -> list[tuple[int, str]]:
    viradas = c.get("viradas") or [[0, c["pagina"]]]
    saida = []
    for i, (inicio, pag) in enumerate(viradas):
        fim = viradas[i + 1][0] if i + 1 < len(viradas) else len(c["texto"])
        for f in re.split(r"(?<=[.;!?])\s+", c["texto"][inicio:fim]):
            f = f.strip()
            if len(f) >= 40:
                saida.append((pag, f))
    return saida


def _cortar(frase: str) -> str:
    if len(frase) <= cp.TAMANHO_MAX_TRECHO:
        return frase
    corte = frase[: cp.TAMANHO_MAX_TRECHO]
    return corte[: corte.rfind(" ")].rstrip(" ,;:") if " " in corte else corte


def extrativo(pergunta: str, cid: str, recuperados: list[dict], paginas: dict) -> list[dict]:
    """Os 3 trechos mais relevantes do plano, sem modelo: das frases dos chunks recuperados, as que
    têm mais termos da pergunta, uma por chunk, literais na página delas. O texto do bullet é o próprio
    trecho. A frase precisa de 2 termos distintos da pergunta (ou do único, se ela tiver só um): no
    ouro, isso custa 1 página em 54 e deixa sem trecho 13 de 18 perguntas fora dos planos, contra 3
    de 18 com um termo só (18/10/2026). Sem modelo não há como decidir "fora dos planos" com
    segurança: a similaridade semântica não separa ("Quem descobriu o Brasil?" bate 0,63)."""
    arquivo = cp.CANDIDATOS[cid]["arquivo"]
    alvo = set(texto.termos(pergunta))
    exigido = max(1, min(2, len(alvo)))
    candidatas = []
    for rank, c in enumerate(recuperados):
        for pos, (pag, f) in enumerate(_frases_por_pagina(c)):
            nota = len(alvo & set(texto.termos(f)))
            if nota >= exigido:
                candidatas.append((-nota, rank, pos, pag, f))
    saida: list[dict] = []
    usados: set[int] = set()
    vistos: set[str] = set()  # chunks vizinhos se sobrepõem em 15%: a mesma frase pode vir de dois
    for _, rank, _, pag, f in sorted(candidatas):
        trecho = _cortar(normalizar(f))
        if rank in usados or trecho in vistos:
            continue
        if trecho_na_pagina(trecho, extrair.texto_da_pagina(paginas, arquivo, pag) or ""):
            vistos.add(trecho)
            saida.append({"texto": trecho, "citacoes": [{"arquivo": arquivo, "pagina": pag, "trecho": trecho}]})
            usados.add(rank)
            if len(saida) == config.TRECHOS_EXTRATIVO:
                break
    return saida


# --- grafo ------------------------------------------------------------------------------------

def contexto(pergunta: str, recortes: dict | None = None) -> dict:
    """O que o site mostra como contexto: a pergunta processada, os termos e os recortes por plano."""
    return {
        "pergunta": pergunta,
        "termos": texto.termos_legiveis(pergunta),
        "trechos": {cid: [{"arquivo": cp.CANDIDATOS[cid]["arquivo"], "pagina": r["pagina"], "paginas": r["paginas"],
                           "viradas": r["viradas"], "texto": r["texto"]} for r in (recortes or {}).get(cid, [])]
                    for cid in cp.CANDIDATOS},
    }


class Estado(TypedDict, total=False):
    pergunta: str
    prazo: float           # instante (relógio da cadeia) até o qual vale chamar modelo
    trechos: dict          # candidato -> chunks recuperados (o extrativo usa estes)
    recortes: dict         # candidato -> recortes desses chunks (vão ao modelo)
    brutos: Annotated[dict, _juntar]  # candidato -> {"dados", "provedor"} ou {"falhou": True}
    resposta: dict
    provedores: list


def montar_grafo(indice: Indice, cadeia: Cadeia, paginas: dict):
    candidatos = list(cp.CANDIDATOS)

    def recuperar(s: Estado):
        v = indice.embeddings([s["pergunta"]])[0]
        trechos = {cid: indice.buscar(s["pergunta"], cid, vetor_pergunta=v) for cid in candidatos}
        return {"trechos": trechos,
                "recortes": {cid: [r for c in trechos[cid] for r in indice.recortes(c, v)] for cid in candidatos}}

    def distribuir(s: Estado):
        return [Send("gerar", {"cid": cid, "pergunta": s["pergunta"], "prazo": s["prazo"],
                               "trechos": s["recortes"][cid]}) for cid in candidatos]

    def gerar(e: dict):
        arquivo = cp.CANDIDATOS[e["cid"]]["arquivo"]
        try:
            dados, provedor = cadeia.json(prompt(e["pergunta"], arquivo, e["trechos"]), e["prazo"])
        except SemProvedor:
            return {"brutos": {e["cid"]: {"falhou": True}}}
        return {"brutos": {e["cid"]: {"dados": dados, "provedor": provedor}}}

    def montar(s: Estado):
        brutos = s.get("brutos", {})
        if any(cid not in brutos or brutos[cid].get("falhou") for cid in candidatos):
            areas = {cid: extrativo(s["pergunta"], cid, s["trechos"][cid], paginas) for cid in candidatos}
            origem, provedores = "extrativo", []
        else:
            areas = {cid: filtrar(brutos[cid]["dados"], cid, s["recortes"][cid], paginas) for cid in candidatos}
            origem, provedores = "gerado", sorted({brutos[cid]["provedor"] for cid in candidatos})
        resposta = {"origem": origem, "camada": "plano",
                    "candidatos": {cid: {"nao_encontrado": not areas[cid], "resumo": areas[cid]} for cid in candidatos},
                    "modelos": provedores, "contexto": contexto(s["pergunta"], s["recortes"])}
        if all(not areas[cid] for cid in candidatos):
            resposta.update(recusada=True, motivo="fora_dos_planos")
        return {"resposta": resposta, "provedores": provedores}

    g = StateGraph(Estado)
    g.add_node("recuperar", recuperar)
    g.add_node("gerar", gerar)
    g.add_node("montar", montar)
    g.add_edge(START, "recuperar")
    g.add_conditional_edges("recuperar", distribuir, ["gerar"])
    g.add_edge("gerar", "montar")
    g.add_edge("montar", END)
    return g.compile()


def responder(grafo, pergunta: str, prazo: float) -> tuple[dict, list[str]]:
    s = grafo.invoke({"pergunta": pergunta, "prazo": prazo}, {"max_concurrency": 2})
    return s["resposta"], s.get("provedores", [])


def prazo_padrao(relogio: Callable[[], float] = time.monotonic) -> float:
    return relogio() + config.ORCAMENTO_S
