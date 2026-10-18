"""Camada de LLM em LangGraph (checks L1-L11 e L13 de .checks/migracao-langgraph.md).

Modelo falso em memória, ou o ChatGoogleGenerativeAI real contra um servidor HTTP local que imita
o endpoint do Gemini. Nenhum teste sai para a rede.
"""
import hashlib
import json
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from importlib.metadata import version
from pathlib import Path

import pytest

from rag_planos import classificar, comparar, grafos, llm, verificar
from rag_planos.__main__ import main

from .conftest import FLAVIO, LULA, bullet, cit

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
    return llm.Gerador(modelo, "gemini", "gemini-2.5-flash", pasta)


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


def test_candidato_sem_chunks_nao_chama_modelo(tmp_path, paginas_falsas):
    m = ModeloFalso(responder)
    saida = comparar.com_llm(TEMA, chunks_do_corpus(so="lula"), paginas_falsas, gerador(m, tmp_path / "a"))
    assert [_tipo(p) for p in m.prompts] == ["resume", "compara"]
    assert f"Arquivo: {LULA}" in m.prompts[0]
    assert saida["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": []}
    assert saida["candidatos"]["lula"]["nao_encontrado"] is False
    m2 = ModeloFalso(responder)
    vazio = comparar.com_llm(TEMA, [], paginas_falsas, gerador(m2, tmp_path / "b"))
    assert [_tipo(p) for p in m2.prompts] == ["compara"]
    assert all(v == {"nao_encontrado": True, "resumo": []} for v in vazio["candidatos"].values())


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
    assert g2.resumo() == "LLM gemini:gemini-2.5-flash: 0 chamadas, 3 do cache"
    assert len(list(tmp_path.glob("*.json"))) == 3
    for p in m.prompts:
        nome = hashlib.sha256(("gemini:gemini-2.5-flash\n" + p).encode("utf-8")).hexdigest() + ".json"
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
    assert a["candidatos"]["lula"] == {"nao_encontrado": True, "resumo": []}
    assert [x["texto"] for x in a["candidatos"]["flavio-bolsonaro"]["resumo"]] == ["Corrigir a Tabela SUS."]
    assert b["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": []}
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
    """POST /v1beta/models/<modelo>:generateContent; `roteiro` = status de erro antes do 200."""

    def __init__(self, texto='{"semelhancas": [], "diferencas": [], "omissoes": []}'):
        self.roteiro, self.pedidos, self.texto = [], [], texto
        srv = self

        class H(BaseHTTPRequestHandler):
            def do_POST(self):
                corpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                srv.pedidos.append({"path": self.path, "corpo": corpo,
                                    "headers": {k.lower(): v for k, v in self.headers.items()}})
                status = srv.roteiro.pop(0) if srv.roteiro else 200
                resp = ({"candidates": [{"content": {"role": "model", "parts": [{"text": srv.texto}]},
                                         "finishReason": "STOP"}]} if status == 200
                        else {"error": {"code": status, "message": "falso", "status": "FALSO"}})
                dados = json.dumps(resp).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)

            def log_message(self, *a):
                pass

        self.http = HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=self.http.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.http.server_port}"


@pytest.fixture
def servidor():
    s = ServidorGemini()
    yield s
    s.http.shutdown()


def _comparar_real(servidor, pasta, paginas):
    g = llm.Gerador(llm.gemini("gemini-2.5-flash", "chave-falsa", base_url=servidor.url),
                    "gemini", "gemini-2.5-flash", pasta)
    return grafos.comparar(g, TEMA, {}, paginas, retry=RAPIDO)


def test_retry_429_e_503_repetem(servidor, tmp_path, paginas_falsas):
    assert (grafos.RETRY.max_attempts, grafos.RETRY.initial_interval, grafos.RETRY.backoff_factor) == (5, 2.0, 2.0)
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
    assert p["path"] == "/v1beta/models/gemini-2.5-flash:generateContent"
    assert p["corpo"]["generationConfig"]["temperature"] == 0
    assert p["corpo"]["generationConfig"]["responseMimeType"] == "application/json"
    assert p["headers"]["x-goog-api-key"] == "chave-falsa"
    assert "chave-falsa" not in p["path"]


# --- L8: resposta inválida -------------------------------------------------------------------

def test_json_invalido_fora_do_cache(tmp_path):
    respostas = iter(["isto não é JSON", '{"ok": true}'])
    g = gerador(ModeloFalso(lambda p: next(respostas)), tmp_path)
    with pytest.raises(ValueError):
        g.json("p")
    assert not list(tmp_path.iterdir())
    assert not llm.deve_repetir(ValueError("x"))
    assert g.json("p") == {"ok": True}
    assert [a.name for a in tmp_path.iterdir()] == [g.arquivo("p").name]


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
