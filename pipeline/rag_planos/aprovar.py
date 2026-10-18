"""Registro da aprovação humana (decisão 7, AC 13): theme_id -> SHA-256 do JSON aprovado.

Só registra se o relatório de revisão foi gerado para exatamente este JSON.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import yaml

from . import config, relatorio


def sha256_arquivo(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def aprovar(theme_id: str, comparacoes: Path = config.DADOS / "comparacoes",
            relatorios: Path = config.DADOS / "relatorios",
            aprovados: Path = config.REVISAO / "aprovados.yaml") -> int:
    json_tema = comparacoes / f"{theme_id}.json"
    if not json_tema.exists():
        print(f"ERRO: {json_tema} não existe", file=sys.stderr)
        return 2
    atual = sha256_arquivo(json_tema)
    revisado = relatorio.sha256_do_relatorio(relatorios / f"{theme_id}.html")
    if revisado != atual:
        print(f"ERRO: o JSON de {theme_id} mudou depois do relatório (ou não há relatório). "
              "Rode `verificar` e revise de novo.", file=sys.stderr)
        return 1
    mapa = {}
    if aprovados.exists():
        mapa = yaml.safe_load(aprovados.read_text(encoding="utf-8")) or {}
    mapa[theme_id] = atual
    aprovados.parent.mkdir(parents=True, exist_ok=True)
    aprovados.write_text(
        "# Portão de publicação: theme_id -> SHA-256 do JSON aprovado pelo dono (decisão 7).\n"
        + yaml.safe_dump(dict(sorted(mapa.items())), allow_unicode=True, sort_keys=True), encoding="utf-8")
    print(f"aprovado {theme_id} {atual}")
    return 0
