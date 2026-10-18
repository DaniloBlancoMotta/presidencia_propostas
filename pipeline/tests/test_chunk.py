"""AC 4: tamanho, sobreposição e fronteira de seção."""
from rag_planos import chunk

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
