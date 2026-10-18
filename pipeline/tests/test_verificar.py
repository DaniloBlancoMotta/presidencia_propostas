"""AC 5, 7, 8, 9: verificação, motivos de descarte e nao_encontrado."""
import copy

from rag_planos import verificar

from .conftest import FLAVIO, LULA, bullet, cit


def test_minimos_de_citacao(conteudo_valido, paginas_falsas):
    c = copy.deepcopy(conteudo_valido)
    c["semelhancas"].append({"texto": "Só um lado.", "camada": "plano", "citacoes": {
        "flavio-bolsonaro": [cit(FLAVIO, 1, "escola em tempo integral")], "lula": []}})
    c["candidatos"]["lula"]["resumo"].append({"texto": "Sem citação.", "camada": "plano", "citacoes": []})
    saida, descartes, _ = verificar.verificar("t", c, paginas_falsas)
    assert len(saida["semelhancas"]) == 1
    assert len(saida["candidatos"]["lula"]["resumo"]) == 1
    assert sorted(d["motivo"] for d in descartes) == ["citacao_insuficiente", "citacao_insuficiente"]
    for area in saida["candidatos"].values():
        assert all(len(b["citacoes"]) >= 1 for b in area["resumo"])
    for item in saida["semelhancas"] + saida["diferencas"]:
        assert item["citacoes"]["lula"] and item["citacoes"]["flavio-bolsonaro"]
    for item in saida["omissoes"]:
        assert any(ci["arquivo"] == FLAVIO for ci in item["citacoes"])


def test_trecho_inexistente_descartado(conteudo_valido, paginas_falsas):
    c = copy.deepcopy(conteudo_valido)
    c["candidatos"]["lula"]["resumo"].append(bullet("Inventado.", cit(LULA, 2, "Construir 900 hospitais")))
    saida, descartes, _ = verificar.verificar("t", c, paginas_falsas)
    textos = [b["texto"] for b in saida["candidatos"]["lula"]["resumo"]]
    assert "Inventado." not in textos
    assert [d["motivo"] for d in descartes] == ["trecho_nao_encontrado"]
    assert descartes[0]["item"]["texto"] == "Inventado."


def test_trecho_na_pagina_errada_descartado(conteudo_valido, paginas_falsas):
    c = copy.deepcopy(conteudo_valido)
    c["candidatos"]["lula"]["resumo"][0]["citacoes"][0]["pagina"] = 1
    _, descartes, _ = verificar.verificar("t", c, paginas_falsas)
    assert [d["motivo"] for d in descartes] == ["trecho_nao_encontrado"]


def test_arquivo_de_outro_candidato_descartado(conteudo_valido, paginas_falsas):
    c = copy.deepcopy(conteudo_valido)
    c["candidatos"]["lula"]["resumo"].append(bullet("Troca.", cit(FLAVIO, 2, "Vamos corrigir a Tabela SUS.")))
    _, descartes, _ = verificar.verificar("t", c, paginas_falsas)
    assert [d["motivo"] for d in descartes] == ["arquivo_errado"]


def test_juiz_nao_sustentado(conteudo_valido, paginas_falsas):
    def juiz(texto, citacoes, chave):
        if texto == "Fortalecer o SUS.":
            return {"sustentado": False, "justificativa": "o trecho não fala em médicos da família"}
        return {"sustentado": True, "justificativa": "ok"}
    saida, descartes, mantidos = verificar.verificar("t", conteudo_valido, paginas_falsas, juiz)
    assert saida["candidatos"]["lula"]["resumo"] == []
    assert [d["motivo"] for d in descartes] == ["nao_sustentado"]
    assert descartes[0]["detalhe"] == "o trecho não fala em médicos da família"
    assert all(m["juiz"] == "sustentado" for m in mantidos)


def test_sem_juiz_marca_nao_executado(conteudo_valido, paginas_falsas):
    _, _, mantidos = verificar.verificar("t", conteudo_valido, paginas_falsas, None)
    assert mantidos and all(m["juiz"] == "nao_executado" for m in mantidos)


def test_sem_bullet_nao_encontrado(conteudo_valido, paginas_falsas):
    c = copy.deepcopy(conteudo_valido)
    c["candidatos"]["lula"]["resumo"] = [bullet("Inventado.", cit(LULA, 2, "texto que não existe"))]
    saida, _, _ = verificar.verificar("t", c, paginas_falsas)
    assert saida["candidatos"]["lula"] == {"nao_encontrado": True, "resumo": []}
    assert saida["candidatos"]["flavio-bolsonaro"]["nao_encontrado"] is False


def test_montar_valida_schema(conteudo_valido, paginas_falsas):
    saida, _, _ = verificar.verificar("saude", conteudo_valido, paginas_falsas)
    fontes = [{"arquivo": LULA, "candidato": "lula", "sha256": "a" * 64, "coletado_em": "2026-10-17"},
              {"arquivo": FLAVIO, "candidato": "flavio-bolsonaro", "sha256": "b" * 64, "coletado_em": "2026-10-17"}]
    comp = verificar.montar("saude", "2026-10-17T20:00:00-03:00", saida, fontes)
    assert comp["theme_id"] == "saude" and set(comp["candidatos"]) == {"lula", "flavio-bolsonaro"}
