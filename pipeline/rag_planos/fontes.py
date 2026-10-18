"""SHA-256 do corpus, conferência contra os PDFs do TSE e fontes.json (AC 2, AC 3)."""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

from . import config


def sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def gravar_fontes(corpus: Path, destino: Path, coletado_em: str, conferido_tse: bool,
                  url_tse: str = config.URL_TSE) -> list[dict]:
    fontes = []
    for cid, c in config.CANDIDATOS.items():
        arq = corpus / c["arquivo"]
        fontes.append({
            "arquivo": c["arquivo"],
            "candidato": cid,
            "partido": c["partido"],
            "sha256": sha256(arq),
            "coletado_em": coletado_em,
            "url_tse": url_tse,
            "conferido_tse": conferido_tse,
        })
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(fontes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return fontes


def divergencias(corpus: Path, tse_dir: Path) -> list[str]:
    """Mensagens de divergência entre corpus/ e as cópias baixadas da página do TSE."""
    erros = []
    for c in config.CANDIDATOS.values():
        local, remoto = corpus / c["arquivo"], tse_dir / c["arquivo"]
        if not remoto.exists():
            erros.append(f"{c['arquivo']}: cópia do TSE ausente em {tse_dir}")
        elif sha256(local) != sha256(remoto):
            erros.append(f"{c['arquivo']}: SHA-256 diverge (corpus {sha256(local)} != TSE {sha256(remoto)})")
    return erros


def baixar(url: str, destino: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(destino, "wb") as f:
        f.write(r.read())


def principal(tse_dir: str | None, urls: list[str], coletado_em: str | None, sem_tse: bool = False,
              corpus: Path | None = None, destino: Path | None = None) -> int:
    corpus = corpus or config.CORPUS
    destino = destino or config.DADOS / "fontes.json"
    if sem_tse:
        if not coletado_em:
            print("ERRO: --sem-tse exige --coletado-em AAAA-MM-DD informado pelo dono", file=sys.stderr)
            return 2
        for f in gravar_fontes(corpus, destino, coletado_em, conferido_tse=False):
            print(f"registrado SEM conferência do TSE: {f['arquivo']} {f['sha256']}")
        return 0
    if urls:
        alvo = Path(tse_dir or config.DADOS / "tse")
        alvo.mkdir(parents=True, exist_ok=True)
        for u in urls:
            try:
                baixar(u, alvo / u.rsplit("/", 1)[-1])
            except Exception as e:  # noqa: BLE001 - qualquer falha de rede encerra com a causa
                print(f"ERRO: não foi possível baixar {u}: {e}", file=sys.stderr)
                return 2
        tse_dir = str(alvo)
    if not tse_dir:
        print("ERRO: informe --tse-dir (PDFs baixados da página do TSE) ou --url", file=sys.stderr)
        return 2
    erros = divergencias(corpus, Path(tse_dir))
    if erros:
        for e in erros:
            print("ERRO: " + e, file=sys.stderr)
        return 1
    for f in gravar_fontes(corpus, destino, coletado_em or date.today().isoformat(), conferido_tse=True):
        print(f"ok {f['arquivo']} {f['sha256']}")
    return 0
