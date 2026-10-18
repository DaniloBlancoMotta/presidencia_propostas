"""AC 14 e AC 15: recall do conjunto-ouro e as 7 convergências."""
from rag_planos import avaliar

from .conftest import FLAVIO, LULA, bullet, cit


def _comp(tid, pags_lula, pags_flavio, semelhancas=()):
    return {"theme_id": tid,
            "candidatos": {"lula": {"nao_encontrado": False, "resumo": [bullet("x", *[cit(LULA, p, "t") for p in pags_lula])]},
                           "flavio-bolsonaro": {"nao_encontrado": False, "resumo": [bullet("x", *[cit(FLAVIO, p, "t") for p in pags_flavio])]}},
            "semelhancas": [{"texto": "s", "camada": "plano", "citacoes": {"lula": [cit(LULA, pl, "t")],
                                                                          "flavio-bolsonaro": [cit(FLAVIO, pf, "t")]}}
                            for pl, pf in semelhancas],
            "diferencas": [], "omissoes": []}


def _cenario():
    """30 itens de ouro em `saude` (15 por candidato, págs. 1-15) e as 7 convergências presentes."""
    itens = [{"theme_id": "saude", "candidato": c, "descricao": f"{c}-{p}", "pagina": p}
             for c in ("lula", "flavio-bolsonaro") for p in range(1, 16)]
    convs, comps = [], {}
    por_tema: dict[str, list] = {}
    for i, (cid, _, tid) in enumerate(avaliar.CONVERGENCIAS):
        convs.append({"id": cid, "theme_id": tid, "paginas": {"lula": [100 + i], "flavio-bolsonaro": [200 + i]}})
        por_tema.setdefault(tid, []).append((100 + i, 200 + i))
    for tid, sem in por_tema.items():
        comps[tid] = _comp(tid, [], [], sem)
    comps["saude"] = _comp("saude", range(1, 16), range(1, 16), por_tema["saude"])
    return {"itens": itens, "convergencias": convs}, comps


def test_cenario_completo_aprova():
    ouro, comps = _cenario()
    ok, linhas = avaliar.avaliar(ouro, comps)
    assert ok, linhas


def test_recall_baixo_sai_nao_zero():
    ouro, comps = _cenario()
    # lula cita só as págs. 1-13: 13/15 = 86,7% < 90%
    comps["saude"]["candidatos"]["lula"]["resumo"] = [bullet("x", *[cit(LULA, p, "t") for p in range(1, 14)])]
    ok, linhas = avaliar.avaliar(ouro, comps)
    assert not ok
    assert any(l.startswith("FALHA: saude / lula: 87%") for l in linhas)
    assert any("faltou: lula-14 (pág. 14)" in l for l in linhas)
    assert any("faltou: lula-15 (pág. 15)" in l for l in linhas)


def test_recall_exatamente_90_passa():
    ouro, comps = _cenario()
    ouro["itens"] = [i for i in ouro["itens"] if not (i["candidato"] == "lula" and i["pagina"] > 10)]
    ouro["itens"] += [{"theme_id": "educacao", "candidato": "lula", "descricao": f"e{p}", "pagina": p}
                      for p in range(1, 6)]
    comps["saude"]["candidatos"]["lula"]["resumo"] = [bullet("x", *[cit(LULA, p, "t") for p in range(1, 10)])]
    comps["educacao"]["candidatos"]["lula"]["resumo"] = [bullet("x", *[cit(LULA, p, "t") for p in range(1, 6)])]
    ok, linhas = avaliar.avaliar(ouro, comps)
    assert any("saude / lula: 90% (9/10)" in l for l in linhas)
    assert ok, linhas


def test_convergencia_faltando_sai_nao_zero():
    ouro, comps = _cenario()
    comps["agronegocio"]["semelhancas"] = comps["agronegocio"]["semelhancas"][:1]
    ok, linhas = avaliar.avaliar(ouro, comps)
    assert not ok
    assert any(l.startswith("FALHA: convergência regularização fundiária") for l in linhas)


def test_ouro_com_menos_de_30_itens_reprova():
    ouro, comps = _cenario()
    ouro["itens"] = ouro["itens"][:29]
    ok, linhas = avaliar.avaliar(ouro, comps)
    assert not ok and "mínimo 30" in linhas[0]


def test_comando_avaliar_sai_nao_zero(tmp_path):
    """AC 14/15 no nível do comando: `python -m rag_planos avaliar` devolve código != 0."""
    import json
    import yaml
    from rag_planos.__main__ import main
    ouro, comps = _cenario()
    comps["saude"]["candidatos"]["lula"]["resumo"] = [bullet("x", cit(LULA, 1, "t"))]
    (tmp_path / "comparacoes").mkdir()
    for tid, c in comps.items():
        (tmp_path / "comparacoes" / f"{tid}.json").write_text(json.dumps(c), encoding="utf-8")
    (tmp_path / "ouro.yaml").write_text(yaml.safe_dump(ouro), encoding="utf-8")
    assert avaliar.principal(tmp_path / "ouro.yaml", tmp_path / "comparacoes") == 1
    comps["saude"]["candidatos"]["lula"]["resumo"] = [bullet("x", *[cit(LULA, p, "t") for p in range(1, 16)])]
    (tmp_path / "comparacoes" / "saude.json").write_text(json.dumps(comps["saude"]), encoding="utf-8")
    assert avaliar.principal(tmp_path / "ouro.yaml", tmp_path / "comparacoes") == 0
    calls = []
    original = avaliar.principal
    avaliar.principal = lambda: calls.append(1) or original(tmp_path / "ouro.yaml", tmp_path / "comparacoes")
    try:
        assert main(["avaliar"]) == 0  # o comando devolve o código de `principal`
        comps["saude"]["candidatos"]["lula"]["resumo"] = [bullet("x", cit(LULA, 1, "t"))]
        (tmp_path / "comparacoes" / "saude.json").write_text(json.dumps(comps["saude"]), encoding="utf-8")
        assert main(["avaliar"]) == 1
    finally:
        avaliar.principal = original
    assert calls == [1, 1]
