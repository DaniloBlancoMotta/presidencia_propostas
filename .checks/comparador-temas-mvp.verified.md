# Comparador de planos de governo por tema (MVP estático) Verification

**Verdict**: FAIL (40/41 proven; C38 measured on a different route than the one the checklist and plano §6 CI step 4 name)
**Profile**: light (step 1 binding-source enumeration, step 4 fault injection, Coverage join and Test-policy rows not run)
**Diff range**: 60fc01c..f7906c5 (whole history; working tree clean before and after the runs)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

| Source | Opened | Contradiction | Uncovered |
|---|---|---|---|
| `.specs/plano-final.md` §4-§7 | yes | none in the checks; C1 drops one AC 1 clause (see precision gaps) | step 1 not run (profile `light`) |

## Checks

| Check | Claim | Proof run | Evidence file:line + assertion | Result |
|---|---|---|---|---|
| C1 | every chunk has candidato, partido, arquivo, pagina >= 1, secao, temas with confianca in [0,1] | pytest `test_ingest.py::test_todo_chunk_tem_campos` PASSED | `pipeline/tests/test_ingest.py:13` `assert isinstance(c["pagina"], int) and c["pagina"] >= 1`; `:18` `assert 0 <= t["confianca"] <= 1`; `:10-14` candidato/partido/arquivo/secao. Note `:19` ends in `or True` (vacuous) | PASS (precision gap: AC 1 "pagina igual ao número impresso" not asserted) |
| C2 | fontes.json stores sha256 and coletado_em per PDF | `test_fontes.py::test_grava_sha256_e_data` PASSED | `pipeline/tests/test_fontes.py:28` `assert d["sha256"] == esperado`; `:29` `assert d["coletado_em"] == "2026-10-17"` | PASS |
| C3 | footer on every route reads "Documentos coletados do TSE em DD/MM/AAAA" | e2e `transparencia.spec.ts:5 rodapé` PASSED (desktop-chrome) | `web/e2e/transparencia.spec.ts:8` `toHaveText(\`Documentos coletados do TSE em ${dataColeta()}\`)` over `ROTAS` (all routes incl. 404 and PDF viewer); `apoio.ts` `dataColeta()` returns `${d}/${m}/${a}` | PASS |
| C4 | divergent TSE hash exits != 0 and names the file | `test_fontes.py::test_hash_divergente_sai_nao_zero` PASSED | `test_fontes.py:41` `assert rc != 0`; `:42` `assert "plano-de-governo_flavio.pdf" in capsys.readouterr().err` | PASS |
| C5 | chunks 400-800 tokens, 15% overlap | `test_chunk.py::test_tamanho_e_sobreposicao` PASSED | `test_chunk.py:16` `assert 400 <= c["tokens"] <= 800`; `:19` `assert 0.13 <= sobra / a["tokens"] <= 0.17` | PASS (tolerance ±2 pp around 15%) |
| C6 | no chunk crosses secao; section < 400 is one chunk | `test_nao_cruza_secao`, `test_secao_curta_um_chunk` PASSED | `test_chunk.py:30` `assert ("a" in prefixos) == (c["secao"] == "A")`; `:35` `assert len(cs) == 1 and cs[0]["tokens"] == 120 and cs[0]["pagina"] == 5` | PASS |
| C7 | generated JSON meets per-list citation minimums | `test_verificar.py::test_minimos_de_citacao` PASSED | `test_verificar.py:17` `sorted(d["motivo"] ...) == ["citacao_insuficiente", "citacao_insuficiente"]`; `:19-23` resumo >= 1, both sides in semelhancas/diferencas, omissoes cite the treating side | PASS |
| C8 | normalization: whitespace -> one space, end-of-line hyphen removed | `test_literal.py::test_normaliza` PASSED | `test_literal.py:6` `normalizar("a  b\n\tc") == "a b c"`; `:7` `normalizar("Sistema Único de Saú-\nde") == "Sistema Único de Saúde"`; `:9` mid-line hyphen kept | PASS |
| C9 | every published trecho occurs on the cited page of the cited file | `test_comparacoes_reais.py::test_todo_trecho_publicado_e_literal` PASSED (not skipped; 8 JSONs in `dados/comparacoes`) | `test_comparacoes_reais.py:34` `c["arquivo"] == config.CANDIDATOS[cid]["arquivo"]`; `:36` `texto is not None and trecho_na_pagina(c["trecho"], texto)`; `:38` `total > 0` | PASS |
| C10 | missing trecho leaves JSON, report gets `trecho_nao_encontrado` | `test_trecho_inexistente_descartado` PASSED | `test_verificar.py:31` `"Inventado." not in textos`; `:32` `[d["motivo"] for d in descartes] == ["trecho_nao_encontrado"]` | PASS |
| C11 | judge "not sustained" removes bullet, motive `nao_sustentado` + justification | `test_juiz_nao_sustentado` PASSED | `test_verificar.py:57` `== ["nao_sustentado"]`; `:58` `descartes[0]["detalhe"] == "o trecho não fala em médicos da família"` | PASS |
| C12 | candidate without bullet gets `nao_encontrado: true` | `test_sem_bullet_nao_encontrado` PASSED | `test_verificar.py:71` `saida["candidatos"]["lula"] == {"nao_encontrado": True, "resumo": []}` | PASS |
| C13 | screen shows exactly "Não encontrado no plano de governo registrado no TSE" | vitest `render.test.tsx > nao encontrado` PASSED | `web/tests/render.test.tsx:39` `toContain(\`<p class="nao-encontrado">${NAO_ENCONTRADO}</p>\`)` in `painel-lula`; `:40` `expect(NAO_ENCONTRADO).toBe("Não encontrado no plano de governo registrado no TSE")` | PASS (SSR render level, not a browser; `:41` slice is empty, so vacuous, if panel order flips) |
| C14 | camada != plano fails the build | vitest `guardas.test.ts > camada diferente de plano falha` PASSED | `web/tests/guardas.test.ts:71` `toContain('saude: camada diferente de "plano" (imprensa)')`; `falha()` `:25` `toBeInstanceOf(ErroGuarda)` | PASS (level gap: proven on `verificarGuardas`, not `npm run build`; `scripts/build.ts:35` calls that same function) |
| C15 | JSON > 30 KB fails the build | vitest `JSON acima de 30 KB falha` PASSED | `guardas.test.ts:78` grows until `> 30 * 1024`; `:82` `toMatch(/saude: \d+ bytes, acima do limite de 30 KB/)`; limit `scripts/guardas.ts:9` `LIMITE_BYTES = 30 * 1024` | PASS (same level gap as C14) |
| C16 | HTML report lists items, trechos, page link, discards with motive, per-candidate count | `test_relatorio.py::test_relatorio_completo` PASSED | `test_relatorio.py:33` trecho; `:34` `f"../../corpus/{LULA}#page=2" in html`; `:35` `"Inventado." in html and "trecho_nao_encontrado" in html`; `:38` `contagem == {"flavio-bolsonaro": 3, "lula": 2}`; `:39` `<td>Lula</td><td>2</td>` | PASS |
| C17 | unregistered hash fails the build and names the theme | vitest `hash: JSON sem aprovação…` + `hash: JSON regerado…` PASSED; **also `npm run build` exit 1** | `guardas.test.ts:52` `toContain("saude: hash")`; `:53` `toContain("sem aprovação")`; `:61` `toMatch(/saude: hash [0-9a-f]{64} diverge do aprovado/)`. Build level: production gate lists all 8 themes `<id>: hash … sem aprovação em revisao/aprovados.yaml` | PASS (build level proven) |
| C18 | recall < 90% exits != 0 listing the missing items | `test_avaliar.py::test_recall_baixo_sai_nao_zero` PASSED | `test_avaliar.py:43` `assert not ok`; `:44` `l.startswith("FALHA: saude / lula: 87%")`; `:45` `"faltou: lula-14 (pág. 14)"`; boundary `:57-58` exactly 90% passes | PASS (level: `ok` from `avaliar()`, not the CLI exit code) |
| C19 | missing convergence exits != 0 | `test_convergencia_faltando_sai_nao_zero` PASSED | `test_avaliar.py:65` `assert not ok`; `:66` `startswith("FALHA: convergência regularização fundiária")` | PASS (same level note as C18; 1 of 7 convergences exercised as missing) |
| C20 | `/`: Semelhanças, Diferenças first, then themes in themes.yaml order, each with SVG | e2e `navegacao.spec.ts:7 grade` PASSED desktop-chrome + android-chrome | `navegacao.spec.ts:10` `toHaveText(["Semelhanças", "Diferenças", ...ordemTemas.map(t => t.rotulo)])`; `:11` `li.locator("svg") toHaveCount(1)`; `:12` `.destaque toHaveCount(2)` | PASS |
| C21 | >= 768 px two equal-width columns; < 768 px two tabs | e2e `navegacao.spec.ts:15 colunas e abas` PASSED desktop + android | `:20` viewport 1024; `:25` `Math.abs(a.width - b.width) <= 1`; `:26` same y; `:27` viewport 767; `:30` `abas toHaveCount(2)`; `:31` one visible tabpanel | PASS (768 itself not sampled; 767 and 1024 bracket it) |
| C22 | expanded bullet shows trecho, arquivo, página and "Ver no PDF" | e2e `navegacao.spec.ts:39 expandir` PASSED desktop + android | `:43` trecho hidden before; `:45` visible after; `:46` `.arquivo toHaveText(/\.pdf$/)`; `:47` `.pagina toHaveText(/^pág\. \d+$/)`; `:48` link `/Ver no PDF/` visible | PASS |
| C23 | "Ver no PDF" opens the own-domain viewer at the cited page | e2e `pdf.spec.ts:7` PASSED on desktop-chrome, android-chrome (Pixel 5), ios-safari (iPhone 12 WebKit) | `web/e2e/pdf.spec.ts:16` `url.origin == baseURL origin`; `:17` `pathname == "/pdf/visualizador.html"`; `:19` `body data-pagina == String(pagina)`; `:20` `#titulo-pdf` `página N de M`; `:27` served PDF sha256 == fontes.json sha256 | PASS (emulated devices, not real phones) |
| C24 | 50/50 order drawn, kept across screens until reload | e2e `ordem.spec.ts:15`, `:24`, `:37` PASSED | `ordem.spec.ts:18` random 0.1 -> `"flavio-bolsonaro"`; `:21` 0.9 after reload -> `"lula"`; `:34` after client navigation to /semelhancas first side still `lula`; `:43` 30 unfixed loads see `["ab","ba"]` | PASS |
| C25 | "Trocar ordem dos candidatos" inverts on every screen | e2e `ordem.spec.ts:46 trocar` PASSED | `:51` after click first = `lula`; `:57` persists on /diferencas; `:59` second click -> `flavio-bolsonaro` | PASS |
| C26 | filters "Só semelhanças" / "Só diferenças" / "Mostrar tudo" | e2e `navegacao.spec.ts:51 filtro` PASSED desktop + android | `:56` 1 block; `:60-63` diferencas + omissoes, no semelhancas (Landing decision); `:65` back to 4 | PASS |
| C27 | transversal views grouped by theme in order, `/diferencas` with labelled omissions | e2e `navegacao.spec.ts:68 transversal` PASSED | `:77` `ids toEqual(esperado.map(t => t.id))`; `:83` `textos toEqual(esperados)`; `:85` `.selo "Omissão" toHaveCount(c.omissoes.length)`; `:90` same trecho as JSON | PASS |
| C28 | empty view shows "Nenhum ponto encontrado nos temas publicados" | vitest `render.test.tsx > vazia` PASSED | `render.test.tsx:47` `toContain(TRANSVERSAL_VAZIA)` for both views; `:49` `toBe("Nenhum ponto encontrado nos temas publicados")` | PASS (SSR level) |
| C29 | direct link to `/tema/<id>` opens the theme | e2e `navegacao.spec.ts:96 link direto` PASSED | `:98` `status() == 200`; `:99` `h1 toHaveText("Educação")` | PASS |
| C30 | unknown theme and unknown route answer 404 with link to `/` | e2e `navegacao.spec.ts:102 404` PASSED | `:105` `r.status() == 404`; `:107` link "Ir para o início" `href "/"` | PASS (status comes from `scripts/servir.mjs:51-53`, the local Pages imitation, not Cloudflare) |
| C31 | only own-domain requests, on every route and control | e2e `transparencia.spec.ts:75 mesma origem` PASSED | `:80` collects any non data:/blob: request off-origin; `:85-88` clicks every visible button and summary on every route; `:98` `expect(fora).toEqual([])` | PASS (links other than navigation not clicked; PDF viewer covered as a route) |
| C32 | AI notice on every route | e2e `transparencia.spec.ts:12 aviso` PASSED | `:15` `.aviso-ia toHaveText(AVISO)` over ROTAS; `apoio.ts` AVISO is the AC 28 string verbatim | PASS |
| C33 | `/sobre`: file, sha256, date, TSE link, responsible | e2e `transparencia.spec.ts:20 sobre` PASSED | `:26` link with file name; `:27` `.hash toHaveText(f.sha256)`; `:28` date; `:29` TSE `href == f.url_tse`; `:31-32` "Responsável pelo site" heading, `.responsavel` not empty | PASS |
| C34 | `/metodologia`: 5 stages and "só documentos oficiais" | e2e `transparencia.spec.ts:35 metodologia` PASSED | `:37-43` `toHaveText(["Ingestão.","Classificação.","Comparação.","Verificação automática.","Revisão humana."])`; `:44` `toContainText("Regra: só documentos oficiais.")` | PASS |
| C35 | both candidates use the same component and classes | e2e `transparencia.spec.ts:47 neutro` PASSED (desktop only) | `:65` `expect(estilos[0]).toEqual(estilos[1])` (class, tag, computed colours); `:67` tab classes equal; `:72` every `data-cand` CSS rule is only `order: 1|2` | PASS |
| C36 | no Set-Cookie and no foreign script | e2e `transparencia.spec.ts:101 cookie` PASSED | `:111` script src origin == own; `:113` CSP contains `default-src 'self'`; `:115` `comCookie toEqual([])`; `:116` `cookies() toEqual([])` | PASS (headers from local `servir.mjs` reading `_headers`, not real Cloudflare responses) |
| C37 | initial JS <= 200 KB gzip | `npm run orcamento` exit 0 | `web/scripts/orcamento.mjs:6` `LIMITE = 200 * 1024`; `:19` `ok = total <= LIMITE && srcs.length > 0`. Output: `index.html: 49.7 KB`, `tema/agronegocio/index.html: 49.7 KB` | PASS |
| C38 | Lighthouse mobile on `/` and `/tema/saude`: P >= 90, A >= 90, LCP < 2.0 s | `npm run lighthouse` exit 0 | `web/scripts/lighthouse.mjs:56` `ok = perf >= 90 && a11y >= 90 && lcp < 2.0`; `:12` routes `["/", \`/tema/${tema}\`]` with `:35` `tema = readdirSync(join(raiz, "tema"))[0]` = **agronegocio**. Output: `/` P99 A100 LCP 1.55 s; `/tema/agronegocio` P98 A100 LCP 1.85 s | **FAIL as stated**: `/tema/saude` (checklist, plano §6 CI step 4) was never measured; AC 34's `/tema/<theme_id>` is met |
| C39 | every route keyboard operable, visible focus | e2e `a11y.spec.ts:36 teclado` PASSED | `web/e2e/a11y.spec.ts:40` first Tab = "Pular para o conteúdo"; `:45` outline >= 2px on each Tab stop up to "Saúde"; `:54` Space on filter -> `aria-pressed true`; `:60` ArrowRight moves tab; `:73` per route first <= 6 Tab stops have outline | PASS (weak: filter, tab and summary reached by `.focus()` not Tab; only 6 stops per route) |
| C40 | axe: no serious/critical on any route | e2e `a11y.spec.ts:6 axe` PASSED | `:11` wcag2a/2aa/21a/21aa; `:13` `expect(graves.map(...)).toEqual([])` over ROTAS with summaries expanded | PASS |
| C41 | 320 px at 200% (160 CSS px) no horizontal scroll | e2e `a11y.spec.ts:17 reflow` PASSED | `:18` `setViewportSize({ width: 160, height: 700 })`; `:24` `expect(sw, r).toBeLessThanOrEqual(cw)` over ROTAS, summaries expanded | PASS |

## Swept rows resolving to existing code

| Row | In code | Evidence |
|---|---|---|
| schema guard | yes | `web/tests/guardas.test.ts:85-91` `toContain("saude: fora do schema")`, PASSED; `scripts/guardas.ts:68` |
| TSE unreachable -> `fontes` exits != 0 with the HTTP message | yes (no test) | `pipeline/rag_planos/fontes.py:74-78` prints `não foi possível baixar {u}: {e}`, `return 2` |
| LLM disk cache by prompt hash | yes (no test) | `pipeline/rag_planos/llm.py:63-76` `ComCache`, key `sha256(f"{nome}\n{prompt}")` |
| regenerating changes the hash and reopens the gate | yes | `guardas.test.ts:56-62`, PASSED |
| `fontes --tse-dir` | yes | `rag_planos/__main__.py:141` |
| Gemini without key -> provider `arquivo` | **differs from Landing** | no `arquivo` provider in `llm.py` (only `Gemini`, `ComCache`; `provedor_padrao()` returns `None` without key). The fallback is `comparar.de_rascunho` (`comparar.py:32`), which reads `dados/rascunhos/<tema>.json` outside the `Provedor` interface |
| judge without key -> `juiz: nao_executado` | yes | `test_verificar.py:62-64` PASSED |
| version by SHA-256 / state gerado->aprovado | yes | C2, C4, C17 |

## Gate

- `WD=pipeline ./dock.sh pipeline python -m pytest -v`: 30 passed, 0 failed, 0 skipped
- `WD=web ./dock.sh web "npx vitest run --reporter=verbose"`: 8 passed, 0 failed
- `WD=web ./dock.sh web "npm run build:teste … && npx playwright test --reporter=list"`: 31 passed, 0 failed (desktop-chrome 19, android-chrome 7, ios-safari 1)
- `WD=web ./dock.sh web "npm run build:teste … && npm run orcamento && npm run lighthouse"`: exit 0 (2/2 budget ok, 2/2 Lighthouse ok)
- `WD=web ./dock.sh web "npm run build"`: exit 1 as expected, "Build bloqueado pelas guardas", lists all 8 themes (agronegocio, custo-de-vida, educacao, meio-ambiente, programas-sociais, saude, seguranca-publica, tecnologia-ia) with `sem aprovação em revisao/aprovados.yaml`
- `git status --porcelain` empty before and after

## Gaps (ranked)

1. **C38**: Lighthouse runs on `/tema/agronegocio` (first directory alphabetically), not `/tema/saude` as the checklist and plano §6 step 4 say. Fix: pin `saude` in `lighthouse.mjs` (and in `orcamento.mjs` for consistency).
2. **Landing/Swept mismatch**: the `arquivo` provider behind `Provedor.gerar` that Landing describes does not exist. The fallback without a key is `comparar.de_rascunho`. It does the same job, but the literal shape is not what was recorded.
3. **Precision gap C1 / AC 1**: "pagina igual ao número impresso na página" is not in C1 and no test asserts it. The code uses the physical page index (`extrair.py:73,93`). `test_ingest.py:19` is vacuous (`… or True`).
4. **Level gaps**: C14 and C15 are proven on `verificarGuardas`, not on `npm run build` (C17 is proven at build level by the production gate). C18 and C19 check `avaliar()`'s `ok`, not the CLI exit code. C13 and C28 are proven at SSR render level.
5. **C39 is weak**: it reaches the filter, tabs and summary with `.focus()` instead of Tab, and checks only 6 Tab stops per route.
6. **What the proofs cannot reach**: real Android and iOS devices (only Playwright emulation: Pixel 5 Chromium and iPhone 12 WebKit). Real Cloudflare Pages headers, 404 status and the absence of Set-Cookie (all served by the local `servir.mjs`). Real 4G (Lighthouse simulated throttling on localhost). C21 and C35 run only on desktop and Android, and C35 only on desktop.
