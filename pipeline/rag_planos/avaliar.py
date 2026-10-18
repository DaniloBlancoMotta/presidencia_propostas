"""Conjunto-ouro e avaliação (AC 14, AC 15).

`montar_ouro` monta dados/ouro/conjunto-ouro.yaml a partir das buscas de cada rascunho: um item
só entra se o trecho que o comprova ocorre literalmente na página indicada. Itens não achados no
plano ficam em `nao_encontrados`, para o dono conferir.

`avaliar` lê o conjunto-ouro e os JSONs publicados e sai com código != 0 se, para algum tema e
candidato, menos de 90% das páginas do ouro estão entre as citadas, se o ouro tiver menos de 30
itens, ou se faltar uma das 7 convergências da §11.2 na visão Semelhanças.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

from . import config, extrair
from .literal import trecho_na_pagina

RECALL_MINIMO = 0.9
MINIMO_ITENS = 30

# §11.2 da especificação: as 7 convergências e o theme_id de cada uma (plano-final §5).
CONVERGENCIAS = [
    ("digitalizacao-servicos-publicos", "digitalização dos serviços públicos", "tecnologia-ia"),
    ("prontuario-eletronico-unico", "prontuário eletrônico único", "saude"),
    ("filas-do-sus", "redução das filas do SUS", "saude"),
    ("ensino-integral", "ensino integral", "educacao"),
    ("meio-ambiente", "infraestrutura hídrica, desmatamento e instrumentos econômicos de conservação",
     "meio-ambiente"),
    ("fertilizantes", "fertilizantes importados", "agronegocio"),
    ("regularizacao-fundiaria", "regularização fundiária", "agronegocio"),
]


def montar_ouro(temas: list[dict], paginas: dict, pasta: Path = config.DADOS / "rascunhos") -> dict:
    itens, nao_encontrados, convergencias = [], [], []
    for tema in temas:
        arq = pasta / f"{tema['id']}.json"
        if not arq.exists():
            continue
        r = json.loads(arq.read_text(encoding="utf-8"))
        for g in r.get("ouro", []):
            cand = g.get("candidato")
            base = {"theme_id": tema["id"], "candidato": cand, "descricao": g.get("descricao")}
            pag, trecho = g.get("pagina"), g.get("trecho")
            arquivo = config.CANDIDATOS.get(cand, {}).get("arquivo")
            texto = extrair.texto_da_pagina(paginas, arquivo, int(pag)) if (arquivo and pag) else None
            if pag and trecho and texto and trecho_na_pagina(trecho, texto):
                itens.append({**base, "pagina": int(pag), "trecho": trecho})
            else:
                motivo = "não localizado no plano" if not pag else "trecho não confere com a página"
                nao_encontrados.append({**base, "motivo": motivo})
        for c in r.get("convergencias", []):
            idx = c.get("indice_semelhanca")
            if idx is None or not 0 <= idx < len(r.get("semelhancas", [])):
                continue
            item = r["semelhancas"][idx]
            convergencias.append({
                "id": c["id"], "theme_id": tema["id"],
                "paginas": {cid: sorted({ci["pagina"] for ci in item["citacoes"].get(cid, [])})
                            for cid in config.CANDIDATOS},
            })
    return {"itens": itens, "nao_encontrados": nao_encontrados, "convergencias": convergencias}


def paginas_citadas(comparacao: dict, candidato: str) -> set[int]:
    pags = {ci["pagina"] for b in comparacao["candidatos"][candidato]["resumo"] for ci in b["citacoes"]}
    for lista in ("semelhancas", "diferencas"):
        for item in comparacao[lista]:
            pags |= {ci["pagina"] for ci in item["citacoes"].get(candidato, [])}
    for item in comparacao["omissoes"]:
        if item["tratado_por"] == candidato:
            pags |= {ci["pagina"] for ci in item["citacoes"]}
    return pags


def avaliar(ouro: dict, comparacoes: dict[str, dict]) -> tuple[bool, list[str]]:
    linhas, ok = [], True
    itens = ouro.get("itens", [])
    if len(itens) < MINIMO_ITENS:
        ok = False
        linhas.append(f"FALHA: conjunto-ouro com {len(itens)} itens (mínimo {MINIMO_ITENS})")
    grupos: dict[tuple[str, str], list[dict]] = {}
    for it in itens:
        grupos.setdefault((it["theme_id"], it["candidato"]), []).append(it)
    for (tid, cand), lista in sorted(grupos.items()):
        comp = comparacoes.get(tid)
        citadas = paginas_citadas(comp, cand) if comp else set()
        faltam = [it for it in lista if it["pagina"] not in citadas]
        fracao = 1 - len(faltam) / len(lista)
        status = "ok" if fracao >= RECALL_MINIMO else "FALHA"
        if status == "FALHA":
            ok = False
        linhas.append(f"{status}: {tid} / {cand}: {fracao:.0%} ({len(lista) - len(faltam)}/{len(lista)})"
                      + ("" if comp else " [tema sem JSON]"))
        for it in faltam:
            linhas.append(f"    faltou: {it['descricao']} (pág. {it['pagina']})")
    convs = {c["id"]: c for c in ouro.get("convergencias", [])}
    for cid, desc, tid in CONVERGENCIAS:
        c = convs.get(cid)
        comp = comparacoes.get(tid)
        achou = False
        if c and comp:
            for item in comp["semelhancas"]:
                pl = {ci["pagina"] for ci in item["citacoes"]["lula"]}
                pf = {ci["pagina"] for ci in item["citacoes"]["flavio-bolsonaro"]}
                if pl & set(c["paginas"]["lula"]) and pf & set(c["paginas"]["flavio-bolsonaro"]):
                    achou = True
                    break
        if not achou:
            ok = False
        motivo = "" if achou else (" [sem referência no conjunto-ouro]" if not c else " [não está em Semelhanças]")
        linhas.append(f"{'ok' if achou else 'FALHA'}: convergência {desc} ({tid}){motivo}")
    return ok, linhas


def principal(caminho_ouro: Path = config.DADOS / "ouro" / "conjunto-ouro.yaml",
              pasta: Path = config.DADOS / "comparacoes") -> int:
    ouro = yaml.safe_load(caminho_ouro.read_text(encoding="utf-8"))
    comparacoes = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(pasta.glob("*.json"))}
    ok, linhas = avaliar(ouro, comparacoes)
    print("\n".join(linhas))
    print("RESULTADO:", "aprovado" if ok else "reprovado", file=sys.stderr)
    return 0 if ok else 1
