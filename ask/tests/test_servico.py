"""Cadeia de provedores, cache, limite de taxa e o contrato HTTP do /ask (plano-final §11)."""
import json
from datetime import date

import numpy as np
import pytest
from fastapi.testclient import TestClient

from ask import config
from ask.cache import Cache
from ask.limite import Limite
from ask.provedores import Cadeia, Provedor, SemProvedor, decodificar
from ask.servico import Servico
from ask.servidor import criar_app

from .conftest import EmbeddingsFalsas, ModeloFalso, arquivo_do_prompt, cadeia


class Relogio:
    def __init__(self, t=1000.0):
        self.t = t

    def __call__(self):
        return self.t


# --- cadeia -----------------------------------------------------------------------------------

def test_passa_ao_proximo_provedor_quando_um_falha():
    def falha(_):
        raise RuntimeError("429")
    cad = cadeia(falha, lambda _: '{"ok": 1}')
    dados, nome = cad.json("p", prazo=cad.relogio() + 30)
    assert dados == {"ok": 1} and nome == "p1"


def test_disjuntor_abre_depois_de_3_falhas_por_5_minutos():
    rel = Relogio()
    chamadas = []

    def falha(p):
        chamadas.append(p)
        raise RuntimeError("503")
    cad = cadeia(falha, lambda _: "{}", relogio=rel)
    for _ in range(3):
        cad.json("p", prazo=rel() + 30)
    assert len(chamadas) == 3 and cad.disponiveis() == ["p1"]
    cad.json("p", prazo=rel() + 30)
    assert len(chamadas) == 3  # aberto: nem tenta
    rel.t += config.PAUSA_DISJUNTOR_S + 1
    cad.json("p", prazo=rel() + 30)
    assert len(chamadas) == 4


def test_timeout_de_10_s_passa_ao_proximo():
    import time
    cad = Cadeia([Provedor("lento", ModeloFalso(lambda _: time.sleep(0.5) or "{}")),
                  Provedor("rapido", ModeloFalso(lambda _: '{"r": 1}'))], timeout=0.1)
    assert cad.json("p", prazo=cad.relogio() + 30) == ({"r": 1}, "rapido")


def test_sem_provedor_ou_sem_tempo():
    with pytest.raises(SemProvedor):
        Cadeia([]).json("p", prazo=1e12)
    cad = cadeia(lambda _: "{}")
    with pytest.raises(SemProvedor):
        cad.json("p", prazo=cad.relogio() + 0.5)  # menos de 1 s de orçamento: nem chama
    assert cad.provedores[0].modelo.prompts == []


def test_json_invalido_conta_como_falha_e_cerca_e_aceita():
    cad = cadeia(lambda _: "não é json", lambda _: '```json\n{"a": 2}\n```')
    assert cad.json("p", prazo=cad.relogio() + 30) == ({"a": 2}, "p1")
    assert decodificar(' {"x": 1} ') == {"x": 1}


# --- cache ------------------------------------------------------------------------------------

def test_cache_exato_semantico_e_so_gerado():
    e = EmbeddingsFalsas()
    c = Cache("v1", e, limiar=0.92)
    gerado = {"origem": "gerado", "candidatos": {}}
    c.guardar("Quais as propostas para as filas do SUS?", gerado)
    c.guardar("Outra pergunta", {"origem": "extrativo"})
    assert len(c) == 1
    assert c.obter("quais as propostas para as filas do sus") is gerado  # normalizada: acerto exato
    assert c.obter("Receita de bolo de fubá") is None


def test_cache_semantico_respeita_o_limiar():
    vetores = {"a": np.array([1.0, 0.0]), "b": np.array([0.95, np.sqrt(1 - 0.95 ** 2)]), "c": np.array([0.9, np.sqrt(1 - 0.81)])}
    c = Cache("v1", lambda ts: np.array([vetores[t] for t in ts]), limiar=0.92)
    r = {"origem": "gerado"}
    c.guardar("a", r)
    assert c.obter("b") is r and c.obter("c") is None


def test_cache_vence_em_30_11_2026_e_separa_versoes():
    hoje = {"d": date(2026, 11, 30)}
    c = Cache("v1", EmbeddingsFalsas(), hoje=lambda: hoje["d"])
    r = {"origem": "gerado"}
    c.guardar("pergunta", r)
    assert c.obter("pergunta") is r
    hoje["d"] = date(2026, 12, 1)
    assert c.obter("pergunta") is None
    assert Cache("v2", EmbeddingsFalsas())._chave("x") != Cache("v1", EmbeddingsFalsas())._chave("x")


# --- limite -----------------------------------------------------------------------------------

def test_limite_10_por_hora_com_janela_deslizante():
    rel = Relogio(1_800_000_000.0)
    lim = Limite(agora=rel)
    for i in range(10):
        assert lim.registrar("1.2.3.4") == (True, 0)
        rel.t += 60
    ok, espera = lim.registrar("1.2.3.4")
    assert ok is False and espera == 3600 - 600
    assert lim.registrar("5.6.7.8") == (True, 0)
    rel.t += espera
    assert lim.registrar("1.2.3.4")[0] is True


def test_limite_nao_guarda_ip_e_troca_a_chave_no_dia_seguinte():
    rel = Relogio(1_800_000_000.0)
    lim = Limite(agora=rel)
    lim.registrar("1.2.3.4")
    assert all("1.2.3.4" not in k for k in lim._pedidos)
    k1 = lim.chave("1.2.3.4")
    rel.t += 86400
    assert lim.chave("1.2.3.4") != k1 and lim._pedidos == {}


# --- HTTP -------------------------------------------------------------------------------------

@pytest.fixture
def cliente(indice_falso, paginas, bullets_reais):
    def r(prompt):
        arq = arquivo_do_prompt(prompt)
        return json.dumps({"nao_encontrado": False, "resumo": bullets_reais[arq][:1]}, ensure_ascii=False)
    linhas = []
    s = Servico(indice_falso, cadeia(r), paginas, registrar=linhas.append)
    app = criar_app(s, origem_site="https://comparador.exemplo")
    with TestClient(app) as c:
        c.linhas = linhas
        yield c


def test_health(cliente):
    r = cliente.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_contrato_da_resposta_e_cache(cliente):
    r = cliente.post("/ask", json={"pergunta": "Como os planos tratam o prontuário eletrônico?"})
    assert r.status_code == 200
    d = r.json()
    assert d["origem"] == "gerado" and d["camada"] == "plano"
    assert set(d["candidatos"]) == {"flavio-bolsonaro", "lula"}
    for area in d["candidatos"].values():
        assert set(area) == {"nao_encontrado", "resumo"}
        for b in area["resumo"]:
            assert set(b) == {"texto", "citacoes"} and all(set(c) == {"arquivo", "pagina", "trecho"} for c in b["citacoes"])
    assert d["modelos"] == ["p0"] and set(d["contexto"]) == {"pergunta", "termos", "trechos"}
    r2 = cliente.post("/ask", json={"pergunta": "como os planos tratam o prontuario eletronico"})
    assert r2.json()["origem"] == "cache" and r2.json()["candidatos"] == d["candidatos"]
    # do cache, o contexto mostra a pergunta que foi de fato respondida
    assert r2.json()["contexto"]["pergunta"] == "Como os planos tratam o prontuário eletrônico?"


def test_erros_do_contrato(cliente):
    assert cliente.post("/ask", json={"pergunta": "x" * 301}).json() == {"erro": "pergunta_muito_longa"}
    assert cliente.post("/ask", json={"pergunta": "   "}).json() == {"erro": "pergunta_vazia"}
    assert cliente.post("/ask", content=b"{nao json").json() == {"erro": "pedido_invalido"}
    r = cliente.post("/ask", json={"pergunta": "x" * 301})
    assert r.status_code == 400


def test_recusa_por_regra_sem_chamar_modelo(cliente, indice_falso):
    r = cliente.post("/ask", json={"pergunta": "Em quem devo votar no domingo?"}).json()
    assert r["recusada"] is True and r["motivo"] == "opiniao"
    assert r["modelos"] == [] and r["contexto"]["pergunta"] == "Em quem devo votar no domingo?"
    assert r["contexto"]["trechos"] == {"flavio-bolsonaro": [], "lula": []}
    assert all(a == {"nao_encontrado": True, "resumo": []} for a in r["candidatos"].values())


def test_limite_429_com_retry_after(cliente):
    for i in range(config.LIMITE_POR_HORA):
        assert cliente.post("/ask", json={"pergunta": f"Em quem votar {i}"}).status_code == 200
    r = cliente.post("/ask", json={"pergunta": "mais uma"}, headers={"Origin": "https://comparador.exemplo"})
    assert r.status_code == 429 and r.json() == {"erro": "limite"} and int(r.headers["retry-after"]) > 0
    assert "retry-after" in r.headers["access-control-expose-headers"].lower()  # o site lê a espera


def test_cabecalhos_e_cors(cliente):
    r = cliente.post("/ask", json={"pergunta": "Quem vai ganhar?"}, headers={"Origin": "https://comparador.exemplo"})
    assert r.headers["access-control-allow-origin"] == "https://comparador.exemplo"
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["referrer-policy"] == "no-referrer"
    assert r.headers["content-security-policy"].startswith("default-src 'none'")
    assert "x-provedores" not in r.headers
    outra = cliente.post("/ask", json={"pergunta": "Quem vai ganhar?"}, headers={"Origin": "https://outro.exemplo"})
    assert "access-control-allow-origin" not in outra.headers
    pre = cliente.options("/ask", headers={"Origin": "https://outro.exemplo", "Access-Control-Request-Method": "POST"})
    assert pre.status_code == 400


def test_erro_interno_sem_detalhe(indice_falso, paginas):
    s = Servico(indice_falso, cadeia(lambda _: "{}"), paginas, registrar=lambda _: None)
    s.cache.vetor = lambda _: (_ for _ in ()).throw(RuntimeError("segredo interno"))
    with TestClient(criar_app(s)) as c:
        r = c.post("/ask", json={"pergunta": "O que os planos dizem sobre creches?"})
    assert r.status_code == 500 and r.json() == {"erro": "interno"} and "segredo" not in r.text


def test_registro_sem_ip_nem_texto_da_pergunta(cliente):
    cliente.post("/ask", json={"pergunta": "O que os planos dizem sobre creches?"})
    linha = json.dumps(cliente.linhas[-1], ensure_ascii=False)
    assert "creches" not in linha and "testclient" not in linha and "127.0.0.1" not in linha
    assert len(cliente.linhas[-1]["pergunta"]) == 12 and cliente.linhas[-1]["status"] == 200
