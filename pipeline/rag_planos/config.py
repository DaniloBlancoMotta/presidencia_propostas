"""Caminhos e metadados fixos. Nomes, partidos e números vêm da §2 da especificação."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CORPUS = RAIZ / "corpus"
DADOS = RAIZ / "dados"
CONTRATO = RAIZ / "contrato"
REVISAO = RAIZ / "revisao"
PROMPTS = Path(__file__).resolve().parent / "prompts"

URL_TSE = (
    "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/"
    "propostas-de-governo-dos-candidatos-ao-cargo-de-presidente-da-republica-eleicoes-2026-segundo-turno/"
    "planos-de-governo-dos-candidatos-ao-cargo-de-presidente-da-republica-eleicoes-2026-2-turno"
)

CANDIDATOS = {
    "flavio-bolsonaro": {
        "nome": "Flávio Bolsonaro",
        "partido": "PL",
        "numero": 22,
        "arquivo": "plano-de-governo_flavio.pdf",
    },
    "lula": {
        "nome": "Lula",
        "partido": "PT",
        "numero": 13,
        "arquivo": "Programa-Governo-LULA-2026.pdf",
    },
}

ARQUIVO_PARA_CANDIDATO = {c["arquivo"]: cid for cid, c in CANDIDATOS.items()}

TAMANHO_MAX_TRECHO = 280
