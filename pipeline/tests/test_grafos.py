"""Camada de LLM em LangGraph (checks L1-L11, L13, L16-L26 e L28-L30 de .checks/migracao-langgraph.md).

Modelo falso em memória, ou o ChatGoogleGenerativeAI real contra um servidor HTTP local que imita
o endpoint do Gemini. Nenhum teste sai para a rede.
"""
import hashlib
import html
import itertools
import json
import re
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version
from pathlib import Path

import pytest

from rag_planos import classificar, comparar, extrair, grafos, llm, relatorio, verificar
from rag_planos.__main__ import main
from rag_planos.chunk import cortar as cortar_em_chunks

from .conftest import FLAVIO, LULA, bullet, cit, pagina_falsa

TEMA = {"id": "saude", "rotulo": "Saúde", "descricao": "SUS e atenção básica"}
RAPIDO = grafos.RETRY._replace(initial_interval=0.01, jitter=False)
INVENTADO = "Contratar cem mil médicos estrangeiros"  # não está em nenhuma página
RAIZ = Path(__file__).resolve().parents[2]


class _Resposta:
    def __init__(self, text):
        self.text = text


class ModeloFalso:
    """Chat model falso: `responder(prompt) -> str`; `latencia(prompt) -> segundos`."""

    def __init__(self, responder, latencia=None):
        self.responder, self.latencia = responder, latencia
        self.prompts, self.terminados = [], []
        self._trava = threading.Lock()

    def invoke(self, prompt):
        with self._trava:
            self.prompts.append(prompt)
        if self.latencia:
            time.sleep(self.latencia(prompt))
        with self._trava:
            self.terminados.append(prompt)
        return _Resposta(self.responder(prompt))


def gerador(modelo, pasta):
    return llm.Gerador(modelo, "gemini", "gemini-3.8-flash", pasta)


def chunk(candidato, pagina, texto, tema="saude"):
    return {"candidato": candidato, "pagina": pagina, "paginas": [pagina], "texto": texto,
            "temas": [{"theme_id": tema, "confianca": 0.9}]}


def chunks_do_corpus(tema="saude", so=None):
    todos = [chunk("lula", 2, "Fortalecer o Sistema Único de Saúde com mais médicos.", tema),
             chunk("flavio-bolsonaro", 2, "Vamos corrigir a Tabela SUS.", tema)]
    return [c for c in todos if so is None or c["candidato"] == so]


def responder(prompt):
    if prompt.startswith("Você resume"):
        if f"Arquivo: {LULA}" in prompt:
            return json.dumps({"nao_encontrado": False, "resumo": [
                bullet("Fortalecer o SUS.", cit(LULA, 2, "Fortalecer o Sistema Único de Saúde")),
                bullet(INVENTADO + ".", cit(LULA, 2, INVENTADO))]}, ensure_ascii=False)
        return json.dumps({"nao_encontrado": False, "resumo": [
            bullet("Corrigir a Tabela SUS.", cit(FLAVIO, 2, "Vamos corrigir a Tabela SUS."))]})
    if prompt.startswith("Você compara"):
        return json.dumps({"semelhancas": [], "omissoes": [], "diferencas": [
            {"texto": "Financiamento do SUS", "camada": "plano", "citacoes": {
                "flavio-bolsonaro": [cit(FLAVIO, 2, "Vamos corrigir a Tabela SUS.")],
                "lula": [cit(LULA, 2, "Fortalecer o Sistema Único de Saúde")]}}]}, ensure_ascii=False)
    raise AssertionError(f"prompt inesperado: {prompt[:60]}")


def _tipo(prompt):
    return prompt.split(" ")[1].rstrip(",")


# --- L1, L2: grafo comparar ------------------------------------------------------------------

def test_comparar_filtra_antes_de_comparar(tmp_path, paginas_falsas):
    m = ModeloFalso(responder)
    saida = comparar.com_llm(TEMA, chunks_do_corpus(), paginas_falsas, gerador(m, tmp_path))
    resumos = [p for p in m.prompts if p.startswith("Você resume")]
    comparacoes = [p for p in m.prompts if p.startswith("Você compara")]
    assert len(resumos) == 2 and len(comparacoes) == 1
    assert {f"Arquivo: {LULA}" in p for p in resumos} == {True, False}
    assert INVENTADO not in comparacoes[0]
    assert "Fortalecer o SUS." in comparacoes[0] and "Corrigir a Tabela SUS." in comparacoes[0]
    assert [b["texto"] for b in saida["candidatos"]["lula"]["resumo"]] == ["Fortalecer o SUS."]
    assert [b["texto"] for b in saida["candidatos"]["flavio-bolsonaro"]["resumo"]] == ["Corrigir a Tabela SUS."]
    assert INVENTADO not in json.dumps(saida, ensure_ascii=False)
    assert [d["texto"] for d in saida["diferencas"]] == ["Financiamento do SUS"]
    assert list(saida) == ["candidatos", "semelhancas", "diferencas", "omissoes"]


def test_comparar_devolve_executivo(tmp_path, paginas_falsas):
    """AC 39 e 44: o nó comparar devolve o resumo executivo, que entra em `candidatos` de cada um."""
    def resp(p):
        if p.startswith("Você compara"):
            r = json.loads(responder(p))
            r["executivo"] = {"lula": [bullet("Fortalecer o SUS.", cit(LULA, 2, "Fortalecer o Sistema Único de Saúde"))],
                              "flavio-bolsonaro": "fora do formato"}
            return json.dumps(r, ensure_ascii=False)
        return responder(p)
    m = ModeloFalso(resp)
    saida = comparar.com_llm(TEMA, chunks_do_corpus(), paginas_falsas, gerador(m, tmp_path))
    assert [b["texto"] for b in saida["candidatos"]["lula"]["executivo"]] == ["Fortalecer o SUS."]
    assert saida["candidatos"]["flavio-bolsonaro"]["executivo"] == []
    assert list(saida["candidatos"]["lula"]) == ["nao_encontrado", "resumo", "executivo"]
    assert "`executivo`: para cada candidato, exatamente 3 pontos-chave" in next(
        p for p in m.prompts if p.startswith("Você compara"))


def test_candidato_sem_chunks_nao_chama_modelo(tmp_path, paginas_falsas):
    m = ModeloFalso(responder)
    saida = comparar.com_llm(TEMA, chunks_do_corpus(so="lula"), paginas_falsas, gerador(m, tmp_path / "a"))
    assert [_tipo(p) for p in m.prompts] == ["resume", "compara"]
    assert f"Arquivo: {LULA}" in m.prompts[0]
    assert saida["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": [], "executivo": []}
    assert saida["candidatos"]["lula"]["nao_encontrado"] is False
    m2 = ModeloFalso(responder)
    vazio = comparar.com_llm(TEMA, [], paginas_falsas, gerador(m2, tmp_path / "b"))
    assert [_tipo(p) for p in m2.prompts] == ["compara"]
    assert all(v == {"nao_encontrado": True, "resumo": [], "executivo": []} for v in vazio["candidatos"].values())


# --- L3, L4: cache ---------------------------------------------------------------------------

def test_cache_segunda_execucao_sem_chamadas(tmp_path, paginas_falsas):
    m = ModeloFalso(responder)
    g1 = gerador(m, tmp_path)
    a = comparar.com_llm(TEMA, chunks_do_corpus(), paginas_falsas, g1)
    assert (g1.chamadas, g1.do_cache) == (3, 0)
    g2 = gerador(m, tmp_path)
    b = comparar.com_llm(TEMA, chunks_do_corpus(), paginas_falsas, g2)
    assert a == b
    assert len(m.prompts) == 3 and (g2.chamadas, g2.do_cache) == (0, 3)
    assert g2.resumo() == ("LLM gemini:gemini-3.8-flash: 0 chamadas, 3 do cache, 0 falhas, "
                           "0 tokens de entrada, 0 de saída")
    assert len(list(tmp_path.glob("*.json"))) == 3
    for p in m.prompts:
        nome = hashlib.sha256(("gemini:gemini-3.8-flash\n" + p).encode("utf-8")).hexdigest() + ".json"
        assert json.loads((tmp_path / nome).read_text(encoding="utf-8")) == {"resposta": responder(p)}
    outro = llm.Gerador(m, "gemini", "gemini-2.5-pro", tmp_path)
    assert outro.arquivo(m.prompts[0]) != g1.arquivo(m.prompts[0])


def test_cache_nao_colide_entre_temas(tmp_path, paginas_falsas):
    """Cenário em que o cache de nó do LangGraph quebrou na avaliação: A sem Lula, B sem Flávio."""
    m = ModeloFalso(responder)
    g = gerador(m, tmp_path)
    a = comparar.com_llm({**TEMA, "id": "tema-a"}, chunks_do_corpus("tema-a", so="flavio-bolsonaro"),
                         paginas_falsas, g)
    b = comparar.com_llm({**TEMA, "id": "tema-b"}, chunks_do_corpus("tema-b", so="lula"), paginas_falsas, g)
    assert a["candidatos"]["lula"] == {"nao_encontrado": True, "resumo": [], "executivo": []}
    assert [x["texto"] for x in a["candidatos"]["flavio-bolsonaro"]["resumo"]] == ["Corrigir a Tabela SUS."]
    assert b["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": [], "executivo": []}
    assert [x["texto"] for x in b["candidatos"]["lula"]["resumo"]] == ["Fortalecer o SUS."]


# --- L5: determinismo ------------------------------------------------------------------------

def test_mesma_entrada_mesmo_json(tmp_path, paginas_falsas, monkeypatch):
    monkeypatch.setenv("LLM_CONCORRENCIA", "4")
    saidas, ordens = set(), set()
    for i in range(5):
        lento = LULA if i % 2 == 0 else FLAVIO
        m = ModeloFalso(responder, latencia=lambda p, lento=lento: 0.15 if f"Arquivo: {lento}" in p else 0.0)
        c = comparar.com_llm(TEMA, chunks_do_corpus(), paginas_falsas, gerador(m, tmp_path / str(i)))
        saidas.add(json.dumps(c, ensure_ascii=False, indent=1))
        ordens.add(tuple(LULA in p for p in m.terminados if p.startswith("Você resume")))
    assert len(ordens) == 2, "os resumos devem terminar em ordens diferentes entre as execuções"
    assert len(saidas) == 1


# --- L6, L7: ChatGoogleGenerativeAI real contra servidor falso -------------------------------

class ServidorGemini:
    """POST /v1beta/models/<modelo>:generateContent. `roteiro`: o que responder antes do 200 -
    um status de erro, ou {"status", "corpo", "dormir"}; `uso`: usageMetadata do 200."""

    def __init__(self, texto='{"semelhancas": [], "diferencas": [], "omissoes": []}'):
        self.roteiro, self.pedidos, self.texto, self.uso = [], [], texto, None
        srv = self

        class H(BaseHTTPRequestHandler):
            def do_POST(self):
                corpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                srv.pedidos.append({"path": self.path, "corpo": corpo, "t": time.monotonic(),
                                    "headers": {k.lower(): v for k, v in self.headers.items()}})
                passo = srv.roteiro.pop(0) if srv.roteiro else 200
                passo = passo if isinstance(passo, dict) else {"status": passo}
                time.sleep(passo.get("dormir", 0))
                status = passo.get("status", 200)
                if status == 200:
                    resp = {"candidates": [{"content": {"role": "model", "parts": [{"text": srv.texto}]},
                                            "finishReason": "STOP"}]}
                    if srv.uso:
                        resp["usageMetadata"] = srv.uso
                else:
                    resp = passo.get("corpo") or {"error": {"code": status, "message": "falso", "status": "FALSO"}}
                dados = json.dumps(resp).encode()
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(dados)))
                    self.end_headers()
                    self.wfile.write(dados)
                except OSError:
                    pass  # cliente já desistiu (teste de tempo esgotado)

            def log_message(self, *a):
                pass

        self.http = ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.http.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.http.server_port}"


@pytest.fixture
def servidor():
    s = ServidorGemini()
    yield s
    s.http.shutdown()


def _comparar_real(servidor, pasta, paginas):
    g = llm.Gerador(llm.gemini(llm.MODELO_PADRAO, "chave-falsa", base_url=servidor.url),
                    "gemini", llm.MODELO_PADRAO, pasta)
    return grafos.comparar(g, TEMA, {}, paginas, retry=RAPIDO)


def test_retry_429_e_503_repetem(servidor, tmp_path, paginas_falsas):
    r = grafos.RETRY
    assert (r.max_attempts, r.initial_interval, r.backoff_factor, r.max_interval, r.jitter) == (5, 2.0, 2.0, 60.0, True)
    assert grafos.RETRY.retry_on is llm.deve_repetir and RAPIDO.max_attempts == 5
    servidor.roteiro = [429, 503]
    saida = _comparar_real(servidor, tmp_path, paginas_falsas)
    assert len(servidor.pedidos) == 3
    assert (saida["semelhancas"], saida["diferencas"], saida["omissoes"]) == ([], [], [])


def test_retry_400_nao_repete(servidor, tmp_path, paginas_falsas):
    servidor.roteiro = [400]
    with pytest.raises(Exception) as erro:
        _comparar_real(servidor, tmp_path, paginas_falsas)
    assert len(servidor.pedidos) == 1
    assert not llm.deve_repetir(erro.value)
    assert not list(tmp_path.glob("*.json"))


def test_retry_desiste_depois_de_5_tentativas(servidor, tmp_path, paginas_falsas):
    servidor.roteiro = [429] * 6
    with pytest.raises(Exception) as erro:
        _comparar_real(servidor, tmp_path, paginas_falsas)
    assert len(servidor.pedidos) == 5
    assert llm.deve_repetir(erro.value)


def test_requisicao_gemini(servidor, tmp_path, paginas_falsas):
    _comparar_real(servidor, tmp_path, paginas_falsas)
    p = servidor.pedidos[0]
    assert p["path"] == "/v1beta/models/gemini-3.8-flash:generateContent"
    assert p["corpo"]["generationConfig"]["temperature"] == 0
    assert p["corpo"]["generationConfig"]["responseMimeType"] == "application/json"
    assert p["headers"]["x-goog-api-key"] == "chave-falsa"
    assert "chave-falsa" not in p["path"]


# --- L8: resposta inválida -------------------------------------------------------------------

def test_json_invalido_fora_do_cache(tmp_path):
    respostas = iter(["isto não é JSON", '{"ok": true}'])
    m = ModeloFalso(lambda p: next(respostas))
    with pytest.raises(ValueError):
        gerador(m, tmp_path).json("p")
    assert not list(tmp_path.glob("*.json"))
    assert not llm.deve_repetir(ValueError("x"))
    g = gerador(m, tmp_path)  # a execução seguinte
    assert g.json("p") == {"ok": True}
    assert [a.name for a in tmp_path.glob("*.json")] == [g.arquivo("p").name]


# --- L16, L17, L24: ritmo, espera sugerida, rede e concorrência ------------------------------

def test_ritmo_por_cota(servidor, tmp_path, monkeypatch):
    from langchain_core.rate_limiters import InMemoryRateLimiter
    monkeypatch.setenv("GEMINI_API_KEY", "chave-falsa")
    monkeypatch.delenv("LLM_RPM", raising=False)
    assert llm.provedor_padrao().limitador is None
    monkeypatch.setenv("LLM_RPM", "600")
    p = llm.provedor_padrao()
    lim = p.limitador
    assert isinstance(lim, InMemoryRateLimiter)
    assert (lim.requests_per_second, lim.check_every_n_seconds, lim.max_bucket_size) == (10, 0.05, 1)
    assert p.modelo.rate_limiter is None  # o limitador fica no Gerador, fora do relógio da latência
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-falsa", base_url=servidor.url),
                    "gemini", "gemini-3.8-flash", tmp_path, limitador=llm.limitador(600))
    inicio = time.monotonic()
    for i in range(5):
        g.json(f"p{i}")
    assert time.monotonic() - inicio >= 0.4
    assert len(servidor.pedidos) == 5
    linhas = [json.loads(l) for l in (tmp_path / "chamadas.jsonl").read_text(encoding="utf-8").splitlines()]
    assert sum(l["espera_ms"] for l in linhas) >= 400


def _429_com_espera(segundos):
    return {"status": 429, "corpo": {"error": {"code": 429, "message": "cota", "status": "RESOURCE_EXHAUSTED",
                                               "details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo",
                                                            "retryDelay": segundos}]}}}


def test_retry_espera_sugerida(servidor, tmp_path, paginas_falsas):
    servidor.roteiro = [_429_com_espera("1s")]
    _comparar_real(servidor, tmp_path / "a", paginas_falsas)
    assert len(servidor.pedidos) == 2
    assert servidor.pedidos[1]["t"] - servidor.pedidos[0]["t"] >= 1.0
    servidor.pedidos.clear()
    servidor.roteiro = [_429_com_espera("30s")]
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-falsa", base_url=servidor.url),
                    "gemini", "gemini-3.8-flash", tmp_path / "b", espera_maxima=0.2)
    grafos.comparar(g, TEMA, {}, paginas_falsas, retry=RAPIDO)
    assert len(servidor.pedidos) == 2
    assert 0.2 <= servidor.pedidos[1]["t"] - servidor.pedidos[0]["t"] < 2.0
    assert llm.ESPERA_MAXIMA_SUGERIDA == 60.0 and llm.Gerador(None, "gemini", "m").espera_maxima == 60.0
    servidor.pedidos.clear()
    servidor.roteiro = [_429_com_espera("30s")] * 5  # a 5ª tentativa também recebe retryDelay
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-falsa", base_url=servidor.url),
                    "gemini", "gemini-3.8-flash", tmp_path / "c", espera_maxima=0.5)
    with pytest.raises(Exception):
        grafos.comparar(g, TEMA, {}, paginas_falsas, retry=RAPIDO)
    assert len(servidor.pedidos) == 5
    assert time.monotonic() - servidor.pedidos[-1]["t"] < 0.3  # sem espera depois da última


def test_retry_rede_e_500(servidor, tmp_path, paginas_falsas):
    servidor.roteiro = [500]
    _comparar_real(servidor, tmp_path / "a", paginas_falsas)
    assert len(servidor.pedidos) == 2
    servidor.pedidos.clear()
    servidor.roteiro = [{"dormir": 1.5}]  # mais que o timeout do cliente
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-falsa", base_url=servidor.url, timeout=0.5),
                    "gemini", "gemini-3.8-flash", tmp_path / "b")
    grafos.comparar(g, TEMA, {}, paginas_falsas, retry=RAPIDO)
    assert len(servidor.pedidos) == 2 and g.falhas == 1
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        porta = s.getsockname()[1]
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-falsa", base_url=f"http://127.0.0.1:{porta}"),
                    "gemini", "gemini-3.8-flash", tmp_path / "c")
    with pytest.raises(Exception) as erro:
        grafos.comparar(g, TEMA, {}, paginas_falsas, retry=RAPIDO)
    assert llm.deve_repetir(erro.value) and (g.chamadas, g.falhas) == (5, 5)


def test_concorrencia_limitada(tmp_path, monkeypatch):
    monkeypatch.setenv("LLM_CONCORRENCIA", "2")
    estado, trava = {"agora": 0, "pico": 0}, threading.Lock()

    def lento(p):
        with trava:
            estado["agora"] += 1
            estado["pico"] = max(estado["pico"], estado["agora"])
        time.sleep(0.05)
        with trava:
            estado["agora"] -= 1
        return 0

    grafos.classificar(gerador(ModeloFalso(lambda p: "[]", latencia=lento), tmp_path), [f"p{i}" for i in range(10)])
    assert estado["pico"] == 2


# --- L25, L26: variáveis e cota diária -------------------------------------------------------

def test_variaveis_vazias_ou_invalidas(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "chave-falsa")
    for nome in ("GEMINI_MODELO", "LLM_RPM", "LLM_CONCORRENCIA"):
        monkeypatch.setenv(nome, "")
    p = llm.provedor_padrao()
    assert (p.nome_modelo, p.limitador, llm.concorrencia()) == ("gemini-3.8-flash", None, 4)
    for valor in ("nan", "abc", "0", "-5", "inf"):
        monkeypatch.setenv("LLM_RPM", valor)
        with pytest.raises(SystemExit, match="ERRO: LLM_RPM"):
            llm.provedor_padrao()
    monkeypatch.setenv("LLM_RPM", "")
    for valor in ("0", "x", "2.5"):
        monkeypatch.setenv("LLM_CONCORRENCIA", valor)
        with pytest.raises(SystemExit, match="ERRO: LLM_CONCORRENCIA"):
            grafos.classificar(gerador(ModeloFalso(lambda q: "[]"), Path("/tmp/nao-usado")), ["p"])
    monkeypatch.setenv("LLM_CONCORRENCIA", "3")
    assert llm.concorrencia() == 3


def _429_cota(*quota_ids, espera="30s"):
    return {"status": 429, "corpo": {"error": {
        "code": 429, "message": "You exceeded your current quota", "status": "RESOURCE_EXHAUSTED",
        "details": [{"@type": "type.googleapis.com/google.rpc.QuotaFailure",
                     "violations": [{"quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                                     "quotaId": q} for q in quota_ids]},
                    {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": espera}]}}}


def test_cota_diaria_nao_repete(servidor, tmp_path, paginas_falsas, monkeypatch):
    servidor.roteiro = [_429_cota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", espera="0s")]
    _comparar_real(servidor, tmp_path / "minuto", paginas_falsas)
    assert len(servidor.pedidos) == 2  # por minuto: repete
    servidor.pedidos.clear()
    monkeypatch.setenv("LLM_CONCORRENCIA", "1")
    servidor.roteiro = [_429_cota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
                                  "GenerateRequestsPerDayPerProjectPerModel-FreeTier")]
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-falsa", base_url=servidor.url),
                    "gemini", "gemini-3.8-flash", tmp_path / "dia")
    inicio = time.monotonic()
    with pytest.raises(Exception) as erro:
        grafos.classificar(g, [f"p{i}" for i in range(6)], retry=RAPIDO)
    assert len(servidor.pedidos) == 1  # por dia: nem repete, nem chama as outras 5
    assert llm.cota_diaria(erro.value) and not llm.deve_repetir(erro.value)
    assert type(erro.value).__name__ == "GoogleRateLimitError"
    assert time.monotonic() - inicio < 2.0


# --- L18-L22: telemetria, formato, prompt idêntico, erro definitivo, página -------------------

def test_telemetria_local(servidor, tmp_path, paginas_falsas):
    servidor.uso = {"promptTokenCount": 11, "candidatesTokenCount": 7, "totalTokenCount": 18}
    servidor.roteiro = [429]
    g = llm.Gerador(llm.gemini("gemini-3.8-flash", "chave-secreta-123", base_url=servidor.url),
                    "gemini", "gemini-3.8-flash", tmp_path)
    grafos.comparar(g, TEMA, {}, paginas_falsas, retry=RAPIDO)
    grafos.comparar(g, TEMA, {}, paginas_falsas, retry=RAPIDO)  # do cache: nenhuma linha nova
    bruto = (tmp_path / "chamadas.jsonl").read_text(encoding="utf-8")
    linhas = [json.loads(l) for l in bruto.splitlines()]
    assert [l["erro"] for l in linhas] == ["GoogleRateLimitError 429", None]
    assert (linhas[1]["tokens_entrada"], linhas[1]["tokens_saida"]) == (11, 7)
    assert {l["etapa"] for l in linhas} == {"comparar"}
    assert {l["modelo"] for l in linhas} == {"gemini:gemini-3.8-flash"}
    prompt = servidor.pedidos[0]["corpo"]["contents"][0]["parts"][0]["text"]
    assert {l["chave"] for l in linhas} == {g.arquivo(prompt).stem}
    assert "chave-secreta-123" not in bruto and "Você compara" not in bruto
    assert all(isinstance(l["ms"], int) and isinstance(l["espera_ms"], int) for l in linhas)
    assert g.resumo() == ("LLM gemini:gemini-3.8-flash: 2 chamadas, 1 do cache, 1 falhas, "
                          "11 tokens de entrada, 7 de saída")


def test_resumo_sai_mesmo_com_erro(tmp_path, monkeypatch, capsys):
    def resp(p):
        if p.startswith("Você resume"):
            return '{"nao_encontrado": true, "resumo": []}'
        raise ValueError("falha definitiva na comparação")

    g = gerador(ModeloFalso(resp), tmp_path / "comparar")
    monkeypatch.setattr(llm, "provedor_padrao", lambda: g)
    with pytest.raises(ValueError, match="falha definitiva"):
        main(["comparar", "saude", "--origem", "gemini"])
    assert "LLM gemini:gemini-3.8-flash: 3 chamadas, 0 do cache, 1 falhas" in capsys.readouterr().out

    def falha(p):
        raise ErroHttp(400)

    for cmd in (["verificar", "saude"], ["ingest"]):
        g = gerador(ModeloFalso(falha), tmp_path / cmd[0])
        monkeypatch.setattr(llm, "provedor_padrao", lambda g=g: g)
        monkeypatch.setattr(extrair, "gravar", lambda *a, **k: None)  # o ingest não reescreve dados/paginas
        with pytest.raises(ErroHttp):
            main(cmd)
        saida = capsys.readouterr().out
        assert re.search(r"LLM gemini:gemini-3.8-flash: [1-9]\d* chamadas, 0 do cache, [1-9]\d* falhas", saida), cmd


@pytest.mark.parametrize("etapa,resposta", [
    ("resume", "[]"), ("resume", '{"resumo": {"texto": "x"}}'), ("resume", "{}"),
    ("resume", '{"nao_encontrado": true}'),
    ("compara", '[{"semelhancas": []}]'), ("compara", '{"semelhancas": "nenhuma"}'), ("compara", "{}"),
    ("compara", '{"semelhancas": [], "diferencas": []}')])
def test_formato_invalido_fora_do_cache(tmp_path, paginas_falsas, etapa, resposta):
    g = gerador(ModeloFalso(lambda p: resposta if p.startswith("Você " + etapa) else responder(p)), tmp_path)
    with pytest.raises(ValueError, match="fora do formato"):
        comparar.com_llm(TEMA, chunks_do_corpus(), paginas_falsas, g)
    gravados = [json.loads(a.read_text(encoding="utf-8"))["resposta"] for a in tmp_path.glob("*.json")]
    assert resposta not in gravados


def test_prompt_identico_uma_chamada(tmp_path, monkeypatch):
    monkeypatch.setenv("LLM_CONCORRENCIA", "4")
    n = itertools.count()
    m = ModeloFalso(lambda p: json.dumps([{"theme_id": "saude", "confianca": 0.1 + next(n) / 100}]),
                    latencia=lambda p: 0.05)
    g = gerador(m, tmp_path)
    respostas = grafos.classificar(g, ["mesmo prompt"] * 4)
    assert len(m.prompts) == 1 and (g.chamadas, g.do_cache) == (1, 3)
    cache = json.loads(json.loads(g.arquivo("mesmo prompt").read_text(encoding="utf-8"))["resposta"])
    assert respostas == [cache] * 4


class ErroHttp(Exception):
    def __init__(self, code):
        super().__init__(f"HTTP {code}")
        self.code = code


def test_erro_definitivo_interrompe(tmp_path, monkeypatch):
    monkeypatch.setenv("LLM_CONCORRENCIA", "2")

    def resp(p):
        if p == "p0":
            raise ErroHttp(400)
        return "[]"

    m = ModeloFalso(resp, latencia=lambda p: 0.0 if p == "p0" else 0.05)
    with pytest.raises(ErroHttp):
        grafos.classificar(gerador(m, tmp_path), [f"p{i}" for i in range(10)], retry=RAPIDO)
    assert len(m.prompts) <= 2
    # determinístico: o LangGraph pode trazer a tarefa cancelada; _rodar sobe o erro que a cancelou
    original = ErroHttp(400)
    original.__cause__ = ValueError("causa do SDK")

    class GrafoQueCancela:
        def invoke(self, entrada, config):
            raise llm.ChamadaCancelada(original)

    with pytest.raises(ErroHttp) as erro:
        grafos._rodar(GrafoQueCancela(), {})
    assert erro.value is original and isinstance(erro.value.__cause__, ValueError)


@pytest.mark.parametrize("pagina,trecho", [
    (2.0, "Vamos corrigir a Tabela SUS."), ("2", "Vamos corrigir a Tabela SUS."),
    (True, "Apoiamos a escola em tempo integral."), (None, "Vamos corrigir a Tabela SUS."),
    ("abc", "Vamos corrigir a Tabela SUS."), ("<b>", "Vamos corrigir a Tabela SUS.")])
def test_pagina_nao_inteira_reprova(pagina, trecho, paginas_falsas, conteudo_valido):
    ci = cit(FLAVIO, pagina, trecho)
    if pagina is None:
        del ci["pagina"]
    assert not grafos._literal({"texto": "x", "citacoes": [ci]}, paginas_falsas)
    assert grafos._literal({"texto": "x", "citacoes": [cit(FLAVIO, 2, "Vamos corrigir a Tabela SUS.")]}, paginas_falsas)
    for malformado in ([{"arquivo": FLAVIO, "pagina": 2}], ["Vamos corrigir a Tabela SUS."], "x"):
        assert not grafos._literal({"texto": "x", "citacoes": malformado}, paginas_falsas)
    conteudo_valido["candidatos"]["flavio-bolsonaro"]["resumo"][0]["citacoes"][0] = ci
    _, descartes, _ = verificar.verificar("t", conteudo_valido, paginas_falsas)
    assert [d["motivo"] for d in descartes if d["item"]["texto"] == "Corrigir a Tabela SUS."] == \
        ["trecho_nao_encontrado"]
    d = next(x for x in descartes if x["item"]["texto"] == "Corrigir a Tabela SUS.")
    bloco = relatorio._bloco_item(d, "")  # o relatório do descarte não quebra e escapa o valor
    assert f"pág. {html.escape(str(ci.get('pagina')))} " in bloco and "#page=0'" in bloco
    assert "<b>" not in bloco.replace("<b>Resumo</b>", "")


# --- L9: grafo juiz --------------------------------------------------------------------------

def test_juiz_por_grafo(tmp_path, paginas_falsas, conteudo_valido):
    def juiz(p):
        assert p.startswith("Você verifica")
        if "<afirmacao>\nFortalecer o SUS.\n</afirmacao>" in p:
            return json.dumps({"sustentado": False, "justificativa": "o trecho não fala em fortalecer"},
                              ensure_ascii=False)
        if "<afirmacao>\nEscola em tempo integral.\n</afirmacao>" in p:
            return '"sim"'  # fora do formato
        return json.dumps({"sustentado": True, "justificativa": "ok"})

    m = ModeloFalso(juiz)
    pendentes = verificar.pendentes_para_juiz(conteudo_valido, paginas_falsas)
    j = verificar.juiz_llm(gerador(m, tmp_path), conteudo_valido, paginas_falsas)
    assert len(pendentes) == 4 and len(m.prompts) == 4
    for it in pendentes:
        linhas = "\n".join(f"[{c['arquivo']} p.{c['pagina']}] {c['trecho']}" for c in it["trechos"])
        assert any(f"<afirmacao>\n{it['texto']}\n</afirmacao>" in p and linhas in p for p in m.prompts)
    _, descartes, mantidos = verificar.verificar("saude", conteudo_valido, paginas_falsas, j)
    d = {x["item"]["texto"]: x for x in descartes}
    assert set(d) == {"Fortalecer o SUS.", "Escola em tempo integral."}
    assert d["Fortalecer o SUS."]["motivo"] == "nao_sustentado"
    assert d["Fortalecer o SUS."]["detalhe"] == "o trecho não fala em fortalecer"
    assert d["Escola em tempo integral."]["motivo"] == "nao_sustentado"
    assert d["Escola em tempo integral."]["detalhe"].startswith("resposta do juiz fora do formato")
    assert sorted(x["item"]["texto"] for x in mantidos) == ["Corrigir a Tabela SUS.", "Tabela SUS."]
    assert all(x["juiz"] == "sustentado" for x in mantidos)


# --- L10: grafo classificar ------------------------------------------------------------------

def test_classificar_por_grafo(tmp_path, monkeypatch):
    monkeypatch.setenv("LLM_CONCORRENCIA", "3")
    temas = [{"id": "saude", "rotulo": "Saúde", "descricao": "SUS", "palavras_chave": ["SUS"]},
             {"id": "educacao", "rotulo": "Educação", "descricao": "escola", "palavras_chave": ["escola"]}]
    textos = ["Vamos corrigir a Tabela SUS.", "Apoiamos a escola em tempo integral.", "Texto neutro."]

    def resp(p):
        if "Tabela SUS" in p:
            return json.dumps([{"theme_id": "saude", "confianca": 0.1}, {"theme_id": "educacao", "confianca": 0.6}])
        if "Apoiamos a escola" in p:
            return json.dumps([{"theme_id": "inexistente", "confianca": 0.9}, {"theme_id": "educacao", "confianca": 1.5}])
        return json.dumps([{"theme_id": "saude", "confianca": 0}])

    atraso = {textos[0]: 0.2, textos[1]: 0.1, textos[2]: 0.0}  # termina na ordem inversa
    m = ModeloFalso(resp, latencia=lambda p: next(v for t, v in atraso.items() if t in p))
    chunks = [{"texto": t} for t in textos]
    classificar.classificar(chunks, temas, gerador(m, tmp_path))
    assert len(m.prompts) == 3
    assert [next(t for t in textos if t in p) for p in m.terminados] == textos[::-1]
    assert chunks[0]["temas"] == [{"theme_id": "educacao", "confianca": 0.6}, {"theme_id": "saude", "confianca": 0.25}]
    assert chunks[1]["temas"] == [{"theme_id": "educacao", "confianca": 0.25}]
    assert chunks[2]["temas"] == []
    malformada = json.dumps(["saude", {"theme_id": "educacao", "confianca": "alta"},
                             {"theme_id": "saude", "confianca": 1}, {"theme_id": "educacao"}])
    outro = [{"texto": "Mais verbas para o SUS."}, {"texto": "Outro texto."}]
    m2 = ModeloFalso(lambda p: malformada if "Mais verbas" in p else '{"theme_id": "saude", "confianca": 0.9}')
    classificar.classificar(outro, temas, gerador(m2, tmp_path / "m"))
    assert outro[0]["temas"] == [{"theme_id": "saude", "confianca": 1.0}]
    assert outro[1]["temas"] == []


# --- L11: sem chave --------------------------------------------------------------------------

def test_sem_chave_provedor_padrao_none(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert llm.provedor_padrao() is None


def test_sem_chave_comparar_gemini_sai_2(monkeypatch, capsys):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert main(["comparar", "saude", "--origem", "gemini"]) == 2
    assert "--origem gemini exige GEMINI_API_KEY" in capsys.readouterr().err


def test_sem_chave_nao_importa_langgraph():
    codigo = (
        "import sys\n"
        "from rag_planos import __main__, aprovar, avaliar, comparar, config, extrair, relatorio, verificar\n"
        "p = extrair.carregar()\n"
        "c = comparar.de_rascunho('saude')\n"
        "_, _, mantidos = verificar.verificar('saude', c, p, verificar.juiz_vereditos(config.DADOS / 'juiz' / 'saude.json'))\n"
        "assert mantidos\n"
        "print(sorted(m for m in sys.modules if m.split('.')[0] in "
        "('langgraph', 'langchain_core', 'langchain_google_genai', 'google')))\n")
    r = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True,
                       cwd=RAIZ / "pipeline", env={"PATH": "/usr/local/bin:/usr/bin:/bin", "PYTHONPATH": str(RAIZ / "pipeline")})
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip() == "[]"


# --- L13: dependências -----------------------------------------------------------------------

def test_dependencias_fixadas():
    linhas = [l for l in (RAIZ / "docker" / "pipeline.requirements.txt").read_text(encoding="utf-8").splitlines()
              if l.strip() and not l.startswith("#")]
    assert linhas and all(re.fullmatch(r"[A-Za-z0-9_.\-]+==[0-9][0-9A-Za-z.]*", l) for l in linhas), linhas
    nomes = {l.split("==")[0].lower() for l in linhas}
    assert {"langgraph", "langchain-google-genai", "langchain-core", "google-genai", "pymupdf"} <= nomes
    for l in linhas:
        nome, versao = l.split("==")
        assert version(nome) == versao, f"{nome}: instalado {version(nome)}, lock {versao}"
    assert "pipeline.requirements.txt" in (RAIZ / "docker" / "pipeline.Dockerfile").read_text(encoding="utf-8")
    assert "pip install --no-cache-dir -r docker/pipeline.requirements.txt" in \
        (RAIZ / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")


# --- L28, L29: marcadores de página, correção de página e registro ----------------------------

PAGS = {LULA: [pagina_falsa(1, "Texto repetido A. Proposta um."),
               pagina_falsa(2, "Texto repetido A. Proposta dois."),
               pagina_falsa(3, "Proposta três exclusiva.")],
        FLAVIO: [pagina_falsa(1, "Nada aqui."), pagina_falsa(2, "Proposta dois.")]}


def _chunk_lula_1_2():
    """Chunk real (chunk.cortar) que cobre só as págs. 1 e 2 de Lula; a 3 não vai ao modelo."""
    c = cortar_em_chunks(PAGS[LULA][:2], "lula", "PT", LULA)
    assert len(c) == 1 and c[0]["paginas"] == [1, 2]
    c[0]["temas"] = [{"theme_id": "saude", "confianca": 0.9}]
    return c[0]


def test_prompt_marca_viradas():
    outro = {**_chunk_lula_1_2(), "pagina": 5, "paginas": [5], "viradas": [[0, 5]], "texto": "Página cinco."}
    outro["temas"] = [{"theme_id": "saude", "confianca": 0.5}]
    pedidos = comparar.pedidos_de_resumo(TEMA, [_chunk_lula_1_2(), outro])
    assert list(pedidos) == ["lula"]
    assert [(c["texto"], c["viradas"]) for c in pedidos["lula"]["chunks"]] == [
        ("Texto repetido A. Proposta um. Texto repetido A. Proposta dois.", [[0, 1], [31, 2]]),
        ("Página cinco.", [[0, 5]])]
    p = pedidos["lula"]["prompt"]
    assert "[página 1] Texto repetido A. Proposta um. [página 2] Texto repetido A. Proposta dois." in p
    assert "[página 5] Página cinco." in p and "[página 1-2]" not in p
    assert "A `pagina` de uma citação é a do último marcador antes do trecho" in p


def test_corrige_pagina_so_quando_unica_na_faixa(tmp_path):
    def resp(p):
        if p.startswith("Você resume"):
            return json.dumps({"nao_encontrado": False, "resumo": [
                bullet("Corrigida.", cit(LULA, 1, "Proposta dois.")),            # no chunk, sob [página 2]
                bullet("Ambígua.", cit(LULA, 3, "Texto repetido A.")),           # sob [página 1] e [página 2]
                bullet("Fora da faixa.", cit(LULA, 1, "Proposta três exclusiva.")),  # pág. 3: não foi ao modelo
                bullet("Certa.", cit(LULA, 1, "Proposta um.")),
                bullet("Página em texto.", cit(LULA, "1", "Proposta dois.")),
                bullet("Arquivo do outro.", cit(FLAVIO, 1, "Proposta dois.")),   # Flávio p.2 tem o trecho
                bullet("Duas citações.", cit(LULA, 1, "Proposta dois."), cit(LULA, 1, "Inexistente.")),
                bullet("Atravessa.", cit(LULA, 1, "Proposta um. Texto repetido A."))]}, ensure_ascii=False)
        return json.dumps({"semelhancas": [], "diferencas": [], "omissoes": []})

    m = ModeloFalso(resp)
    conteudo, correcoes = comparar.com_llm_e_correcoes(TEMA, [_chunk_lula_1_2()], PAGS, gerador(m, tmp_path))
    lula = conteudo["candidatos"]["lula"]["resumo"]
    assert [b["texto"] for b in lula] == ["Corrigida.", "Certa."]
    assert [b["citacoes"][0]["pagina"] for b in lula] == [2, 1]
    assert correcoes == [{"candidato": "lula", "texto": "Corrigida.", "trecho": "Proposta dois.",
                          "pagina_citada": 1, "pagina": 2}]
    assert conteudo["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": [], "executivo": []}
    pedido_comparar = next(p for p in m.prompts if p.startswith("Você compara"))
    assert '"pagina": 2, "trecho": "Proposta dois."' in pedido_comparar
    assert '"pagina": 1, "trecho": "Proposta dois."' not in pedido_comparar
    assert comparar.com_llm(TEMA, [_chunk_lula_1_2()], PAGS, gerador(m, tmp_path)) == conteudo
    # ocorrência inteira sob [página 1] e outra atravessando a virada 2 -> 3: vale só a primeira
    sintetico = {"texto": "alfa beta gama delta beta gama epsilon", "viradas": [[0, 1], [15, 2], [26, 3]], "pagina": 1}
    assert grafos._pagina_no_chunk("beta gama", [sintetico]) == 1
    assert grafos._pagina_no_chunk("gama delta", [sintetico]) is None


FONTES = [{"arquivo": LULA, "candidato": "lula", "sha256": "a" * 64, "coletado_em": "2026-10-17"},
          {"arquivo": FLAVIO, "candidato": "flavio-bolsonaro", "sha256": "b" * 64, "coletado_em": "2026-10-17"}]


def test_correcao_registrada_e_no_relatorio(tmp_path, conteudo_valido, paginas_falsas):
    corr = [{"candidato": "lula", "texto": "Fortalecer o SUS.", "trecho": "Fortalecer <o> SUS",
             "pagina_citada": 1, "pagina": 2}]
    agora = datetime(2026, 10, 18, 12, 0, tzinfo=comparar.BRT)
    comparar.registrar("saude", conteudo_valido, "x", tmp_path / "a", agora=agora)
    comparar.registrar("saude", conteudo_valido, "x", tmp_path / "b", agora=agora, correcoes=[])
    a = (tmp_path / "a" / "saude.json").read_bytes()
    assert a == (tmp_path / "b" / "saude.json").read_bytes() and b"correcoes_pagina" not in a
    reg = comparar.registrar("saude", conteudo_valido, "x", tmp_path / "c", agora=agora, correcoes=corr)
    assert json.loads((tmp_path / "c" / "saude.json").read_text(encoding="utf-8"))["correcoes_pagina"] == corr
    depois = datetime(2026, 10, 19, 12, 0, tzinfo=comparar.BRT)
    assert comparar.registrar("saude", conteudo_valido, "x", tmp_path / "c", agora=depois,
                              correcoes=corr)["gerado_em"] == reg["gerado_em"]
    outra = [{**corr[0], "pagina_citada": 3}]
    trocada = comparar.registrar("saude", conteudo_valido, "x", tmp_path / "c", agora=depois, correcoes=outra)
    assert trocada["gerado_em"] == reg["gerado_em"]
    assert json.loads((tmp_path / "c" / "saude.json").read_text(encoding="utf-8"))["correcoes_pagina"] == outra
    sem_trocas = comparar.registrar("saude", conteudo_valido, "x", tmp_path / "c", agora=depois)
    assert sem_trocas["gerado_em"] == reg["gerado_em"] and "correcoes_pagina" not in sem_trocas
    assert (tmp_path / "c" / "saude.json").read_bytes() == a  # mesmo conteúdo: mesmo arquivo, mesmo hash adiante

    saida, descartes, mantidos = verificar.verificar("saude", conteudo_valido, paginas_falsas)
    comp = verificar.montar("saude", "2026-10-18T12:00:00-03:00", saida, FONTES)
    com = relatorio.gerar(TEMA, comp, "0" * 64, "gemini (x)", mantidos, descartes, tmp_path / "r1.html", corr)
    sem = relatorio.gerar(TEMA, comp, "0" * 64, "gemini (x)", mantidos, descartes, tmp_path / "r2.html")
    com, sem = com.read_text(encoding="utf-8"), sem.read_text(encoding="utf-8")
    assert "Páginas corrigidas automaticamente (1)" in com and "pág. 1 → 2" in com
    assert "Fortalecer &lt;o&gt; SUS" in com and "<o>" not in com
    assert "Páginas corrigidas" not in sem
    assert relatorio.gerar(TEMA, comp, "0" * 64, "gemini (x)", mantidos, descartes, tmp_path / "r3.html",
                           []).read_text(encoding="utf-8") == sem


def test_correcoes_pela_linha_de_comando(tmp_path, monkeypatch, capsys, paginas):
    """`comparar --origem gemini` grava as trocas em geracao/<tema>.json e `verificar` as leva ao
    relatório. O modelo falso cita cada trecho uma página adiante da do marcador que viu."""
    from rag_planos import __main__ as cli, config, temas

    def resp(p):
        if p.startswith("Você resume"):
            arq = re.search(r"Arquivo: (\S+)", p).group(1)
            pag, trecho = re.search(r"\[página (\d+)\] ((?:\S+ ){7}\S+)", p).groups()
            return json.dumps({"nao_encontrado": False, "resumo": [
                bullet("Bullet de teste.", cit(arq, int(pag) + 1, trecho))]}, ensure_ascii=False)
        return json.dumps({"semelhancas": [], "diferencas": [], "omissoes": []})

    dados = tmp_path / "dados"
    original = comparar.registrar
    monkeypatch.setattr(llm, "provedor_padrao", lambda: gerador(ModeloFalso(resp), tmp_path / "cache"))
    monkeypatch.setattr(comparar, "registrar", lambda *a, **k: original(*a, **{**k, "pasta": dados / "geracao"}))
    assert main(["comparar", "saude", "--origem", "gemini"]) == 0
    assert "2 página(s) corrigida(s)" in capsys.readouterr().out
    g = json.loads((dados / "geracao" / "saude.json").read_text(encoding="utf-8"))
    assert sorted(c["candidato"] for c in g["correcoes_pagina"]) == ["flavio-bolsonaro", "lula"]
    assert all(c["pagina_citada"] == c["pagina"] + 1 for c in g["correcoes_pagina"])

    tema = temas.por_id(temas.carregar())["saude"]
    fontes = json.loads((config.DADOS / "fontes.json").read_text(encoding="utf-8"))
    monkeypatch.setattr(config, "RAIZ", tmp_path)
    monkeypatch.setattr(config, "DADOS", dados)
    cli._verificar_tema(tema, paginas, fontes, None)
    html_rel = (dados / "relatorios" / "saude.html").read_text(encoding="utf-8")
    assert "Páginas corrigidas automaticamente (2)" in html_rel
