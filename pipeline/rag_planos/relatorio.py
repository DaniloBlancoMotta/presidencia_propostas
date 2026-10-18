"""Relatório HTML de revisão humana por tema (AC 12).

Mostra cada item mantido com seus trechos e o link para a página do PDF, todos os descartes com
motivo e a contagem de citações por candidato. Grava o SHA-256 do JSON revisado numa meta tag,
que `aprovar` confere antes de registrar a aprovação.
"""
from __future__ import annotations

import html
from pathlib import Path

from . import config

ROTULO_LISTA = {"resumo": "Resumo", "semelhancas": "Semelhança", "diferencas": "Diferença",
                "omissoes": "Omissão"}


def _cits(item: dict) -> list[tuple[str, dict]]:
    cits = item.get("citacoes", [])
    if isinstance(cits, dict):
        return [(cand, c) for cand, v in cits.items() for c in v]
    return [(config.ARQUIVO_PARA_CANDIDATO.get(c.get("arquivo"), "?"), c) for c in cits]


def _link(c: dict) -> str:
    p = c.get("pagina")
    pagina = p if isinstance(p, int) and not isinstance(p, bool) else 0  # descarte pode ter página inválida
    return f"../../corpus/{html.escape(str(c.get('arquivo', '')))}#page={pagina}"


def _bloco_item(m: dict, extra: str) -> str:
    item = m["item"]
    linhas = [f"<li class='item'><p><b>{html.escape(ROTULO_LISTA[m['lista']])}</b>"
              + (f" · {html.escape(config.CANDIDATOS[m['candidato']]['nome'])}" if m.get("candidato") in config.CANDIDATOS else "")
              + f" · <code>{m['chave']}</code>{extra}</p><p>{html.escape(item.get('texto', ''))}</p><ul>"]
    for cand, c in _cits(item):
        nome = config.CANDIDATOS.get(cand, {}).get("nome", cand)
        linhas.append(f"<li><q>{html.escape(c.get('trecho', ''))}</q> — {html.escape(nome)}, "
                      f"{html.escape(str(c.get('arquivo', '')))}, pág. {html.escape(str(c.get('pagina')))} "
                      f"<a href='{_link(c)}'>abrir página</a></li>")
    linhas.append("</ul></li>")
    return "".join(linhas)


def contagem_por_candidato(comparacao: dict) -> dict[str, int]:
    n = {cid: 0 for cid in config.CANDIDATOS}
    for cid, area in comparacao["candidatos"].items():
        n[cid] += sum(len(b["citacoes"]) for b in area["resumo"])
    for lista in ("semelhancas", "diferencas"):
        for item in comparacao[lista]:
            for cid, v in item["citacoes"].items():
                n[cid] += len(v)
    for item in comparacao["omissoes"]:
        n[item["tratado_por"]] += len(item["citacoes"])
    return n


def _secao_correcoes(correcoes: list) -> list[str]:
    """Páginas que o filtro literal da geração trocou (trecho idêntico, página verdadeira)."""
    partes = [f"<h2>Páginas corrigidas automaticamente ({len(correcoes)})</h2>",
              "<p>O trecho estava literalmente em uma só página da faixa enviada ao modelo, "
              "diferente da que ele citou; a citação passou a apontar essa página.</p><ul>"]
    for c in correcoes:
        nome = config.CANDIDATOS.get(c.get("candidato"), {}).get("nome", str(c.get("candidato")))
        partes.append(f"<li><q>{html.escape(str(c.get('trecho', '')))}</q> — {html.escape(nome)}, "
                      f"pág. {html.escape(str(c.get('pagina_citada')))} → {html.escape(str(c.get('pagina')))}"
                      f"<br><small>{html.escape(str(c.get('texto', '')))}</small></li>")
    partes.append("</ul>")
    return partes


def gerar(tema: dict, comparacao: dict, sha256_json: str, origem: str, mantidos: list, descartes: list,
          destino: Path, correcoes: list | None = None) -> Path:
    contagem = contagem_por_candidato(comparacao)
    juiz_pend = sum(1 for m in mantidos if m["juiz"] == "nao_executado")
    partes = [
        "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>",
        f"<meta name='sha256-comparacao' content='{sha256_json}'>",
        f"<title>Revisão: {html.escape(tema['rotulo'])}</title>",
        "<style>body{font:16px/1.5 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem}"
        ".item{margin:1rem 0;padding:.5rem 1rem;border:1px solid #ccc;border-radius:6px}"
        ".desc{border-color:#b55}q{background:#f4f4f4}table{border-collapse:collapse}"
        "td,th{border:1px solid #ccc;padding:.25rem .5rem}</style></head><body>",
        f"<h1>Revisão do tema: {html.escape(tema['rotulo'])} (<code>{tema['id']}</code>)</h1>",
        f"<p>Gerado em {html.escape(comparacao['gerado_em'])} · origem da geração: <b>{html.escape(origem)}</b> · "
        f"SHA-256 do JSON: <code>{sha256_json}</code></p>",
        "<h2>Citações por candidato</h2><table><tr><th>Candidato</th><th>Citações</th><th>Bullets no resumo</th></tr>",
    ]
    for cid, meta in config.CANDIDATOS.items():
        area = comparacao["candidatos"][cid]
        nb = "não encontrado" if area["nao_encontrado"] else str(len(area["resumo"]))
        partes.append(f"<tr><td>{html.escape(meta['nome'])}</td><td>{contagem[cid]}</td><td>{nb}</td></tr>")
    partes.append("</table>")
    partes.append(f"<p>Semelhanças: {len(comparacao['semelhancas'])} · Diferenças: {len(comparacao['diferencas'])}"
                  f" · Omissões: {len(comparacao['omissoes'])}</p>")
    if juiz_pend:
        partes.append(f"<p><b>Atenção:</b> {juiz_pend} item(ns) sem veredito do juiz LLM "
                      "(<code>nao_executado</code>): conferir o sentido manualmente.</p>")
    if correcoes:
        partes += _secao_correcoes(correcoes)
    partes.append(f"<h2>Itens publicados ({len(mantidos)})</h2><ul>")
    for m in mantidos:
        extra = f" · juiz: <b>{html.escape(m['juiz'])}</b>"
        if m.get("justificativa"):
            extra += f" — {html.escape(m['justificativa'])}"
        partes.append(_bloco_item(m, extra))
    partes.append(f"</ul><h2>Itens descartados ({len(descartes)})</h2><ul>")
    for d in descartes:
        extra = f" · motivo: <b>{html.escape(d['motivo'])}</b> — {html.escape(d.get('detalhe', ''))}"
        partes.append(_bloco_item(d, extra).replace("class='item'", "class='item desc'", 1))
    partes.append("</ul><p>Para aprovar este conteúdo exato: "
                  f"<code>./dock.sh pipeline python -m rag_planos aprovar {tema['id']}</code></p></body></html>")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(partes), encoding="utf-8")
    return destino


def sha256_do_relatorio(caminho: Path) -> str | None:
    import re
    if not caminho.exists():
        return None
    m = re.search(r"<meta name='sha256-comparacao' content='([0-9a-f]{64})'>", caminho.read_text(encoding="utf-8"))
    return m.group(1) if m else None
