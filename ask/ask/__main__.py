"""Linha de comando do /ask (prévia). Rode pelo Docker:

    ./dock.sh ask python -m ask indexar            # embute as janelas dos chunks em dados/indice-ask
    ./dock.sh ask python -m ask perguntar "..."     # uma pergunta, resposta em JSON
    ./dock.sh ask python -m ask avaliar [--amostra N] [--juiz]
    ./dock.sh ask python -m ask servir             # API em 0.0.0.0:8080
"""
from __future__ import annotations

import argparse
import json
import sys


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="ask")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("indexar")
    q = sub.add_parser("perguntar")
    q.add_argument("pergunta")
    a = sub.add_parser("avaliar")
    a.add_argument("--amostra", type=int, help="só as N primeiras perguntas do conjunto-ouro")
    a.add_argument("--juiz", action="store_true", help="mede a fidelidade com o juiz Gemini do pipeline")
    a.add_argument("--pausa", type=float, default=0.0, help="segundos entre perguntas que chamam o modelo")
    s = sub.add_parser("servir")
    s.add_argument("--porta", type=int, default=8080)
    args = p.parse_args(argv)

    if args.cmd == "indexar":
        from rag_planos import config as cp

        from .indice import EmbeddingsLocais, Indice, carregar_chunks, versao_indice
        fontes = json.loads((cp.DADOS / "fontes.json").read_text(encoding="utf-8"))
        e = EmbeddingsLocais()
        ind = Indice.carregar_ou_construir(carregar_chunks(), e, versao_indice(fontes, e.nome))
        print(f"índice {ind.versao[:12]}: {len(ind.chunks)} chunks, {len(ind.dono)} janelas")
        return 0
    if args.cmd == "perguntar":
        from .servico import servico_do_ambiente
        s = servico_do_ambiente()
        r = s.perguntar({"pergunta": args.pergunta}, "linha-de-comando")
        print(json.dumps(r.corpo, ensure_ascii=False, indent=1))
        return 0 if r.status == 200 else 1
    if args.cmd == "avaliar":
        from .avaliar import principal
        return principal(args.amostra, args.juiz, args.pausa)
    import uvicorn
    uvicorn.run("ask.servidor:app", host="0.0.0.0", port=args.porta, proxy_headers=False, access_log=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
