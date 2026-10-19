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
    assert saida["candidatos"]["lula"] == {"nao_encontrado": True, "resumo": [], "executivo": []}
    assert saida["candidatos"]["flavio-bolsonaro"]["nao_encontrado"] is False


def test_montar_valida_schema(conteudo_valido, paginas_falsas):
    saida, _, _ = verificar.verificar("saude", conteudo_valido, paginas_falsas)
    fontes = [{"arquivo": LULA, "candidato": "lula", "sha256": "a" * 64, "coletado_em": "2026-10-17"},
              {"arquivo": FLAVIO, "candidato": "flavio-bolsonaro", "sha256": "b" * 64, "coletado_em": "2026-10-17"}]
    comp = verificar.montar("saude", "2026-10-17T20:00:00-03:00", saida, fontes)
    assert comp["theme_id"] == "saude" and set(comp["candidatos"]) == {"lula", "flavio-bolsonaro"}


def test_executivo_so_cita_o_resumo_verificado(conteudo_valido, paginas_falsas):
    """AC 44: ponto-chave só cita o resumo verificado do mesmo candidato, e no máximo 3 por candidato."""
    c = copy.deepcopy(conteudo_valido)
    sus = cit(LULA, 2, "Fortalecer o Sistema Único de Saúde")
    c["candidatos"]["lula"]["executivo"] = [
        bullet("Fortalecer o SUS.", sus),
        bullet("Escola integral.", cit(LULA, 1, "ampliar a escola em tempo integral")),  # literal, fora do resumo
        bullet("Dois.", sus), bullet("Três.", sus), bullet("Quatro.", sus)]
    c["candidatos"]["flavio-bolsonaro"]["executivo"] = [bullet("Do outro plano.", sus)]
    saida, descartes, mantidos = verificar.verificar("t", c, paginas_falsas)
    assert [b["texto"] for b in saida["candidatos"]["lula"]["executivo"]] == ["Fortalecer o SUS.", "Dois.", "Três."]
    assert saida["candidatos"]["flavio-bolsonaro"]["executivo"] == []
    assert [(d["lista"], d["candidato"], d["motivo"], d["item"]["texto"]) for d in descartes] == [
        ("executivo", "flavio-bolsonaro", "fora_do_resumo", "Do outro plano."),
        ("executivo", "lula", "fora_do_resumo", "Escola integral."),
        ("executivo", "lula", "acima_do_limite", "Quatro.")]
    assert [m["item"]["texto"] for m in mantidos if m["lista"] == "executivo"] == ["Fortalecer o SUS.", "Dois.", "Três."]
    assert list(saida["candidatos"]["lula"]) == ["nao_encontrado", "resumo", "executivo"]


def test_executivo_passa_pelo_juiz_e_cai_com_o_resumo(conteudo_valido, paginas_falsas):
    """O juiz julga o ponto-chave; e um ponto que cita bullet descartado sai como fora_do_resumo."""
    c = copy.deepcopy(conteudo_valido)
    sus = cit(LULA, 2, "Fortalecer o Sistema Único de Saúde")
    tabela = cit(FLAVIO, 2, "Vamos corrigir a Tabela SUS.")
    c["candidatos"]["lula"]["executivo"] = [bullet("Fortalecer o SUS.", sus)]
    c["candidatos"]["flavio-bolsonaro"]["executivo"] = [bullet("Ponto sem base.", tabela)]

    def juiz(texto, citacoes, chave):
        return {"sustentado": texto not in ("Ponto sem base.", "Fortalecer o SUS."), "justificativa": "x"}
    saida, descartes, _ = verificar.verificar("t", c, paginas_falsas, juiz)
    assert saida["candidatos"]["flavio-bolsonaro"]["executivo"] == []
    assert saida["candidatos"]["lula"] == {"nao_encontrado": True, "resumo": [], "executivo": []}
    assert [(d["lista"], d["candidato"], d["motivo"]) for d in descartes] == [
        ("executivo", "flavio-bolsonaro", "nao_sustentado"),
        ("resumo", "lula", "nao_sustentado"),
        ("executivo", "lula", "fora_do_resumo")]
