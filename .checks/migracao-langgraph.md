# Camada de LLM do pipeline em LangGraph

Profile: light (nenhum `AGENTS.md` declara outro). Handoff: on, um lote só (estimativa abaixo).

Sources:

- pedido do dono em 18/10/2026: "Mudar para langgraph", depois da avaliação de 5 frameworks
- condições da avaliação, que o dono não contestou: versões fixadas, cache próprio por SHA-256 com nada do estado do grafo na chave nem no valor, `literal.py` sem mudança
- `.specs/plano-final.md` decisão 10 (Gemini Flash só offline, retry/backoff, cache em disco por hash do prompt) e AC 5-9, 13

## Out of scope

- `/ask`, cadeia Gemini → Groq → OpenRouter e circuit breaker - plano §11; esta camada é a base dela, mas nada da fase 2 entra agora
- conteúdo publicado: os 8 temas vêm de `dados/rascunhos` + `dados/juiz` e não podem mudar nem um byte (L12)
- LangSmith ou qualquer tracing externo
- checkpointer e `interrupt` do LangGraph: a revisão humana continua sendo o relatório HTML + `aprovar` (decisão 21)

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Onde fica o cache | `llm.Gerador.json(prompt)`: arquivo `dados/cache-llm/<sha256("<provedor>:<modelo>\n" + prompt)>.json` com `{"resposta": <texto>}`; só o texto do modelo, nunca a saída do nó | `CachePolicy` + `SqliteCache` do LangGraph: guarda a saída inteira do nó; na avaliação, um tema herdou a saída de outro e quebrou com `KeyError` |
| Retry | só no nó: `RetryPolicy(max_attempts=5, initial_interval=2.0, backoff_factor=2.0, max_interval=60.0, jitter=True, retry_on=llm.deve_repetir)`; o modelo com `max_retries=0`; `deve_repetir` percorre `__cause__`/`__context__` e repete só código 429, 500, 503 ou falha de rede (`ConnectionError`, `TimeoutError`, `httpx.TransportError`) | `default_retry_on` do LangGraph: repete também 400 (o erro do SDK não é `ValueError`); retry do SDK (padrão 6) somado ao do nó: até 30 requisições por chamada |
| Modelo | `ChatGoogleGenerativeAI(model=GEMINI_MODELO or "gemini-2.5-flash", temperature=0, max_retries=0, timeout=120, response_mime_type="application/json")` de langchain-google-genai 4.4.2 | manter o REST com `urllib`: o pedido do dono é o framework; a troca de provedor da fase 2 fica a uma classe |
| Grafos | `grafos.py`: `comparar` (START → `Send("resumo")` por candidato com trechos → `filtrar` → `comparar` → END), `juiz` (START → `Send("julgar")` por item pendente → END), `classificar` (START → `Send("classificar")` por chunk → END) | um grafo único gerar+julgar: `comparar` e `verificar` são comandos separados, com o relatório entre eles |
| Ordem do resultado | estado final montado na ordem de `config.CANDIDATOS` e das listas; os reducers só juntam dicionários por chave | confiar na ordem em que os nós terminam: o JSON (e o hash aprovado) mudaria de uma execução para outra |
| Concorrência | `max_concurrency` = env `LLM_CONCORRENCIA`, padrão 4 | sem limite: o `ingest` tem 84 chunks, e o superstep de classificação dispararia os 84 pedidos de uma vez contra a cota gratuita |
| Veredito fora do formato | `grafos._veredito`: resposta sem `sustentado` booleano vira `{"sustentado": false, "justificativa": "resposta do juiz fora do formato: ..."}` e o item sai como `nao_sustentado` (falha fechada) | deixar `_checar` quebrar com `AttributeError`, ou tratar como sustentado |
| Classificação malformada | `classificar.interpretar`: item que não é objeto, sem número em `confianca`, tema desconhecido ou fora de (0, 1] é ignorado; as palavras-chave seguem valendo | derrubar o `ingest` inteiro por um chunk |
| Juiz por LLM | `verificar.juiz_llm(gerador, conteudo, paginas)` roda o grafo sobre `pendentes_para_juiz` e devolve o mesmo `Juiz` por chave que `juiz_vereditos` | juiz chamado item a item dentro de `_checar`: sem paralelismo e com dois formatos de juiz |
| Resposta inválida | `Gerador.json` só grava no cache o que `json.loads` aceita; texto inválido levanta `ValueError` (não repetido) | gravar e depois falhar: o erro ficaria no cache e toda execução seguinte falharia igual |
| Import | `grafos` e `langchain_google_genai` só são importados quando há `GEMINI_API_KEY`; o caminho rascunho + vereditos não carrega LangGraph | import no topo: +2 s em todo comando, inclusive nos que não usam LLM |
| Dependências | `docker/pipeline.requirements.txt`, 56 pacotes com `==` (lock gerado em python:3.11.9-slim); Dockerfile e CI instalam dele; `pyproject.toml` lista as diretas | pinar só as diretas: langchain-core, langsmith e google-genai mudam toda semana |
| Tracing | `ENV LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false` na imagem; `dock.sh` não repassa chave de LangSmith | tracing ligado: mandaria prompts para um serviço externo |
| Observabilidade | cada comando com LLM imprime `LLM <provedor>:<modelo>: N chamadas, M do cache` | nenhuma: não dá para saber quanto da cota um comando gastou |
| Contêiner após rebuild | `dock.sh` recria o contêiner quando o ID da imagem dele difere do da imagem atual | só quando não está rodando: o contêiner antigo seguiria sem LangGraph depois de `REBUILD=1` |

## Checks

**L1** - grafo `comparar`: um pedido de resumo por candidato com trechos, filtro literal antes da comparação; bullet com trecho ausente da página citada não chega ao prompt de comparação nem à saída
Proof: `pytest pipeline/tests/test_grafos.py::test_comparar_filtra_antes_de_comparar`

**L2** - candidato sem chunk no tema: nenhuma chamada ao modelo para ele e `nao_encontrado: true`
Proof: `pytest pipeline/tests/test_grafos.py::test_candidato_sem_chunks_nao_chama_modelo`

**L3** - cache: a segunda execução com a mesma entrada faz 0 chamadas e devolve o mesmo conteúdo; o arquivo é `<sha256("gemini:<modelo>\n" + prompt)>.json` com `{"resposta": ...}`
Proof: `pytest pipeline/tests/test_grafos.py::test_cache_segunda_execucao_sem_chamadas`

**L4** - cache não colide entre temas: tema A sem Lula e depois tema B sem Flávio, mesma pasta de cache; B sai com Flávio `nao_encontrado` e Lula com os bullets
Proof: `pytest pipeline/tests/test_grafos.py::test_cache_nao_colide_entre_temas`

**L5** - determinismo: mesma entrada, latência aleatória por chamada e concorrência 4; 5 execuções sem cache serializam bytes idênticos
Proof: `pytest pipeline/tests/test_grafos.py::test_mesma_entrada_mesmo_json`

**L6** - retry contra servidor HTTP falso com o `ChatGoogleGenerativeAI` real: 429 e 503 seguidos de 200 → sucesso na 3ª requisição; 400 → 1 requisição e erro; 429 cinco vezes → erro depois de exatamente 5 requisições
Proof: `pytest pipeline/tests/test_grafos.py -k retry`

**L7** - requisição ao Gemini: `temperature` 0, `responseMimeType` `application/json`, chave no header `x-goog-api-key` e ausente da URL
Proof: `pytest pipeline/tests/test_grafos.py::test_requisicao_gemini`

**L8** - resposta que não é JSON: `ValueError` e nenhum arquivo no cache; com resposta válida em seguida, grava e segue
Proof: `pytest pipeline/tests/test_grafos.py::test_json_invalido_fora_do_cache`

**L9** - grafo `juiz`: um pedido por item pendente; item julgado não sustentado sai com `nao_sustentado` e a justificativa; os outros ficam `sustentado`
Proof: `pytest pipeline/tests/test_grafos.py::test_juiz_por_grafo`

**L10** - grafo `classificar`: um pedido por chunk; confiança final = máximo entre palavras-chave e LLM; `theme_id` desconhecido e confiança fora de (0, 1] ignorados
Proof: `pytest pipeline/tests/test_grafos.py::test_classificar_por_grafo`

**L11** - sem `GEMINI_API_KEY`: `provedor_padrao()` é `None`, `comparar --origem gemini` sai com código 2 e o caminho sem chave não importa `langgraph`
Proof: `pytest pipeline/tests/test_grafos.py -k sem_chave`

**L12** - conteúdo publicado inalterado: os 8 `dados/comparacoes/*.json` são reproduzidos byte a byte a partir de `dados/geracao` + `dados/juiz`; e `comparar --todos` + `verificar --todos` depois da migração deixam os 17 SHA-256 de `comparacoes`, `geracao` e `chunks` iguais aos de antes
Proof: `pytest pipeline/tests/test_comparacoes_reais.py::test_comparacoes_reproduziveis` e `sha256sum -c hashes-antes.txt` após os dois comandos

**L13** - dependências fixadas: toda linha de `docker/pipeline.requirements.txt` tem `==`, a imagem e o job `pipeline` do CI instalam desse arquivo, `pip check` limpo
Proof: `pytest pipeline/tests/test_grafos.py::test_dependencias_fixadas` e `./dock.sh pipeline pip check`

**L14** - `dock.sh` recria o contêiner depois de `REBUILD=1`
Proof: `REBUILD=1 ./dock.sh pipeline python -c "import langgraph"` sai com 0 sem `docker rm` manual

**L15** - a suíte anterior continua verde (32 testes)
Proof: `WD=pipeline ./dock.sh pipeline python -m pytest -q`

## Swept

- validation: L8 (JSON inválido); citação sem `trecho` ou `pagina` reprova no filtro literal em vez de derrubar o grafo (L1)
- failure modes: L6; erro definitivo (400, cota diária) sobe com a mensagem do SDK e o comando sai ≠ 0; o que já foi respondido fica no cache e a nova execução retoma dali (L3)
- idempotency and retry: L3, L6; `registrar` mantém `gerado_em` quando o conteúdo não muda (já coberto)
- authorization: a chave só vem de env e vai no header (L7)
- concurrency and ordering: L5; `max_concurrency`; escrita do cache por arquivo temporário + `os.replace`
- data lifecycle: `dados/cache-llm/` fica fora do git (`.gitignore`); trocar de modelo muda a chave e não reaproveita respostas
- external-dependency failure: L6 e L11
- state transitions: sem estado entre execuções além do cache; aprovação segue fora do grafo (decisão 21)
- observability: contagem de chamadas e de acertos de cache por comando; tracing externo desligado

## Handoff

Um lote: `llm.py`, `grafos.py` (novo), `comparar.py`, `classificar.py`, `verificar.py`, `__main__.py`, `test_grafos.py`, Dockerfile, CI, `dock.sh`, docs ≈ 45k tokens de leitura, abaixo de 150k. Verificação por agente novo sobre `main..feat/langgraph`.
