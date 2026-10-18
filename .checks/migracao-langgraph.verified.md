# Camada de LLM do pipeline em LangGraph: verificação

**Veredito**: PASS. Os 30 checks (L1-L30) estão provados em `796a021`. Os 80 itens de pytest passaram numa só invocação, cada um listado como `PASSED` no `-rA`. As provas de comando também passaram: L12 (16 `OK`, `git status --short dados` vazio, os 84 chunks iguais aos de `main` sem `viradas`), L13, L14 nas duas formas, L15 na forma literal e L23. Cada check tem `file:line` com a asserção. As 2 linhas do `Landing` marcadas "rodada 5" conferem com o código. O código agora faz o que o dono pediu na rodada 4 ("faixa do chunk"): a página vem do marcador sob o qual o trecho aparece no texto de um chunk enviado, e a união das páginas sumiu. Os 3 mutantes que sobreviveram na rodada 4 agora morrem, e as 3 regressões estão corrigidas. Uma lacuna nova não bloqueia pelo critério desta rodada: o mutante M5 sobreviveu, porque nenhum teste distingue a regra "ocorrência que atravessa uma virada não conta" (`grafos.py:76`).
**Perfil**: light. Rodaram os passos 2 e 3, a releitura do `Swept` e sondas. O passo 1 não roda neste perfil, e a injeção de falhas não é exigida. Mesmo assim, rodaram 7 mutantes nas superfícies da rodada 5, como evidência extra (ver "Falhas injetadas").
**Diff**: rodada 5 em `74c19a8..796a021`. O fix é `84439b8`; `796a021` só reescreve este relatório (rodada 4). A feature vai de `main` a `796a021`. Provas rodadas em HEAD `796a021`, branch `feat/langgraph`
**Rodada**: 5 - scoped
**Verificador**: sub-agente independente (autor != verificador), rótulo `verificador-r5`
**Rodada 1** (`8069d09`): FAIL 14/15. A prova de L14 estava sem aspas, e a linha "Modelo" do `Landing` não tinha `or`.
**Rodada 2** (`d683c2f`): FAIL. Os 24/24 checks estavam provados, mas a linha "Formato" do `Landing` não batia (`{}` passava). O teste de L21 era fraco, e havia 1 regressão média e 4 baixas.
**Rodada 3** (`1fab36a`): PASS 26/26. As 6 linhas "rodada 3" do `Landing` conferiam, 5 mutantes extras foram mortos e ficaram 5 lacunas de precisão não bloqueantes.
**Rodada 4** (`74c19a8`): PASS 30/30. As 4 linhas "rodada 4" do `Landing` conferiam. O mutante do filtro de arquivo sobreviveu, o fio `__main__` → relatório ficou sem pytest e a faixa era a união das páginas, não a "faixa do chunk" do dono.

## Escopo da rodada (verificado em 796a021)

`git diff --stat 74c19a8..HEAD` lista 6 arquivos: `.checks/migracao-langgraph.md`, `.checks/migracao-langgraph.verified.md`, `pipeline/rag_planos/comparar.py`, `pipeline/rag_planos/grafos.py`, `pipeline/tests/test_chunk.py` e `pipeline/tests/test_grafos.py`. Já `git diff --stat 74c19a8..HEAD -- dock.sh docker .github pipeline/pyproject.toml pipeline/rag_planos/llm.py pipeline/rag_planos/verificar.py pipeline/rag_planos/classificar.py pipeline/rag_planos/relatorio.py pipeline/rag_planos/__main__.py pipeline/rag_planos/chunk.py pipeline/rag_planos/literal.py pipeline/rag_planos/prompts dados` sai vazio. As citações desses arquivos vêm marcadas "carregado de 74c19a8".

Os hunks do diff definem quais linhas mudaram:

- `test_grafos.py`: o primeiro hunk é `@@ -656`, então as linhas até `:655` são as mesmas da rodada 4. Foram conferidas uma a uma em 32 pontos (`:100` a `:643`).
- `test_chunk.py`: o primeiro hunk é `@@ -70`, e só o corpo de `test_chunks_gravados_iguais_aos_recalculados` mudou.
- `grafos.py`: entraram +18 linhas a partir de `:65` (`_pagina_no_chunk`). As citações acima de `:62` não mudaram, e as de baixo foram refeitas.
- `comparar.py`: mudaram `pedidos_de_resumo` (`:47-60`) e `registrar` (`:74-95`). Tudo a partir de `:47` foi recitado.

Mudanças no checklist (`git diff 74c19a8..84439b8 -- .checks/migracao-langgraph.md`):

- 2 linhas novas no `Landing`: "Faixa do chunk (rodada 5)" e "Correção não muda a data (rodada 5)"
- L12 ganhou o parêntese "(rodada 5: ...)". A igualdade de `temas` virou "cada tema das palavras-chave presente com confiança ≥ a delas"
- L28 foi reescrita para a faixa do chunk e ganhou os casos "arquivo do outro candidato" e "bullet que sai não deixa registro"
- L29 ganhou "mudar só as correções mantém `gerado_em`" e o caminho pela linha de comando, com a prova nova `test_correcoes_pela_linha_de_comando`
- 1 linha nova no Handoff

Afrouxamento só existe em L12, no campo `temas` (ver lacuna 4). L28 ficou mais estrita: a página precisa estar sob o marcador no texto enviado, não basta estar em alguma página da união. L29 só ganhou afirmações.

## Fontes vinculantes (carregado de 74c19a8)

O passo 1 não roda no perfil `light`, nem para os checks renegociados (L12, L28). O pedido do brief foi comparar o código com a frase do dono da rodada 4, "faixa do chunk", e isso está na linha "Faixa do chunk" do `Landing` e na sonda S3. A decisão 10 do plano (`.specs/plano-final.md:40`) ainda tem a redação da rodada 4: "um trecho literal que está em uma só página da faixa enviada". Ela é compatível com a rodada 5 se "faixa enviada" for lida como o texto enviado. Não houve mudança no plano nesta rodada (lacuna 5).

## Gate (verificado em 796a021)

- Suíte com `-rA`: `WD=pipeline SAIDAS="pipeline/.nada" ./dock.sh pipeline 'python -m pytest -p no:cacheprovider -rA tests/ 2>&1 | grep -E "^(PASSED|FAILED|ERROR)|passed|failed"'` deu `80 passed in 16.03s`. São 80 linhas `PASSED` e nenhuma `FAILED` ou `ERROR`, na imagem `42cdcb0b`. A saída está em `<scratchpad>/verif-langgraph-r5/verificador-r5/pytest-rA.txt`
- L15, forma literal: `WD=pipeline ./dock.sh pipeline python -m pytest -q` deu `80 passed in 15.54s`, rc 0
- L12, comandos: `./dock.sh pipeline 'cd pipeline && python -m rag_planos ingest && python -m rag_planos comparar --todos && python -m rag_planos verificar --todos'` saiu com rc 0. A saída teve `84 chunks · classificação: palavras-chave` e, em cada tema, `gerado <tema> · rascunho (dados/rascunhos) · 2026-10-17T23:52:21-03:00`. A saída inteira está em `.../verificador-r5/l12-comandos.txt`
- L12, hashes: `sha256sum -c ".../scratchpad/hashes-antes-16.txt"` deu 16 linhas `OK`, rc 0, e `git status --short dados` saiu vazio
- L12, `chunks.json` regravado: o `ingest` regravou o arquivo (mtime de `12:42:03` para `12:43:49`), e o SHA-256 continua `812fe5c2…`, o da HEAD (o de `main` é `853e29c4…`). Os 8 `dados/relatorios/*.html` rastreados foram refeitos (mtime `12:43:50`) e seguem sem mudança no git
- L12, chunks contra `main`: rodou `docker run --rm -i --network none rag-planos-pipeline` sobre `git show main:` e `git show HEAD:` do arquivo, mais o arquivo em disco. O script está em `.../verificador-r5/cmp/cmp.py` e a saída em `.../verificador-r5/cmp.out`. Resultado: `main 84 head 84 disco==head True`, `head sem viradas == main: True` e `chaves head - main: ['viradas'] | main - head: []`
- L13: `./dock.sh pipeline pip check` dá `No broken requirements found.`, rc 0
- L23: `GEMINI_MODELO=m LLM_CONCORRENCIA=3 LLM_RPM=5 ./dock.sh pipeline 'echo $GEMINI_MODELO $LLM_CONCORRENCIA $LLM_RPM'` imprime `m 3 5`, rc 0. No controle, sem as variáveis no host, sai `[][][]`
- L14, forma literal: `REBUILD=1 ./dock.sh pipeline 'python -c "import langgraph"'` sai com rc 0. A imagem foi de `42cdcb0b…` para `b81013ae…`, e o contêiner foi recriado com ela: `Created` passou de `15:16:37Z` para `15:49:37Z`, com `.Image` = `b81013ae…`
- L14, impostor: pus sob o nome `rag-planos-pipeline-dev` um contêiner `python:3.11.9-slim` (`8fb09919…`), em que `import langgraph` dá `ModuleNotFoundError`. Em seguida, `./dock.sh pipeline 'python -c "import langgraph"'` saiu com rc 0, e o contêiner voltou a `b81013ae…` (`Created` `15:49:53Z`). O `docker rm` só montou o impostor; o `dock.sh` não precisou de `rm` manual
- Na imagem refeita (`b81013ae`), a suíte com `-rA` deu `80 passed in 15.73s`, com a mesma lista de `PASSED` (`diff` vazio), e `pip check` saiu limpo
- Sem rede e sem chave: `GEMINI_API_KEY`, `GEMINI_MODELO`, `LLM_RPM` e `LLM_CONCORRENCIA` estavam ausentes no host durante tudo. Nenhuma chamada foi feita à API do Google, e sondas e mutantes rodaram com `--network none`
- `git status --porcelain`: vazio no início (`porcelain-antes.txt`, 12:43:09). Às 12:45:44 apareceu `?? .specs/features/` (`interface-site/achados-revisao.txt` e `plan.md`), criado por outro processo. Não veio do `dock.sh`, cujo `SAIDAS` padrão é `dados revisao web/dist web/package-lock.json web/test-results web/relatorios`, nem deste verificador. Fora isso, a única mudança no repositório é este relatório

Filtros `-k` (`--collect-only -q tests/test_grafos.py`):

- `-k retry`: `5/44 tests collected` (`test_retry_429_e_503_repetem`, `test_retry_400_nao_repete`, `test_retry_desiste_depois_de_5_tentativas`, `test_retry_espera_sugerida`, `test_retry_rede_e_500`)
- `-k sem_chave`: `3/44 tests collected` (`test_sem_chave_provedor_padrao_none`, `test_sem_chave_comparar_gemini_sai_2`, `test_sem_chave_nao_importa_langgraph`)

Os ids parametrizados de `test_formato_invalido_fora_do_cache` (8) e de `test_pagina_nao_inteira_reprova` (6) são os mesmos da rodada 4, todos `PASSED`.

Cada teste nomeado foi localizado com `rg -n "^def test_|^@pytest.mark.parametrize" pipeline/tests/test_grafos.py pipeline/tests/test_chunk.py pipeline/tests/test_comparacoes_reais.py`. São 36 nomes nas provas: 35 da rodada 4 e 1 novo. Cada um tem exatamente uma definição (`rg -c "^def <nome>\("` = 1) e aparece como `PASSED` no `-rA`, e `uniq -d` sobre todos os `def test_` sai vazio. O novo é `test_grafos.py:745 test_correcoes_pela_linha_de_comando`. Também mudaram de linha: `test_corrige_pagina_so_quando_unica_na_faixa`, de `:681` para `:684`, e `test_correcao_registrada_e_no_relatorio`, de `:711` para `:716`. `test_chunk.py:72` mudou de corpo. L15: os 32 `def test_` de `main` estão todos em HEAD (`comm -23` vazio), e HEAD tem 68 funções e 80 itens.

## Checks

L1-L11, L13-L27 e L30: prova rodada em 796a021, citações carregadas de 74c19a8 e conferidas iguais em 796a021 (o diff de `test_grafos.py` começa em `:656`). L12, L28 e L29: verificados em 796a021.

| Check | Afirmação | Prova rodada | Evidência file:line + asserção | Resultado |
|---|---|---|---|---|
| L1 | 1 resumo por candidato com trechos; filtro literal antes de comparar; bullet inventado fora do prompt e da saída | `test_grafos.py:95 test_comparar_filtra_antes_de_comparar` PASSED | `:100` `len(resumos) == 2 and len(comparacoes) == 1`; `:102` `INVENTADO not in comparacoes[0]`; `:106` `INVENTADO not in json.dumps(saida, ...)`; `:108` `list(saida) == ["candidatos", "semelhancas", "diferencas", "omissoes"]` | PASS |
| L2 | candidato sem chunk: nenhuma chamada e `nao_encontrado: true` | `:111 test_candidato_sem_chunks_nao_chama_modelo` PASSED | `:114` `[_tipo(p) for p in m.prompts] == ["resume", "compara"]`; `:116` `saida["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": []}`; `:120` `== ["compara"]` | PASS |
| L3 | 2ª execução: 0 chamadas e mesmo conteúdo; arquivo `<sha256("gemini:<modelo>\n"+prompt)>.json` com `{"resposta": ...}` | `:126 test_cache_segunda_execucao_sem_chamadas` PASSED | `:133` `a == b`; `:134` `(g2.chamadas, g2.do_cache) == (0, 3)`; `:139` `hashlib.sha256(("gemini:gemini-3.8-flash\n" + p).encode("utf-8")).hexdigest() + ".json"`; `:140` `== {"resposta": responder(p)}`. O pedido agora leva `chunks`, mas a chave do cache continua só o prompt (`llm.py:118`, intocado) | PASS |
| L4 | cache não colide: A sem Lula, B sem Flávio, mesma pasta | `:145 test_cache_nao_colide_entre_temas` PASSED | `:154` `b["candidatos"]["flavio-bolsonaro"] == {"nao_encontrado": True, "resumo": []}`; `:155` Lula em B `== ["Fortalecer o SUS."]` | PASS |
| L5 | 5 execuções, latência variável, concorrência 4: bytes idênticos | `:160 test_mesma_entrada_mesmo_json` PASSED | `:161` `LLM_CONCORRENCIA=4`; `:169` `len(ordens) == 2`; `:170` `len(saidas) == 1` | PASS |
| L6 | cliente real: 429+503 → 3 requisições; 400 → 1; 429 contínuo → exatamente 5 | `-k retry` (5 testes) PASSED | `:232` `== (5, 2.0, 2.0, 60.0, True)`; `:233` `retry_on is llm.deve_repetir`; `:236` `len(servidor.pedidos) == 3`; `:244` `== 1`; `:253` `== 5` | PASS |
| L7 | `temperature` 0, `responseMimeType` JSON, chave no header e fora da URL | `:257 test_requisicao_gemini` PASSED | `:261` `temperature == 0`; `:262` `responseMimeType == "application/json"`; `:263` `headers["x-goog-api-key"] == "chave-falsa"`; `:264` `"chave-falsa" not in p["path"]` | PASS |
| L8 | não-JSON: `ValueError`, nada no cache; válido depois grava | `:269 test_json_invalido_fora_do_cache` PASSED | `:272` `pytest.raises(ValueError)`; `:274` `not list(tmp_path.glob("*.json"))`; `:277` `g.json("p") == {"ok": True}` | PASS |
| L9 | grafo juiz: 1 pedido por pendente; não sustentado com justificativa; o resto `sustentado` | `:548 test_juiz_por_grafo` PASSED | `:561` `len(pendentes) == 4 and len(m.prompts) == 4`; `:568` `== "nao_sustentado"`; `:569` `== "o trecho não fala em fortalecer"`; `:573` `all(x["juiz"] == "sustentado" for x in mantidos)` | PASS |
| L10 | 1 pedido por chunk; máximo entre palavras-chave e LLM; desconhecido e fora de (0, 1] ignorados | `:578 test_classificar_por_grafo` PASSED | `:595` `len(m.prompts) == 3`; `:597` `== [{"theme_id": "educacao", "confianca": 0.6}, {"theme_id": "saude", "confianca": 0.25}]`; `:598-599`; `:605` `confianca 1.0` | PASS |
| L11 | sem chave: `provedor_padrao()` None; `comparar --origem gemini` → 2; sem import de langgraph | `-k sem_chave` (3) PASSED | `:613` `llm.provedor_padrao() is None`; `:618` `main([...]) == 2`; `:635` `r.stdout.strip() == "[]"` | PASS |
| L12 | os 8 JSON reproduzidos byte a byte; após `ingest` + `comparar --todos` + `verificar --todos`, os 16 SHA-256 iguais e `dados/relatorios` sem mudança; os 84 chunks iguais a `main` fora `viradas`; o arquivo gravado é o que o código produz, com `temas` admitindo as confianças do LLM (≥ as das palavras-chave) | `test_comparacoes_reais.py:47 test_comparacoes_reproduziveis` e `test_chunk.py:72 test_chunks_gravados_iguais_aos_recalculados` PASSED; comandos do Gate | `test_comparacoes_reais.py` carregado de 74c19a8 (intocado): `:49` `{a.stem for a in ARQUIVOS} == {t["id"] for t in temas.carregar()}`, `:54` `g["conteudo"] == comparar.de_rascunho(tid)`, `:57` `verificar.serializar(...) == arq.read_bytes()`. Novo em `test_chunk.py`: `:76` `len(gravados) == len(chunks_reais) == 84`; `:78` `{k: v for k, v in g.items() if k != "temas"} == {k: v for k, v in r.items() if k != "temas"}`; `:80` `all(conf.get(t["theme_id"], -1) >= t["confianca"] for t in r["temas"])`. Comandos: 16 `OK`, `git status --short dados` vazio, `head sem viradas == main: True`. A sonda P-L12 mostra que o teste aceita um `ingest` com chave simulado e ainda pega confiança menor, tema sumido, texto mudado, viradas mudadas e um chunk a menos | PASS |
| L13 | toda linha do lock com `==`; imagem e CI instalam dele; `pip check` limpo | `:640 test_dependencias_fixadas` PASSED; `pip check` limpo nas duas imagens | `:643` `re.fullmatch(r"[A-Za-z0-9_.\-]+==[0-9][0-9A-Za-z.]*", l)` em todas as linhas; `:648` `version(nome) == versao`; `docker/pipeline.Dockerfile:4-5` e `.github/workflows/ci.yml:16` carregados de 74c19a8 (intocados) | PASS |
| L14 | `dock.sh` recria o contêiner depois de `REBUILD=1` e quando ele roda outra imagem | as duas formas, rc 0 (Gate) | carregado de 74c19a8 (`dock.sh` intocado): `dock.sh:17-18` compara o `.Image` do contêiner com o `.Id` da imagem; `:19` `docker rm -f "$nome"`; `:27` `sh -c "$*"`. Valores desta rodada: `42cdcb0b` → `b81013ae`, recriado; depois do impostor `8fb09919`, volta a `b81013ae` | PASS |
| L15 | a suíte anterior continua verde (32 testes) | `WD=pipeline ./dock.sh pipeline python -m pytest -q` → `80 passed`, rc 0 | os 32 `def test_` de `main` estão todos em HEAD (`comm -23` vazio) | PASS |
| L16 | `LLM_RPM=600` → limitador (10/s, 0,05, 1) no `Gerador`, modelo sem `rate_limiter`; 5 chamadas ≥ 0,4 s; sem `LLM_RPM`, nenhum | `:283 test_ritmo_por_cota` PASSED | `:287` `limitador is None`; `:292` `== (10, 0.05, 1)`; `:293` `p.modelo.rate_limiter is None`; `:299` `>= 0.4`; `:300` `== 5` | PASS |
| L17 | "1s" → ≥ 1 s; "30s" com teto 0,2 → entre 0,2 e 2 s; teto padrão 60 s; depois da 5ª, o erro sobe em < 0,3 s | `:311 test_retry_espera_sugerida` PASSED | `:315` `>= 1.0`; `:322` `0.2 <= ... < 2.0`; `:323` `llm.ESPERA_MAXIMA_SUGERIDA == 60.0`; `:330` `== 5`; `:331` `< 0.3` | PASS |
| L18 | 1 linha por chamada com tokens, `ms`, `espera_ms` e `erro`; cache não grava; nem prompt nem chave; resumo também na falha | `:422 test_telemetria_local` e `:443 test_resumo_sai_mesmo_com_erro` PASSED | `:431` `== ["GoogleRateLimitError 429", None]`; `:432` `== (11, 7)`; `:437` `"chave-secreta-123" not in bruto and "Você compara" not in bruto`; `:439-440` o resumo; `:453`, `:458-465` resumo na falha de `comparar`, `verificar` e `ingest` | PASS |
| L19 | formato errado: `ValueError`, nada no cache, o comando para | `:473 test_formato_invalido_fora_do_cache` PASSED, 8 ids | `:475` `pytest.raises(ValueError, match="fora do formato")`; `:478` `resposta not in gravados` | PASS |
| L20 | 4 prompts idênticos: 1 chamada e 4 respostas iguais | `:481 test_prompt_identico_uma_chamada` PASSED | `:488` `len(m.prompts) == 1 and (g.chamadas, g.do_cache) == (1, 3)`; `:490` `respostas == [cache] * 4` | PASS |
| L21 | depois de erro não repetível, ≤ 2 chamadas e sobe o original com `__cause__` | `:499 test_erro_definitivo_interrompe` PASSED | `:510` `len(m.prompts) <= 2`; `:521` `erro.value is original and isinstance(erro.value.__cause__, ValueError)` | PASS |
| L22 | `pagina` float, texto, `bool` ou ausente reprova no filtro e em `verificar`; relatório não quebra e escapa | `:528 test_pagina_nao_inteira_reprova` PASSED, 6 ids | `:532` `not grafos._literal(...)`; `:538-539` `== ["trecho_nao_encontrado"]`; `:542` `html.escape(...)` no bloco; `:543` `"<b>" not in bloco.replace("<b>Resumo</b>", "")`. `_literal` (`grafos.py:50-62`) não mudou | PASS |
| L23 | `dock.sh` repassa `GEMINI_MODELO`, `LLM_CONCORRENCIA` e `LLM_RPM` | `m 3 5`, rc 0 | carregado de 74c19a8: `dock.sh:27` `docker exec -i -e GEMINI_API_KEY -e GEMINI_MODELO -e LLM_CONCORRENCIA -e LLM_RPM ...`; controle `[][][]` | PASS |
| L24 | 500, tempo esgotado e conexão recusada repetidos; concorrência 2 → pico 2 | `:334 test_retry_rede_e_500` e `:354 test_concorrencia_limitada` PASSED | `:335-337` `[500]` → `== 2`; `:343` `len(servidor.pedidos) == 2 and g.falhas == 1`; `:351` `llm.deve_repetir(erro.value)`; `:368` `estado["pico"] == 2` | PASS |
| L25 | vazias → padrão (`gemini-3.8-flash`, sem limitador, 4); inválidas → `SystemExit` `ERRO: <variável>` | `:373 test_variaveis_vazias_ou_invalidas` PASSED | `:378` `== ("gemini-3.8-flash", None, 4)`; `:379-382` `match="ERRO: LLM_RPM"`; `:384-387` `match="ERRO: LLM_CONCORRENCIA"` | PASS |
| L26 | `...PerDay...` → 1 requisição, sem repetição, fila cancelada; só `...PerMinute...` → repetido | `:401 test_cota_diaria_nao_repete` PASSED | `:402-404` `PerMinute` → `== 2`; `:414` `len(servidor.pedidos) == 1`; `:415` `llm.cota_diaria(erro.value) and not llm.deve_repetir(erro.value)` | PASS |
| L27 | `viradas` do chunk sintético e `texto_marcado`; nos 84 reais, páginas = `paginas`, 1ª em 0, trecho literal, sem marcadores volta `texto` | `test_chunk.py:47` e `:58` PASSED | `:53` `c["viradas"] == [[0, 1], [len(a) + 1, 2]]`; `:54` `== f"[página 1] {a} [página 2] {b}"`; `:63` `v[0] == [0, c["pagina"]] and [p for _, p in v] == c["paginas"]`; `:64` `re.sub(...) == c["texto"]`; `:68` `trecho_na_pagina(...)` (linhas abaixo de `:70`, iguais às da rodada 4) | PASS |
| L28 | prompt com `[página N]` e a regra; o pedido leva texto e viradas de cada chunk enviado; a troca vai para a página do único marcador sob o qual o trecho aparece num chunk enviado; sob dois marcadores, ausente dos chunks, do arquivo do outro candidato ou com `pagina` em texto: sem troca e o bullet sai; bullet que sai não registra troca; citação certa não registra; a comparação recebe a página corrigida | `test_grafos.py:670 test_prompt_marca_viradas` e `:684 test_corrige_pagina_so_quando_unica_na_faixa` PASSED | `:674` `list(pedidos) == ["lula"]`; `:675-677` `[(c["texto"], c["viradas"]) for c in pedidos["lula"]["chunks"]] == [("Texto repetido A. Proposta um. Texto repetido A. Proposta dois.", [[0, 1], [31, 2]]), ("Página cinco.", [[0, 5]])]`; `:679` `"[página 1] ... [página 2] ..." in p`; `:680` `"[página 1-2]" not in p`; `:681` a regra do marcador. Filtro: casos em `:688-695`; `:701` `[b["texto"] for b in lula] == ["Corrigida.", "Certa."]`, de modo que saem "Ambígua." (dois marcadores), "Fora da faixa." (pág. 3 fora do chunk), "Página em texto.", "Arquivo do outro." (agora o Flávio tem "Proposta dois." na pág. 2, `:659`), "Duas citações." e "Atravessa."; `:702` `== [2, 1]`; `:703-704` `correcoes == [{"candidato": "lula", "texto": "Corrigida.", "trecho": "Proposta dois.", "pagina_citada": 1, "pagina": 2}]`, sem registro para "Duas citações." (descartado depois da troca) nem para "Certa."; `:707-708` `'"pagina": 2, "trecho": "Proposta dois."' in pedido_comparar` e a versão com `1` ausente; `:709` `com_llm(...) == conteudo` | PASS. M1, M2 e M7 mortos; M5 sobreviveu (lacuna 1) |
| L29 | `registrar(..., correcoes)` grava `correcoes_pagina`; sem troca, o arquivo é idêntico (sem a chave); mesmo conteúdo e origem com outras correções mantêm `gerado_em`; o relatório mostra a seção com trecho escapado e "pág. 1 → 2"; sem troca, sem seção; pela linha de comando, `comparar --origem gemini` grava as trocas e `verificar` as leva ao relatório | `:716 test_correcao_registrada_e_no_relatorio` e `:745 test_correcoes_pela_linha_de_comando` PASSED | `:723` `a == (tmp_path / "b" / "saude.json").read_bytes() and b"correcoes_pagina" not in a`; `:725` `["correcoes_pagina"] == corr`; `:727-728` `gerado_em` igual com as mesmas correções; `:730` `sem_trocas["gerado_em"] == reg["gerado_em"] and "correcoes_pagina" not in sem_trocas`; `:731` `(tmp_path / "c" / "saude.json").read_bytes() == a`; `:738` `"Páginas corrigidas automaticamente (1)" in com and "pág. 1 → 2" in com`; `:739` `"Fortalecer &lt;o&gt; SUS" in com and "<o>" not in com`; `:740` `"Páginas corrigidas" not in sem`; `:741-742` `[]` → mesmo HTML. Linha de comando: `:762` `main(["comparar", "saude", "--origem", "gemini"]) == 0`; `:763` `"2 página(s) corrigida(s)" in ...out`; `:765` `sorted(c["candidato"] ...) == ["flavio-bolsonaro", "lula"]`; `:766` `all(c["pagina_citada"] == c["pagina"] + 1 ...)`; `:772` `cli._verificar_tema(...)`; `:774` `"Páginas corrigidas automaticamente (2)" in html_rel` | PASS. M3, M4 e M6 mortos; lacunas 2 e 3 |
| L30 | sem `GEMINI_MODELO`, `gemini-3.8-flash` e `/v1beta/models/gemini-3.8-flash:generateContent` | `:373` e `:257` PASSED | `:378` `p.nome_modelo == "gemini-3.8-flash"`; `:260` `p["path"] == "/v1beta/models/gemini-3.8-flash:generateContent"` | PASS (lacuna 6: vazia, não ausente) |

Nível, carregado de 74c19a8: L6, L7, L16-L18, L24, L26 e L30 usam o `ChatGoogleGenerativeAI` real contra o HTTP local `ServidorGemini`. L12 (`test_chunk.py:72`), L27 e L29 pela linha de comando (`:745`, fixture `paginas` = `extrair.extrair()`, e o `chunks.json` real) usam os PDFs reais.

## Landing: linhas da rodada 5 (verificado em 796a021)

| Linha | Código | Confere |
|---|---|---|
| Faixa do chunk | Pedido: `comparar.py:58-59` `"chunks": [{"texto": c["texto"], "viradas": c.get("viradas"), "pagina": c["pagina"]} for c in sel]`, com `sel` = os chunks enviados no prompt (`:53-57`). A sonda S0 dá `chaves de cada chunk: ['pagina', 'texto', 'viradas']` e pedido `['chunks', 'prompt']`, sem `paginas`. No filtro, `grafos.py:139` `enviados = _dict(s["pedidos"].get(cid)).get("chunks", [])` e `:142` passa a `_corrigir_paginas`. Em `_pagina_no_chunk` (`:65-79`): `:68` `t = normalizar(trecho)`; `:72` e `:78` procuram cada ocorrência no `texto`; `:74` `k = max(j ... if inicio <= i)` dá o último marcador antes da ocorrência; `:75-76` `if i + len(t) <= proxima - 1` descarta a ocorrência que atravessa a virada seguinte; `:77` guarda a página do marcador; `:79` `achadas.pop() if len(achadas) == 1 else None` exige todas na mesma página. Em `_corrigir_paginas`, `:98-99` só troca se `vista is not None and trecho_na_pagina(trecho, ...vista...)` (trecho literal nela), e `:100-101` registram e trocam. `rg -n '"paginas"' grafos.py` só acha `s["paginas"]`, o dicionário de páginas do PDF: a união das páginas dos chunks sumiu. Sondas: S2 (segmentos reais certos 32/32 e 33/33; trechos que atravessam a virada → `None` 20/20 e 21/21) e S3 (das 266 janelas fora do texto dos chunks, a rodada 4 trocaria 266 e a rodada 5 troca 0) | sim. M5 sobreviveu (lacuna 1) |
| Correção não muda a data | `comparar.py:80` lê o antigo; `:81` `if antigo and antigo["conteudo"] == conteudo and antigo["origem"] == origem:`; `:82-83` com as mesmas correções, devolve o antigo sem regravar; `:84` `registro = {k: v for k, v in antigo.items() if k != "correcoes_pagina"}` mantém `gerado_em` e a ordem das chaves; `:92-93` `if correcoes: registro["correcoes_pagina"] = correcoes` (sem a chave quando vazia); `:94` regrava. O arquivo regravado sem correções é byte a byte o original (`test_grafos.py:731`). `verificar.montar` usa `g["gerado_em"]` (`__main__.py:131`, carregado de 74c19a8), então o SHA-256 publicado não muda | sim. M6 morto; lacuna 2 |

A frase do dono na rodada 4 era "faixa do chunk", e o código agora faz exatamente isso. A página vem do texto do chunk que o modelo viu e do marcador `[página N]` sob o qual o trecho está. Pela L27, essa página é sempre uma das páginas daquele chunk. Um trecho que está numa página da faixa, mas fora do texto enviado, não é mais trocado (S3, com exemplos `'A jornada do cidadão A vida de uma'` na pág. 10 de Flávio e `'empreendedorismo feminino; de apoio à participação'` na pág. 22 de Lula: `_corrigir_paginas` → `trocas=[]`, página citada mantida).

## Landing: linhas da rodada 4 (verificado em 796a021 onde o arquivo mudou; o resto carregado de 74c19a8)

| Linha | Código | Confere |
|---|---|---|
| Viradas de página no chunk (carregado de 74c19a8) | `chunk.py:49-53`, `:59`, `:66-77`; `comparar.py:55` `"\n\n".join(chunk.texto_marcado(c) for c in sel)`; `prompts/resumo.md:9` | sim |
| Correção de página na geração | a faixa foi substituída pela linha "Faixa do chunk" (acima). O resto confere em `grafos.py`: `:91` só a citação com `arquivo` do candidato; `:94` `pagina` `int` e não `bool`; `:96-97` a citação já certa segue sem registro; `:99-101` troca e registra `{trecho, pagina_citada, pagina}`; `:142-145` a troca vem antes de `_literal`, e o registro `{"candidato": cid, "texto": ..., **t}` só entra para bullet mantido. Em nenhuma ou em mais de uma página, `ci["pagina"]` não muda, e `_literal` (`:143`) reprova. `verificar` não corrige nada: `git diff 74c19a8..HEAD -- pipeline/rag_planos/verificar.py` sai vazio, e `rg -n "correcoes\|_corrigir_paginas\|_pagina_no_chunk" pipeline/rag_planos/` só acha `grafos.py`, `comparar.py`, `relatorio.py` e `__main__.py` | sim. M1 e M2 mortos |
| Registro da correção | `comparar.py:92-93` (a chave só existe quando há troca); `__main__.py:81`, `:84`, `:88` `registrar(..., correcoes=correcoes)` e `:138` `relatorio.gerar(..., g.get("correcoes_pagina"))`; `relatorio.py:58-67`, `:99-100` (carregados de 74c19a8). Sem troca, os 16 SHA-256 batem e os relatórios rastreados não mudam (Gate) | sim. M3 e M4 mortos |
| Modelo padrão (carregado de 74c19a8) | `llm.py:30` `MODELO_PADRAO = "gemini-3.8-flash"`; `:242` `os.environ.get("GEMINI_MODELO") or MODELO_PADRAO` | sim |

## Landing: linhas das rodadas 1-3 (citações de `grafos.py` e `comparar.py` refeitas em 796a021; o resto carregado de 74c19a8)

| Linha | Código | Confere |
|---|---|---|
| Onde fica o cache | `llm.py:103`, `:115`, `:118`, `:183` (carregados); `rg -n "CachePolicy\|SqliteCache\|checkpointer\|MemorySaver\|interrupt" pipeline/rag_planos/` sai com rc 1 em 796a021 | sim |
| Retry | `grafos.py:25-26` `RetryPolicy(max_attempts=5, initial_interval=2.0, backoff_factor=2.0, max_interval=60.0, jitter=True, retry_on=llm.deve_repetir)`; nos nós em `:156`, `:158`, `:197` e `:224`; `llm.py:195`, `:27`, `:39`, `:71` (carregados) | sim |
| Modelo | `llm.py:192-196` (carregado) | sim (padrão substituído na r4) |
| Grafos | `comparar`: `grafos.py:129` `Send("resumo", ...)`, `:155-163`; `juiz`: `:189`, `:196-200`; `classificar`: `:218`, `:223-227` | sim |
| Ordem do resultado | `grafos.py:137` `for cid, meta in config.CANDIDATOS.items()` (também ordena `correcoes`); `:153` `{k: r.get(k, []) for k in LISTAS}`; `:235` `[s["respostas"][i] for i in range(len(prompts))]`; reducer `:29-30` | sim |
| Concorrência | `grafos.py:34`; `_rodar` em `:37-43`, usado em `:168`, `:206` e `:234`; `llm.py:217-227` (carregado) | sim |
| Veredito fora do formato | `grafos.py:179-184`; teste `test_grafos.py:570-571` | sim |
| Classificação malformada (carregado) | `classificar.py:37-45`; teste `test_grafos.py:600-606` | sim |
| Juiz por LLM (carregado) | `verificar.py:138-143`, `:146` | sim |
| Resposta inválida (carregado) | `llm.py:170-172`, antes da escrita em `:181-184` | sim |
| Import | `comparar.py:16` `from . import chunk, config, llm`; `:65` `from . import grafos` dentro de `com_llm_e_correcoes`; o resto carregado; prova `test_grafos.py:635` | sim |
| Dependências, Tracing, Contêiner após rebuild, Variáveis repassadas (carregados) | lock, Dockerfile, CI, `dock.sh` intocados; L13, L14 e L23 de novo | sim |
| Observabilidade, Telemetria, Ritmo por cota, Espera sugerida (r2 e r3), Prompt idêntico, Limitador no `Gerador`, Variáveis vazias ou inválidas (carregados) | `llm.py` intocado; as citações da rodada 4 valem | sim |
| Formato de resumo e comparação (r2) | `grafos.py:133` e `:152` passam `_validar_resumo` e `_validar_comparar` | sim |
| Erro definitivo (r2) | `grafos.py:37-43`; `llm.py` carregado | sim |
| Página da citação (r2) | `grafos.py:57-59` (inalterado); `verificar.py:37` (carregado) | sim |
| Formato exige as chaves (r3) | `grafos.py:106` `isinstance(r.get("resumo"), list)`; `:111` `all(isinstance(r.get(k), list) for k in LISTAS)` | sim |
| Cota diária (r3) | `grafos.py:41-43`; `llm.py:60-69` (carregado) | sim |
| Página no relatório (r3, carregado) | `relatorio.py:25-28`, `:39` | sim |

## Swept: linhas que apontam para código existente (verificado em 796a021, exceto onde marcado)

| Linha | No código | Evidência |
|---|---|---|
| validation | sim | `grafos.py:50-62`; `_corrigir_paginas` pula a citação malformada (`:87-88`, `:91-95`) sem quebrar; `_pagina_no_chunk` com trecho vazio não procura (`:70` `for c in chunks if t else []`); `test_grafos.py:534-535`; "Página em texto." em `:692` |
| failure modes (carregado) | sim | `llm.py:161-165`, `:175-176`; `grafos.py:37-43`; L21 e L26 |
| idempotency: `registrar` mantém `gerado_em` | sim | `comparar.py:80-84`; `test_grafos.py:727-731`; na prova L12, `gerado_em` ficou `2026-10-17T23:52:21-03:00` |
| authorization (carregado) | sim | `llm.py:239`; L7 `:263-264` |
| concurrency and ordering | sim | `grafos.py:34`, `:137`; `llm.py:121-123`, `:182-184` (carregados) |
| data lifecycle (carregado) | sim | `.gitignore:7:dados/cache-llm/`; `llm.py:118` |
| external-dependency failure | sim | L6 e L11 |
| state transitions | sim | `grafos.py:163`, `:200` e `:227` `g.compile()` sem checkpointer; o `rg` do cache sai sem acerto |
| observability (carregado) | sim | Landing "Telemetria" e "Tracing" |

## Sondas (verificado em 796a021)

Rodaram em `docker run --rm -i --network none rag-planos-pipeline` sobre `git archive HEAD` mais `dados/cache-llm`. O modelo das sondas levanta `RuntimeError` se for chamado. Scripts: `<scratchpad>/verif-langgraph-r5/verificador-r5/sonda/sonda.py` e `.../verificador-r5/tree/l12sonda.py`. Saídas: `.../verificador-r5/sonda-mutar.out` e `.../verificador-r5/l12sonda.out`.

- S0: o pedido de `saude` tem as chaves `['chunks', 'prompt']` nos dois candidatos, e cada chunk tem `['pagina', 'texto', 'viradas']`
- S1: o grafo de `saude` foi refeito a partir do cache do teste real; os prompts não mudaram na rodada 5, e os dois estão no cache. Deu `chamadas=0 do_cache=3 correcoes=[] mantidos=20 descartados=0`, igual ao teste real da rodada 4 (Handoff)
- S2: `_pagina_no_chunk` nos chunks reais enviados de `saude`, com as 8 primeiras palavras de cada segmento entre marcadores, deu Flávio `certo=32 None=0 errado=0` e Lula `certo=33 None=0 errado=0`. Trechos de 4+4 palavras que atravessam cada virada deram `None` em 20/20 (Flávio) e 21/21 (Lula)
- S3, faixa do chunk contra a união: das janelas de 8 palavras de páginas da união que não estão no texto de nenhum chunk enviado, Flávio tem 212 e Lula 54. A rodada 4 trocaria todas (212 e 54; cada uma está em uma só página da união), e a rodada 5 troca 0
- P-L12: com o `chunks.json` modificado num contêiner descartável, `test_chunks_gravados_iguais_aos_recalculados` dá:
  - controle: rc 0
  - `ingest` com chave simulado (confianças elevadas a ≥ 0,95 e o tema `educacao` 0,4 acrescentado): rc 0
  - confiança menor que a das palavras-chave: rc 1
  - tema das palavras-chave sumido: rc 1
  - texto mudado: rc 1
  - viradas mudadas: rc 1
  - um chunk a menos: rc 1

## Falhas injetadas (verificado em 796a021; extra, o perfil `light` não exige)

Rodaram no mesmo contêiner descartável com `--network none`. Cada mutante parte do arquivo original e roda só o teste mais estreito. O sobrevivente rodou também contra a suíte inteira. Script: `.../verificador-r5/sonda/mutar.py`. No controle sem mutante, os 3 testes-alvo deram `1 passed`. O `git status --porcelain` da árvore real ficou igual antes e depois (`diff` vazio). São 7 mutantes, 2 acima do teto de 5 do `verify.md` (teto que vale para `standard`/`ui`). M3 e M4 cobrem as duas linhas de `__main__` que a rodada 4 apontou, e M5 e M7 cobrem as duas regras novas de `_pagina_no_chunk`.

| Mutação | Local | Prova | Morto |
|---|---|---|---|
| M1 sem o filtro "arquivo do candidato" (sobrevivente da r4) | `grafos.py:91` | `test_corrige_pagina_so_quando_unica_na_faixa` | sim (`1 failed`) |
| M2 registro de troca também em bullet descartado (sobrevivente da r4) | `grafos.py:143-145` | `test_corrige_pagina_so_quando_unica_na_faixa` | sim (`1 failed`) |
| M3 `comparar` sem repassar as trocas a `registrar` (sobrevivente da r4) | `__main__.py:88` | `test_correcoes_pela_linha_de_comando` | sim (`1 failed`) |
| M4 `verificar` sem levar as trocas ao relatório (lacuna 2 da r4) | `__main__.py:138` | `test_correcoes_pela_linha_de_comando` | sim (`1 failed`) |
| M5 a ocorrência que atravessa a virada passa a contar (`if True:`) | `grafos.py:76` | `test_corrige_pagina_so_quando_unica_na_faixa` | **não** (`1 passed`; suíte inteira `80 passed`). Não é equivalente; ver lacuna 1 |
| M6 `registrar` volta a trocar `gerado_em` quando só as correções mudam (comportamento da r4) | `comparar.py:84` | `test_correcao_registrada_e_no_relatorio` | sim (`1 failed`) |
| M7 sob dois marcadores, fica com o menor | `grafos.py:79` | `test_corrige_pagina_so_quando_unica_na_faixa` | sim (`1 failed`) |

Achados da rodada 4 e estado agora:

| Achado da r4 | Estado |
|---|---|
| mutante do filtro de arquivo | fechado: M1 morto |
| registro de troca em bullet descartado | fechado: M2 morto |
| `comparar`/`verificar` sem repassar as trocas | fechado: M3 e M4 mortos |
| teste da L12 vermelho depois de `ingest` com chave (média) | fechado (P-L12) |
| trocar só as correções mudava `gerado_em` (baixa) | fechado: M6 morto, `:729-731` |
| faixa = união, não "faixa do chunk" (baixa) | fechado (S3, Landing) |

## Lacunas (em ordem; nenhuma bloqueia pelo critério desta rodada)

1. **O mutante M5 sobreviveu** (`grafos.py:76`). A regra "ocorrência que atravessa uma virada não conta", da linha "Faixa do chunk" do `Landing`, não tem teste que a distinga. O caso "Atravessa." (`test_grafos.py:695`) sai pelo `trecho_na_pagina` de `:99` com ou sem a regra. O mutante não é equivalente. Quando um trecho tem uma ocorrência limpa sob `[página A]` e outra que começa sob `[página B]` e atravessa a virada, o código certo troca para A, e o mutante devolve `None` e descarta o bullet. O código confere com o `Landing`, e nos dados reais S2 deu `None` nos 41 trechos que atravessam. Pelo `verify.md`, um sobrevivente deixa o trabalho por terminar só em `standard`/`ui`, e aqui o perfil é `light`. Fica para o dono decidir.
2. **Precisão, L29 e a linha "Correção não muda a data"**: falta o caso "outra lista não vazia". `:727-728` repete a mesma lista e cai no retorno antecipado de `comparar.py:82-83`. `:729-731` usa a lista vazia. Uma implementação que devolvesse o antigo sempre que `correcoes` não fosse vazia passaria, deixando a lista velha no arquivo. A afirmação da L29 ("mudar só as correções mantém `gerado_em`") está provada; "regrava ... a lista nova" não está.
3. **L29 pela linha de comando**: o teste chama `cli._verificar_tema` (`test_grafos.py:772`), não `main(["verificar", ...])`. A linha que leva as trocas ao relatório (`__main__.py:138`) está dentro de `_verificar_tema`, e M4 morre. Fica sem teste só o invólucro `cmd_verificar` (`:112-123`), que já era coberto antes.
4. **L12 afrouxada em `temas`** (rodada 5). Antes era `gravados == chunks_reais`; agora são os campos fora `temas` iguais (`test_chunk.py:78`) mais "≥ nas palavras-chave" (`:80`), com tema extra permitido. O texto da L12 registra a mudança como "(rodada 5: ...)", em resposta à regressão média da rodada 4. Não diz que o dono aprovou. As partes publicadas (16 SHA-256, `dados/relatorios`, `main` sem `viradas`) ficaram iguais, e a sonda P-L12 mostra que o teste ainda pega mudança real.
5. `.specs/plano-final.md:40` ainda diz "um trecho literal que está em uma só página da faixa enviada". Isso é compatível com a regra da rodada 5, se "faixa enviada" for o texto enviado, mas não acompanha a nova redação. O passo 1 não roda no perfil `light`; fica só como observação.
6. Lacunas da rodada 4 que continuam abertas (carregadas de 74c19a8):
   - (3) L30 é provada com `GEMINI_MODELO` vazia, não ausente (é o mesmo `or` de `llm.py:242`)
   - (4) o ponto sem escape na regex de `test_grafos.py:465`
   - (5) a mensagem 404 da API e os números do primeiro teste real não foram conferidos, por falta de chave
   - (6) as notas carregadas da rodada 3: `ms` sem asserção de valor; "descontado o backoff" sem teste; L16 medida com `llm.limitador(600)`; superconjuntos benignos; `RetryInfo` e `QuotaFailure` reais sem conferência

   As lacunas 1 e 2 da rodada 4 estão fechadas (M1, M3, M4).
7. Ambiente, não é da feature: `?? .specs/features/interface-site/` apareceu às 12:45:44, durante a verificação, criado por outro processo.
