"""AC 4: tamanho, sobreposição e fronteira de seção."""
import json
import re

from rag_planos import chunk, config, extrair
from rag_planos.literal import trecho_na_pagina

from .conftest import pagina_falsa


def _texto(n_palavras: int, prefixo: str = "w") -> str:
    return " ".join(f"{prefixo}{i}" for i in range(n_palavras))


def test_tamanho_e_sobreposicao():
    for total in (801, 1000, 1500, 2600, 5000):
        cs = chunk.cortar_secao([pagina_falsa(1, _texto(total))])
        assert len(cs) >= 2
        for c in cs:
            assert 400 <= c["tokens"] <= 800, (total, c["tokens"])
        for a, b in zip(cs, cs[1:]):
            sobra = a["fim_token"] - b["inicio_token"]
            assert 0.13 <= sobra / a["tokens"] <= 0.17, (total, sobra, a["tokens"])
        assert cs[0]["inicio_token"] == 0 and cs[-1]["fim_token"] == total


def test_nao_cruza_secao():
    paginas = [pagina_falsa(1, _texto(300, "a"), "A"), pagina_falsa(2, _texto(300, "b"), "B"),
               pagina_falsa(3, _texto(900, "c"), "B")]
    cs = chunk.cortar(paginas, "lula", "PT", "x.pdf")
    for c in cs:
        prefixos = {w[0] for w in c["texto"].split(" ")}
        assert len(prefixos) == 1 or prefixos == {"b", "c"}
        assert ("a" in prefixos) == (c["secao"] == "A")


def test_secao_curta_um_chunk():
    cs = chunk.cortar([pagina_falsa(5, _texto(120), "Curta")], "lula", "PT", "x.pdf")
    assert len(cs) == 1 and cs[0]["tokens"] == 120 and cs[0]["pagina"] == 5


def test_chunks_reais_respeitam_limites(chunks_reais):
    for c in chunks_reais:
        assert c["tokens"] <= 800


def test_viradas_marcam_cada_pagina():
    """L27: onde cada página começa no texto do chunk, e o texto com os marcadores para o prompt."""
    a, b = _texto(200, "a"), _texto(200, "b")
    cs = chunk.cortar([pagina_falsa(1, a, "S"), pagina_falsa(2, b, "S")], "lula", "PT", "x.pdf")
    assert len(cs) == 1
    c = cs[0]
    assert c["viradas"] == [[0, 1], [len(a) + 1, 2]]
    assert chunk.texto_marcado(c) == f"[página 1] {a} [página 2] {b}"
    assert chunk.texto_marcado({**c, "viradas": None}) == f"[página 1-2] {c['texto']}"


def test_viradas_reais_batem_com_as_paginas(chunks_reais, paginas):
    """L27 nos 84 chunks reais: cada trecho entre marcadores está, literalmente, na sua página."""
    assert len(chunks_reais) == 84
    for c in chunks_reais:
        v = c["viradas"]
        assert v[0] == [0, c["pagina"]] and [p for _, p in v] == c["paginas"], c["id"]
        assert re.sub(r"\[página \d+\] ", "", chunk.texto_marcado(c)) == c["texto"], c["id"]
        for i, (inicio, pag) in enumerate(v):
            fim = v[i + 1][0] if i + 1 < len(v) else len(c["texto"])
            trecho = c["texto"][inicio:fim].strip()
            assert trecho and trecho_na_pagina(trecho, extrair.texto_da_pagina(paginas, c["arquivo"], pag)), \
                (c["id"], pag)


def test_chunks_gravados_iguais_aos_recalculados(chunks_reais):
    """L12: dados/chunks/chunks.json é o que o código produz hoje. `temas` admite as confianças do
    LLM de um `ingest` com chave: cada tema das palavras-chave fica, com confiança >= a delas."""
    gravados = json.loads((config.DADOS / "chunks" / "chunks.json").read_text(encoding="utf-8"))
    assert len(gravados) == len(chunks_reais) == 84
    for g, r in zip(gravados, chunks_reais):
        assert {k: v for k, v in g.items() if k != "temas"} == {k: v for k, v in r.items() if k != "temas"}, r["id"]
        conf = {t["theme_id"]: t["confianca"] for t in g["temas"]}
        assert all(conf.get(t["theme_id"], -1) >= t["confianca"] for t in r["temas"]), r["id"]
