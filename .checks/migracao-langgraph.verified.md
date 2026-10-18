# Camada de LLM do pipeline em LangGraph: verificação

**Veredito**: FAIL. 14 de 15 checks provados em 8069d09. A prova literal de L14 sai com 1, embora o comportamento esteja provado por um teste discriminante. Uma forma literal do `Landing` (linha "Modelo") diverge do código.
**Perfil**: light. Rodaram os passos 2 e 3 e a releitura do `Swept`. O passo 1 não roda neste perfil, e a injeção de falhas ficou com outro agente.
**Diff**: `main` (cc7d48a)..`feat/langgraph` (8069d09), 3 commits; provas rodadas em HEAD 8069d09
**Rodada**: 1 - completa
**Verificador**: sub-agente independente (autor != verificador)

## Fontes vinculantes

O passo 1 não rodou (perfil `light`). O checklist cita o pedido do dono, as condições da avaliação e `.specs/plano-final.md` (decisão 10, AC 5-9 e 13). Nenhuma delas foi comparada aqui check a check.

## Checks (verificados em 8069d09)

Gate de todos os pytest numa invocação só: `WD=pipeline SAIDAS="pipeline/.nada" ./dock.sh pipeline 'python -m pytest -p no:cacheprovider -rA tests/ ...'`. Resultado: `49 passed in 7.43s`, cada teste listado como `PASSED`. Cada teste citado foi localizado com `rg -n "^def test_..." pipeline/tests/`. Filtros `-k` (`--collect-only`):

- `-k retry`: `3/16 tests collected` (`test_retry_429_e_503_repetem`, `test_retry_400_nao_repete`, `test_retry_desiste_depois_de_5_tentativas`)
- `-k sem_chave`: `3/16 tests collected` (`test_sem_chave_provedor_padrao_none`, `test_sem_chave_comparar_gemini_sai_2`, `test_sem_chave_nao_importa_langgraph`)

| Check | Afirmação | Prova rodada | Evidência file:line + asserção | Resultado |
|---|---|---|---|---|
| L1 | 1 resumo por candidato com trechos; filtro literal antes de comparar; bullet inventado fora do prompt e da saída | `test_grafos.py:90 test_comparar_filtra_antes_de_comparar` PASSED | `:95` `len(resumos) == 2 and len(comparacoes) == 1`; `:96` `{f"Arquivo: {LULA}" in p for p in resumos} == {True, False}`; `:97` `INVENTADO not in comparacoes[0]`; `:101` `INVENTADO not in json.dumps(saida, ...)`; `:99` resumo de Lula `== ["Fortalecer o SUS."]` | PASS |
| L2 | candidato sem chunk: nenhuma chamada e `nao_encontrado: true` | `:106 test_candidato_sem_chunks_nao_chama_modelo` PASSED | `:109` `[_tipo(p) for p in m.prompts] == ["resume", "compara"]`; `:111` `saida["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": []}`; `:115` sem chunks, `== ["compara"]` | PASS |
| L3 | 2ª execução: 0 chamadas e mesmo conteúdo; arquivo `<sha256("gemini:<modelo>\n"+prompt)>.json` com `{"resposta": ...}` | `:121 test_cache_segunda_execucao_sem_chamadas` PASSED | `:128` `a == b`; `:129` `(g2.chamadas, g2.do_cache) == (0, 3)`; `:133` nome `hashlib.sha256(("gemini:gemini-2.5-flash\n" + p).encode("utf-8")).hexdigest() + ".json"`; `:134` conteúdo `== {"resposta": responder(p)}` | PASS |
| L4 | cache não colide: A sem Lula, B sem Flávio, mesma pasta | `:139 test_cache_nao_colide_entre_temas` PASSED | um único `g = gerador(m, tmp_path)` em `:142`; `:148` `b["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": []}`; `:149` resumo de Lula em B `== ["Fortalecer o SUS."]`; `:146-147` o mesmo para A | PASS |
| L5 | 5 execuções sem cache, latência variável, concorrência 4: bytes idênticos | `:154 test_mesma_entrada_mesmo_json` PASSED | `:155` `setenv("LLM_CONCORRENCIA", "4")`; `:157` `range(5)` com pasta nova por execução (`:160`); `:163` `len(ordens) == 2` (os resumos terminaram em ordens diferentes); `:164` `len(saidas) == 1` | PASS. Nota de precisão: a latência alterna de forma fixa (`:159`) em vez de ser aleatória, e `:163` garante a troca de ordem, o que é mais forte |
| L6 | `ChatGoogleGenerativeAI` real contra servidor falso: 429+503 → 3 requisições; 400 → 1; 429 contínuo → exatamente 5 | `-k retry` (3 testes) PASSED | modelo real em `:208` `llm.gemini(..., base_url=servidor.url)`; `:218` `len(servidor.pedidos) == 3`; `:226` `== 1` e `:227` `not llm.deve_repetir(erro.value)`; `:232` roteiro `[429] * 6`, `:235` `len(servidor.pedidos) == 5`; `:214` `(max_attempts, initial_interval, backoff_factor) == (5, 2.0, 2.0)`; `:215` `retry_on is llm.deve_repetir` | PASS (nível: cliente real, servidor local) |
| L7 | `temperature` 0, `responseMimeType` JSON, chave no header e fora da URL | `:239 test_requisicao_gemini` PASSED | `:243` `generationConfig.temperature == 0`; `:244` `responseMimeType == "application/json"`; `:245` `headers["x-goog-api-key"] == "chave-falsa"`; `:246` `"chave-falsa" not in p["path"]` | PASS (nível: cliente real) |
| L8 | não-JSON: `ValueError`, nada no cache; resposta válida depois grava | `:251 test_json_invalido_fora_do_cache` PASSED | `:254` `pytest.raises(ValueError)`; `:256` `not list(tmp_path.iterdir())`; `:257` `not llm.deve_repetir(ValueError("x"))`; `:258` `== {"ok": True}`; `:259` só `g.arquivo("p").name` | PASS |
| L9 | grafo juiz: 1 pedido por pendente; não sustentado com justificativa; resto `sustentado` | `:264 test_juiz_por_grafo` PASSED | `:277` `len(pendentes) == 4 and len(m.prompts) == 4`; `:284` `motivo == "nao_sustentado"`; `:285` `detalhe == "o trecho não fala em fortalecer"`; `:289` `all(x["juiz"] == "sustentado" for x in mantidos)` | PASS |
| L10 | 1 pedido por chunk; máximo entre palavras-chave e LLM; tema desconhecido e confiança fora de (0, 1] ignorados | `:294 test_classificar_por_grafo` PASSED | `:311` `len(m.prompts) == 3`; `:313` `[{"educacao", 0.6}, {"saude", 0.25}]` (LLM 0.1 < palavra-chave 0.25); `:314` `inexistente` e `1.5` ignorados; `:315` confiança `0` → `[]`; `:312` a ordem de término é invertida e o resultado segue a ordem dos chunks | PASS. Nota: o limite superior inclusivo `1.0` não é exercitado |
| L11 | sem chave: `provedor_padrao()` None; `comparar --origem gemini` → 2; sem import de langgraph | `-k sem_chave` (3 testes) PASSED | `:322` `llm.provedor_padrao() is None`; `:327` `main(["comparar", "saude", "--origem", "gemini"]) == 2`; `:344` `r.stdout.strip() == "[]"` (módulos `langgraph`, `langchain_core`, `langchain_google_genai` e `google` ausentes em processo limpo, `:342`) | PASS |
| L12 | os 8 JSON reproduzidos byte a byte; `comparar --todos` + `verificar --todos` mantêm os 17 SHA-256 | `test_comparacoes_reais.py:48 test_comparacoes_reproduziveis` PASSED (não SKIPPED); comando abaixo | `:54` `g["conteudo"] == comparar.de_rascunho(tid)`; `:57` `verificar.serializar(verificar.montar(...)) == arq.read_bytes()`. Comando: `./dock.sh pipeline 'cd pipeline && python -m rag_planos comparar --todos && python -m rag_planos verificar --todos'` sai com 0; `sha256sum -c hashes-antes.txt` dá 17 `OK` com rc 0; `git status --porcelain` vazio. O instantâneo é de `main`: `git show main:<arquivo> \| sha256sum` bate nas 17 linhas (`match=17 diff=0`), e HEAD == main em todas; `git diff --stat main..feat/langgraph -- dados/` vazio | PASS. Nota: o teste não afirma `len(ARQUIVOS) == 8` e pula se a pasta estiver vazia (`:47` `skipif`); a contagem é garantida pela prova de hash |
| L13 | toda linha do lock com `==`; imagem e job `pipeline` instalam dele; `pip check` limpo | `:349 test_dependencias_fixadas` PASSED; `SAIDAS=pipeline/.nada ./dock.sh pipeline pip check` → `No broken requirements found.` rc 0 | `:352` `re.fullmatch(r"[A-Za-z0-9_.\-]+==[0-9][0-9A-Za-z.]*", l)` em todas as linhas; `:357` `version(nome) == versao` (o instalado bate com o lock); `:359-360` string `pip install --no-cache-dir -r docker/pipeline.requirements.txt` em `ci.yml`. Lido direto: `docker/pipeline.Dockerfile:4-5` `COPY pipeline.requirements.txt ...` + `RUN pip install --no-cache-dir -r /tmp/pipeline.requirements.txt`; `.github/workflows/ci.yml:11-16` job `pipeline`, `:16` `pip install --no-cache-dir -r docker/pipeline.requirements.txt`. `grep -c '==' docker/pipeline.requirements.txt` = 56 = linhas sem comentário | PASS. Nota: `:358` só procura a substring `pipeline.requirements.txt` no Dockerfile, e `:359` aceita o comando em qualquer job; a leitura direta é que fecha |
| L14 | `dock.sh` recria o contêiner depois de `REBUILD=1` | teste discriminante abaixo: PASS. **Prova literal: rc 1** | `dock.sh:17-18` `\|\| [ "$(docker inspect -f '{{.Image}}' "$nome" ...)" != "$(docker image inspect -f '{{.Id}}' "$img")" ]`. Discriminante: impostor `python:3.11.9-slim` sob `rag-planos-pipeline-dev`. O `dock.sh` de `main` (cópia em scratch, sem `docker inspect`) dá `ModuleNotFoundError: No module named 'langgraph'` com rc 1 e o contêiner continua `python:3.11.9-slim`. O de HEAD, sem REBUILD e sem `docker rm`, imprime `langgraph` com rc 0 e o contêiner passa a `sha256:54aeb37e...` (= imagem). Literal: `REBUILD=1 ./dock.sh pipeline python -c "import langgraph"` dá `SyntaxError: invalid syntax` em `import`, rc 1, porque `dock.sh:27` executa `sh -c "$*"` e as aspas se perdem (`python -c import langgraph`). Com aspas simples, `REBUILD=1 ./dock.sh pipeline 'python -c "import langgraph; print(langgraph.__name__)"'` imprime `langgraph` com rc 0, e imagem e contêiner ficam ambos `d4984f58...` | **FAIL** (comportamento provado; a prova escrita no checklist não passa) |
| L15 | a suíte anterior continua verde (32 testes) | `WD=pipeline ./dock.sh pipeline python -m pytest -q` → `49 passed`, rc 0 | `git show main:<f> \| grep -c "^def test_"`: avaliar 6/6, chunk 4/4, comparacoes_reais 2/3, fontes 3/3, ingest 5/5, literal 2/2, relatorio 2/2, verificar 8/8 (main/HEAD) = 32 → 33, mais 16 em `test_grafos.py`, total 49. `comm -23` dos nomes de main contra HEAD: nenhum ausente. `git diff --numstat main..feat/langgraph -- pipeline/tests`: `14 1` e `360 0`; a única linha removida é `-from rag_planos import config, extrair, verificar`, trocada pelo mesmo import com `comparar` | PASS |

Nível (L6, L7): as duas provas usam o `ChatGoogleGenerativeAI` real (via `llm.gemini`, `llm.py:79-82`) contra um HTTP local que imita `generateContent` (`test_grafos.py:169-197`). Os demais checks de grafo (L1-L5, L8-L10) usam `ModeloFalso` em memória, o que basta porque afirmam lógica de grafo e de cache. Fica sem prova que o endpoint real do Google devolve os erros com a mesma forma do servidor falso (`:182-184`); não há chave, e a API real não foi chamada.

## Landing (formas literais contra o código, em 8069d09)

| Linha | Código | Confere |
|---|---|---|
| Onde fica o cache | `llm.py:45` `pasta = config.DADOS / "cache-llm"`; `:52` `f"{self.provedor}:{self.nome_modelo}"`; `:55` `sha256((self.nome + "\n" + prompt).encode("utf-8"))`; `:70` `{"resposta": texto}` (texto do modelo, não a saída do nó); nenhum `CachePolicy`/`SqliteCache` (`rg` sem acerto) | sim |
| Retry | `grafos.py:24-25` `RetryPolicy(max_attempts=5, initial_interval=2.0, backoff_factor=2.0, max_interval=60.0, jitter=True, retry_on=llm.deve_repetir)`; só nos nós: `:88`, `:90`, `:130`, `:157` `retry_policy=retry`; `llm.py:81` `max_retries=0`; `llm.py:20` `{429, 500, 503}`; `:33` `(ConnectionError, TimeoutError, rede)` com `rede = httpx.TransportError` (`:26`); `:38` `x.__cause__ or x.__context__` | sim |
| Modelo | `llm.py:81-82` `ChatGoogleGenerativeAI(model=modelo, google_api_key=chave, temperature=0, max_retries=0, timeout=120, response_mime_type="application/json")`; sonda P2: `temperature 0.0, max_retries 0, timeout 120.0, response_mime_type application/json`; versão travada `langchain-google-genai==4.4.2` (`requirements.txt:26`). **Mas** `llm.py:97` `os.environ.get("GEMINI_MODELO", "gemini-2.5-flash")` não é `GEMINI_MODELO or "gemini-2.5-flash"`: na sonda P7, `GEMINI_MODELO=''` dá `model=''` | **não** (caso `GEMINI_MODELO` vazio) |
| Grafos | `comparar`: `grafos.py:69` `Send("resumo", ...)` por item de `pedidos` (só candidatos com trechos, `comparar.py:46-56`), `:91-94` START → resumo/filtrar → comparar → END; `juiz`: `:122`, `:130-132`; `classificar`: `:151`, `:157-159` | sim |
| Ordem do resultado | `grafos.py:76` `for cid in config.CANDIDATOS`; `:85` `{k: r.get(k, []) for k in LISTAS}`; `:169` `[s["respostas"][i] for i in range(len(prompts))]`; reducer `:28-29` `{**a, **b}` | sim |
| Concorrência | `grafos.py:33` `{"max_concurrency": int(os.environ.get("LLM_CONCORRENCIA", "4"))}`, passado em `:101`, `:139`, `:168`; sonda P6 (12 pedidos de 0,2 s): pico de 4 sem a variável, 2 com `=2` e 12 com `=12` | sim |
| Veredito fora do formato | `grafos.py:112-117` `{"sustentado": False, "justificativa": "resposta do juiz fora do formato: " + ...}`; prova `test_grafos.py:286-287` | sim |
| Classificação malformada | `classificar.py:37-45`: não-lista → `[]`; `not isinstance(item, dict)` → ignora; `float(...)` com `except (TypeError, ValueError)` → ignora; `item.get("theme_id") in ids and 0 < conf <= 1`; as palavras-chave seguem valendo (`:57-62`) | sim (item não-objeto e confiança não numérica sem teste) |
| Juiz por LLM | `verificar.py:135-140` `juiz_llm(gerador, conteudo, paginas)` → `grafos.julgar(gerador, pendentes_para_juiz(conteudo, paginas))` → `lambda texto, citacoes, chave: vereditos.get(chave)`, a mesma forma de `juiz_vereditos` em `:149` | sim |
| Resposta inválida | `llm.py:67` `json.loads(texto)` antes da escrita em `:68-71`; `deve_repetir(ValueError)` é False (`test_grafos.py:257`) | sim |
| Import | imports tardios: `comparar.py:60`, `classificar.py:51`, `verificar.py:138` (`from . import grafos`), `llm.py:79` (`langchain_google_genai`); prova `test_grafos.py:344` | sim |
| Dependências | 56 linhas, todas com `==`; comentário `requirements.txt:1` "pip freeze em python:3.11.9-slim"; diretas em `pyproject.toml:6-7`; Dockerfile `:4-5` e CI `:16` instalam do lock | sim |
| Tracing | `docker/pipeline.Dockerfile:2-3` `LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false`; `dock.sh:27` repassa só `-e GEMINI_API_KEY -e APROVADOS -e PREVIA_RESPONSAVEL` | sim |
| Observabilidade | `llm.py:75` `f"LLM {self.nome}: {self.chamadas} chamadas, {self.do_cache} do cache"`; impresso em `__main__.py:52-53` (ingest), `:77-78` (comparar) e `:126-127` (verificar); prova `test_grafos.py:130` | sim |
| Contêiner após rebuild | `dock.sh:17-18` (ver L14) | sim |

## Swept: linhas que apontam para código existente (verificadas em 8069d09)

| Linha | No código | Evidência |
|---|---|---|
| validation: citação sem `trecho`/`pagina` reprova no filtro, sem derrubar o grafo | sim | `grafos.py:42-52`; sonda P8: sem `pagina`, sem `trecho`, `pagina 'abc'` e `citacoes` não-lista dão todos `False`; `extrair.py:119` devolve `None` para página fora de `1..len`. O teste de L1 não exercita citação malformada |
| failure modes: erro definitivo sobe; o já respondido fica no cache | sim | 400: `test_grafos.py:224-228`; escrita por resposta em `llm.py:66-71`. A cota diária do Gemini também é 429, então é repetida 5 vezes antes de subir |
| idempotency: `registrar` mantém `gerado_em` (diz "já coberto") | sim | `comparar.py:68-71`. Nenhum pytest chama `registrar` (`rg -n "registrar\|idempot" pipeline/tests/` vazio, rc 1). Na prática a cobertura vem da prova L12: `comparar --todos` imprimiu `gerado_em 2026-10-17T23:52:21-03:00` (antigo) e os hashes de `dados/geracao` ficaram iguais |
| authorization: a chave só vem de env e vai no header | sim | `llm.py:94` `os.environ.get("GEMINI_API_KEY")`; L7 `:245-246` |
| concurrency: `max_concurrency`; temporário + `os.replace` | sim | `grafos.py:33`; `llm.py:69` `arq.with_suffix(f".{threading.get_ident()}.tmp")`; `llm.py:71` `os.replace(tmp, arq)`; sonda P6 |
| data lifecycle: `dados/cache-llm/` fora do git; trocar de modelo muda a chave | sim | `.gitignore:7` `dados/cache-llm/`; `llm.py:55` (nome entra na chave); `test_grafos.py:136` `outro.arquivo(...) != g1.arquivo(...)` |
| external-dependency failure | sim | L6 e L11; sondas P3-P5 |
| state transitions: sem estado entre execuções; aprovação fora do grafo | sim | `grafos.py:95,133,160` `g.compile()` sem checkpointer; `rg "checkpointer\|MemorySaver\|interrupt"` sem acerto |
| observability: contagem por comando; tracing desligado | sim | ver Landing "Observabilidade" e "Tracing" |

## Sondas (além da suíte; contêiner descartável com `--network none` e só 127.0.0.1)

Script: `<scratchpad>/verif-langgraph/verificador/probe.py`

- P2: `llm.gemini(...)` real tem `model gemini-2.5-flash, temperature 0.0, max_retries 0, timeout 120.0, response_mime_type application/json`
- P3: 500 seguido de 200 pelo cliente real e `RetryPolicy` dá 2 requisições, com sucesso
- P4: porta fechada: cadeia `httpx.ConnectError → httpcore.ConnectError → ConnectionRefusedError`, `deve_repetir` True, 5 tentativas no grafo antes de subir `ConnectError`
- P5: leitura lenta (`timeout=1`): `httpx.ReadTimeout → httpcore.ReadTimeout → TimeoutError`, `deve_repetir` True
- P6: pico de pedidos simultâneos de 4 (padrão), 2 e 12, conforme `LLM_CONCORRENCIA`
- P7: `GEMINI_MODELO` ausente dá `gemini-2.5-flash`; `GEMINI_MODELO=''` dá `model=''` (diverge do Landing)
- P8: citações malformadas dão `False` no filtro literal

## Faults injected

Não rodou neste agente (perfil `light`; a injeção de falhas é de um agente separado).

## Gate (8069d09)

- `WD=pipeline SAIDAS="pipeline/.nada" ./dock.sh pipeline 'python -m pytest -p no:cacheprovider -rA tests/'`: 49 passed, 0 failed, 0 skipped (7.43 s, imagem `54aeb37e`). Repetido na imagem final `d4984f58`, depois dos `REBUILD=1`: 49 PASSED, `49 passed in 6.84s`
- `WD=pipeline ./dock.sh pipeline python -m pytest -q`: `49 passed`, rc 0
- `./dock.sh pipeline pip check`: `No broken requirements found.`, rc 0
- `./dock.sh pipeline 'cd pipeline && python -m rag_planos comparar --todos && python -m rag_planos verificar --todos'` com rc 0; em seguida `sha256sum -c hashes-antes.txt` dá 17 OK (rc 0)
- `REBUILD=1 ./dock.sh pipeline python -c "import langgraph"`: **rc 1** (`SyntaxError`); com aspas simples, rc 0
- `git status --porcelain`: vazio antes e depois de todas as execuções (só este arquivo é novo)

## Lacunas (em ordem)

1. **L14: a prova literal falha (bloqueia).** `REBUILD=1 ./dock.sh pipeline python -c "import langgraph"` sai com 1, porque `dock.sh:27` faz `sh -c "$*"` e o Python recebe `-c import`. O comportamento está provado: o contêiner impostor é recriado sem `docker rm`, e o `dock.sh` de `main` falha no mesmo cenário. Correção: escrever a prova como `REBUILD=1 ./dock.sh pipeline 'python -c "import langgraph"'`, ou fazer o `dock.sh` preservar os argumentos. A linha 27 é a mesma em `main`.
2. **Landing "Modelo": a forma literal diverge (bloqueia, gravidade baixa).** O Landing escreve `model=GEMINI_MODELO or "gemini-2.5-flash"`; `llm.py:97` usa `os.environ.get("GEMINI_MODELO", "gemini-2.5-flash")`, e com `GEMINI_MODELO=''` o modelo vira `''` (sonda P7). A semântica vem de `main`. Correção: `os.environ.get("GEMINI_MODELO") or "gemini-2.5-flash"`, ou ajustar o texto do Landing.
3. Testes fracos, sem bloquear: L12 não afirma 8 arquivos e pula com pasta vazia, mas a contagem fica coberta pelo `sha256sum -c`. L13 verifica o Dockerfile e o CI por substring, mas a leitura direta fecha. L6 não afirma `max_interval=60.0` nem `jitter=True`; os testes usam `RAPIDO`, e os valores conferem no código em `grafos.py:24-25`.
4. Cobertura sem teste, só sondada: retry de 500 e de falha de rede/timeout pelo cliente real (P3-P5), limite de `max_concurrency` (P6), itens malformados de classificação (não-objeto, confiança não numérica) e o limite `1.0` inclusivo, citação malformada no filtro de L1 (P8), e `registrar` idempotente (coberto só pela prova de hash de L12).
5. Fora do alcance das provas: a forma real das respostas de erro do Gemini (só servidor falso). `dock.sh:27` não repassa `GEMINI_MODELO` nem `LLM_CONCORRENCIA`, que só podem ser definidos dentro do comando (`'LLM_CONCORRENCIA=2 python -m ...'`). Cada `REBUILD=1` gerou um ID de imagem novo mesmo com cache (`54aeb37e → c562838b → d4984f58`), então o contêiner é recriado a cada `REBUILD=1`, o que é coerente com o Landing.
