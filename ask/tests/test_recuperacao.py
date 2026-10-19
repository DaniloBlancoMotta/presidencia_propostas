"""Índice híbrido: janelas, versão, buscas separadas por candidato e recall no conjunto-ouro."""
import numpy as np
import yaml

from ask import indice
from ask.avaliar import perguntas_do_ouro
from rag_planos import config as cp

from .conftest import EmbeddingsFalsas


def test_janelas_cobrem_o_texto_todo():
    t = " ".join(f"p{i}" for i in range(200))
    js = indice.janelas(t, n=80, passo=60)
    assert js[0].split()[0] == "p0" and js[-1].split()[-1] == "p199"
    assert all(len(j.split()) == 80 for j in js)
    assert indice.janelas("curto demais") == ["curto demais"]


def test_versao_muda_com_pdf_ou_modelo():
    f = [{"sha256": "a" * 64}, {"sha256": "b" * 64}]
    v = indice.versao_indice(f, "m1")
    assert v == indice.versao_indice(list(reversed(f)), "m1")
    assert v != indice.versao_indice(f, "m2")
    assert v != indice.versao_indice([{"sha256": "c" * 64}, f[1]], "m1")


def test_busca_separada_por_candidato(indice_falso):
    for cid in cp.CANDIDATOS:
        res = indice_falso.buscar("filas do SUS e consultas com especialistas", cid, k=5)
        assert len(res) == 5 and all(c["candidato"] == cid for c in res)


def test_indice_persistido_e_recarregado(tmp_path, chunks):
    e = EmbeddingsFalsas()
    a = indice.Indice.carregar_ou_construir(chunks, e, "v1", pasta=tmp_path)
    assert (tmp_path / "v1.npz").exists()
    b = indice.Indice.carregar_ou_construir(chunks, e, "v1", pasta=tmp_path)
    assert np.array_equal(a.vetores, b.vetores) and np.array_equal(a.dono, b.dono)


def test_recall_no_conjunto_ouro_com_o_modelo_real(chunks):
    """§11 "Recuperação": a página do ouro está entre os 5 trechos do candidato, e também dentro dos
    recortes que vão ao modelo, em ≥ 90% dos itens. Medido em 18/10/2026 com a fusão ponderada
    (BM25 1,0, vetorial 0,5): 53/54 nos dois; pesos iguais 52/54; BM25 sozinho 51/54."""
    fontes = yaml.safe_load((cp.DADOS / "fontes.json").read_text(encoding="utf-8"))
    e = indice.EmbeddingsLocais()
    ind = indice.Indice.carregar_ou_construir(chunks, e, indice.versao_indice(fontes, e.nome))
    ouro = yaml.safe_load((cp.DADOS / "ouro" / "conjunto-ouro.yaml").read_text(encoding="utf-8"))["itens"]
    qs = perguntas_do_ouro(ouro)
    nos_chunks, nos_recortes = [], []
    for q in qs:
        v = e([q["pergunta"]])[0]
        cs = ind.buscar(q["pergunta"], q["candidato"], vetor_pergunta=v)
        if q["pagina"] in {p for c in cs for p in c["paginas"]}:
            nos_chunks.append(q)
        if q["pagina"] in {p for c in cs for r in ind.recortes(c, v) for p in r["paginas"]}:
            nos_recortes.append(q)
    assert len(qs) >= 30
    assert len(nos_chunks) / len(qs) >= 0.9, [q["pergunta"] for q in qs if q not in nos_chunks]
    assert len(nos_recortes) / len(qs) >= 0.9, [q["pergunta"] for q in qs if q not in nos_recortes]


def test_recortes_mantem_a_pagina_de_cada_trecho(indice_falso, paginas):
    """Todo trecho de um recorte está na página que o marcador `[página N]` do recorte indica."""
    from rag_planos.literal import trecho_na_pagina
    v = indice_falso.embeddings(["saúde fila prontuário"])[0]
    for c in indice_falso.chunks[:30]:
        for r in indice_falso.recortes(c, v):
            assert r["texto"] and r["texto"] in c["texto"]
            limites = r["viradas"] + [[len(r["texto"]), None]]
            for (a, pag), (b, _) in zip(limites, limites[1:]):
                pedaco = r["texto"][a:b].strip()
                if len(pedaco) > 30:
                    meio = pedaco[len(pedaco) // 2 - 10: len(pedaco) // 2 + 10]
                    assert trecho_na_pagina(meio, paginas[c["arquivo"]][pag - 1]["texto"]), (c["id"], pag)
