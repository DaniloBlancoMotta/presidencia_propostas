"""Linha de comando do pipeline (plano-final §5). Rode sempre pelo Docker:

    ./dock.sh pipeline python -m rag_planos <comando> [opções]

Comandos: fontes, ingest, comparar, exportar-juiz, verificar, ouro, avaliar, aprovar.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import sys
from pathlib import Path

import yaml

from . import (aprovar, avaliar, chunk, classificar, comparar, config, extrair, fontes, llm,
               relatorio, temas, verificar)


@contextlib.contextmanager
def _resumo_llm(provedor):
    """Imprime chamadas, cache, falhas e tokens do LLM ao sair, também quando o comando falha."""
    try:
        yield
    finally:
        if provedor:
            print(provedor.resumo(), flush=True)


def _temas_alvo(args) -> list[dict]:
    todos = temas.carregar()
    if args.todos:
        return todos
    mapa = temas.por_id(todos)
    if args.tema not in mapa:
        raise SystemExit(f"ERRO: tema desconhecido {args.tema!r}; opções: {', '.join(mapa)}")
    return [mapa[args.tema]]


def cmd_fontes(args) -> int:
    return fontes.principal(args.tse_dir, args.url or [], args.coletado_em, sem_tse=args.sem_tse)


def cmd_ingest(args) -> int:
    paginas = extrair.extrair()
    extrair.gravar(paginas)
    lista_temas = temas.carregar()
    provedor = llm.provedor_padrao()
    todos = []
    for arquivo, pags in paginas.items():
        cid = config.ARQUIVO_PARA_CANDIDATO[arquivo]
        todos += chunk.cortar(pags, cid, config.CANDIDATOS[cid]["partido"], arquivo)
    with _resumo_llm(provedor):
        classificar.classificar(todos, lista_temas, provedor)
    destino = config.DADOS / "chunks" / "chunks.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(todos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sem_pagina = [c["id"] for c in todos if not isinstance(c.get("pagina"), int) or c["pagina"] < 1]
    if sem_pagina:
        print(f"ERRO: chunks sem página: {sem_pagina}", file=sys.stderr)
        return 1
    print(f"{len(todos)} chunks · classificação: {'palavras-chave + LLM' if provedor else 'palavras-chave'}")
    for tid in (t["id"] for t in lista_temas):
        n = {cid: sum(1 for c in todos if c["candidato"] == cid and any(t["theme_id"] == tid for t in c["temas"]))
             for cid in config.CANDIDATOS}
        print(f"  {tid}: " + ", ".join(f"{k}={v}" for k, v in n.items()))
    return 0


def cmd_comparar(args) -> int:
    paginas = extrair.carregar()
    provedor = None
    if args.origem == "gemini":
        provedor = llm.provedor_padrao()
        if provedor is None:
            print("ERRO: --origem gemini exige GEMINI_API_KEY", file=sys.stderr)
            return 2
    with _resumo_llm(provedor):
        for tema in _temas_alvo(args):
            correcoes = []
            if provedor:
                chunks = json.loads((config.DADOS / "chunks" / "chunks.json").read_text(encoding="utf-8"))
                conteudo, correcoes = comparar.com_llm_e_correcoes(tema, chunks, paginas, provedor)
                origem = f"gemini ({provedor.nome_modelo})"
            else:
                conteudo, origem = comparar.de_rascunho(tema["id"]), "rascunho (dados/rascunhos)"
            reg = comparar.registrar(tema["id"], conteudo, origem, correcoes=correcoes)
            print(f"gerado {tema['id']} · {reg['origem']} · {reg['gerado_em']}"
                  + (f" · {len(correcoes)} página(s) corrigida(s)" if correcoes else ""))
    return 0


def _geracao(theme_id: str) -> dict:
    arq = config.DADOS / "geracao" / f"{theme_id}.json"
    if not arq.exists():
        raise SystemExit(f"ERRO: rode `comparar {theme_id}` antes")
    return json.loads(arq.read_text(encoding="utf-8"))


def cmd_exportar_juiz(args) -> int:
    paginas = extrair.carregar()
    for tema in _temas_alvo(args):
        pend = verificar.pendentes_para_juiz(_geracao(tema["id"])["conteudo"], paginas)
        destino = config.DADOS / "juiz" / f"{tema['id']}.pendente.json"
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(json.dumps(pend, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{tema['id']}: {len(pend)} itens para o juiz em {destino.relative_to(config.RAIZ)}")
    return 0


def cmd_verificar(args) -> int:
    paginas = extrair.carregar()
    arq_fontes = config.DADOS / "fontes.json"
    if not arq_fontes.exists():
        print("ERRO: dados/fontes.json ausente; rode `fontes`", file=sys.stderr)
        return 2
    lista_fontes = json.loads(arq_fontes.read_text(encoding="utf-8"))
    provedor = llm.provedor_padrao()
    with _resumo_llm(provedor):
        for tema in _temas_alvo(args):
            _verificar_tema(tema, paginas, lista_fontes, provedor)
    return 0


def _verificar_tema(tema: dict, paginas: dict, lista_fontes: list, provedor) -> None:
    g = _geracao(tema["id"])
    juiz = verificar.juiz_llm(provedor, g["conteudo"], paginas) if provedor else \
        verificar.juiz_vereditos(config.DADOS / "juiz" / f"{tema['id']}.json")
    verificado, descartes, mantidos = verificar.verificar(tema["id"], g["conteudo"], paginas, juiz)
    comp = verificar.montar(tema["id"], g["gerado_em"], verificado, lista_fontes)
    dados = verificar.serializar(comp)
    destino = config.DADOS / "comparacoes" / f"{tema['id']}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(dados)
    sha = aprovar.sha256_arquivo(destino)
    rel = relatorio.gerar(tema, comp, sha, g["origem"], mantidos, descartes,
                          config.DADOS / "relatorios" / f"{tema['id']}.html", g.get("correcoes_pagina"))
    pend = sum(1 for m in mantidos if m["juiz"] == "nao_executado")
    print(f"{tema['id']}: {len(mantidos)} mantidos, {len(descartes)} descartados, juiz pendente em {pend}"
          f" · {len(dados) / 1024:.1f} KB · relatório {rel.relative_to(config.RAIZ)}")
    for d in descartes:
        print(f"    descartado [{d['motivo']}] {d['lista']}: {d['item'].get('texto', '')[:80]}")


def cmd_ouro(args) -> int:
    ouro = avaliar.montar_ouro(temas.carregar(), extrair.carregar())
    destino = config.DADOS / "ouro" / "conjunto-ouro.yaml"
    destino.parent.mkdir(parents=True, exist_ok=True)
    cabecalho = ("# Conjunto-ouro (AC 14, 15). Itens da §11.3 da especificação localizados nos PDFs;\n"
                 "# cada `trecho` foi conferido literalmente na `pagina`. `nao_encontrados`: não\n"
                 "# localizados no plano. O dono confere este arquivo antes de aprovar (decisão 21).\n")
    destino.write_text(cabecalho + yaml.safe_dump(ouro, allow_unicode=True, sort_keys=False, width=110),
                       encoding="utf-8")
    print(f"{len(ouro['itens'])} itens · {len(ouro['nao_encontrados'])} não encontrados · "
          f"{len(ouro['convergencias'])} convergências")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="rag_planos")
    sub = p.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fontes", help="confere SHA-256 contra o TSE e grava fontes.json")
    f.add_argument("--tse-dir", help="pasta com os PDFs baixados da página do TSE")
    f.add_argument("--url", action="append", help="URL direta de um PDF no TSE (repetível)")
    f.add_argument("--coletado-em", help="AAAA-MM-DD")
    f.add_argument("--sem-tse", action="store_true", help="registra sem conferência (exige --coletado-em)")
    f.set_defaults(func=cmd_fontes)
    sub.add_parser("ingest").set_defaults(func=cmd_ingest)
    for nome, func in (("comparar", cmd_comparar), ("exportar-juiz", cmd_exportar_juiz),
                       ("verificar", cmd_verificar)):
        s = sub.add_parser(nome)
        s.add_argument("tema", nargs="?")
        s.add_argument("--todos", action="store_true")
        if nome == "comparar":
            s.add_argument("--origem", choices=["rascunho", "gemini"], default="rascunho")
        s.set_defaults(func=func)
    sub.add_parser("ouro").set_defaults(func=cmd_ouro)
    sub.add_parser("avaliar").set_defaults(func=lambda a: avaliar.principal())
    a = sub.add_parser("aprovar", help="registra o hash do JSON revisado (só o dono)")
    a.add_argument("tema")
    a.set_defaults(func=lambda a: aprovar.aprovar(a.tema))
    args = p.parse_args(argv)
    if getattr(args, "cmd", None) in ("comparar", "exportar-juiz", "verificar") and not (args.todos or args.tema):
        p.error("informe o tema ou --todos")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
