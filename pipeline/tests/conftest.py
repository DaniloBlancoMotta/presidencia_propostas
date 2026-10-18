import json

import pytest

from rag_planos import chunk, classificar, config, extrair, temas

LULA = "Programa-Governo-LULA-2026.pdf"
FLAVIO = "plano-de-governo_flavio.pdf"


@pytest.fixture(scope="session")
def paginas():
    return extrair.extrair()


@pytest.fixture(scope="session")
def chunks_reais(paginas):
    lista_temas = temas.carregar()
    todos = []
    for arquivo, pags in paginas.items():
        cid = config.ARQUIVO_PARA_CANDIDATO[arquivo]
        todos += chunk.cortar(pags, cid, config.CANDIDATOS[cid]["partido"], arquivo)
    return classificar.classificar(todos, lista_temas)


def pagina_falsa(n: int, texto: str, secao: str = "S") -> dict:
    return {"pagina": n, "texto": texto, "secao": secao, "subsecoes": [], "indice": False}


@pytest.fixture
def paginas_falsas():
    """Corpus mínimo em memória: cada plano com 2 páginas de texto conhecido."""
    return {
        LULA: [pagina_falsa(1, "Vamos ampliar a escola em tempo\nintegral em todo o país."),
               pagina_falsa(2, "Fortalecer o Sistema Único de Saú-\nde com mais médicos.")],
        FLAVIO: [pagina_falsa(1, "Apoiamos a escola em tempo integral."),
                 pagina_falsa(2, "Vamos corrigir a Tabela SUS.")],
    }


def cit(arquivo, pagina, trecho):
    return {"arquivo": arquivo, "pagina": pagina, "trecho": trecho}


def bullet(texto, *citacoes):
    return {"texto": texto, "camada": "plano", "citacoes": list(citacoes)}


@pytest.fixture
def conteudo_valido():
    return {
        "candidatos": {
            "flavio-bolsonaro": {"nao_encontrado": False, "resumo": [
                bullet("Corrigir a Tabela SUS.", cit(FLAVIO, 2, "Vamos corrigir a Tabela SUS."))]},
            "lula": {"nao_encontrado": False, "resumo": [
                bullet("Fortalecer o SUS.", cit(LULA, 2, "Fortalecer o Sistema Único de Saúde"))]},
        },
        "semelhancas": [{"texto": "Escola em tempo integral.", "camada": "plano", "citacoes": {
            "flavio-bolsonaro": [cit(FLAVIO, 1, "escola em tempo integral")],
            "lula": [cit(LULA, 1, "ampliar a escola em tempo integral")]}}],
        "diferencas": [],
        "omissoes": [{"tratado_por": "flavio-bolsonaro", "texto": "Tabela SUS.", "camada": "plano",
                      "citacoes": [cit(FLAVIO, 2, "corrigir a Tabela SUS")]}],
    }


def carregar_json(caminho):
    return json.loads(caminho.read_text(encoding="utf-8"))
