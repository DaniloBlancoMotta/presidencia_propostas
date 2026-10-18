"""Geração da comparação bruta de um tema (AC 5), antes da verificação.

Duas origens, registradas em dados/geracao/<tema>.json junto com `gerado_em`:
- `gemini`: grafo `comparar` de grafos.py (LangGraph) - resumo.md por candidato em paralelo,
  filtro literal (com correção da página quando o trecho está em uma só página da faixa) e
  comparar.md sobre os chunks do tema; as trocas de página ficam em `correcoes_pagina`;
- `rascunho`: dados/rascunhos/<tema>.json, produzido fora do pipeline quando não há chave de API.
`gerado_em` só muda quando o conteúdo muda, para que rodar de novo seja idempotente.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import chunk, config, llm

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


def pedidos_de_resumo(tema: dict, chunks: list[dict]) -> dict[str, dict]:
    """Por candidato com trechos no tema: o prompt resumo.md (com `[página N]` em cada virada) e o
    texto e as viradas dos chunks enviados, que o filtro usa para achar a página que o modelo viu.
    Quem não tem trecho fica de fora (sem chamada)."""
    pedidos = {}
    for cid, meta in config.CANDIDATOS.items():
        sel = _chunks_do_tema(chunks, tema["id"], cid)
        if sel:
            trechos = "\n\n".join(chunk.texto_marcado(c) for c in sel)
            pedidos[cid] = {"prompt": llm.prompt("resumo", rotulo=tema["rotulo"], descricao=tema["descricao"],
                                                 arquivo=meta["arquivo"], trechos=trechos),
                            "chunks": [{"texto": c["texto"], "viradas": c.get("viradas"), "pagina": c["pagina"]}
                                       for c in sel]}
    return pedidos


def com_llm_e_correcoes(tema: dict, chunks: list[dict], paginas: dict, gerador: llm.Gerador) -> tuple[dict, list]:
    """Conteúdo gerado pelo grafo e as páginas que o filtro literal corrigiu (`correcoes_pagina`)."""
    from . import grafos
    r = grafos.comparar(gerador, tema, pedidos_de_resumo(tema, chunks), paginas)
    return _conteudo(r), r["correcoes_pagina"]


def com_llm(tema: dict, chunks: list[dict], paginas: dict, gerador: llm.Gerador) -> dict:
    return com_llm_e_correcoes(tema, chunks, paginas, gerador)[0]


def registrar(theme_id: str, conteudo: dict, origem: str, pasta: Path = config.DADOS / "geracao",
              agora: datetime | None = None, correcoes: list | None = None) -> dict:
    """`correcoes_pagina` só entra no arquivo quando houve troca: sem troca, o arquivo é o de sempre.
    Mesmo conteúdo e mesma origem mantêm `gerado_em` (e o hash publicado), mesmo que as trocas mudem."""
    pasta.mkdir(parents=True, exist_ok=True)
    arq = pasta / f"{theme_id}.json"
    antigo = json.loads(arq.read_text(encoding="utf-8")) if arq.exists() else None
    if antigo and antigo["conteudo"] == conteudo and antigo["origem"] == origem:
        if antigo.get("correcoes_pagina", []) == (correcoes or []):
            return antigo
        registro = {k: v for k, v in antigo.items() if k != "correcoes_pagina"}
    else:
        registro = {
            "theme_id": theme_id,
            "origem": origem,
            "gerado_em": (agora or datetime.now(BRT)).replace(microsecond=0).isoformat(),
            "conteudo": conteudo,
        }
    if correcoes:
        registro["correcoes_pagina"] = correcoes
    arq.write_text(json.dumps(registro, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return registro
