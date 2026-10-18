"""Verificação automática (AC 5-9): checagem literal + juiz LLM, com motivo de descarte.

Um item sai do JSON quando:
- `trecho_nao_encontrado`: alguma citação não ocorre literalmente na página citada, ou aponta
  para página inexistente, ou passa de 280 caracteres (AC 6, 7);
- `arquivo_errado`: a citação vem do PDF de outro candidato;
- `citacao_insuficiente`: falta a citação mínima da lista (AC 5);
- `nao_sustentado`: o juiz julgou que os trechos não sustentam o texto (AC 8).
Candidato sem bullet restante recebe `nao_encontrado: true` (AC 9).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Callable

import jsonschema
from referencing import Registry, Resource

from . import config, extrair, llm
from .literal import trecho_na_pagina

Juiz = Callable[[str, list[dict], str], "dict | None"]  # (texto, citações, chave do item)
LISTAS_DOIS_LADOS = ("semelhancas", "diferencas")


def chave_item(texto: str, citacoes) -> str:
    return hashlib.sha256(json.dumps([texto, citacoes], ensure_ascii=False, sort_keys=True)
                          .encode("utf-8")).hexdigest()[:16]


def _problema_citacao(ci: dict, candidato: str, paginas: dict) -> str | None:
    if ci.get("arquivo") != config.CANDIDATOS[candidato]["arquivo"]:
        return "arquivo_errado"
    texto = extrair.texto_da_pagina(paginas, ci["arquivo"], int(ci.get("pagina", 0)))
    if texto is None or len(ci.get("trecho", "")) > config.TAMANHO_MAX_TRECHO:
        return "trecho_nao_encontrado"
    if not trecho_na_pagina(ci.get("trecho", ""), texto):
        return "trecho_nao_encontrado"
    return None


def _checar(item: dict, por_candidato: dict[str, list[dict]], paginas: dict,
            juiz: Juiz | None, chave: str) -> tuple[str | None, str, str]:
    """(motivo de descarte ou None, detalhe, estado do juiz)."""
    if item.get("camada") != "plano":
        return "camada_invalida", f"camada={item.get('camada')!r}", "-"
    if not item.get("texto", "").strip():
        return "citacao_insuficiente", "texto vazio", "-"
    for cand, cits in por_candidato.items():
        if not cits:
            return "citacao_insuficiente", f"sem citação de {cand}", "-"
        for ci in cits:
            p = _problema_citacao(ci, cand, paginas)
            if p:
                return p, f"{ci.get('arquivo')} p.{ci.get('pagina')}: {ci.get('trecho', '')[:120]!r}", "-"
    if juiz is None:
        return None, "", "nao_executado"
    todas = [ci for cits in por_candidato.values() for ci in cits]
    veredito = juiz(item["texto"], todas, chave)
    if veredito is None:
        return None, "", "nao_executado"
    if not veredito.get("sustentado"):
        return "nao_sustentado", veredito.get("justificativa", ""), "nao_sustentado"
    return None, veredito.get("justificativa", ""), "sustentado"


def verificar(theme_id: str, conteudo: dict, paginas: dict, juiz: Juiz | None = None) -> tuple[dict, list, list]:
    """Devolve (conteúdo verificado, descartes, avaliações dos itens mantidos)."""
    descartes, mantidos = [], []
    saida = {"candidatos": {}, "semelhancas": [], "diferencas": [], "omissoes": []}

    def processar(lista: str, item: dict, por_candidato: dict, rotulo_cand: str | None):
        chave = chave_item(item.get("texto", ""), item.get("citacoes"))
        motivo, detalhe, estado = _checar(item, por_candidato, paginas, juiz, chave)
        registro = {"lista": lista, "candidato": rotulo_cand, "item": item, "chave": chave}
        if motivo:
            descartes.append({**registro, "motivo": motivo, "detalhe": detalhe})
            return False
        mantidos.append({**registro, "juiz": estado, "justificativa": detalhe})
        return True

    for cid in config.CANDIDATOS:
        area = conteudo["candidatos"].get(cid, {"resumo": []})
        resumo = [b for b in area.get("resumo", [])
                  if processar("resumo", b, {cid: b.get("citacoes", [])}, cid)]
        saida["candidatos"][cid] = {"nao_encontrado": not resumo, "resumo": resumo}
    for lista in LISTAS_DOIS_LADOS:
        for item in conteudo.get(lista, []):
            cits = item.get("citacoes", {})
            if processar(lista, item, {c: cits.get(c, []) for c in config.CANDIDATOS}, None):
                saida[lista].append(item)
    for item in conteudo.get("omissoes", []):
        cand = item.get("tratado_por")
        if cand not in config.CANDIDATOS:
            descartes.append({"lista": "omissoes", "candidato": cand, "item": item,
                              "chave": chave_item(item.get("texto", ""), item.get("citacoes")),
                              "motivo": "citacao_insuficiente", "detalhe": "tratado_por inválido"})
            continue
        if processar("omissoes", item, {cand: item.get("citacoes", [])}, cand):
            saida["omissoes"].append(item)
    return saida, descartes, mantidos


def _registro_schemas() -> tuple[dict, Registry]:
    comp = json.loads((config.CONTRATO / "comparacao.schema.json").read_text(encoding="utf-8"))
    cit = json.loads((config.CONTRATO / "citacao.schema.json").read_text(encoding="utf-8"))
    reg = Registry().with_resources([(s["$id"], Resource.from_contents(s)) for s in (comp, cit)])
    return comp, reg


def validar(comparacao: dict) -> None:
    schema, reg = _registro_schemas()
    jsonschema.Draft202012Validator(schema, registry=reg).validate(comparacao)


def montar(theme_id: str, gerado_em: str, verificado: dict, fontes: list[dict]) -> dict:
    comparacao = {
        "theme_id": theme_id,
        "gerado_em": gerado_em,
        "fontes": [{k: f[k] for k in ("arquivo", "candidato", "sha256", "coletado_em")} for f in fontes],
        **verificado,
    }
    validar(comparacao)
    return comparacao


def serializar(comparacao: dict) -> bytes:
    return (json.dumps(comparacao, ensure_ascii=False, indent=1) + "\n").encode("utf-8")


# --- juízes ---------------------------------------------------------------------------------

def juiz_llm(provedor) -> Juiz:
    def julgar(texto: str, citacoes: list[dict], chave: str) -> dict:
        trechos = "\n".join(f"[{c['arquivo']} p.{c['pagina']}] {c['trecho']}" for c in citacoes)
        return json.loads(provedor.gerar(llm.prompt("juiz", afirmacao=texto, trechos=trechos)))
    return julgar


def juiz_vereditos(caminho: Path) -> Juiz | None:
    """Vereditos produzidos fora do pipeline, por chave de item (dados/juiz/<tema>.json).
    Item sem veredito fica `nao_executado` e segue marcado para a revisão humana."""
    if not caminho.exists():
        return None
    vereditos = json.loads(caminho.read_text(encoding="utf-8"))
    return lambda texto, citacoes, chave: vereditos.get(chave)


def pendentes_para_juiz(conteudo: dict, paginas: dict) -> list[dict]:
    """Itens que passaram na checagem literal, no formato entregue a um juiz externo."""
    _, _, mantidos = verificar("-", conteudo, paginas, juiz=None)
    saida = []
    for m in mantidos:
        cits = m["item"]["citacoes"]
        todas = [ci for v in cits.values() for ci in v] if isinstance(cits, dict) else cits
        saida.append({"chave": m["chave"], "lista": m["lista"], "texto": m["item"]["texto"],
                      "trechos": [{"arquivo": c["arquivo"], "pagina": c["pagina"], "trecho": c["trecho"]}
                                  for c in todas]})
    return saida
