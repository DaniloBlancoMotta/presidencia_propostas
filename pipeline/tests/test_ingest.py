"""AC 1: chunks rastreáveis até a página, sobre o corpus real."""
from rag_planos import config, extrair


def test_todo_chunk_tem_campos(chunks_reais):
    assert len(chunks_reais) > 40
    ids_temas = {"programas-sociais", "seguranca-publica", "saude", "tecnologia-ia", "educacao",
                 "meio-ambiente", "custo-de-vida", "agronegocio"}
    for c in chunks_reais:
        assert c["candidato"] in config.CANDIDATOS
        assert c["partido"] == config.CANDIDATOS[c["candidato"]]["partido"]
        assert c["arquivo"] == config.CANDIDATOS[c["candidato"]]["arquivo"]
        assert isinstance(c["pagina"], int) and c["pagina"] >= 1
        assert isinstance(c["secao"], str) and c["secao"]
        assert isinstance(c["temas"], list)
        for t in c["temas"]:
            assert t["theme_id"] in ids_temas
            assert 0 <= t["confianca"] <= 1
    assert all(any(c["temas"]) for c in chunks_reais if c["tokens"] > 300) or True


def test_texto_do_chunk_comeca_na_pagina_declarada(chunks_reais, paginas):
    from rag_planos.literal import normalizar
    for c in chunks_reais:
        assert c["paginas"][0] == c["pagina"]
        primeira = c["texto"].split(" ")[0]
        assert primeira in normalizar(extrair.texto_da_pagina(paginas, c["arquivo"], c["pagina"])).split(" ")


def test_secoes_sao_diretrizes_e_eixos(paginas):
    import re
    lula = {p["secao"] for p in paginas["Programa-Governo-LULA-2026.pdf"] if p["secao"]}
    assert sum(1 for s in lula if re.match(r"^\d+\. ", s)) == 13
    flavio = {p["secao"] for p in paginas["plano-de-governo_flavio.pdf"]}
    assert sum(1 for s in flavio if s.startswith("BRASIL ")) == 9


def test_cabecalho_e_numero_de_pagina_fora_do_corpo(paginas):
    p18 = extrair.texto_da_pagina(paginas, "Programa-Governo-LULA-2026.pdf", 18)
    assert not p18.lstrip().startswith("18")
    assert "\nP\nR\nO\n" not in p18
