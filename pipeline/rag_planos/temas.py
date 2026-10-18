"""Leitura e validação de dados/themes.yaml (decisão 6)."""
from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import yaml

from . import config


def carregar(caminho: Path = config.DADOS / "themes.yaml") -> list[dict]:
    dados = yaml.safe_load(caminho.read_text(encoding="utf-8"))
    schema = json.loads((config.CONTRATO / "themes.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(dados, schema)
    ids = [t["id"] for t in dados["temas"]]
    if len(ids) != len(set(ids)):
        raise ValueError("themes.yaml: id repetido")
    return dados["temas"]


def por_id(temas: list[dict]) -> dict[str, dict]:
    return {t["id"]: t for t in temas}
