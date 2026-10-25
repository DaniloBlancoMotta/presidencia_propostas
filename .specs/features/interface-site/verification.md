# Interface do site - verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: f54d5f3..HEAD (HEAD = ccb05f9); fix diff d13f092..ccb05f9 (f1bd907, 3148225, ccb05f9), with d13f092 itself adding C80 and the unit `Proof:` lines to checks.md
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope: proofs re-run in full at ccb05f9; every round-2 non-PASS verdict re-judged (the "←" of the back link, the unmet `Decide, alcançado pelo navegador` row, the missing unit `Proof:` lines); citations refreshed in every file the fix touched (`web/src/App.tsx`, `web/src/navegacao.ts`, `web/tests/interface.test.ts`, `web/e2e/interface-inicio.spec.ts`, checks.md, plan.md); Coverage rows whose authority the fix touched recomputed; faults injected on the surfaces the fix touched or created (`faltaBaixar`/`temasDaRota`, the `destinoDaRolagem` wiring, the back-link SVG) plus two round-2 surfaces no fault had reached (C17 separators, C79). The fix changed no markup or CSS (`git diff d13f092..HEAD -- web/src` moves `faltaBaixar` and `temasDaRota` into `navegacao.ts`, adds `destinoDaRolagem`, and rewires `App.tsx:113` and `:145-147`), so step 1 is re-done only for the back-link element. Everything else says `carried from 28cd9d8` (round 2 HEAD) or `carried from 2529684` (round 1).

Run A, the proofs at HEAD on the real tree, was one invocation from `/d/Rag_planos_presidencia`: `DOCK_NOME=verif WD=web SAIDAS="web/test-results" ./dock.sh web '...'` running `npx tsc --noEmit`, `npm run build:teste`, `npx vitest run --reporter=verbose`, `npx playwright test --reporter=list` (all four projects), `npm run orcamento`, `npm run lighthouse`, the C76 `fc-match` command and `npm run build` (production), each followed by `echo "RC <step>=$?"`. Every RC is 0 and dock.sh exited 0. Every named test appears on its own line in that log with ✓: each `Cn:` e2e title C1-C75, C78-C80, `404: tema inexistente`, `neutro`; and the unit titles `C6:`, `C10:`, `C19:`, `C20:`, `C26:`, `C28:`, both `C29:`, `C30:`, `C31:`, `C32:`, `C34:`, `C40:`, `C50:`, `C51:`, `C53:`, `C56:`, `C61:`, `C74:`.

Faults ran in `git worktree add <scratchpad>/r3/wt-mut HEAD`, through that worktree's own `dock.sh` with `DOCK_NOME=mut`, one at a time, each reverted with `git -C <wt> checkout -- web` (0 files changed after each). The real tree's `git status --porcelain` was empty before (recorded to a file) and empty after `git worktree remove --force`; the two snapshots were compared with `cmp` (identical).

## Binding sources

Verified at ccb05f9 for the back-link element; the rest carried from 28cd9d8.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/plano-final.md` §6 Telas, CELULAR `/` (lines 202-219) | carried from 28cd9d8 | none | - |
| `.specs/plano-final.md` §6 Telas, CELULAR `/tema/saude` (lines 203-220), "← Saúde" | yes - re-read lines 198-221 at ccb05f9 | none | - . Round-2 gap 1 now has a check: C80 asserts one visible `svg[aria-hidden="true"]` with a non-zero box and a non-transparent colour inside `main a.voltar`, before the `h1`, on all 15 site routes except `/` (`web/e2e/interface-inicio.spec.ts:264-290`). The SVG is `SetaVoltar` (`web/src/icones.tsx:39`) inside `Voltar` (`web/src/paginas.tsx:62-68`), used at the 7 call sites `paginas.tsx:230`, `:366`, `:442`, `:490`, `:538`, `Chat.tsx:859`, `:891`, all reached by C80's route loop. Whether the arrow is actually drawn is not asserted: see Faults F3 and the arrangement row in Coverage |
| `.specs/plano-final.md` §6 `/semelhancas`, `/diferencas` and crit. 58 | carried from 28cd9d8 | none | - |
| `.specs/plano-final.md` §6 DESKTOP note (line 221) | carried from 2529684 | none | - |
| `.specs/plano-final.md` §6 Rotas e guardas de build (lines 224-234) | carried from 2529684 | none | - |
| `.specs/plano-final.md` §7 AC 16-37 (lines 277-306) | carried from 28cd9d8; AC 34 Lighthouse re-run in A | none | - |
| `.specs/plano-final.md` §2 decisions 12, 13, 14, 22, as amended in plan.md | carried from 2529684 | none | - |
| plan.md Assumptions dated 25/10/2026 (plan.md:280-281) | yes - unchanged at ccb05f9 (the fix touched plan.md:50, the Flow step 4, only) | none | - |

## Checks

Proof run "A" = run A at ccb05f9. Citations in files the fix touched are refreshed (`web/tests/interface.test.ts` shifted by +41 from line 155 on; `web/e2e/interface-inicio.spec.ts` only grew at the end, so its earlier lines stand). Evidence in untouched files is carried from 28cd9d8 or 2529684 with the proof re-run green in A.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Pre-JS tab and panel of the drawn order; hydration does not swap | A: e2e `C1:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:51` - ``await expect(q.locator(`.painel[data-cand="${primeiro}"]`)).toBeVisible()``; `:74` - `expect(await visiveis()).toEqual([primeiro])` | PASS |
| C2 | Section counts in all 8 themes | A: e2e `C2:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:86-88` - ``toBe(`Omissões (${c.omissoes.length})`)``; `:80` - `toHaveLength(8)` | PASS |
| C3 | Filled SVG triangle right of text, 0°/90° | A: e2e `C3:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:121` - `expect(d.lista).toBe("none")`; `:134` - `.toBe(90)` | PASS |
| C4 | 390 px: name only on the tab; h3 at most 1×1 px | A: e2e `C4:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:147`; `:149-150` - `toBeLessThanOrEqual(1)` | PASS |
| C5 | Control DOM order; filters share a top at 390 px | A: e2e `C5:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:158` - `expect(noDom).toEqual(rotulos)`; `:162` | PASS |
| C6 | Omissions in current order | A: e2e `C6:` ✓, vitest `C6:` ✓ | `web/e2e/interface-tema.spec.ts:172` (carried); `web/tests/interface.test.ts:89` - `expect(textos(ordenarOmissoes(misturadas, ["flavio-bolsonaro", "lula"]))).toEqual(["f1", "f2", "l1", "l2"])` (line unchanged) | PASS |
| C7 | Trocar reverses omission groups | A: e2e `C7:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:192` | PASS |
| C8 | h3/h3/h4 names; no skipped level | A: e2e `C8:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:209`; `:218` | PASS |
| C9 | No `region` inside lists | A: e2e `C9:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:227` - `toHaveCount(0)` | PASS |
| C10 | All quotes; one origin and one Ver no PDF per group | A: e2e `C10:` ✓, vitest `C10:` ✓ | `web/e2e/interface-tema.spec.ts:256-257` (carried); `web/tests/interface.test.ts:102` - `expect(forma([c("a.pdf", 3, "x"), c("a.pdf", 4, "y")])).toEqual([["x"], ["y"]])` (line unchanged) | PASS |
| C11 | Tablist at top 0 after 1,500 px | A: e2e `C11:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:273` | PASS |
| C12 | Exact opening text, both orders | A: e2e `C12:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:36` - ``expect(normal(texto)).toBe(`Planos de governo de ${a} e ${b}, ...`)`` | PASS |
| C13 | Highlights split one row; themes 4 + 4 | A: e2e `C13:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:49-50`; `:53` - `toEqual([4, 4])` | PASS |
| C14 | 390 / 339 / 160 px layouts | A: e2e `C14:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:60` - `toEqual([2, 2, 2, 2])`; `:69`; `:78` - `expect(sw).toBeLessThanOrEqual(cw)` | PASS |
| C15 | Cards in a row share a height | A: e2e `C15:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:86` - `toBeLessThanOrEqual(1)` | PASS |
| C16 | Nothing before the h1 but the back link; aviso right after the h1; content after the aviso; back link names | A: e2e `C16:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:126` - `expect(r.antesDoH1, rota).toEqual([])`; `:128` - `expect(r.entre, rota).toEqual([])`; `:130` - `expect(r.conteudoAntesDoAviso, rota).toEqual([])`; `:138-139` - `toHaveAccessibleName("Todos os temas")`, `toBe("/")` | PASS |
| C17 | Footer links in order, separated by "·", before the collection date; page h1s | A: e2e `C17:` ✓; fault F4 killed | `web/e2e/interface-inicio.spec.ts:151` - ``toEqual(["a:Chat por tema", "a:Metodologia", "a:Sobre", `p:Documentos coletados do TSE em ${dataColeta()}`])``; `:166` - `expect(grupo.texto, rota).toBe("Chat por tema · Metodologia · Sobre")`; `:167-171` - two visible "·" between the links; separators now at `web/src/App.tsx:216`, `:218` | PASS |
| C18 | Viewer bar sticky only at 1366×900 | A: e2e `C18:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:45-46` | PASS |
| C19 | Two taps during the draw end on page 28 | A: e2e `C19:` ✓, vitest `C19:` ✓ (unit `Proof:` line now in checks.md) | `web/e2e/interface-visualizador.spec.ts:72` - ``toHaveText(`Página 28 de ${total}`)`` (carried); `web/tests/interface.test.ts:232-234` - `expect(comecados).toEqual([26, 28])`, `expect(terminados).toEqual([28])`, `expect(cancelados).toBe(3)` | PASS |
| C20 | At first or last page focus moves to the other button | A: e2e `C20:` ✓, vitest `C20:` ✓ (unit `Proof:` line now in checks.md) | `web/e2e/interface-visualizador.spec.ts:88-89`, `:95-96` (carried); `web/tests/interface.test.ts:242-243` - `toEqual({ desabilitado: { anterior: true, proxima: false }, foco: "proxima" })` and the reverse; `:245-247` - `foco` null otherwise | PASS |
| C21 | Paging disabled, Baixar hidden while loading | A: e2e `C21:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:109-111` | PASS |
| C22 | Unknown file / aborted download alert | A: e2e `C22:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:124-126` | PASS |
| C23 | One h1; one aria-live "Página N de M" | A: e2e `C23:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:135-138` | PASS |
| C24 | document.title | A: e2e `C24:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:147` | PASS |
| C25 | 1:1.414 reserved before the PDF | A: e2e `C25:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:158` | PASS |
| C26 | Redrawn at the new width within 300 ms | A: e2e `C26:` ✓, vitest `C26:` ✓ (unit `Proof:` line now in checks.md) | `web/e2e/interface-visualizador.spec.ts:176-177` (carried); `web/tests/interface.test.ts:251-253` - `redesenharNaLargura(600, 1366)` true, `(1366, 600)` true, `(600, 600)` false | PASS |
| C27 | Tabular digits; buttons do not move 9 -> 10 | A: e2e `C27:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:184-185`; `:194-195` | PASS |
| C28 | Skip link and `#g-` link focus the target, no history entry, no fetch | A: e2e `C28:` ✓, vitest `C28:` ✓ (unit `Proof:` line now in checks.md) | `web/e2e/interface-historico.spec.ts:26-29`, `:36-39` (carried); `web/tests/interface.test.ts:200-205` - `ancoraDaPagina` true only for the same path and search with a hash | PASS |
| C29 | Back restores `scrollY` within 2 px; after a route change, anchor with y = 0 wins, a stored y wins over the anchor | A: e2e `C29:` ✓, both vitest `C29:` ✓; fault F2 killed | `web/e2e/interface-historico.spec.ts:54` - `expect.poll(...).toBeGreaterThan(y - 3)`; `:55` - `toBeLessThanOrEqual(2)`; `web/tests/interface.test.ts:147`, `:149` - `rolagemDoEstado` 0 / 6025; `:160` - `expect(destinoDaRolagem(0, ancora)).toEqual({ alvo: ancora })`; `:162` - `expect(destinoDaRolagem(6025, ancora)).toEqual({ y: 6025 })`; `:164-165` - `{ y: 6025 }`, `{ y: 0 }` without an anchor | PASS |
| C30 | aria-busy and "Carregando…" while loading, cleared afterwards; only when the route has something to fetch | A: e2e `C30:` ✓, vitest `C30:` ✓; fault F1 killed | `web/e2e/interface-historico.spec.ts:63` - `toHaveAttribute("aria-busy", "true")`; `:64` - `toHaveText("Carregando…")`; `:66-67` - cleared (carried); `web/tests/interface.test.ts:179-180` - chat/conversa not loaded `toBe(true)`; `:182-183` - loaded `toBe(false)`; `:185-186` - theme JSON missing true / present false; `:188-191` - cross views missing one true / all present false; `:193-194` - inicio, metodologia, sobre `toBe(false)` | PASS |
| C31 | Last destination wins, exactly one history entry | A: e2e `C31:` ✓, vitest `C31:` ✓ (unit `Proof:` line now in checks.md) | `web/e2e/interface-historico.spec.ts:79`, `:81` - `expect(await historico(page)).toBe(antes + 1)` (carried); `web/tests/interface.test.ts:134-135` - `expect(vez.vale(saude)).toBe(false)`, `expect(vez.vale(educacao)).toBe(true)` | PASS |
| C32 | Filters in the URL, no history entry | A: e2e `C32:` ✓, vitest `C32:` ✓ | `web/e2e/interface-historico.spec.ts:89`, `:93-94` (carried); `web/tests/interface.test.ts:114` - `expect(urlComFiltro("/tema/saude", "tudo")).toBe("/tema/saude")` | PASS |
| C33 | `?filtro` opens pressed and applied; 200 | A: e2e `C33:` ✓ | carried from 28cd9d8: `web/e2e/interface-historico.spec.ts:99-100`; `:105`; `:107` - `toBe(200)` | PASS |
| C34 | Unknown `?filtro` -> Mostrar tudo | A: e2e `C34:` ✓, vitest `C34:` ✓ | `web/e2e/interface-historico.spec.ts:115` (carried); `web/tests/interface.test.ts:122` - `expect(filtroDaUrl("?filtro=xyz")).toBe("tudo")` | PASS |
| C35 | Status announces who comes first | A: e2e `C35:` ✓ | carried from 28cd9d8: `web/e2e/interface-historico.spec.ts:125`, `:127` | PASS |
| C36 | Index of themes with counts; anchor lands at 0-64 px | A: e2e `C36:` ✓ | carried from 28cd9d8: `web/e2e/interface-historico.spec.ts:144-145`; `:149-150`; `:154` - `toBe(200)` | PASS |
| C37 | `/diferencas` h3 counts; no "Diferença" seal | A: e2e `C37:` ✓ | carried from 28cd9d8: `web/e2e/interface-historico.spec.ts:164`; `:167` | PASS |
| C38 | `/sobre` cards in current order, side by side | A: e2e `C38:` ✓ | carried from 28cd9d8: `web/e2e/interface-historico.spec.ts:179`; `:181-183` | PASS |
| C39 | No tabpanel at 1024 px; no ARIA ref to hidden | A: e2e `C39:` ✓ | carried from 28cd9d8: `web/e2e/interface-historico.spec.ts:190`; `:203` | PASS |
| C40 | Hover to a token on 6 controls; `:hover` only `var()` | A: e2e `C40:` ✓, vitest `C40:` ✓ | `web/e2e/interface-acabamento.spec.ts:23-24` (carried); `web/tests/interface.test.ts:265` - `toBeNull()`; `:270` - `toMatch(/var\(--[\w-]+\)/)` | PASS |
| C41 | touch-action, tap highlight, `:active` | A: e2e `C41:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:70-73`, `:95` | PASS |
| C42 | Navigation links at least 44 px | A: e2e `C42:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:104` | PASS |
| C43 | Running text at most 68ch | A: e2e `C43:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:138` | PASS |
| C44 | Aviso band spans the window; content at the h1's x | A: e2e `C44:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:147`, `:150` | PASS |
| C45 | Footer at the window bottom on a short page | A: e2e `C45:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:157` | PASS |
| C46 | balance on headings, pretty on running text; NBSP places | A: e2e `C46:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:173` - `toContain("balance")`; `:196-197` - `toContain("pretty")`; `:177`, `:180`, `:182` | PASS |
| C47 | Omission seal text | A: e2e `C47:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:207` | PASS |
| C48 | theme-color, favicon, no `/favicon.ico` | A: e2e `C48:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:221-222`; `:225-227` | PASS |
| C49 | Permissions-Policy without interest-cohort | A: e2e `C49:` ✓ | carried from 28cd9d8: `web/e2e/interface-acabamento.spec.ts:234`, `:237` | PASS |
| C50 | `$&`, `$'`, `$$` verbatim | A: vitest `C50:` ✓ | `web/tests/interface.test.ts:326` - ``expect(texto(app)).toContain(`Custa ${s} por mês.`)``; `:328-330` | PASS |
| C51 | Colour literals only in tokens.css | A: vitest `C51:` ✓ | `web/tests/interface.test.ts:282` - `expect(literais, arquivo).toEqual([])`; `:284-285` | PASS |
| C52 | pdf.js text layer, selectable, has the quote | A: e2e `C52:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:205`; `:207`; `:211` | PASS |
| C53 | Exact candidate, green and tone tokens | A: vitest `C53:` ✓ | `web/tests/interface.test.ts:50` - `expect(tokens).toMatchObject({ "cand-lula": "#ee481a", ... })` (line unchanged) | PASS |
| C54 | Candidate tone places with 6 px and 4 px bands | A: e2e `C54:` ✓ | carried from 28cd9d8: `web/e2e/interface-cores.spec.ts:50-52`, `:56`, `:61-63`, `:71-74` | PASS |
| C55 | Full colour never on text; 3 px side rule; square | A: e2e `C55:` ✓ | carried from 28cd9d8: `web/e2e/interface-cores.spec.ts:94`; `:104-105`; `:108-116` | PASS |
| C56 | Contrast thresholds; tightest pair 3.05:1 | A: vitest `C56:` ✓ | `web/tests/interface.test.ts:66`, `:68`; `:70` - `toBeLessThanOrEqual(0.02)` (lines unchanged) | PASS |
| C57 | Colours stay with their candidate | A: e2e `C57:` ✓ | carried from 28cd9d8: `web/e2e/interface-cores.spec.ts:139`; `:142` | PASS |
| C58 | Green concordance incl. `/semelhancas` title glyph | A: e2e `C58:` ✓ | carried from 28cd9d8: `web/e2e/interface-cores.spec.ts:158`; `:185` - `toHaveCount(1)`; `:186` - `toBe("M5 9h14M5 15h14")`; `:187-188` | PASS |
| C59 | Viewer bar band in the PDF's colour | A: e2e `C59:` ✓ | carried from 28cd9d8: `web/e2e/interface-visualizador.spec.ts:31-32` | PASS |
| C60 | Fonts from `/fontes/`, swap, one preload, 5.3.0 | A: e2e `C60:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:23-25`, `:27`, `:34-35`, `:38-39` | PASS |
| C61 | Neutral tokens in OKLCH; no `#fff`/`#000` | A: vitest `C61:` ✓ | `web/tests/interface.test.ts:289` - `toMatchObject({ papel: "oklch(97.6% 0.008 85)", ... })`; `:295` - `toBeNull()` | PASS |
| C62 | No shadow, gradient, thick side border | A: e2e `C62:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:67-70` | PASS |
| C63 | Only 13/15/17/21 px plus h1 36-60 px | A: e2e `C63:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:98` | PASS |
| C64 | Item numbers; quotes in Newsreader italic | A: e2e `C64:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:119-120`, `:135-138` | PASS |
| C65 | "=" green, "≠" graphite, SVG | A: e2e `C65:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:159-160` | PASS |
| C66 | 260 ms opacity/transform | A: e2e `C66:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:172`, `:188`, `:201` | PASS |
| C67 | Reduced motion: nothing animates | A: e2e `C67:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:211`, `:217` | PASS |
| C68 | Segmented filters; Trocar text button | A: e2e `C68:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:227`, `:230-231`, `:244` | PASS |
| C69 | No arrows or triangles in text; names without arrow | A: e2e `C69:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:253`, `:259-260` | PASS |
| C70 | Hyphenation rules | A: e2e `C70:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:269`, `:277` | PASS |
| C71 | `role="list"`; numbers aria-hidden | A: e2e `C71:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:292-293` | PASS |
| C72 | Regression suites green, no assertion loosened | A: Playwright 145/145 (desktop-chrome 122, android-chrome 19, ios-safari 1, previa-ask 3), vitest 55/55, orcamento ok, lighthouse ok | carried from 28cd9d8: `web/e2e/navegacao.spec.ts:89` - exact `toEqual(esperados)`; `web/scripts/lighthouse.mjs:33` - `perf >= 90 && a11y >= 90 && lcp < 2.0` (A: `/` 99/100, LCP 1.58 s; `/tema/saude` 100/100, LCP 1.55 s); `web/e2e/a11y.spec.ts:13`. The fix touched no pre-existing test (only additions to `interface.test.ts` and `interface-inicio.spec.ts`) | PASS |
| C73 | Same component, classes and styles for both candidates | A: e2e `neutro` ✓ | carried from 2529684: `web/e2e/transparencia.spec.ts:67`, `:115` | PASS |
| C74 | GEO kept; absolute canonical on every route but the 404 | A: `geo.spec.ts` ✓, `seo.test.ts` ✓, vitest `C74:` ✓ | `web/e2e/geo.spec.ts:27` (carried); `web/tests/interface.test.ts:357` - `expect(r.status, r.stderr).toBe(0)`; `:370` - `expect(canonicos(arquivo), arquivo).toEqual([url])`; `:371` - `expect(canonicos("404.html")).toEqual([])` | PASS |
| C75 | Chat suites green; Chat por tema button outside the grid | A: `chat.spec.ts`, `ask.spec.ts`, e2e `C75:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:182`; `:185` | PASS |
| C76 | fc-match resolves to LiberationSans-Bold | A: printed `LiberationSans-Bold.ttf: "Liberation Sans" "Bold"` twice; `RC C76=0` | carried from 2529684: `docker/web.Dockerfile:5` | PASS |
| C77 | Unknown theme and route answer 404 with a link to `/` | A: e2e `404: tema inexistente` ✓ (desktop, android) | carried from 28cd9d8: `web/e2e/navegacao.spec.ts:111` - `toBe(404)`; `:113` - `toHaveAttribute("href", "/")` | PASS |
| C78 | Trocar ordem present/absent on the 8 places | A: e2e `C78:` ✓ | carried from 28cd9d8: `web/e2e/interface-inicio.spec.ts:191`; `:196-197`; `:199-200` | PASS |
| C79 | Owner-kept additions only; "Aviso" outside the exact aviso text | A: e2e `C79:` ✓; fault F5 killed | `web/e2e/interface-inicio.spec.ts:218` - `expect(aviso, rota).toEqual({ rotulos: ["Aviso"], fora: true, texto: AVISO })`; `:230` - `toEqual(["H1:Compare os planos de governo", "SPAN.rotulo:Aviso", "H2.rotulo:Temas"])`; `:251`; `:260` | PASS |
| C80 | On every site route but `/`, the back link before the `h1` holds a visible `svg[aria-hidden="true"]` with width and height > 0 and a non-transparent `color`; the accessible name has no arrow | A: e2e `C80:` ✓; fault F3 survived | `web/e2e/interface-inicio.spec.ts:266` - `expect(rotas.length).toBeGreaterThan(0)`; `:270` - `toHaveCount(1)`; `:272-275` - link precedes `main h1`; `:277-279` - `toHaveCount(1)`, `toBeVisible()`, `toHaveAttribute("aria-hidden", "true")`; `:284-287` - width, height > 0, colour not transparent; `:288` - `toHaveAccessibleName(/^[^←→]+$/)`. Each enumerated property is asserted, so the row passes as written; but the claim's "a seta '←' desenhada" is not reached: no assertion reads the path, its stroke or its direction (precision gap; see F3) | PASS |

## Coverage

Verified at ccb05f9 for the rows the fix touched; the others carried from 28cd9d8.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Surface `GET /tema/<id>?filtro` statuses (2) | carried from 2529684 | 200 -> C33; 404 -> C77 | - |
| `?filtro` values (4) | carried from 2529684 | C32, C33, C34 e2e; unit `tests/interface.test.ts:112-124` | - |
| Surface `#g-<id>` statuses (1) | carried from 2529684 | 200 -> C36 | - |
| Landing doors (4) | carried from 2529684 | C32, C36, C53/C73/C62, C60 | - |
| Published themes (8) | carried from 28cd9d8 | C2, C10, C78, C79 loop all 8; C80 too (`ROTAS` in `web/e2e/apoio.ts:14-25` spreads `publicados`) | - |
| Draw orders (2) | carried from 2529684 | C1, C6, C12, C38, C57 | - |
| Routes (10) | carried from 28cd9d8 | the 9 site routes -> C16, C17, C63, C71, C79; all 10 -> C48, C69 | - |
| Routes carrying the back link (15: 8 themes, `/semelhancas`, `/diferencas`, `/metodologia`, `/sobre`, `/chat`, `/chat/conversa`, 404) | `Voltar` call sites `web/src/paginas.tsx:230`, `:366`, `:442`, `:490`, `:538`, `web/src/Chat.tsx:859`, `:891` | all 15 -> C80 (`ROTAS_SITE` minus `/`, `interface-inicio.spec.ts:265`) | - |
| Screen arrangement per §6, `/` | carried from 28cd9d8 | C16, C17, C79 | - |
| Screen arrangement per §6, `/tema/<id>` ("← Saúde", aviso, controls, "O que cada plano propõe", tabs, sections) | §6 drawing plus plan.md:281 | aviso after `h1` -> C16; controls -> C5; h2 -> C79 `:260`; sections -> C2; back link name -> C16 `:138`; back-link SVG box present and coloured -> C80 `:277-287` | the drawn stroke of the "←" itself: with `SetaVoltar`'s path emptied (`web/src/icones.tsx:39`, F3) nothing is painted and C80 stays green; its direction is not asserted either |
| Footer separators (2) | carried from 28cd9d8 | C17 `:167-171`; F4 killed | - |
| Glyphs outside the font (5) | checks.md Coverage row | "≠" C69 · "←" C69 (never text), C80 (SVG box) · "→" C69 · "▸", "▾" C3 | - (the "←" stroke gap is the one in the `/tema/<id>` arrangement row) |
| Green "=" glyph places (3) | carried from 28cd9d8 | C58 | - |
| "Trocar ordem" placement (8) | carried from 28cd9d8 | C78 | - |
| Owner-kept §6 additions (3) plus removed kicker (1) | carried from 28cd9d8 | C79 (F5 killed), C16 | - |
| C74 GEO members (4) | carried from 28cd9d8 | `geo.spec.ts`, `seo.test.ts`, `tests/interface.test.ts:370-371` | - |
| C28 cases (2 triggers × 3 properties) | carried from 28cd9d8 | `interface-historico.spec.ts:26-29`, `:36-39` | - |
| Decision rows of the pure navigation and paging functions | `web/src/navegacao.ts:5-50`, `web/src/paginacao.ts` at ccb05f9 | latest wins (2) -> `interface.test.ts:134-138`; scroll stored / restored / missing (4) -> `:147-154`; `destinoDaRolagem` (4: anchor & y = 0, anchor & y > 0, none & y > 0, none & y = 0) -> `:160-165`; `faltaBaixar` over the 8 route types it is called with (`App.tsx:107-113` returns early for `nao-encontrada`): chat and conversa not loaded -> `:179-180`, loaded -> `:182-183`, theme JSON missing / present -> `:185-186`, cross views missing one / complete -> `:188-191`, inicio, metodologia, sobre -> `:193-194`; same-page anchor (6) -> `:200-205`; draw queue -> `:232-238`; focus hand-off (5) -> `:242-247`; width redraw (3) -> `:251-253` | - |
| Startup: build outputs with CSS, tokens, fonts (3) | `web/scripts/build.ts` | `dist-teste` -> C60; `dist-previa` -> `ask.spec.ts`; `dist` -> `npm run build` exit 0 in A ("build ok em /app/web/dist: 8 temas publicados") | - |
| Other carried rows (viewer failures 2, hover controls 6, 44 px links 4, 68ch text 3, NBSP 3, S7 tokens 9, neutral tokens 4, tone places 3, full-colour places 4, text sizes 5, running text pretty 3) | carried from 28cd9d8 | as in round 2 | - |

## Test policy rows

Verified at ccb05f9 for the round-2 unmet row and the rows classifying touched files; the others carried from 28cd9d8.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decide, alcançado pelo navegador | `web/src/rotas.ts`, `web/src/Citado.tsx`, client navigation in `web/src/App.tsx` (C28-C31) through `web/src/navegacao.ts`, viewer paging (C19, C20, C26) through `web/src/paginacao.ts` | e2e and unit, one unit case per decision-table row | yes. Round-2 misses closed: `faltaBaixar` (`navegacao.ts:41-44`) and `destinoDaRolagem` (`:28-30`) are pure and each decision row has a unit case (`tests/interface.test.ts:160-165`, `:179-194`); `App.tsx:113` and `:145-147` only call them. The e2e contract stays (C29 `interface-historico.spec.ts:55`, C30 `:63-67`); F1 was killed at the unit level and F2 (the App wiring) at the e2e level. checks.md now binds the unit proofs of C19, C20, C26, C28, C29, C30, C31 with `Proof: npx vitest run tests/interface.test.ts -t "Cn:"` lines, and each title ran in A |
| Decide, sem fronteira | `tokens.css` contrast (C56); `build.ts` substitution (C50) and canonical (C74) | unit | yes - `tests/interface.test.ts:66-70`, `:326`, `:370-371` (carried from 28cd9d8, lines refreshed) |
| Apresentação | `estilo.css`, `tokens.css`, `visualizador.css`; markup in `paginas.tsx`, `App.tsx` footer, `Citado.tsx`, `icones.tsx` | e2e on the computed style or DOM, at the widths and routes the check names | yes for the values the checks name: C17 (F4 killed), C79 (F5 killed), C80 asserts each property it enumerates on all 15 routes. The `icones.tsx` back arrow's painted stroke is outside every check's enumeration, recorded under Faults and Coverage rather than here |
| Repasse, instrumentação | `web/scripts/servir.mjs`, `docker/web.Dockerfile`, `web/e2e/interface-apoio.ts`, `SITE_YAML` in `build.ts` | none of its own | yes - carried from 28cd9d8 |

## Faults injected

Verified at ccb05f9, each in the worktree with `DOCK_NOME=mut`, reverted with `git -C <wt> checkout -- web` before the next. Cap of 5 reached. Not mutated this round: C58 title glyph, C78 (both surfaces untouched by the fix and asserting exact values at `interface-cores.spec.ts:186` and `interface-inicio.spec.ts:196-200`).

| Mutation | Location | Killed |
| --- | --- | --- |
| F1: the cross views no longer need any theme JSON (`temasDaRota` returns `[]` for `semelhancas`/`diferencas`) | `web/src/navegacao.ts:35` | yes - unit `C30:` failed at `tests/interface.test.ts:188` ("expected false to be true") |
| F2: the App wiring ignores the stored position on route change (`window.scrollTo(0, destino.y)` -> `window.scrollTo(0, 0)`) | `web/src/App.tsx:147` | yes - e2e `C29:` failed at `interface-historico.spec.ts:54` (expected > 6045, received 0) |
| F3: the back arrow is not drawn (`SetaVoltar`'s path `d="M20 12H5m0 0 6-6m-6 6 6 6"` -> `d=""`); the 26×26 SVG box, `aria-hidden` and `currentColor` remain, so every back link is a blank 44 px square | `web/src/icones.tsx:39` | no - survived: e2e `C80:` passed (`✓ ... interface-inicio.spec.ts:264:1 › C80`, 1 passed, RC 0). The assertions at `:277-287` read only the `svg` element's box and CSS `color`, never the path |
| F4: footer separator "·" -> "\|" | `web/src/App.tsx:216`, `:218` | yes - e2e `C17:` failed at `interface-inicio.spec.ts:166` (received "Chat por tema \| Metodologia \| Sobre") |
| F5: the "Aviso" label moves inside the aviso text element | `web/src/paginas.tsx:49-50` | yes - e2e `C79:` failed at `interface-inicio.spec.ts:218` (`fora: false`, text prefixed with "Aviso") |

## Gate

Run A at ccb05f9 (`DOCK_NOME=verif WD=web SAIDAS="web/test-results" ./dock.sh web '...'`), dock.sh exit 0:

- `npx tsc --noEmit`: exit 0.
- `npm run build:teste`: exit 0 (`dist-teste` and `dist-previa`, 8 themes each).
- `npx vitest run --reporter=verbose`: 55 passed, 0 failed (6 files).
- `npx playwright test --reporter=list`: 145 passed, 0 failed (desktop-chrome 122, android-chrome 19, ios-safari 1, previa-ask 3).
- `npm run orcamento`: ok, 53.0 KB gzip on `index.html` and `tema/saude/index.html` (limit 200 KB).
- `npm run lighthouse`: `/` performance 99, accessibility 100, LCP 1.58 s; `/tema/saude` performance 100, accessibility 100, LCP 1.55 s.
- `fc-match "system-ui:bold"` and `fc-match "sans-serif:bold"`: `LiberationSans-Bold.ttf`, `RC C76=0`.
- `npm run build` (production, real `revisao/aprovados.yaml` from 9486214): exit 0, "build ok em /app/web/dist: 8 temas publicados".

Note: the owner's Assumption (plan.md:280) still asks for one Lighthouse run on a Cloudflare Pages preview before release; that is outside this gate.

## Ranked gaps

1. Surviving mutant F3 on the surface this round created (C80, `web/e2e/interface-inicio.spec.ts:277-287`): with the `SetaVoltar` path emptied (`web/src/icones.tsx:39`), nothing is painted and every back link is a blank 44 px square, which is exactly the round-2 gap 1 failure mode, and C80 stays green. The check enumerates only properties of the `svg` element (visible box, `aria-hidden`, non-transparent `color`), so it also passes with a "→" or any other path. This is a precision gap in checks.md C80 ("a seta '←' desenhada" is in the claim but not in the enumerated properties), and the test follows the check. Closing it needs C80 to name a property of the drawn stroke, e.g. the `path` has `getTotalLength() > 0` with `stroke` equal to `currentColor` and `stroke-width` > 0, and its direction, e.g. the path's `d` equals the left arrow's or its bounding box shows the head on the left. Then assert it in the C80 test. This is round 3 of 3, so per verify.md it goes to the user, not back into another build loop.

Everything round 2 ranked is closed: gap 1 has a check (C80) that holds the SVG's presence on all 15 routes, with the stroke caveat above; gap 2 (`faltaBaixar`, the scroll destination) is met at both levels; gap 3 (unit `Proof:` lines) is fixed in checks.md.
