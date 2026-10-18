"""AC 2 e AC 3: SHA-256, data de coleta e conferência contra o TSE."""
import hashlib
import json
import shutil

from rag_planos import config, fontes


def _corpus(tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    for c in config.CANDIDATOS.values():
        shutil.copy(config.CORPUS / c["arquivo"], corpus / c["arquivo"])
    return corpus


def test_grava_sha256_e_data(tmp_path):
    corpus = _corpus(tmp_path)
    tse = tmp_path / "tse"
    shutil.copytree(corpus, tse)
    destino = tmp_path / "fontes.json"
    rc = fontes.principal(str(tse), [], "2026-10-17", corpus=corpus, destino=destino)
    assert rc == 0
    dados = json.loads(destino.read_text(encoding="utf-8"))
    assert {d["arquivo"] for d in dados} == {c["arquivo"] for c in config.CANDIDATOS.values()}
    for d in dados:
        esperado = hashlib.sha256((corpus / d["arquivo"]).read_bytes()).hexdigest()
        assert d["sha256"] == esperado
        assert d["coletado_em"] == "2026-10-17"
        assert d["conferido_tse"] is True


def test_hash_divergente_sai_nao_zero(tmp_path, capsys):
    corpus = _corpus(tmp_path)
    tse = tmp_path / "tse"
    shutil.copytree(corpus, tse)
    alvo = tse / "plano-de-governo_flavio.pdf"
    alvo.write_bytes(alvo.read_bytes() + b"\n%alterado")
    destino = tmp_path / "fontes.json"
    rc = fontes.principal(str(tse), [], "2026-10-17", corpus=corpus, destino=destino)
    assert rc != 0
    assert "plano-de-governo_flavio.pdf" in capsys.readouterr().err
    assert not destino.exists()


def test_sem_tse_exige_data(tmp_path):
    corpus = _corpus(tmp_path)
    assert fontes.principal(None, [], None, sem_tse=True, corpus=corpus, destino=tmp_path / "f.json") != 0
    assert fontes.principal(None, [], "2026-10-17", sem_tse=True, corpus=corpus,
                            destino=tmp_path / "f.json") == 0
    assert all(d["conferido_tse"] is False for d in json.loads((tmp_path / "f.json").read_text()))
