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
| Ritmo por cota (rodada 2) | env `LLM_RPM` → `InMemoryRateLimiter(requests_per_second=LLM_RPM/60, check_every_n_seconds=0.05, max_bucket_size=1)` no `ChatGoogleGenerativeAI`; sem a variável, sem limitador. O Google não publica limite fixo do plano gratuito (página de limites, atualizada em 15/10/2026: o limite é por conta e aparece no AI Studio) | um número padrão no código: seria inventado e diferente do da conta |
| Espera sugerida pelo servidor (rodada 2) | num 429 com `google.rpc.RetryInfo` em `error.details`, `Gerador.json` dorme `min(retryDelay, 60)` s antes de deixar o nó repetir; sem o campo, só o backoff do `RetryPolicy` | só o backoff fixo: as 5 tentativas cabem em ~32 s, menos que a janela de 60 s da cota por minuto |
| Telemetria local (rodada 2; amplia "Observabilidade") | cada chamada ao modelo (não as servidas do cache) acrescenta uma linha a `dados/cache-llm/chamadas.jsonl` com `em`, `etapa`, `modelo`, `chave`, `ms`, `tokens_entrada`, `tokens_saida`, `erro`; `chave` é o nome do arquivo de cache, nunca o texto do prompt nem a chave de API. O resumo vira `LLM <provedor>:<modelo>: N chamadas, M do cache, F falhas, Ti tokens de entrada, To de saída` e sai num `finally`, também quando o comando falha | LangSmith: mandaria os prompts para fora; contagem só no sucesso: some justamente quando a cota estoura |
| Formato de resumo e comparação (rodada 2) | `Gerador.json(prompt, etapa, validar)`: resumo tem de ser objeto com `resumo` lista; comparação, objeto com `semelhancas`, `diferencas` e `omissoes` listas; fora disso `ValueError` antes de gravar o cache | tolerar e seguir: o tema sairia "não encontrado" e a resposta ruim ficaria no cache para sempre |
| Prompt idêntico em paralelo (rodada 2) | trava por chave de cache no `Gerador`: o segundo pedido espera o primeiro e lê do cache | deduplicar em cada grafo: juiz e classificação teriam cada um a sua deduplicação |
| Erro definitivo (rodada 2) | o primeiro erro não repetível (400, resposta inválida) marca o `Gerador`; as chamadas seguintes levantam `RuntimeError` sem chamar o modelo | deixar a fila do LangGraph seguir: um worker liberado ainda começa a próxima tarefa e cumpre o retry inteiro |
| Página da citação (rodada 2) | `pagina` tem de ser `int` (nem `bool`, nem float, nem texto) no filtro do grafo e em `verificar._problema_citacao`; fora disso, `trecho_nao_encontrado` | `int(...)` como antes: `37.0` passava e seria publicado como `37.0` |
| Variáveis repassadas (rodada 2) | `dock.sh` repassa também `GEMINI_MODELO`, `LLM_CONCORRENCIA` e `LLM_RPM` | só as três de antes: definir a concorrência no host não teria efeito |

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

**L14** - `dock.sh` recria o contêiner depois de `REBUILD=1` e quando o contêiner roda outra imagem
Proof: `REBUILD=1 ./dock.sh pipeline 'python -c "import langgraph"'` sai com 0 sem `docker rm` manual; e, com um contêiner de `python:3.11.9-slim` posto sob o nome `rag-planos-pipeline-dev`, `./dock.sh pipeline 'python -c "import langgraph"'` sai com 0 (o `dock.sh` passa a linha inteira a `sh -c`, por isso o comando vai entre aspas simples; a prova da rodada 1 sem aspas falhava por isso)

**L15** - a suíte anterior continua verde (32 testes)
Proof: `WD=pipeline ./dock.sh pipeline python -m pytest -q`

**L16** - com `LLM_RPM=600`, `provedor_padrao()` monta o modelo com `InMemoryRateLimiter` de 10 pedidos/s e 5 chamadas ao servidor falso levam ≥ 0,4 s; sem `LLM_RPM`, `rate_limiter` é `None`
Proof: `pytest pipeline/tests/test_grafos.py::test_ritmo_por_cota`

**L17** - 429 com `RetryInfo.retryDelay` "1s" e depois 200: o nó espera ≥ 1 s antes da 2ª requisição; com "30s" e `espera_maxima` 0,2, a espera é limitada a 0,2 s
Proof: `pytest pipeline/tests/test_grafos.py::test_retry_espera_sugerida`

**L18** - telemetria: cada chamada ao modelo grava uma linha em `chamadas.jsonl` com os tokens que o servidor informou e `erro` com classe e código quando falha; cache servido não grava linha; nenhuma linha contém o prompt nem a chave de API; o resumo sai também quando o comando falha
Proof: `pytest pipeline/tests/test_grafos.py::test_telemetria_local pipeline/tests/test_grafos.py::test_resumo_sai_mesmo_com_erro`

**L19** - resposta de resumo ou de comparação com formato errado (lista em vez de objeto, `resumo` que não é lista): `ValueError`, nada no cache, e o comando para
Proof: `pytest pipeline/tests/test_grafos.py::test_formato_invalido_fora_do_cache`

**L20** - quatro prompts idênticos no mesmo fan-out: 1 chamada ao modelo e as quatro respostas iguais à do cache
Proof: `pytest pipeline/tests/test_grafos.py::test_prompt_identico_uma_chamada`

**L21** - depois de um erro não repetível, nenhuma nova chamada ao modelo: com 10 prompts e concorrência 2, no máximo 2 chamadas e o erro original sobe
Proof: `pytest pipeline/tests/test_grafos.py::test_erro_definitivo_interrompe`

**L22** - `pagina` float, texto, `bool` ou ausente reprova no filtro do grafo e em `verificar` (`trecho_nao_encontrado`); os 8 JSONs publicados seguem byte a byte (L12)
Proof: `pytest pipeline/tests/test_grafos.py::test_pagina_nao_inteira_reprova`

**L23** - `dock.sh` repassa `GEMINI_MODELO`, `LLM_CONCORRENCIA` e `LLM_RPM`
Proof: `GEMINI_MODELO=m LLM_CONCORRENCIA=3 LLM_RPM=5 ./dock.sh pipeline 'echo $GEMINI_MODELO $LLM_CONCORRENCIA $LLM_RPM'` imprime `m 3 5`

**L24** - pelo cliente real: 500, tempo esgotado e conexão recusada são repetidos (`deve_repetir` verdadeiro e nova requisição); `max_concurrency` limita as chamadas simultâneas (10 prompts, concorrência 2 → pico 2)
Proof: `pytest pipeline/tests/test_grafos.py::test_retry_rede_e_500 pipeline/tests/test_grafos.py::test_concorrencia_limitada`

## Swept

- validation: L8 (JSON inválido), L19 (formato), L22 (página); citação sem `trecho` ou `pagina` reprova no filtro literal em vez de derrubar o grafo
- failure modes: L6, L17, L21, L24; erro definitivo (400, resposta inválida) sobe com a mensagem do SDK, interrompe as chamadas seguintes e o comando sai ≠ 0; o que já foi respondido fica no cache e a nova execução retoma dali (L3); 429 de cota diária ainda é repetido 5 vezes, porque o 429 não diz se a cota é por minuto ou por dia
- idempotency and retry: L3, L6; `registrar` mantém `gerado_em` quando o conteúdo não muda (já coberto)
- authorization: a chave só vem de env e vai no header (L7)
- concurrency and ordering: L5, L20, L24; `max_concurrency`; trava por chave; escrita do cache por arquivo temporário + `os.replace`
- data lifecycle: `dados/cache-llm/` fica fora do git (`.gitignore`); trocar de modelo muda a chave e não reaproveita respostas
- external-dependency failure: L6 e L11
- state transitions: sem estado entre execuções além do cache; aprovação segue fora do grafo (decisão 21)
- observability: L18 - `chamadas.jsonl` com tokens, latência e erro por chamada, resumo também na falha; tracing externo desligado

## Handoff

Um lote: `llm.py`, `grafos.py` (novo), `comparar.py`, `classificar.py`, `verificar.py`, `__main__.py`, `test_grafos.py`, Dockerfile, CI, `dock.sh`, docs ≈ 45k tokens de leitura, abaixo de 150k. Verificação por agente novo sobre `main..feat/langgraph`.

- Rodada 1 (verificador em `8069d09`): FAIL 14/15 - prova de L14 escrita sem aspas; 8 de 9 mutantes mortos (o sobrevivente é equivalente); 8 achados confirmados pelos céticos, todos médios ou baixos.
- Decidido com o dono no meio do build: nada além do pedido "Mudar para langgraph"; a lente de engenharia de IA invocada por ele motivou L16-L18 (ritmo por cota, espera sugerida, telemetria).
- Abandonado: limite padrão de pedidos por minuto no código (o Google não publica um número fixo para o plano gratuito).
- Rodada 2: L16-L24 e as correções dos achados, no mesmo lote; verificação limitada ao diff da rodada e aos vereditos que não foram PASS.
