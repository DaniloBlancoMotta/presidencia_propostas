# Comparador de planos de governo por tema (MVP estático) Verification

**Verdict**: PASS (41/41 checks proven at 9984822; the three round-2 gaps are closed)
**Profile**: light (steps 2, 3 and 5 run; step 1 and step 4 fault injection not run, per profile)
**Diff range**: fix 426fd33..9984822; proofs re-run in full at HEAD 9984822
**Round**: 3 - scoped (all proofs re-run in full at 9984822; citations in the files the fix touched, `web/e2e/a11y.spec.ts` and `pipeline/tests/test_avaliar.py`, refreshed; the rest carried from 426fd33, where line numbers did not move because no other test file changed)
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
|---|---|---|---|
| `.specs/plano-final.md` §7 AC 1-37 (lines 250-318) | yes (verified at 9984822; the file is not in the fix diff) | none. AC 36 (line 304) "WHEN o axe roda sobre cada rota" now maps one-to-one onto one test per route | step 1 not run (profile `light`) |

## Round-2 gaps

| # | Round-2 gap | Status at 9984822 | Evidence |
|---|---|---|---|
| 1 | C40 axe proof flaky at the 60 s timeout | **fixed** | `web/e2e/a11y.spec.ts:6` is now `for (const r of ROTAS) test(\`axe: ... em ${r}\`, ...)`: 15 tests, one per route in `apoio.ts:14-23`, each under its own 60 s budget (`playwright.config.ts:6`). Full gate run: all 15 PASSED, slowest `/diferencas` 9.5 s. Second sample (axe only): 15 PASSED, slowest 7.4 s. Headroom is now about 6x, versus 55.2 s of 60 s in round 2 |
| 2 | Swept row named the nonexistent `arquivo` provider | **fixed** | `.checks/comparador-temas-mvp.md:191` now reads "Gemini sem chave → `comparar.de_rascunho` (dados/rascunhos) e juiz por `verificar.juiz_vereditos` (dados/juiz)". Both exist: `pipeline/rag_planos/comparar.py:32` `def de_rascunho(...)`, `pipeline/rag_planos/verificar.py:142` `def juiz_vereditos(...)`, wired at `__main__.py:70`. `grep -n "arquivo\`\|provedor" .checks/comparador-temas-mvp.md` returns only line 13 (out-of-scope "cadeia de provedores") |
| 3 | `assert callable(main)` was vacuous; `main(["avaliar"])` never driven | **fixed** | `pipeline/tests/test_avaliar.py:91-101`: `avaliar.principal` is replaced by a counting wrapper around the original pointed at tmp data; `:95` `assert main(["avaliar"]) == 0`; data changed to 1 citation; `:98` `assert main(["avaliar"]) == 1`; `:101` `assert calls == [1, 1]`. That drives argparse, the `avaliar` subparser and `__main__.py:156` `func=lambda a: avaliar.principal()` through to `:162` `return args.func(args)`, and proves the exit code travels back both ways. The `callable(main)` line is gone |

## Checks (C18 and C40 verified at 9984822; the other rows carried from 426fd33, proofs re-run at 9984822)

| Check | Claim | Proof run | Evidence file:line + assertion | Result |
|---|---|---|---|---|
| C1 | every chunk has the fields; pagina >= 1; confianca in [0,1]; pagina = printed number | `test_todo_chunk_tem_campos`, `test_pagina_igual_ao_numero_impresso` PASSED | `test_ingest.py:13` `isinstance(c["pagina"], int) and c["pagina"] >= 1`; `:10-12,14` candidato/partido/arquivo/secao; `:18` `0 <= t["confianca"] <= 1`; `:55` `numeros == {str(pagina.number + 1)}`; `:57` `conferidas >= 120` | PASS |
| C2 | fontes.json stores sha256 and coletado_em | `test_grava_sha256_e_data` PASSED | `test_fontes.py:28` `d["sha256"] == esperado`; `:29` `d["coletado_em"] == "2026-10-17"` | PASS |
| C3 | footer "Documentos coletados do TSE em DD/MM/AAAA" on every route | `transparencia.spec.ts:5 rodapé` PASSED | `transparencia.spec.ts:8` `.coleta toHaveText(\`Documentos coletados do TSE em ${dataColeta()}\`)` over `ROTAS` | PASS |
| C4 | divergent TSE hash exits != 0, names file | `test_hash_divergente_sai_nao_zero` PASSED | `test_fontes.py:41` `rc != 0`; `:42` `"plano-de-governo_flavio.pdf" in ...err` | PASS |
| C5 | 400-800 tokens, 15% overlap | `test_tamanho_e_sobreposicao` PASSED | `test_chunk.py:16` `400 <= c["tokens"] <= 800`; `:19` `0.13 <= sobra / a["tokens"] <= 0.17` | PASS |
| C6 | no chunk crosses secao; short section is one chunk | `test_nao_cruza_secao`, `test_secao_curta_um_chunk` PASSED | `test_chunk.py:30` `("a" in prefixos) == (c["secao"] == "A")`; `:35` `len(cs) == 1 and cs[0]["tokens"] == 120` | PASS |
| C7 | citation minimums per list | `test_minimos_de_citacao` PASSED | `test_verificar.py:17` motivos `== ["citacao_insuficiente","citacao_insuficiente"]`; `:19,21,23` | PASS |
| C8 | normalization | `test_normaliza` PASSED | `test_literal.py:6` `normalizar("a  b\n\tc") == "a b c"`; `:7` end-of-line hyphen removed; `:9` mid-line hyphen kept | PASS |
| C9 | every published trecho is literal on the cited page | `test_todo_trecho_publicado_e_literal` PASSED | `test_comparacoes_reais.py:36` `trecho_na_pagina(c["trecho"], texto)`; `:34` arquivo; `:38` `total > 0` | PASS |
| C10 | missing trecho -> `trecho_nao_encontrado` | `test_trecho_inexistente_descartado` PASSED | `test_verificar.py:31` `"Inventado." not in textos`; `:32` `== ["trecho_nao_encontrado"]` | PASS |
| C11 | judge `nao_sustentado` + justification | `test_juiz_nao_sustentado` PASSED | `test_verificar.py:57` `== ["nao_sustentado"]`; `:58` `detalhe == "o trecho não fala em médicos da família"` | PASS |
| C12 | `nao_encontrado: true` | `test_sem_bullet_nao_encontrado` PASSED | `test_verificar.py:71` `== {"nao_encontrado": True, "resumo": []}` | PASS |
| C13 | exact "Não encontrado no plano de governo registrado no TSE" | vitest `nao encontrado` PASSED | `render.test.tsx:39` `toContain(\`<p class="nao-encontrado">${NAO_ENCONTRADO}</p>\`)`; `:40` `toBe("Não encontrado no plano de governo registrado no TSE")` | PASS (SSR render level) |
| C14 | camada != plano fails build | vitest `camada diferente de plano falha` + `camada: o build sai com código 1` PASSED | `guardas.test.ts:72` function; `:111` `r.status toBe(1)`; `:112` `stderr toContain('saude: camada diferente de "plano" (declaracao)')` | PASS (build level) |
| C15 | JSON > 30 KB fails build | vitest `JSON acima de 30 KB falha` + `30 KB: o build sai com código 1` PASSED | `guardas.test.ts:83`; `:121` `r.status toBe(1)`; `:122` `toMatch(/saude: \d+ bytes, acima do limite de 30 KB/)` | PASS (build level) |
| C16 | HTML report contents | `test_relatorio_completo` PASSED | `test_relatorio.py:33-35,38-39` trecho, `#page=2` link, `trecho_nao_encontrado`, `contagem == {"flavio-bolsonaro": 3, "lula": 2}` | PASS |
| C17 | unregistered hash fails build, names theme | vitest 2 function tests + `hash: o build sai com código 1` PASSED; real `npm run build` exit 1 | `guardas.test.ts:53-54,62`; `:127` `r.status toBe(1)`; `:128` `toContain("saude: hash")`; the real build named all 8 themes `sem aprovação em revisao/aprovados.yaml` | PASS (build level) |
| C18 | recall < 90% exits != 0 listing the missing items | `test_recall_baixo_sai_nao_zero`, `test_comando_avaliar_sai_nao_zero` PASSED | `test_avaliar.py:44` `startswith("FALHA: saude / lula: 87%")`; `:45` `"faltou: lula-14 (pág. 14)"`; `:98` `main(["avaliar"]) == 1`; `:95` `main(["avaliar"]) == 0`; `:101` `calls == [1, 1]` | PASS (command level, through `main`) |
| C19 | missing convergence exits != 0 | `test_convergencia_faltando_sai_nao_zero` PASSED; real `python -m rag_planos avaliar` EXIT 1 | `test_avaliar.py:65` `not ok`; `:66` `startswith("FALHA: convergência regularização fundiária")`; real run prints 2 `FALHA: convergência ...` lines and `RESULTADO: reprovado`, exit 1 | PASS (command level) |
| C20 | home grid order with SVG | `navegacao.spec.ts:7` PASSED desktop + android | `:10` `toHaveText(["Semelhanças","Diferenças",...ordemTemas.map(t => t.rotulo)])`; `:11` svg count 1; `:12` `.destaque` 2 | PASS |
| C21 | >= 768 px two equal columns; < 768 px two tabs | `navegacao.spec.ts:15` PASSED desktop + android | `:25` `Math.abs(a.width - b.width) <= 1`; `:26` same y; `:30` `abas toHaveCount(2)`; `:31` one visible tabpanel | PASS |
| C22 | expanded bullet shows trecho, arquivo, página, Ver no PDF | `navegacao.spec.ts:39` PASSED desktop + android | `:45` trecho visible; `:46` `/\.pdf$/`; `:47` `/^pág\. \d+$/`; `:48` link "Ver no PDF" | PASS |
| C23 | viewer on own domain at cited page | `pdf.spec.ts:7` PASSED desktop, android, ios-safari | `:16` same origin; `:17` `/pdf/visualizador.html`; `:19` `data-pagina == String(pagina)`; `:27` sha == fontes.json | PASS (emulated devices) |
| C24 | 50/50 order kept until reload | `ordem.spec.ts:15,24,37` PASSED | `:18` `"flavio-bolsonaro"`, `:21` `"lula"`; `:34` kept after client navigation; `:43` `["ab","ba"]` | PASS |
| C25 | swap order on all screens | `ordem.spec.ts:46` PASSED | `:51` `lula`; `:57` persists on /diferencas; `:59` back to `flavio-bolsonaro` | PASS |
| C26 | filters | `navegacao.spec.ts:51` PASSED desktop + android | `:56` 1 block; `:60-63` diferencas + omissoes only; `:65` 4 blocks again | PASS |
| C27 | transversal views grouped in order, omissions labelled | `navegacao.spec.ts:68` PASSED desktop + android | `:77` `ids toEqual(esperado.map(t => t.id))`; `:83` texts equal JSON; `:85` `.selo "Omissão"` count | PASS |
| C28 | empty view text | vitest `vazia` PASSED | `render.test.tsx:47` `toContain(TRANSVERSAL_VAZIA)`; `:49` `toBe("Nenhum ponto encontrado nos temas publicados")` | PASS (SSR level) |
| C29 | direct link opens theme | `navegacao.spec.ts:96` PASSED desktop + android | `:98` status 200; `:99` h1 "Educação" | PASS |
| C30 | 404 with link to / | `navegacao.spec.ts:102` PASSED desktop + android | `:105` `status() toBe(404)`; `:107` link "Ir para o início" href "/" | PASS (local `servir.mjs`) |
| C31 | same-origin requests only | `transparencia.spec.ts:75` PASSED | `:98` `expect(fora).toEqual([])` after clicking every button/summary on every route | PASS |
| C32 | AI notice on every route | `transparencia.spec.ts:12` PASSED | `:15` `.aviso-ia toHaveText(AVISO)`; AVISO is AC 28 verbatim (`apoio.ts:25-26`) | PASS |
| C33 | /sobre contents | `transparencia.spec.ts:20` PASSED | `:26-29` file link, `.hash == f.sha256`, date, TSE href; `:31-32` responsável | PASS |
| C34 | /metodologia 5 stages + rule | `transparencia.spec.ts:35` PASSED | `:37` 5 stage labels in order; `:44` `"Regra: só documentos oficiais."` | PASS |
| C35 | same component and classes | `transparencia.spec.ts:47` PASSED (desktop) | `:65` `estilos[0] toEqual(estilos[1])`; `:67` tab classes; `:72` candidate CSS only `order: 1\|2` | PASS |
| C36 | no Set-Cookie, no foreign script | `transparencia.spec.ts:101` PASSED | `:111` script origin == own; `:115` `comCookie toEqual([])`; `:116` `cookies() toEqual([])` | PASS (local server headers) |
| C37 | initial JS <= 200 KB gzip | `npm run orcamento` exit 0 | `orcamento.mjs:6` `LIMITE = 200 * 1024`; `:19` `total <= LIMITE && srcs.length > 0`. Output `index.html: 49.7 KB`, `tema/saude/index.html: 49.7 KB` | PASS |
| C38 | Lighthouse mobile `/` and `/tema/saude`: P >= 90, A >= 90, LCP < 2.0 s | `npm run lighthouse` exit 0 | `lighthouse.mjs:12` `tema = "saude"`; `:33` `perf >= 90 && a11y >= 90 && lcp < 2.0`. Output `/` P99 A100 LCP 1.55 s; `/tema/saude` P98 A100 LCP 1.87 s | PASS |
| C39 | keyboard operable, visible focus | `a11y.spec.ts:51 teclado` PASSED | `:45` `expect(f.outline).toBe(true)` on every Tab stop; `:56` outline after first Tab; `:81` per route, outline on every stop | PASS |
| C40 | axe: zero serious/critical per route | `a11y.spec.ts:6` x15 (one per route) PASSED in the gate and again in a second axe-only run | `a11y.spec.ts:6` `for (const r of ROTAS) test(...)`; `:12` filter `impact === "serious" \|\| "critical"`; `:13` `expect(graves.map(...)).toEqual([])` | PASS (stable: max 9.5 s of 60 s) |
| C41 | 320 px @ 200% no horizontal scroll | `a11y.spec.ts:17 reflow` PASSED | `:18` viewport 160 px; `:24` `expect(sw, r).toBeLessThanOrEqual(cw)` | PASS |

## Swept rows resolving to existing code (verified at 9984822)

| Row | In code | Evidence |
|---|---|---|
| schema guard | yes | `guardas.test.ts:92` `toContain("saude: fora do schema")` PASSED |
| TSE unreachable -> `fontes` exits != 0 | yes (no test) | `pipeline/rag_planos/fontes.py:74-78` (carried from 426fd33) |
| LLM disk cache by prompt hash | yes (no test) | `pipeline/rag_planos/llm.py` `ComCache` (carried from 426fd33) |
| regenerating reopens gate | yes | `guardas.test.ts:62` PASSED |
| Gemini without key -> `comparar.de_rascunho` + `verificar.juiz_vereditos` (checklist line 191) | **yes** | `comparar.py:32` `def de_rascunho`; `verificar.py:142` `def juiz_vereditos`; `__main__.py:70` `comparar.de_rascunho(tema["id"]), "rascunho (dados/rascunhos)"`; `:153` `--origem choices=["rascunho","gemini"]` |
| judge without key -> `nao_executado` | yes | `test_verificar.py:64` PASSED |

## Faults injected

Not run (profile `light`).

## Gate (9984822)

- `WD=pipeline ./dock.sh pipeline python -m pytest -v`: 32 passed, 0 failed, 0 skipped (4.15 s)
- `WD=pipeline ./dock.sh pipeline python -m rag_planos avaliar`: exit 1 as expected. Recall 100% on every candidate-theme pair; convergences 5/7. Failing: digitalização dos serviços públicos (tecnologia-ia) `[sem referência no conjunto-ouro]`; redução das filas do SUS (saude) `[não está em Semelhanças]`
- `WD=web ./dock.sh web "npx tsc --noEmit && npx vitest run --reporter=verbose"`: tsc clean; 11 passed, 0 failed
- `WD=web ./dock.sh web "npm run build:teste >/dev/null 2>&1 && npx playwright test --reporter=list && npm run orcamento && npm run lighthouse"`: exit 0 in one chain; 45 passed, 0 failed (1.6 min); orcamento ok; lighthouse ok
- Extra stability sample: `npx playwright test e2e/a11y.spec.ts -g axe`: 15 passed (52.5 s total, max 7.4 s per test)
- `WD=web ./dock.sh web "npm run build"`: exit 1 as expected, "Build bloqueado pelas guardas", naming the 8 themes (agronegocio, custo-de-vida, educacao, meio-ambiente, programas-sociais, saude, seguranca-publica, tecnologia-ia) `sem aprovação em revisao/aprovados.yaml`
- `git status --porcelain` empty before and after

## Gaps (ranked)

No gap fails this round. Notes:

1. **Minor test note (C18)**: `test_avaliar.py:93` swaps `avaliar.principal` for a wrapper with tmp paths, so the test proves the `main` -> subparser -> exit-code wiring but not `principal()`'s default paths. The real `python -m rag_planos avaliar` run (exit 1) covers those.
2. **Level notes**: C13 and C28 are proven at SSR render level, not in a browser, as the checklist's proofs specify.
3. **What the proofs cannot reach**: real Android/iOS devices (Playwright emulation only: Pixel 5 Chromium, iPhone 12 WebKit); real Cloudflare Pages headers, 404 status, `_headers` CSP and Set-Cookie absence (served here by local `servir.mjs`); real 4G (Lighthouse simulated throttling on localhost); C24/C25/C35/C39-C41 run on desktop-chrome only; the AC 1 printed-number test skips pages with no printed number (cover etc.), where `pagina` is the physical index; the human approval of the 8 themes (decision 21, out of scope) and the 2 failing gold-set convergences in pipeline data block the production build and deploy, which this gate does not cover.
