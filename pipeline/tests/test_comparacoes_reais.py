"""AC 6 sobre o conteúdo real: todo trecho publicado ocorre na página citada do PDF real."""
import json

import pytest

from rag_planos import comparar, config, extrair, temas, verificar
from rag_planos.literal import trecho_na_pagina

ARQUIVOS = sorted((config.DADOS / "comparacoes").glob("*.json"))


def _citacoes(comp):
    for cid, area in comp["candidatos"].items():
        for b in area["resumo"]:
            for c in b["citacoes"]:
                yield cid, c
    for lista in ("semelhancas", "diferencas"):
        for item in comp[lista]:
            for cid, cits in item["citacoes"].items():
                for c in cits:
                    yield cid, c
    for item in comp["omissoes"]:
        for c in item["citacoes"]:
            yield item["tratado_por"], c


@pytest.mark.skipif(not ARQUIVOS, reason="nenhuma comparação gerada ainda")
def test_todo_trecho_publicado_e_literal(paginas):
    total = 0
    for arq in ARQUIVOS:
        comp = json.loads(arq.read_text(encoding="utf-8"))
        verificar.validar(comp)
        for cid, c in _citacoes(comp):
            assert c["arquivo"] == config.CANDIDATOS[cid]["arquivo"], (arq.name, c)
            texto = extrair.texto_da_pagina(paginas, c["arquivo"], c["pagina"])
            assert texto is not None and trecho_na_pagina(c["trecho"], texto), (arq.name, c)
            total += 1
    assert total > 0


@pytest.mark.skipif(not ARQUIVOS, reason="nenhuma comparação gerada ainda")
def test_todo_json_ate_30kb():
    for arq in ARQUIVOS:
        assert arq.stat().st_size <= 30 * 1024, arq.name


def test_comparacoes_reproduziveis(paginas):
    """L12: cada JSON publicado sai byte a byte de dados/geracao + dados/juiz, sem chave de API."""
    assert {a.stem for a in ARQUIVOS} == {t["id"] for t in temas.carregar()}
    fontes = json.loads((config.DADOS / "fontes.json").read_text(encoding="utf-8"))
    for arq in ARQUIVOS:
        tid = arq.stem
        g = json.loads((config.DADOS / "geracao" / f"{tid}.json").read_text(encoding="utf-8"))
        assert g["conteudo"] == comparar.de_rascunho(tid), tid
        juiz = verificar.juiz_vereditos(config.DADOS / "juiz" / f"{tid}.json")
        verificado, _, _ = verificar.verificar(tid, g["conteudo"], paginas, juiz)
        assert verificar.serializar(verificar.montar(tid, g["gerado_em"], verificado, fontes)) == arq.read_bytes(), tid
