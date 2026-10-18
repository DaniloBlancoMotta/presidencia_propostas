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
| Formato exige as chaves (rodada 3; aperta a da rodada 2) | resumo: `isinstance(r.get("resumo"), list)`; comparação: `all(isinstance(r.get(k), list) for k in LISTAS)`; `{}` ou objeto sem a chave levanta `ValueError` | `r.get(k, [])`: `{}` passava, e o tema saía "não encontrado" com a resposta vazia no cache |
| Cota diária (rodada 3) | 429 cujo `google.rpc.QuotaFailure` traz algum `violations[].quotaId` com `PerDay` não é repetido: `deve_repetir` falso, o `Gerador` marca erro definitivo e o resto da fila é cancelado. Forma do corpo conferida num relato real (google-gemini/gemini-cli#8437); não conferida contra a API com chave | repetir todo 429: com a cota do dia esgotada, cada tarefa da fila cumpriria 5 tentativas com espera de até 60 s (~11 min para falhar) |
| Espera sugerida no início da tentativa (rodada 3; substitui o momento da rodada 2) | o `retryDelay` vira um prazo por chave; a próxima tentativa daquela chave dorme só o que falta até o prazo, descontado o backoff do `RetryPolicy`; depois da última tentativa ninguém dorme | dormir logo após o erro: na 5ª tentativa, até 60 s de espera sem próxima chamada |
| Limitador no `Gerador` (rodada 3; substitui o lugar da rodada 2) | `Gerador(limitador=InMemoryRateLimiter(requests_per_second=LLM_RPM/60, check_every_n_seconds=0.05, max_bucket_size=1))` chama `acquire()` antes de medir; `chamadas.jsonl` ganha `espera_ms` (fila do limitador e espera sugerida) separado de `ms` (só a chamada ao modelo) | limitador dentro do `ChatGoogleGenerativeAI`: `ms` somaria a fila e mostraria dezenas de segundos que o servidor não gastou |
| Variáveis vazias ou inválidas (rodada 3) | vazia = padrão (`GEMINI_MODELO`, `LLM_RPM`, `LLM_CONCORRENCIA`); `LLM_RPM` precisa ser número finito > 0 e `LLM_CONCORRENCIA` inteiro ≥ 1, senão `SystemExit` com `ERRO: <variável> ...` | `int('')`/`float('nan')` direto: quebra com traceback, ou o limitador com `nan` trava para sempre |
| Viradas de página no chunk (rodada 4) | cada chunk ganha `viradas: [[posição no texto, página], ...]`, a primeira em 0; `chunk.texto_marcado(c)` põe `[página N]` antes do trecho de cada página, e é isso que vai no prompt de resumo; `resumo.md` diz que a página da citação é a do último marcador antes do trecho e que um trecho não atravessa marcador | cabeçalho `[página 36-38]` por chunk: no teste real de 18/10 o modelo atribuiu tudo à primeira página, e 11 de 14 citações reprovaram; um chunk por página: mudaria tamanho e sobreposição (AC 4) |
| Correção de página na geração (rodada 4) | no nó `filtrar`, citação do arquivo do candidato com `pagina` int cujo trecho não está na página citada: procura nas páginas da faixa (união das `paginas` dos chunks enviados no prompt daquele candidato); achou em exatamente uma, troca e registra `{candidato, texto, trecho, pagina_citada, pagina}`; em nenhuma ou em mais de uma, não troca e o bullet reprova. `verificar` não corrige nada | corrigir em `verificar`: temas já publicados que têm descartes passariam a mudar; procurar no PDF inteiro: trecho repetido em outra seção ganharia uma página que o modelo não viu |
| Registro da correção (rodada 4) | `dados/geracao/<tema>.json` ganha `correcoes_pagina` só quando houve troca; `relatorio.gerar(..., correcoes)` mostra "Páginas corrigidas automaticamente" com o trecho e "pág. citada → pág. verdadeira"; sem troca, nem a chave nem a seção existem, e os rascunhos saem byte a byte iguais | só imprimir no terminal: o dono não veria a troca ao aprovar |
| Modelo padrão (rodada 4; substitui o padrão da linha "Modelo") | `llm.MODELO_PADRAO = "gemini-3.8-flash"`. Em 18/10/2026 a API respondeu 404 para `gemini-2.5-flash`: "no longer available to new users. Please update your code to use models/gemini-3.8-flash" | manter 2.5 e exigir `GEMINI_MODELO`: toda conta nova falharia na primeira chamada |
| Faixa do chunk (rodada 5; substitui a faixa da rodada 4) | o pedido de resumo leva `chunks: [{texto, viradas, pagina}]` dos chunks enviados; a página trocada é a do marcador sob o qual o trecho normalizado aparece no `texto` de um desses chunks (ocorrência que atravessa uma virada não conta); todas as ocorrências na mesma página e o trecho literal nela: troca; senão, não troca | união das páginas dos 12 chunks (22 a 31 páginas, rodada 4): um trecho curto ganhava a página de outro contexto, e o pedido do dono foi "faixa do chunk"; tamanho mínimo de trecho: número que o dono não pediu |
| Correção não muda a data (rodada 5) | `registrar` com mesmo `conteudo` e `origem`: mantém `gerado_em`; se só `correcoes_pagina` mudou, regrava o arquivo com o mesmo `gerado_em` e a lista nova (sem a chave quando vazia) | tratar a lista de correções como conteúdo (rodada 4): `gerado_em` e o SHA-256 publicado mudavam sem nada publicado mudar, e a aprovação caía |
| Página no relatório (rodada 3) | `relatorio._link` só põe `#page=<n>` com `int`; o texto `pág. ...` passa por `html.escape` | `int(c.get("pagina", 0))`: página em texto derrubava `verificar` ao gerar o relatório, e o valor entrava cru no HTML |

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

**L12** - conteúdo publicado inalterado: os 8 `dados/comparacoes/*.json` são reproduzidos byte a byte a partir de `dados/geracao` + `dados/juiz`; `ingest` + `comparar --todos` + `verificar --todos` deixam os 16 SHA-256 de `comparacoes` e `geracao` iguais aos de antes da migração e `dados/relatorios` sem mudança. Renegociado na rodada 4 a pedido do dono: `dados/chunks/chunks.json` muda por causa de `viradas`; os 84 chunks mantêm todos os campos anteriores idênticos aos de `main`, e o arquivo gravado é o que o código produz (rodada 5: todos os campos exceto `temas` iguais aos recalculados; em `temas`, cada tema das palavras-chave presente com confiança ≥ a delas, porque um `ingest` com chave soma as confianças do LLM)
Proof: `pytest pipeline/tests/test_comparacoes_reais.py::test_comparacoes_reproduziveis pipeline/tests/test_chunk.py::test_chunks_gravados_iguais_aos_recalculados`; `sha256sum -c` dos 16 hashes de `hashes-antes.txt` sem a linha de `chunks.json` após os comandos; e a comparação de `git show main:dados/chunks/chunks.json` com o arquivo atual sem a chave `viradas`

**L13** - dependências fixadas: toda linha de `docker/pipeline.requirements.txt` tem `==`, a imagem e o job `pipeline` do CI instalam desse arquivo, `pip check` limpo
Proof: `pytest pipeline/tests/test_grafos.py::test_dependencias_fixadas` e `./dock.sh pipeline pip check`

**L14** - `dock.sh` recria o contêiner depois de `REBUILD=1` e quando o contêiner roda outra imagem
Proof: `REBUILD=1 ./dock.sh pipeline 'python -c "import langgraph"'` sai com 0 sem `docker rm` manual; e, com um contêiner de `python:3.11.9-slim` posto sob o nome `rag-planos-pipeline-dev`, `./dock.sh pipeline 'python -c "import langgraph"'` sai com 0 (o `dock.sh` passa a linha inteira a `sh -c`, por isso o comando vai entre aspas simples; a prova da rodada 1 sem aspas falhava por isso)

**L15** - a suíte anterior continua verde (32 testes)
Proof: `WD=pipeline ./dock.sh pipeline python -m pytest -q`

**L16** - com `LLM_RPM=600`, `provedor_padrao()` monta o `Gerador` com `InMemoryRateLimiter` de 10 pedidos/s, `check_every_n_seconds` 0,05 e `max_bucket_size` 1, e o modelo sem `rate_limiter`; 5 chamadas ao servidor falso levam ≥ 0,4 s; sem `LLM_RPM`, nenhum limitador
Proof: `pytest pipeline/tests/test_grafos.py::test_ritmo_por_cota`

**L17** - 429 com `RetryInfo.retryDelay` "1s" e depois 200: a 2ª requisição sai ≥ 1 s depois da 1ª; com "30s" e `espera_maxima` 0,2, o intervalo fica entre 0,2 s e 2 s; o teto padrão é 60 s; depois da 5ª tentativa com `retryDelay` o erro sobe em < 0,3 s
Proof: `pytest pipeline/tests/test_grafos.py::test_retry_espera_sugerida`

**L18** - telemetria: cada chamada ao modelo grava uma linha em `chamadas.jsonl` com os tokens que o servidor informou, `ms`, `espera_ms` e `erro` com classe e código quando falha; cache servido não grava linha; nenhuma linha contém o prompt nem a chave de API; o resumo sai também quando `comparar`, `verificar` ou `ingest` falha
Proof: `pytest pipeline/tests/test_grafos.py::test_telemetria_local pipeline/tests/test_grafos.py::test_resumo_sai_mesmo_com_erro`

**L19** - resposta de resumo ou de comparação com formato errado (lista em vez de objeto, `{}`, chave ausente, `resumo` que não é lista): `ValueError`, nada no cache, e o comando para
Proof: `pytest pipeline/tests/test_grafos.py::test_formato_invalido_fora_do_cache`

**L20** - quatro prompts idênticos no mesmo fan-out: 1 chamada ao modelo e as quatro respostas iguais à do cache
Proof: `pytest pipeline/tests/test_grafos.py::test_prompt_identico_uma_chamada`

**L21** - depois de um erro não repetível, nenhuma nova chamada ao modelo: com 10 prompts e concorrência 2, no máximo 2 chamadas e o erro original sobe; `grafos._rodar` troca `ChamadaCancelada` pelo erro original, com a cadeia `__cause__` intacta
Proof: `pytest pipeline/tests/test_grafos.py::test_erro_definitivo_interrompe`

**L22** - `pagina` float, texto, `bool` ou ausente reprova no filtro do grafo e em `verificar` (`trecho_nao_encontrado`); o relatório de um descarte com `pagina` "abc" ou `"<b>"` sai sem quebrar e com o valor escapado; os 8 JSONs publicados seguem byte a byte (L12)
Proof: `pytest pipeline/tests/test_grafos.py::test_pagina_nao_inteira_reprova`

**L23** - `dock.sh` repassa `GEMINI_MODELO`, `LLM_CONCORRENCIA` e `LLM_RPM`
Proof: `GEMINI_MODELO=m LLM_CONCORRENCIA=3 LLM_RPM=5 ./dock.sh pipeline 'echo $GEMINI_MODELO $LLM_CONCORRENCIA $LLM_RPM'` imprime `m 3 5`

**L24** - pelo cliente real: 500, tempo esgotado e conexão recusada são repetidos (`deve_repetir` verdadeiro e nova requisição); `max_concurrency` limita as chamadas simultâneas (10 prompts, concorrência 2 → pico 2)
Proof: `pytest pipeline/tests/test_grafos.py::test_retry_rede_e_500 pipeline/tests/test_grafos.py::test_concorrencia_limitada`

**L25** - variáveis: `GEMINI_MODELO`, `LLM_RPM` e `LLM_CONCORRENCIA` vazias caem no padrão (`gemini-3.8-flash` desde a rodada 4, sem limitador, 4); `LLM_RPM` "nan", "abc" ou "0" e `LLM_CONCORRENCIA` "0" ou "x" saem com `SystemExit` e mensagem `ERRO: <variável>`
Proof: `pytest pipeline/tests/test_grafos.py::test_variaveis_vazias_ou_invalidas`

**L26** - cota diária: 429 com `QuotaFailure` de `quotaId` `GenerateRequestsPerDayPerProjectPerModel-FreeTier` → 1 requisição, sem repetição, e as tarefas seguintes canceladas sem chamar o servidor; 429 só com `quotaId` `...PerMinute...` → repetido
Proof: `pytest pipeline/tests/test_grafos.py::test_cota_diaria_nao_repete`

**L27** - viradas de página: num chunk sintético que cobre as páginas 1 e 2, `viradas` é `[[0, 1], [início da 1ª palavra da pág. 2, 2]]` e `texto_marcado` é `[página 1] <palavras da 1> [página 2] <palavras da 2>`; nos 84 chunks reais, as páginas de `viradas` são exatamente `paginas`, a primeira começa em 0, cada trecho entre marcadores ocorre literalmente na sua página, e tirar os marcadores devolve `texto`
Proof: `pytest pipeline/tests/test_chunk.py::test_viradas_marcam_cada_pagina pipeline/tests/test_chunk.py::test_viradas_reais_batem_com_as_paginas`

**L28** - o prompt de resumo leva `[página N]` em cada virada e a regra do marcador, e o pedido leva texto e viradas de cada chunk enviado; no filtro: trecho citado na página errada que aparece num chunk enviado sob um único marcador tem a página trocada para a desse marcador e o bullet fica; trecho sob dois marcadores, ausente dos chunks enviados, de citação do arquivo do outro candidato, ou com `pagina` em texto: sem troca e o bullet sai; bullet que sai não deixa registro de troca; citação já certa não gera registro; a comparação recebe a página já corrigida. Renegociado na rodada 5: a rodada 4 usava a união das páginas dos chunks, e o pedido do dono foi "faixa do chunk"
Proof: `pytest pipeline/tests/test_grafos.py::test_prompt_marca_viradas pipeline/tests/test_grafos.py::test_corrige_pagina_so_quando_unica_na_faixa`

**L29** - a troca fica registrada: `registrar(..., correcoes)` grava `correcoes_pagina`, e sem trocas o arquivo sai idêntico ao de antes (sem a chave); com o mesmo conteúdo e a mesma origem, mudar só as correções mantém `gerado_em`; o relatório mostra "Páginas corrigidas automaticamente" com trecho escapado e "pág. 1 → 2"; sem trocas, a seção não aparece; pela linha de comando, `comparar --origem gemini` grava as trocas em `dados/geracao/<tema>.json` e `verificar` as leva ao relatório
Proof: `pytest pipeline/tests/test_grafos.py::test_correcao_registrada_e_no_relatorio pipeline/tests/test_grafos.py::test_correcoes_pela_linha_de_comando`

**L30** - modelo padrão `gemini-3.8-flash`: `provedor_padrao()` sem `GEMINI_MODELO` usa `gemini-3.8-flash`, e a requisição vai para `/v1beta/models/gemini-3.8-flash:generateContent`
Proof: `pytest pipeline/tests/test_grafos.py::test_variaveis_vazias_ou_invalidas pipeline/tests/test_grafos.py::test_requisicao_gemini`

## Swept

- validation: L8 (JSON inválido), L19 (formato), L22 (página); citação sem `trecho` ou `pagina` reprova no filtro literal em vez de derrubar o grafo
- failure modes: L6, L17, L21, L24; erro definitivo (400, resposta inválida) sobe com a mensagem do SDK, interrompe as chamadas seguintes e o comando sai ≠ 0; o que já foi respondido fica no cache e a nova execução retoma dali (L3); 429 de cota diária não é repetido e interrompe a fila (L26)
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
- Rodada 2 (verificador em `d683c2f`): FAIL - 24/24 checks provados, mas a linha de Landing "Formato" não batia (`{}` passava); 1 mutante sobreviveu de forma não determinística (L21 dependia de qual erro o LangGraph sorteia); 1 regressão média (cota diária com `retryDelay`: ~11 min para falhar) e 4 baixas.
- Rodada 3: L25, L26 e as linhas de Landing "rodada 3". L16, L17, L18, L19, L21 e L22 ganharam valores mais estritos; nenhum foi afrouxado. É a última rodada antes de escalar ao dono.
- Rodada 3 (verificador em `1fab36a`): PASS 26/26; 7 de 8 mutantes mortos (sobrevive a 2ª checagem de erro definitivo, sem teste); 1 regressão baixa (formato estrito aborta `{"nao_encontrado": true}` sem `resumo`), levada ao dono.
- Teste real de 18/10 com a chave do dono (só `saude`, nada publicado): `gemini-2.5-flash` deu 404 para contas novas; com `gemini-3.8-flash`, 3 chamadas sem erro, 21.739 tokens de entrada e 12.508 de saída, mas 11 de 14 citações com o trecho literal na página errada (o modelo atribuía tudo à primeira página da faixa `[página a-b]`).
- Decidido pelo dono em 18/10: as três correções da rodada 4 (viradas no prompt, correção de página na geração, modelo padrão 3.8). A L12 foi renegociada por isso: `chunks.json` muda.
- Rodada 4: L27-L30 e L12 renegociada; verificação nova limitada ao diff da rodada; depois, um novo teste real só de `saude`, sem publicar.
- Rodada 4 (verificador em `74c19a8`): PASS 30/30; 3 mutantes sobreviveram por teste fraco (filtro de arquivo na troca, registro de troca em bullet descartado, `comparar` sem repassar as trocas) e 3 regressões (média: teste da L12 vermelho depois de `ingest` com chave; baixas: trocar só as correções mudava `gerado_em`; faixa = união das páginas, não "faixa do chunk" como o dono pediu). Rodada 5 corrige as seis.
- Teste real da rodada 4 (18/10, `f4f21d1`, `gemini-3.8-flash` padrão, só `saude`, nada publicado): 3 chamadas sem erro, 23.404 tokens de entrada e 15.002 de saída; das 13 citações cruas do modelo (Lula 6, Flávio 7), 13 já vieram na página certa e 0 precisaram de correção (antes: 2 de 14); checagem literal completa sem juiz: 20 itens mantidos, 0 descartados.
