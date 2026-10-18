"""Geração da comparação bruta de um tema (AC 5), antes da verificação.

Duas origens, registradas em dados/geracao/<tema>.json junto com `gerado_em`:
- `gemini`: prompts resumo.md (um por candidato) e comparar.md sobre os chunks do tema;
- `rascunho`: dados/rascunhos/<tema>.json, produzido fora do pipeline quando não há chave de API.
`gerado_em` só muda quando o conteúdo muda, para que rodar de novo seja idempotente.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config, extrair, llm
from .literal import trecho_na_pagina

LISTAS = ("semelhancas", "diferencas", "omissoes")
BRT = timezone(timedelta(hours=-3))
CONFIANCA_MINIMA = 0.25
MAX_CHUNKS = 12


def _conteudo(bruto: dict) -> dict:
    return {
        "candidatos": bruto["candidatos"],
        "semelhancas": bruto.get("semelhancas", []),
        "diferencas": bruto.get("diferencas", []),
        "omissoes": bruto.get("omissoes", []),
    }


def de_rascunho(theme_id: str, pasta: Path = config.DADOS / "rascunhos") -> dict:
    bruto = json.loads((pasta / f"{theme_id}.json").read_text(encoding="utf-8"))
    if bruto.get("theme_id") != theme_id:
        raise ValueError(f"rascunho de {theme_id} declara theme_id={bruto.get('theme_id')!r}")
    return _conteudo(bruto)


def _chunks_do_tema(chunks: list[dict], theme_id: str, candidato: str) -> list[dict]:
    sel = [(next((t["confianca"] for t in c["temas"] if t["theme_id"] == theme_id), 0.0), c)
           for c in chunks if c["candidato"] == candidato]
    sel = [x for x in sel if x[0] >= CONFIANCA_MINIMA]
    sel.sort(key=lambda x: -x[0])
    return [c for _, c in sel[:MAX_CHUNKS]]


def com_llm(tema: dict, chunks: list[dict], paginas: dict, provedor) -> dict:
    candidatos = {}
    for cid, meta in config.CANDIDATOS.items():
        trechos = "\n\n".join(
            f"[página {c['pagina']}{'-' + str(c['paginas'][-1]) if len(c['paginas']) > 1 else ''}] {c['texto']}"
            for c in _chunks_do_tema(chunks, tema["id"], cid))
        if not trechos:
            candidatos[cid] = {"nao_encontrado": True, "resumo": []}
            continue
        resposta = json.loads(provedor.gerar(llm.prompt(
            "resumo", rotulo=tema["rotulo"], descricao=tema["descricao"],
            arquivo=meta["arquivo"], trechos=trechos)))
        resumo = [b for b in resposta.get("resumo", []) if all(
            trecho_na_pagina(ci["trecho"], extrair.texto_da_pagina(paginas, ci["arquivo"], ci["pagina"]) or "")
            for ci in b.get("citacoes", []))]
        candidatos[cid] = {"nao_encontrado": not resumo, "resumo": resumo}
    resposta = json.loads(provedor.gerar(llm.prompt(
        "comparar", rotulo=tema["rotulo"], resumos=json.dumps(candidatos, ensure_ascii=False))))
    return _conteudo({"candidatos": candidatos, **{k: resposta.get(k, []) for k in LISTAS}})


def registrar(theme_id: str, conteudo: dict, origem: str, pasta: Path = config.DADOS / "geracao",
              agora: datetime | None = None) -> dict:
    pasta.mkdir(parents=True, exist_ok=True)
    arq = pasta / f"{theme_id}.json"
    if arq.exists():
        antigo = json.loads(arq.read_text(encoding="utf-8"))
        if antigo["conteudo"] == conteudo and antigo["origem"] == origem:
            return antigo
    registro = {
        "theme_id": theme_id,
        "origem": origem,
        "gerado_em": (agora or datetime.now(BRT)).replace(microsecond=0).isoformat(),
        "conteudo": conteudo,
    }
    arq.write_text(json.dumps(registro, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return registro
