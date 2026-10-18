"""Os três fluxos de LLM do pipeline como grafos LangGraph (decisão 10).

- `comparar`: um resumo por candidato em paralelo (`Send`), filtro literal (que corrige a página
  quando o trecho está em exatamente uma página da faixa enviada) e comparação;
- `juiz`: um veredito por item que passou na checagem literal, em paralelo;
- `classificar`: um pedido por chunk, em paralelo.
Os nós que chamam o modelo têm `RETRY` e passam pelo cache de `llm.Gerador`; a concorrência é
`max_concurrency` (env LLM_CONCORRENCIA, padrão 4). O estado final é montado na ordem de
`config.CANDIDATOS` e das listas, nunca na ordem em que os nós terminam: a mesma entrada produz o
mesmo JSON e, portanto, o mesmo hash de aprovação.
"""
from __future__ import annotations

import copy
import json
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy, Send

from . import config, extrair, llm
from .literal import trecho_na_pagina

LISTAS = ("semelhancas", "diferencas", "omissoes")
RETRY = RetryPolicy(max_attempts=5, initial_interval=2.0, backoff_factor=2.0, max_interval=60.0,
                    jitter=True, retry_on=llm.deve_repetir)


def _juntar(a: dict, b: dict) -> dict:
    return {**a, **b}


def _execucao() -> dict:
    return {"max_concurrency": llm.concorrencia()}


def _rodar(grafo, entrada: dict) -> dict:
    """Invoca o grafo; se o LangGraph trouxer a tarefa cancelada, sobe o erro que a cancelou."""
    try:
        return grafo.invoke(entrada, _execucao())
    except llm.ChamadaCancelada as e:
        original = e.original
    raise original  # fora do except: a cadeia __cause__ do erro original fica intacta


def _dict(x: Any) -> dict:
    return x if isinstance(x, dict) else {}


def _literal(bullet: Any, paginas: dict) -> bool:
    """Toda citação do bullet ocorre literalmente na página citada; citação malformada reprova."""
    if not isinstance(bullet, dict) or not isinstance(bullet.get("citacoes", []), list):
        return False
    for ci in bullet.get("citacoes", []):
        if not isinstance(ci, dict) or not isinstance(ci.get("trecho"), str):
            return False
        pagina = ci.get("pagina")
        if not isinstance(pagina, int) or isinstance(pagina, bool):
            return False
        if not trecho_na_pagina(ci["trecho"], extrair.texto_da_pagina(paginas, ci.get("arquivo"), pagina) or ""):
            return False
    return True


def _corrigir_paginas(bullet: Any, arquivo: str, faixa: list[int], paginas: dict) -> tuple[Any, list[dict]]:
    """Cópia do bullet em que cada citação de `arquivo` com página inteira, cujo trecho não está na
    página citada mas está literalmente em exatamente uma página de `faixa`, passa a citar essa
    página. Devolve (bullet, trocas). Nada é inventado: o trecho é o mesmo, só a página fica certa."""
    if not isinstance(bullet, dict) or not isinstance(bullet.get("citacoes"), list):
        return bullet, []
    novo, trocas = copy.deepcopy(bullet), []
    for ci in novo["citacoes"]:
        if not isinstance(ci, dict) or ci.get("arquivo") != arquivo:
            continue
        trecho, pagina = ci.get("trecho"), ci.get("pagina")
        if not isinstance(trecho, str) or not isinstance(pagina, int) or isinstance(pagina, bool):
            continue
        if trecho_na_pagina(trecho, extrair.texto_da_pagina(paginas, arquivo, pagina) or ""):
            continue
        onde = [n for n in faixa if trecho_na_pagina(trecho, extrair.texto_da_pagina(paginas, arquivo, n) or "")]
        if len(onde) == 1:
            trocas.append({"trecho": trecho, "pagina_citada": pagina, "pagina": onde[0]})
            ci["pagina"] = onde[0]
    return novo, trocas


def _validar_resumo(r: Any) -> None:
    if not isinstance(r, dict) or not isinstance(r.get("resumo"), list):
        raise ValueError("resposta de resumo fora do formato: " + json.dumps(r, ensure_ascii=False)[:120])


def _validar_comparar(r: Any) -> None:
    if not isinstance(r, dict) or not all(isinstance(r.get(k), list) for k in LISTAS):
        raise ValueError("resposta de comparação fora do formato: " + json.dumps(r, ensure_ascii=False)[:120])


# --- comparar --------------------------------------------------------------------------------

class EstadoComparar(TypedDict, total=False):
    tema: dict
    pedidos: dict          # candidato -> {"prompt", "paginas" (faixa)}; só quem tem trechos no tema
    paginas: dict
    brutos: Annotated[dict, _juntar]
    candidatos: dict
    correcoes: list
    listas: dict


def montar_comparar(gerador: llm.Gerador, retry: RetryPolicy = RETRY):
    def distribuir(s: EstadoComparar):
        return [Send("resumo", {"cid": cid, "prompt": p["prompt"]})
                for cid, p in s["pedidos"].items()] or ["filtrar"]

    def resumo(e: dict):
        return {"brutos": {e["cid"]: gerador.json(e["prompt"], "resumo", _validar_resumo)}}

    def filtrar(s: EstadoComparar):
        candidatos, correcoes = {}, []
        for cid, meta in config.CANDIDATOS.items():
            bullets = _dict(s.get("brutos", {}).get(cid)).get("resumo", [])
            faixa = _dict(s["pedidos"].get(cid)).get("paginas", [])
            resumo = []
            for b in bullets if isinstance(bullets, list) else []:
                b, trocas = _corrigir_paginas(b, meta["arquivo"], faixa, s["paginas"])
                if _literal(b, s["paginas"]):
                    resumo.append(b)
                    correcoes += [{"candidato": cid, "texto": b.get("texto", ""), **t} for t in trocas]
            candidatos[cid] = {"nao_encontrado": not resumo, "resumo": resumo}
        return {"candidatos": candidatos, "correcoes": correcoes}

    def comparar(s: EstadoComparar):
        r = _dict(gerador.json(llm.prompt("comparar", rotulo=s["tema"]["rotulo"],
                                          resumos=json.dumps(s["candidatos"], ensure_ascii=False)),
                               "comparar", _validar_comparar))
        return {"listas": {k: r.get(k, []) for k in LISTAS}}

    g = StateGraph(EstadoComparar)
    g.add_node("resumo", resumo, retry_policy=retry)
    g.add_node("filtrar", filtrar)
    g.add_node("comparar", comparar, retry_policy=retry)
    g.add_conditional_edges(START, distribuir, ["resumo", "filtrar"])
    g.add_edge("resumo", "filtrar")
    g.add_edge("filtrar", "comparar")
    g.add_edge("comparar", END)
    return g.compile()


def comparar(gerador: llm.Gerador, tema: dict, pedidos: dict[str, dict], paginas: dict,
             retry: RetryPolicy = RETRY) -> dict:
    s = _rodar(montar_comparar(gerador, retry), {"tema": tema, "pedidos": pedidos, "paginas": paginas})
    return {"candidatos": s["candidatos"], **s["listas"], "correcoes_pagina": s.get("correcoes", [])}


# --- juiz ------------------------------------------------------------------------------------

class EstadoJuiz(TypedDict, total=False):
    itens: list            # saída de verificar.pendentes_para_juiz
    vereditos: Annotated[dict, _juntar]


def _veredito(v: Any) -> dict:
    """Resposta fora de {"sustentado": bool, ...} conta como não sustentada (falha fechada)."""
    if isinstance(v, dict) and isinstance(v.get("sustentado"), bool):
        return v
    return {"sustentado": False,
            "justificativa": "resposta do juiz fora do formato: " + json.dumps(v, ensure_ascii=False)[:120]}


def montar_juiz(gerador: llm.Gerador, retry: RetryPolicy = RETRY):
    def distribuir(s: EstadoJuiz):
        return [Send("julgar", it) for it in s["itens"]] or [END]

    def julgar(it: dict):
        trechos = "\n".join(f"[{c['arquivo']} p.{c['pagina']}] {c['trecho']}" for c in it["trechos"])
        v = gerador.json(llm.prompt("juiz", afirmacao=it["texto"], trechos=trechos), "juiz")
        return {"vereditos": {it["chave"]: _veredito(v)}}

    g = StateGraph(EstadoJuiz)
    g.add_node("julgar", julgar, retry_policy=retry)
    g.add_conditional_edges(START, distribuir, ["julgar", END])
    g.add_edge("julgar", END)
    return g.compile()


def julgar(gerador: llm.Gerador, itens: list[dict], retry: RetryPolicy = RETRY) -> dict[str, dict]:
    if not itens:
        return {}
    return _rodar(montar_juiz(gerador, retry), {"itens": itens}).get("vereditos", {})


# --- classificar -----------------------------------------------------------------------------

class EstadoClassificar(TypedDict, total=False):
    pedidos: list          # [{"i": índice do chunk, "prompt": ...}]
    respostas: Annotated[dict, _juntar]


def montar_classificar(gerador: llm.Gerador, retry: RetryPolicy = RETRY):
    def distribuir(s: EstadoClassificar):
        return [Send("classificar", p) for p in s["pedidos"]] or [END]

    def classificar(p: dict):
        return {"respostas": {p["i"]: gerador.json(p["prompt"], "classificar")}}

    g = StateGraph(EstadoClassificar)
    g.add_node("classificar", classificar, retry_policy=retry)
    g.add_conditional_edges(START, distribuir, ["classificar", END])
    g.add_edge("classificar", END)
    return g.compile()


def classificar(gerador: llm.Gerador, prompts: list[str], retry: RetryPolicy = RETRY) -> list[Any]:
    """Resposta decodificada de cada prompt, na ordem dos prompts."""
    if not prompts:
        return []
    s = _rodar(montar_classificar(gerador, retry), {"pedidos": [{"i": i, "prompt": p} for i, p in enumerate(prompts)]})
    return [s["respostas"][i] for i in range(len(prompts))]
