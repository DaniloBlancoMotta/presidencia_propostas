"""Configuração do /ask (plano-final §11). Números fixos aqui; o que muda por ambiente vem de variável
de ambiente, e nenhum segredo vai para arquivo do repositório."""
from __future__ import annotations

import os
from datetime import date

from rag_planos import config as cp
from rag_planos import llm

DADOS = cp.DADOS
INDICE = DADOS / "indice-ask"
SAIDA = DADOS / "ask"

# Modelo de embeddings embutido na imagem; entra na versão do índice e na chave do cache.
MODELO_EMBEDDINGS = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
JANELA_PALAVRAS = 80  # o modelo trunca em 128 tokens: o chunk vira janelas que cabem nele
PASSO_PALAVRAS = 60

TAM_MAX_PERGUNTA = 300
TRECHOS_POR_PLANO = 5  # buscas separadas por candidato, 5 trechos de cada plano
JANELAS_POR_TRECHO = 2  # de cada trecho vão ao modelo só as 2 janelas mais próximas da pergunta
TRECHOS_EXTRATIVO = 3  # modo extrativo: os 3 trechos mais relevantes de cada plano
MAX_BULLETS = 4
MAX_TEXTO = 300
LIMIAR_CACHE = 0.92  # cosseno do cache semântico
VALIDADE_CACHE = date(2026, 11, 30)
LIMITE_POR_HORA = 10
JANELA_LIMITE_S = 3600
TIMEOUT_PROVEDOR_S = 10
FALHAS_PARA_ABRIR = 3
PAUSA_DISJUNTOR_S = 300
ORCAMENTO_S = 12  # o site espera 15 s; o servidor responde, extrativo se preciso, antes disso


def provedores_pedidos() -> list[str]:
    """Ordem da cadeia; só entra quem tem chave. ASK_PROVEDORES reordena ou restringe.
    Na prévia, Groq vem antes do Gemini (medido em 18/10/2026: 2,7 s contra 3 a 10 s, e a cota
    gratuita do Gemini fica para o juiz do pipeline); a §11 previa Gemini primeiro."""
    bruto = os.environ.get("ASK_PROVEDORES") or "groq,gemini,openrouter"
    return [p.strip() for p in bruto.split(",") if p.strip()]


# Modelos que respondiam em 18/10/2026 (listas /models de cada provedor); trocar por variável de ambiente.
MODELOS_PADRAO = {
    "gemini": llm.MODELO_PADRAO,
    "groq": "openai/gpt-oss-120b",
    "openrouter": "google/gemma-4-31b-it:free",
}
VARIAVEIS = {
    "gemini": ("GEMINI_API_KEY", "GEMINI_MODELO"),
    "groq": ("GROQ_API_KEY", "GROQ_MODELO"),
    "openrouter": ("OPENROUTER_API_KEY", "OPENROUTER_MODELO"),
}
URLS_OPENAI = {
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}


def origem_site() -> str | None:
    """Única origem aceita no CORS (ASK_ORIGEM_SITE). Sem ela, nenhuma origem cruzada."""
    return os.environ.get("ASK_ORIGEM_SITE") or None


def ip_do_cabecalho() -> bool:
    """Atrás do Cloud Run, o IP do cliente é o último de X-Forwarded-For (ASK_IP_DO_CABECALHO=1)."""
    return os.environ.get("ASK_IP_DO_CABECALHO") == "1"
