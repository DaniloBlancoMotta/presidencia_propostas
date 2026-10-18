# Comparador de planos de governo por tema (MVP estático) Verification

**Verdict**: FAIL (41/41 checks proven at 426fd33; two non-check findings keep it open: the axe proof for C40 is flaky at its timeout, and the Swept row still names the `arquivo` provider that does not exist)
**Profile**: light (steps 2, 3 and 5 run; step 1 and step 4 fault injection not run, per profile)
**Diff range**: fix f7906c5..426fd33; proofs re-run in full at HEAD 426fd33
**Round**: 2 - scoped (all proofs re-run in full at 426fd33; the citations in files the fix touched were refreshed; the rest carried from f7906c5 with lines re-checked by `grep -n` at 426fd33)
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
|---|---|---|---|
| `.specs/plano-final.md` §6 CI, §7 AC 1-37 | yes (verified at 426fd33) | none. C38 now matches §6 CI step 4 (`/tema/saude`) | step 1 not run (profile `light`) |

## Round-1 gaps

| # | Round-1 gap | Status at 426fd33 | Evidence |
|---|---|---|---|
| 1 | C38 measured `/tema/agronegocio` | **fixed** | `web/scripts/lighthouse.mjs:12` `const tema = "saude"`; `:22` routes `["/", \`/tema/${tema}\`]`; run output `ok: /tema/saude: performance 96, acessibilidade 100, LCP 1.89 s`. `orcamento.mjs:8` also pinned to `saude` |
| 2 | Landing described a nonexistent `arquivo` provider | **partly fixed**: Landing row (checklist line 27) now describes `Gemini` + `comparar.de_rascunho`, but the Swept row at `.checks/comparador-temas-mvp.md:191` still reads "Gemini sem chave → provedor `arquivo`" | `pipeline/rag_planos/__main__.py:152` `--origem choices=["rascunho","gemini"]`; there is no `arquivo` provider in `llm.py` |
| 3 | AC 1 printed page number unproven; `or True` in test_ingest | **fixed** | `or True` line removed (diff). New `pipeline/tests/test_ingest.py:55` `assert numeros == {str(pagina.number + 1)}` for every page that prints an isolated number (size >= 9, y > 700), `:57` `assert conferidas >= 120`. Chunk `pagina` is the physical index (`extrair.py:36` `numero = pagina.number + 1`; `test_ingest.py:24-26` text check), so pagina == printed number wherever one is printed |
| 4 | C14/C15/C17 function-level; C18/C19 return value only | **fixed** (C18 with a caveat) | `web/tests/guardas.test.ts:111/121/127` `expect(r.status).toBe(1)` on `spawnSync("npx", ["tsx","scripts/build.ts"])`, the same script `npm run build` runs (`package.json:8`). C18/C19: `test_avaliar.py:87` `avaliar.principal(...) == 1`, `:90` `== 0`; `principal` is exactly what the CLI returns (`__main__.py:156` `func=lambda a: avaliar.principal()`, `:167` `sys.exit(main())`). `:91` `assert callable(main)` is vacuous. Real command `python -m rag_planos avaliar` exited 1 (C19 at command level) |
| 5 | C39 used `.focus()` | **fixed** | `web/e2e/a11y.spec.ts:36-49` `tabAte()` presses Tab and asserts `outline` on every stop (`:45`); filter, Shift+Tab to "Mostrar tudo", tab, summary and "Ver no PDF" all reached by Tab. No `.focus()` remains. Per-route loop now walks up to min(count, 60) stops (`:76-81`) |

## Checks (verified at 426fd33)

| Check | Claim | Proof run | Evidence file:line + assertion | Result |
|---|---|---|---|---|
| C1 | every chunk has the fields; pagina >= 1; confianca in [0,1]; pagina = printed number | `test_todo_chunk_tem_campos`, `test_pagina_igual_ao_numero_impresso` PASSED | `test_ingest.py:13` `isinstance(c["pagina"], int) and c["pagina"] >= 1`; `:10-12,14` candidato/partido/arquivo/secao; `:18` `0 <= t["confianca"] <= 1`; `:55` `numeros == {str(pagina.number + 1)}`; `:57` `conferidas >= 120` | PASS |
| C2 | fontes.json stores sha256 and coletado_em | `test_grava_sha256_e_data` PASSED | `test_fontes.py:28` `d["sha256"] == esperado`; `:29` `d["coletado_em"] == "2026-10-17"` | PASS |
| C3 | footer "Documentos coletados do TSE em DD/MM/AAAA" on every route | `transparencia.spec.ts:5 rodapé` PASSED | `transparencia.spec.ts:8` `.coleta toHaveText(\`Documentos coletados do TSE em ${dataColeta()}\`)` over `ROTAS` (`apoio.ts:14-23`) | PASS |
| C4 | divergent TSE hash exits != 0, names file | `test_hash_divergente_sai_nao_zero` PASSED | `test_fontes.py:41` `rc != 0`; `:42` `"plano-de-governo_flavio.pdf" in ...err` | PASS |
| C5 | 400-800 tokens, 15% overlap | `test_tamanho_e_sobreposicao` PASSED | `test_chunk.py:16` `400 <= c["tokens"] <= 800`; `:19` `0.13 <= sobra / a["tokens"] <= 0.17` | PASS |
| C6 | no chunk crosses secao; short section one chunk | `test_nao_cruza_secao`, `test_secao_curta_um_chunk` PASSED | `test_chunk.py:30` `("a" in prefixos) == (c["secao"] == "A")`; `:35` `len(cs) == 1 and cs[0]["tokens"] == 120` | PASS |
| C7 | citation minimums per list | `test_minimos_de_citacao` PASSED | `test_verificar.py:17` motivos `== ["citacao_insuficiente","citacao_insuficiente"]`; `:19,21,23` | PASS |
| C8 | normalization | `test_normaliza` PASSED | `test_literal.py:6` `normalizar("a  b\n\tc") == "a b c"`; `:7` hyphen at line end removed; `:9` mid-line kept | PASS |
| C9 | every published trecho literal on cited page | `test_todo_trecho_publicado_e_literal` PASSED | `test_comparacoes_reais.py:36` `trecho_na_pagina(c["trecho"], texto)`; `:34` arquivo; `:38` `total > 0` | PASS |
| C10 | missing trecho -> `trecho_nao_encontrado` | `test_trecho_inexistente_descartado` PASSED | `test_verificar.py:31` `"Inventado." not in textos`; `:32` `== ["trecho_nao_encontrado"]` | PASS |
| C11 | judge `nao_sustentado` + justification | `test_juiz_nao_sustentado` PASSED | `test_verificar.py:57` `== ["nao_sustentado"]`; `:58` `detalhe == "o trecho não fala em médicos da família"` | PASS |
| C12 | `nao_encontrado: true` | `test_sem_bullet_nao_encontrado` PASSED | `test_verificar.py:71` `== {"nao_encontrado": True, "resumo": []}` | PASS |
| C13 | exact "Não encontrado no plano de governo registrado no TSE" | vitest `nao encontrado` PASSED | `render.test.tsx:39` `toContain(\`<p class="nao-encontrado">${NAO_ENCONTRADO}</p>\`)`; `:40` `toBe("Não encontrado no plano de governo registrado no TSE")` | PASS (SSR render level) |
| C14 | camada != plano fails build | vitest `camada diferente de plano falha` + `camada: o build sai com código 1` PASSED | `guardas.test.ts:72` function; `:111` `r.status toBe(1)`; `:112` `stderr toContain('saude: camada diferente de "plano" (declaracao)')` | PASS (build level) |
| C15 | JSON > 30 KB fails build | vitest `JSON acima de 30 KB falha` + `30 KB: o build sai com código 1` PASSED | `guardas.test.ts:83`; `:121` `r.status toBe(1)`; `:122` `toMatch(/saude: \d+ bytes, acima do limite de 30 KB/)` | PASS (build level) |
| C16 | HTML report contents | `test_relatorio_completo` PASSED | `test_relatorio.py:33-35,38-39` trecho, `#page=2` link, `trecho_nao_encontrado`, `contagem == {"flavio-bolsonaro": 3, "lula": 2}` | PASS |
| C17 | unregistered hash fails build, names theme | vitest 2 function + `hash: o build sai com código 1` PASSED; real `npm run build` exit 1 | `guardas.test.ts:53-54,62`; `:127` `r.status toBe(1)`; `:128` `toContain("saude: hash")`; real build listed all 8 themes `sem aprovação em revisao/aprovados.yaml` | PASS (build level) |
| C18 | recall < 90% exits != 0 listing missing | `test_recall_baixo_sai_nao_zero`, `test_comando_avaliar_sai_nao_zero` PASSED | `test_avaliar.py:44` `startswith("FALHA: saude / lula: 87%")`; `:45` `"faltou: lula-14 (pág. 14)"`; `:87` `principal(...) == 1`; `:90` `== 0` | PASS (exit code at `principal`, which `main` returns; argparse wiring itself not driven by the test, but the real run below exercises it) |
| C19 | missing convergence exits != 0 | `test_convergencia_faltando_sai_nao_zero` PASSED; real `python -m rag_planos avaliar` EXIT 1 | `test_avaliar.py:65` `not ok`; `:66` `startswith("FALHA: convergência regularização fundiária")`; real run prints `RESULTADO: reprovado` and exits 1 | PASS (command level) |
| C20 | home grid order with SVG | `navegacao.spec.ts:7` PASSED desktop + android | `:10` `toHaveText(["Semelhanças","Diferenças",...ordemTemas.map(t => t.rotulo)])`; `:11` svg count 1; `:12` `.destaque` 2 | PASS |
| C21 | >= 768 two equal columns; < 768 two tabs | `navegacao.spec.ts:15` PASSED desktop + android | `:25` `Math.abs(a.width - b.width) <= 1`; `:26` same y; `:30` `abas toHaveCount(2)`; `:31` one visible tabpanel | PASS |
| C22 | expanded bullet shows trecho, arquivo, página, Ver no PDF | `navegacao.spec.ts:39` PASSED | `:45` trecho visible; `:46` `/\.pdf$/`; `:47` `/^pág\. \d+$/`; `:48` link "Ver no PDF" | PASS |
| C23 | viewer on own domain at cited page | `pdf.spec.ts:7` PASSED desktop, android, ios-safari | `:16` same origin; `:17` `/pdf/visualizador.html`; `:19` `data-pagina == String(pagina)`; `:27` sha == fontes.json | PASS (emulated devices) |
| C24 | 50/50 order kept until reload | `ordem.spec.ts:15,24,37` PASSED | `:18` `"flavio-bolsonaro"`, `:21` `"lula"`; `:34` kept after client navigation; `:43` `["ab","ba"]` | PASS |
| C25 | swap order on all screens | `ordem.spec.ts:46` PASSED | `:51` `lula`; `:57` persists on /diferencas; `:59` back to `flavio-bolsonaro` | PASS |
| C26 | filters | `navegacao.spec.ts:51` PASSED | `:56` 1 block; `:60-63` diferencas + omissoes only; `:65` 4 blocks again | PASS |
| C27 | transversal views grouped in order, omissions labelled | `navegacao.spec.ts:68` PASSED | `:77` `ids toEqual(esperado.map(t => t.id))`; `:83` texts equal JSON; `:85` `.selo "Omissão"` count | PASS |
| C28 | empty view text | vitest `vazia` PASSED | `render.test.tsx:47` `toContain(TRANSVERSAL_VAZIA)`; `:49` `toBe("Nenhum ponto encontrado nos temas publicados")` | PASS (SSR level) |
| C29 | direct link opens theme | `navegacao.spec.ts:96` PASSED | `:98` status 200; `:99` h1 "Educação" | PASS |
| C30 | 404 with link to / | `navegacao.spec.ts:102` PASSED | `:105` `status() toBe(404)`; `:107` link "Ir para o início" href "/" | PASS (local `servir.mjs`) |
| C31 | same-origin requests only | `transparencia.spec.ts:75` PASSED | `:98` `expect(fora).toEqual([])` after clicking every button/summary on every route | PASS |
| C32 | AI notice on every route | `transparencia.spec.ts:12` PASSED | `:15` `.aviso-ia toHaveText(AVISO)`; AVISO = AC 28 verbatim (`apoio.ts:25-26`) | PASS |
| C33 | /sobre contents | `transparencia.spec.ts:20` PASSED | `:26-29` file link, `.hash == f.sha256`, date, TSE href; `:31-32` responsável | PASS |
| C34 | /metodologia 5 stages + rule | `transparencia.spec.ts:35` PASSED | `:37` 5 stage labels in order; `:44` `"Regra: só documentos oficiais."` | PASS |
| C35 | same component and classes | `transparencia.spec.ts:47` PASSED (desktop) | `:65` `estilos[0] toEqual(estilos[1])`; `:67` tab classes; `:72` candidate CSS only `order: 1|2` | PASS |
| C36 | no Set-Cookie, no foreign script | `transparencia.spec.ts:101` PASSED | `:111` script origin == own; `:115` `comCookie toEqual([])`; `:116` `cookies() toEqual([])` | PASS (local server headers) |
| C37 | initial JS <= 200 KB gzip | `npm run orcamento` exit 0 | `orcamento.mjs:6` `LIMITE = 200 * 1024`; `:19` `total <= LIMITE && srcs.length > 0`. Output `index.html: 49.7 KB`, `tema/saude/index.html: 49.7 KB` | PASS |
| C38 | Lighthouse mobile `/` and `/tema/saude` | `npm run lighthouse` exit 0 | `lighthouse.mjs:12` `tema = "saude"`; `:33` `perf >= 90 && a11y >= 90 && lcp < 2.0`. Output `/` P99 A100 LCP 1.60 s; `/tema/saude` P96 A100 LCP 1.89 s | PASS |
| C39 | keyboard operable, visible focus | `a11y.spec.ts:51 teclado` PASSED | `:45` `expect(f.outline).toBe(true)` on every Tab stop; `:59` Enter opens "Saúde"; `:62` Space -> `aria-pressed true`; `:65` Shift+Tab+Enter -> "Mostrar tudo" pressed; `:68-69` ArrowRight selects and focuses 2nd tab; `:72` summary Enter shows trecho; `:81` per route outline on every stop | PASS |
| C40 | axe: zero serious/critical per route | `a11y.spec.ts:6 axe` **FAILED run 1 (60 s timeout at `:11` `analyze()`), PASSED run 2 in 55.2 s** | `:13` `expect(graves.map(...)).toEqual([])` over ROTAS | PASS on assertion; **flaky proof** (see gaps) |
| C41 | 320 px @ 200% no horizontal scroll | `a11y.spec.ts:17 reflow` PASSED | `:18` viewport 160 px; `:24` `expect(sw, r).toBeLessThanOrEqual(cw)` | PASS |

## Swept rows resolving to existing code (carried from f7906c5, re-checked at 426fd33)

| Row | In code | Evidence |
|---|---|---|
| schema guard | yes | `guardas.test.ts:92` `toContain("saude: fora do schema")` PASSED |
| TSE unreachable -> `fontes` exits != 0 | yes (no test) | `pipeline/rag_planos/fontes.py:74-78` |
| LLM disk cache by prompt hash | yes (no test) | `pipeline/rag_planos/llm.py` `ComCache` |
| regenerating reopens gate | yes | `guardas.test.ts:62` PASSED |
| Gemini without key -> provider `arquivo` (checklist line 191) | **no** | there is no `arquivo` provider; the fallback is `comparar.de_rascunho` / `comparar --origem rascunho` (`__main__.py:152`). Landing line 27 was corrected; line 191 was not |
| judge without key -> `nao_executado` | yes | `test_verificar.py:64` PASSED |

## Faults injected

Not run (profile `light`).

## Gate (426fd33)

- `WD=pipeline ./dock.sh pipeline python -m pytest -v`: 32 passed, 0 failed, 0 skipped
- `WD=pipeline ./dock.sh pipeline python -m rag_planos avaliar`: exit 1 as expected. Recall 16/16 candidate-theme pairs at 100%; convergences 5/7. Failing: **digitalização dos serviços públicos (tecnologia-ia)** `[sem referência no conjunto-ouro]`, meaning the gold set has no page reference for that convergence (`avaliar.py:115`, `not c`); **redução das filas do SUS (saude)** `[não está em Semelhanças]`, meaning no `semelhancas` item in saude.json cites both plans on the gold pages (`avaliar.py:107-112`)
- `WD=web ./dock.sh web "npx tsc --noEmit && npx vitest run --reporter=verbose"`: tsc clean; 11 passed, 0 failed
- `WD=web ./dock.sh web "npm run build:teste … && npx playwright test --reporter=list && npm run orcamento && npm run lighthouse"`: run 1 **30 passed, 1 failed** (axe, 60 s timeout), so the `&&` chain stopped before orcamento and lighthouse. Run 2 (same suite, then orcamento and lighthouse unchained): 31 passed, 0 failed; orcamento exit 0; lighthouse exit 0
- `WD=web ./dock.sh web "npm run build"`: exit 1 as expected, "Build bloqueado pelas guardas", 8 themes `sem aprovação em revisao/aprovados.yaml`
- `git status --porcelain` empty before and after

## Gaps (ranked)

1. **C40's proof is flaky at its time budget.** `a11y.spec.ts:6` runs axe over all 14 routes inside one test with the global 60 s timeout (`playwright.config.ts:6`). It timed out at 60 s in run 1 and passed in 55.2 s in run 2. CI step 5 will go red intermittently. Fix: `test.setTimeout(...)` in that test, or one test per route.
2. **Swept row at checklist line 191 still names provider `arquivo`**, which does not exist. Round-1 gap 2 was fixed in Landing only.
3. **Weak/vacuous assertion**: `test_avaliar.py:91` `assert callable(main)` proves nothing; the exit code is asserted on `avaliar.principal`, not by driving `main(["avaliar"])`. The real `python -m rag_planos avaliar` run (exit 1) covers the wiring for the convergence path.
4. **Level notes**: C13 and C28 are proven at SSR render level, not in a browser.
5. **What the proofs cannot reach**: real Android/iOS devices (only Playwright emulation: Pixel 5 Chromium, iPhone 12 WebKit); real Cloudflare Pages headers, 404 status and Set-Cookie absence (served by local `servir.mjs`); real 4G (Lighthouse simulated throttling on localhost); C35 runs on desktop only, C24/C25/C39-C41 on desktop only; the AC 1 printed-number test skips pages with no printed number (cover etc.), where `pagina` is the physical index; the 2 failing convergences (pipeline data, outside this gate's checks) block D4.
