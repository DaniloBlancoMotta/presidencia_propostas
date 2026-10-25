"""AC 12: relatório HTML de revisão; e o elo relatório -> aprovação (AC 13, lado do pipeline)."""
import copy
import hashlib

import yaml

from rag_planos import aprovar, relatorio, verificar

from .conftest import LULA, FLAVIO, bullet, cit

TEMA = {"id": "saude", "rotulo": "Saúde"}
FONTES = [{"arquivo": LULA, "candidato": "lula", "sha256": "a" * 64, "coletado_em": "2026-10-17"},
          {"arquivo": FLAVIO, "candidato": "flavio-bolsonaro", "sha256": "b" * 64, "coletado_em": "2026-10-17"}]


def _gerar(tmp_path, conteudo, paginas):
    saida, descartes, mantidos = verificar.verificar("saude", conteudo, paginas)
    comp = verificar.montar("saude", "2026-10-17T20:00:00-03:00", saida, FONTES)
    js = tmp_path / "comparacoes" / "saude.json"
    js.parent.mkdir(parents=True, exist_ok=True)
    js.write_bytes(verificar.serializar(comp))
    sha = hashlib.sha256(js.read_bytes()).hexdigest()
    rel = relatorio.gerar(TEMA, comp, sha, "teste", mantidos, descartes, tmp_path / "relatorios" / "saude.html")
    return rel, sha, comp


def test_relatorio_completo(tmp_path, conteudo_valido, paginas_falsas):
    c = copy.deepcopy(conteudo_valido)
    c["candidatos"]["lula"]["resumo"].append(bullet("Inventado.", cit(LULA, 2, "frase que não existe")))
    rel, sha, comp = _gerar(tmp_path, c, paginas_falsas)
    html = rel.read_text(encoding="utf-8")
    assert "Fortalecer o SUS." in html and "Corrigir a Tabela SUS." in html
    assert "Fortalecer o Sistema Único de Saúde" in html  # trecho
    assert f"../../corpus/{LULA}#page=2" in html  # link para a página
    assert "Inventado." in html and "trecho_nao_encontrado" in html  # descarte com motivo
    assert "Citações por candidato" in html
    assert "<th>Pontos-chave</th>" in html
    assert "resumo executivo com menos de 3 pontos-chave: Flávio Bolsonaro (0), Lula (0)." in html
    contagem = relatorio.contagem_por_candidato(comp)
    assert contagem == {"flavio-bolsonaro": 3, "lula": 2}
    assert f"<td>Lula</td><td>{contagem['lula']}</td>" in html
    assert relatorio.sha256_do_relatorio(rel) == sha


def test_aprovar_so_com_relatorio_do_mesmo_json(tmp_path, conteudo_valido, paginas_falsas):
    rel, sha, _ = _gerar(tmp_path, conteudo_valido, paginas_falsas)
    ap = tmp_path / "aprovados.yaml"
    assert aprovar.aprovar("saude", tmp_path / "comparacoes", tmp_path / "relatorios", ap) == 0
    assert yaml.safe_load(ap.read_text())["saude"] == sha
    js = tmp_path / "comparacoes" / "saude.json"
    js.write_bytes(js.read_bytes().replace(b"Fortalecer o SUS.", b"Fortalecer o SUS!"))
    assert aprovar.aprovar("saude", tmp_path / "comparacoes", tmp_path / "relatorios", ap) != 0
    assert yaml.safe_load(ap.read_text())["saude"] == sha
