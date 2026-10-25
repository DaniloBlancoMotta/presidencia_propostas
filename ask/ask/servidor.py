"""API HTTP do /ask (plano-final §11): `POST /ask` e `GET /health`.

CORS só da origem do site (ASK_ORIGEM_SITE); cabeçalhos CSP, nosniff, Referrer-Policy e no-store em
toda resposta; erro interno vira `{"erro": "interno"}` sem detalhe. Rodar:
    uvicorn ask.servidor:app --host 0.0.0.0 --port 8080
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .servico import Servico, servico_do_ambiente

CABECALHOS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def ip_do_cliente(request: Request, do_cabecalho: bool) -> str:
    """No Cloud Run, o front-end acrescenta o IP de quem conectou ao fim de X-Forwarded-For; o que
    vem antes pode ter sido escrito pelo próprio cliente e não vale."""
    if do_cabecalho:
        xff = request.headers.get("x-forwarded-for", "")
        if xff.strip():
            return xff.split(",")[-1].strip()
    return request.client.host if request.client else "-"


def criar_app(servico: Servico | None = None, origem_site: str | None = None, ip_cabecalho: bool = False) -> FastAPI:
    estado: dict = {"servico": servico}

    @asynccontextmanager
    async def ciclo(_: FastAPI):
        if estado["servico"] is None:
            estado["servico"] = await run_in_threadpool(servico_do_ambiente)
        yield

    app = FastAPI(title="Pergunta livre (prévia)", docs_url=None, redoc_url=None, openapi_url=None, lifespan=ciclo)
    if origem_site:
        app.add_middleware(CORSMiddleware, allow_origins=[origem_site], allow_methods=["POST"],
                           allow_headers=["Content-Type"], expose_headers=["Retry-After"], max_age=600)

    @app.middleware("http")
    async def cabecalhos(request: Request, chamar_proximo):
        try:
            resposta = await chamar_proximo(request)
        except Exception:
            resposta = JSONResponse({"erro": "interno"}, status_code=500)
        for k, v in CABECALHOS.items():
            resposta.headers[k] = v
        return resposta

    @app.get("/health")
    def saude():
        return {"status": "ok"}

    @app.post("/ask")
    async def perguntar(request: Request):
        try:
            corpo = json.loads(await request.body())
        except (ValueError, UnicodeDecodeError):
            corpo = None
        ip = ip_do_cliente(request, ip_cabecalho)
        r = await run_in_threadpool(estado["servico"].perguntar, corpo, ip)
        return JSONResponse(r.corpo, status_code=r.status, headers=r.cabecalhos)

    return app


app = criar_app(origem_site=config.origem_site(), ip_cabecalho=config.ip_do_cabecalho())
