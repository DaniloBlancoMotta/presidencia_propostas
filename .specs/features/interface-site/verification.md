# Interface do site - verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: f54d5f3..HEAD (HEAD = 28cd9d8); fix diff 6e6dcf0..28cd9d8 (c6442e1, 9b06ab4, e829ae3, 28cd9d8; 9486214 is the owner's theme approval)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope: proofs re-run in full at 28cd9d8; step 1 re-done for the screens the fix touched (`/`, `/tema/<id>`, `/semelhancas`, `/diferencas`, footer of every route, `/chat/conversa` through the shared `Cabeca`); citations refreshed in every file the fix touched; every round-1 non-PASS verdict re-judged; Coverage rows whose authority the fix touched recomputed; faults re-injected on the touched and created surfaces. Everything else says `carried from 2529684`.

Run A, the proofs at HEAD on the real tree, was one invocation: `DOCK_NOME=verif WD=web SAIDAS="web/test-results" ./dock.sh web '...'` running `npx tsc --noEmit`, `npm run build:teste`, `npx vitest run --reporter=verbose`, `npx playwright test --reporter=list` (all four projects), `npm run orcamento`, `npm run lighthouse`, the C76 `fc-match` command and `npm run build` (production). Every named test appears on its own line in that log with ✓, including each `Cn:` title cited below, and every unit title `C19:`, `C20:`, `C26:`, `C28:`, `C29:`, `C31:`, `C74:`.

Faults ran in `git worktree add <scratchpad>/r2/wt-mut HEAD`, through that worktree's own `dock.sh` with `DOCK_NOME=mut`. The real tree's `git status --porcelain` was empty before (recorded to a file) and empty after `git worktree remove --force`; the two snapshots were compared with `cmp` (identical).

## Binding sources

Verified at 28cd9d8 for the touched screens; the rest carried from 2529684.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.specs/plano-final.md` §6 Telas, CELULAR `/` (lines 202-219) | yes - re-read lines 198-249 at 28cd9d8 | none | - . Round-1 items closed: title text now asserted (`web/e2e/interface-inicio.spec.ts:230`, `"H1:Compare os planos de governo"`); nothing before the `h1` (`:126`, the kicker is gone from `web/src/paginas.tsx:104`); the aviso is the block right after the `h1` (`:128`) and the opening text comes after it (`:130`, `paginas.tsx:55`); "Temas" and "Aviso" are owner-kept and asserted by C79 (`:230`, `:218`); the footer separators render (`web/src/App.tsx:226-229`) and are asserted by C17 (`:166-171`) |
| `.specs/plano-final.md` §6 Telas, CELULAR `/tema/saude` (lines 203-220) | yes - re-read at 28cd9d8 | none. The description and the `.atualizacao` line sit after the aviso and before the controls (`paginas.tsx:230-235`); C16 as rewritten at 6e6dcf0 orders them there explicitly and crit. 74 requires the line, so the §6 sequence title, aviso, content holds | The "←" of "← Saúde" is drawn, but the `SetaVoltar` SVG inside `a.voltar` (`web/src/paginas.tsx:61-67`, `web/src/icones.tsx:39`) still has no presence assertion on any route that carries it. Search of `web/e2e` for `voltar`, `seta` and `svg` near the back link: only `interface-inicio.spec.ts:105`, `:117`, `:127` (link count), `:138` (accessible name), `interface-acabamento.spec.ts:108` (height, which `.voltar { width: 44px; height: 44px }` at `web/src/estilo.css:92` keeps without the SVG) and `interface-cotejo.spec.ts:260` (name without arrow). Round-1 ranked gap 4 named this; the fix did not close it |
| `.specs/plano-final.md` §6 `/semelhancas`, `/diferencas` (Rotas table, line 230) and crit. 58 | yes | none | - . The `/semelhancas` title glyph now renders (`paginas.tsx:367`) and is asserted (`web/e2e/interface-cores.spec.ts:185-188`) |
| `.specs/plano-final.md` §6 DESKTOP note (line 221) | carried from 2529684 | none | - |
| `.specs/plano-final.md` §6 Rotas e guardas de build (lines 224-234) | carried from 2529684 | none | - |
| `.specs/plano-final.md` §7 AC 16-37 (lines 277-306) | yes - re-read AC 28 and AC 34 at 28cd9d8 | none (AC 28 aviso text exact, `interface-inicio.spec.ts:218`; AC 34 Lighthouse, run A) | - |
| `.specs/plano-final.md` §2 decisions 12, 13, 14, 22, as amended in plan.md | carried from 2529684 | none | - |
| plan.md Assumptions dated 25/10/2026 (plan.md:280-281): gzip and six adjusted tests ratified, the seventh made exact again; kicker removed; "Temas", "O que cada plano propõe", "Aviso" kept | yes | none - matches C72 (`web/e2e/navegacao.spec.ts:89`) and C79 | - |

## Checks

Proof run "A" = run A at 28cd9d8. Citations in files the fix touched are refreshed; evidence in untouched files (`interface-tema.spec.ts`, `interface-cotejo.spec.ts`, `transparencia.spec.ts`, `geo.spec.ts`, `a11y.spec.ts`, `lighthouse.mjs`, `orcamento.mjs`, `docker/web.Dockerfile`) is carried from 2529684 with the proof re-run green in A.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Pre-JS tab and panel of the drawn order; hydration does not swap | A: e2e `C1:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:51` - ``await expect(q.locator(`.painel[data-cand="${primeiro}"]`)).toBeVisible()``; `:74` - `expect(await visiveis()).toEqual([primeiro])` | PASS |
| C2 | Section counts in all 8 themes | A: e2e `C2:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:86-88` - ``toBe(`Omissões (${c.omissoes.length})`)``; `:80` - `toHaveLength(8)` | PASS |
| C3 | Filled SVG triangle right of text, 0°/90° | A: e2e `C3:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:121` - `expect(d.lista).toBe("none")`; `:134` - `.toBe(90)` | PASS |
| C4 | 390 px: name only on the tab; h3 at most 1×1 px | A: e2e `C4:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:147`; `:149-150` - `toBeLessThanOrEqual(1)` | PASS |
| C5 | Control DOM order; filters share a top at 390 px | A: e2e `C5:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:158` - `expect(noDom).toEqual(rotulos)`; `:162` | PASS |
| C6 | Omissions in current order | A: e2e `C6:` ✓, vitest `C6:` ✓ | `web/e2e/interface-tema.spec.ts:172` (carried); `web/tests/interface.test.ts:89` - `expect(textos(ordenarOmissoes(misturadas, ["flavio-bolsonaro", "lula"]))).toEqual(["f1", "f2", "l1", "l2"])` | PASS |
| C7 | Trocar reverses omission groups | A: e2e `C7:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:192` | PASS |
| C8 | h3/h3/h4 names; no skipped level | A: e2e `C8:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:209`; `:218` | PASS |
| C9 | No `region` inside lists | A: e2e `C9:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:227` - `toHaveCount(0)` | PASS |
| C10 | All quotes; one origin and one Ver no PDF per group | A: e2e `C10:` ✓, vitest `C10:` ✓ | `web/e2e/interface-tema.spec.ts:256-257` (carried); `web/tests/interface.test.ts:102` - `expect(forma([c("a.pdf", 3, "x"), c("a.pdf", 4, "y")])).toEqual([["x"], ["y"]])` | PASS |
| C11 | Tablist at top 0 after 1,500 px | A: e2e `C11:` ✓ | carried from 2529684: `web/e2e/interface-tema.spec.ts:273` | PASS |
| C12 | Exact opening text, both orders | A: e2e `C12:` ✓ | `web/e2e/interface-inicio.spec.ts:36` - ``expect(normal(texto)).toBe(`Planos de governo de ${a} e ${b}, ...`)`` (line unchanged) | PASS |
| C13 | Highlights split one row; themes 4 + 4 | A: e2e `C13:` ✓ | `web/e2e/interface-inicio.spec.ts:49-50`; `:53` - `toEqual([4, 4])` | PASS |
| C14 | 390 / 339 / 160 px layouts | A: e2e `C14:` ✓ | `web/e2e/interface-inicio.spec.ts:60` - `toEqual([2, 2, 2, 2])`; `:69` - `not.toBe("auto")`; `:78` - `expect(sw).toBeLessThanOrEqual(cw)` | PASS |
| C15 | Cards in a row share a height | A: e2e `C15:` ✓ | `web/e2e/interface-inicio.spec.ts:86` - `toBeLessThanOrEqual(1)` | PASS |
| C16 | Nothing before the h1 but the back link; aviso is the block right after the h1; opening, description, update line, controls and lists after the aviso; no brand bar; back link names | A: e2e `C16:` ✓; fault M4 killed | `web/e2e/interface-inicio.spec.ts:126` - `expect(r.antesDoH1, rota).toEqual([])`; `:128` - `expect(r.entre, rota).toEqual([])`; `:129-130` - `expect(r.conteudo, rota).toBeGreaterThan(0)`, `expect(r.conteudoAntesDoAviso, rota).toEqual([])`; `:135-136` - "Chat por tema" / `"/chat"`; `:138-139` - `toHaveAccessibleName("Todos os temas")`, `toBe("/")` | PASS |
| C17 | Footer links in order, separated by "·", before the collection date; page h1s | A: e2e `C17:` ✓ | `web/e2e/interface-inicio.spec.ts:151` - ``toEqual(["a:Chat por tema", "a:Metodologia", "a:Sobre", `p:Documentos coletados do TSE em ${dataColeta()}`])``; `:166` - `expect(grupo.texto, rota).toBe("Chat por tema · Metodologia · Sobre")`; `:167-171` - two visible "·" between the links; `:174`, `:176` - `toHaveText("Metodologia")`, `toHaveText("Sobre")` | PASS |
| C18 | Viewer bar sticky only at 1366×900 | A: e2e `C18:` ✓ | `web/e2e/interface-visualizador.spec.ts:45-46` (line unchanged) | PASS |
| C19 | Two taps during the draw end on page 28 | A: e2e `C19:` ✓, vitest `C19:` ✓ | `web/e2e/interface-visualizador.spec.ts:72` - ``toHaveText(`Página 28 de ${total}`)``; `:74` - `expect(desenhos.at(-1)).toBe("28")`; `web/tests/interface.test.ts:191-193` - `expect(comecados).toEqual([26, 28])`, `expect(terminados).toEqual([28])`, `expect(cancelados).toBe(3)` | PASS |
| C20 | At first or last page focus moves to the other button | A: e2e `C20:` ✓, vitest `C20:` ✓ | `web/e2e/interface-visualizador.spec.ts:88-89`, `:95-96` - `toBeDisabled()`, `toBeFocused()`; `web/tests/interface.test.ts:201-202` - `toEqual({ desabilitado: { anterior: true, proxima: false }, foco: "proxima" })` and the reverse; `:204-206` - `foco` null otherwise | PASS |
| C21 | Paging disabled, Baixar hidden while loading | A: e2e `C21:` ✓ | `web/e2e/interface-visualizador.spec.ts:109-111` (line unchanged) | PASS |
| C22 | Unknown file / aborted download alert | A: e2e `C22:` ✓ | `web/e2e/interface-visualizador.spec.ts:124-126` (line unchanged) | PASS |
| C23 | One h1; one aria-live "Página N de M" | A: e2e `C23:` ✓ | `web/e2e/interface-visualizador.spec.ts:135-138` (line unchanged) | PASS |
| C24 | document.title | A: e2e `C24:` ✓ | `web/e2e/interface-visualizador.spec.ts:147` (line unchanged) | PASS |
| C25 | 1:1.414 reserved before the PDF | A: e2e `C25:` ✓ | `web/e2e/interface-visualizador.spec.ts:158` (line unchanged) | PASS |
| C26 | Redrawn at the new width within 300 ms | A: e2e `C26:` ✓, vitest `C26:` ✓; fault M1 (= round-1 F1) killed at both levels | `web/e2e/interface-visualizador.spec.ts:173` - `expect(largo).not.toBe(bitmap)`; `:176` - CSS width within 1 px; `:177` - `expect(await page.locator("#tela").evaluate((c) => (c as HTMLCanvasElement).width)).toBe(bitmap)` (the drawn bitmap, which only a redraw changes); `web/tests/interface.test.ts:210-212` - `redesenharNaLargura` true for a new width, false for the same | PASS |
| C27 | Tabular digits; buttons do not move 9 -> 10 | A: e2e `C27:` ✓ | `web/e2e/interface-visualizador.spec.ts:184-185`; `:194-195` - `toBeLessThanOrEqual(0.5)` | PASS |
| C28 | Skip link and `#g-` link focus the target, no history entry, no fetch | A: e2e `C28:` ✓, vitest `C28:` ✓ | `web/e2e/interface-historico.spec.ts:26-27` - `toBeFocused()`, `toBe(antes)`; `:29` - `expect(buscas).toEqual([])` (counted from the opening of `/`, so it now covers the skip link); `:36-37`, `:39` - the same for `#g-saude`; `web/tests/interface.test.ts:159-164` - `ancoraDaPagina` true only for same path and same search with a hash | PASS |
| C29 | Back restores `scrollY` within 2 px | A: e2e `C29:` ✓, vitest `C29:` ✓ | `web/e2e/interface-historico.spec.ts:55` - `toBeLessThanOrEqual(2)`; `web/tests/interface.test.ts:147` - `expect(rolagemDoEstado(pilha[1])).toBe(0)`; `:149` - `.toBe(6025)`; `:151` - other state kept | PASS |
| C30 | aria-busy and "Carregando…" while loading, cleared afterwards | A: e2e `C30:` ✓ | `web/e2e/interface-historico.spec.ts:63` - `toHaveAttribute("aria-busy", "true")`; `:64` - `toHaveText("Carregando…")`; `:66-67` - cleared | PASS |
| C31 | Last destination wins, exactly one history entry | A: e2e `C31:` ✓, vitest `C31:` ✓; fault M3 killed at both levels | `web/e2e/interface-historico.spec.ts:79` - `toHaveURL(/\/tema\/educacao$/)`; `:81` - `expect(await historico(page)).toBe(antes + 1)`; `web/tests/interface.test.ts:134-135` - `expect(vez.vale(saude)).toBe(false)`, `expect(vez.vale(educacao)).toBe(true)` | PASS |
| C32 | Filters in the URL, no history entry | A: e2e `C32:` ✓, vitest `C32:` ✓ | `web/e2e/interface-historico.spec.ts:89`, `:93-94`; `web/tests/interface.test.ts:114` - `expect(urlComFiltro("/tema/saude", "tudo")).toBe("/tema/saude")` | PASS |
| C33 | `?filtro` opens pressed and applied; 200 | A: e2e `C33:` ✓ | `web/e2e/interface-historico.spec.ts:99-100`; `:105` - `toEqual(["diferencas", "omissoes"])`; `:107` - `toBe(200)` | PASS |
| C34 | Unknown `?filtro` -> Mostrar tudo | A: e2e `C34:` ✓, vitest `C34:` ✓ | `web/e2e/interface-historico.spec.ts:115`; `web/tests/interface.test.ts:122` - `expect(filtroDaUrl("?filtro=xyz")).toBe("tudo")` | PASS |
| C35 | Status announces who comes first | A: e2e `C35:` ✓ | `web/e2e/interface-historico.spec.ts:125`, `:127` | PASS |
| C36 | Index of themes with counts; anchor lands at 0-64 px | A: e2e `C36:` ✓ | `web/e2e/interface-historico.spec.ts:144-145`; `:149-150`; `:154` - `toBe(200)` | PASS |
| C37 | `/diferencas` h3 counts; no "Diferença" seal | A: e2e `C37:` ✓ | `web/e2e/interface-historico.spec.ts:164`; `:167` | PASS |
| C38 | `/sobre` cards in current order, side by side | A: e2e `C38:` ✓ | `web/e2e/interface-historico.spec.ts:179`; `:181-183` | PASS |
| C39 | No tabpanel at 1024 px; no ARIA ref to hidden | A: e2e `C39:` ✓ | `web/e2e/interface-historico.spec.ts:190`; `:203` | PASS |
| C40 | Hover to a token on 6 controls; `:hover` only `var()` | A: e2e `C40:` ✓, vitest `C40:` ✓ | `web/e2e/interface-acabamento.spec.ts:23-24` (line unchanged); `web/tests/interface.test.ts:224` - `toBeNull()`; `:229` - `toMatch(/var\(--[\w-]+\)/)` | PASS |
| C41 | touch-action, tap highlight, `:active` | A: e2e `C41:` ✓ | `web/e2e/interface-acabamento.spec.ts:70-73`, `:95` (line unchanged) | PASS |
| C42 | Navigation links at least 44 px | A: e2e `C42:` ✓ | `web/e2e/interface-acabamento.spec.ts:104` (line unchanged) | PASS |
| C43 | Running text at most 68ch | A: e2e `C43:` ✓ | `web/e2e/interface-acabamento.spec.ts:138` (line unchanged) | PASS |
| C44 | Aviso band spans the window; content at the h1's x | A: e2e `C44:` ✓ | `web/e2e/interface-acabamento.spec.ts:147`, `:150` (line unchanged) | PASS |
| C45 | Footer at the window bottom on a short page | A: e2e `C45:` ✓ | `web/e2e/interface-acabamento.spec.ts:157` (line unchanged) | PASS |
| C46 | balance on headings, pretty on running text; NBSP places | A: e2e `C46:` ✓ | `web/e2e/interface-acabamento.spec.ts:173` - `toContain("balance")`; `:196-197` - `expect(estilos.length, rota).toBeGreaterThan(0)` and `expect(p, rota).toContain("pretty")` over `.abertura` of `/` and `main p` of `/metodologia` and `/sobre` (`:184-188`), the running text crit. 43 names; `:177`, `:180`, `:182` - the three NBSP places | PASS |
| C47 | Omission seal text | A: e2e `C47:` ✓ | `web/e2e/interface-acabamento.spec.ts:207` - ``toBe(`Omissão · só no plano de ${...}`)`` | PASS |
| C48 | theme-color, favicon, no `/favicon.ico` | A: e2e `C48:` ✓ | `web/e2e/interface-acabamento.spec.ts:221-222`; `:225-227` - `toBe(200)`, `image/svg+xml`, `expect(ico).toEqual([])` | PASS |
| C49 | Permissions-Policy without interest-cohort | A: e2e `C49:` ✓ | `web/e2e/interface-acabamento.spec.ts:234`, `:237` | PASS |
| C50 | `$&`, `$'`, `$$` verbatim | A: vitest `C50:` ✓ | `web/tests/interface.test.ts:285` - ``expect(texto(app)).toContain(`Custa ${s} por mês.`)``; `:287-289` | PASS |
| C51 | Colour literals only in tokens.css | A: vitest `C51:` ✓ | `web/tests/interface.test.ts:241` - `expect(literais, arquivo).toEqual([])`; `:243-244` | PASS |
| C52 | pdf.js text layer, selectable, has the quote | A: e2e `C52:` ✓ | `web/e2e/interface-visualizador.spec.ts:205`; `:207` - `not.toBe("none")`; `:211` - `toContain(cinco)` | PASS |
| C53 | Exact candidate, green and tone tokens | A: vitest `C53:` ✓ | `web/tests/interface.test.ts:50` - `expect(tokens).toMatchObject({ "cand-lula": "#ee481a", ... })` | PASS |
| C54 | Candidate tone places with 6 px and 4 px bands | A: e2e `C54:` ✓ | `web/e2e/interface-cores.spec.ts:50-52`, `:56`, `:61-63`, `:71-74` (lines unchanged) | PASS |
| C55 | Full colour never on text; 3 px side rule; square; on the 5 routes | A: e2e `C55:` ✓; fault M2 (= round-1 F5) killed | `web/e2e/interface-cores.spec.ts:94` - `expect(emTexto, rota).toEqual([])`; `:104-105` - square; `:108-116` - for `/tema/saude`, `/semelhancas`, `/diferencas`: `expect(l.topo, rota).toBe("3px")`, ``expect(l.corTopo, rota).toBe(await token(page, `cand-${l.cand}`))`` | PASS |
| C56 | Contrast thresholds; tightest pair 3.05:1 | A: vitest `C56:` ✓ | `web/tests/interface.test.ts:66`, `:68`; `:70` - `toBeLessThanOrEqual(0.02)` | PASS |
| C57 | Colours stay with their candidate | A: e2e `C57:` ✓ | `web/e2e/interface-cores.spec.ts:139` - `expect(errados, ...).toEqual([])`; `:142` | PASS |
| C58 | Green concordance incl. `/semelhancas` title glyph; graphite difference | A: e2e `C58:` ✓ | `web/e2e/interface-cores.spec.ts:158`; `:162-165`; `:168-170`; `:179-181`; `:185` - `toHaveCount(1)`; `:186` - `toBe("M5 9h14M5 15h14")`; `:187-188` - colour equals the green token and `"rgb(47, 122, 85)"` | PASS |
| C59 | Viewer bar band in the PDF's colour | A: e2e `C59:` ✓ | `web/e2e/interface-visualizador.spec.ts:31-32` (line unchanged) | PASS |
| C60 | Fonts from `/fontes/`, swap, one preload, 5.3.0 | A: e2e `C60:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:23-25`, `:27`, `:34-35`, `:38-39` | PASS |
| C61 | Neutral tokens in OKLCH; no `#fff`/`#000` | A: vitest `C61:` ✓ | `web/tests/interface.test.ts:248` - `toMatchObject({ papel: "oklch(97.6% 0.008 85)", ... })`; `:254` - `toBeNull()` | PASS |
| C62 | No shadow, gradient, thick side border; rule widths | A: e2e `C62:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:67-70` | PASS |
| C63 | Only 13/15/17/21 px plus h1 36-60 px | A: e2e `C63:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:98` - ``toEqual([])`` | PASS |
| C64 | Item numbers; quotes in Newsreader italic | A: e2e `C64:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:119-120`, `:135-138` | PASS |
| C65 | "=" green, "≠" graphite, SVG | A: e2e `C65:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:159-160` | PASS |
| C66 | 260 ms opacity/transform; open-on-load does not animate | A: e2e `C66:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:172`, `:188`, `:201` | PASS |
| C67 | Reduced motion: nothing animates | A: e2e `C67:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:211`, `:217` | PASS |
| C68 | Segmented filters; Trocar text button; labels | A: e2e `C68:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:227`, `:230-231`, `:244` | PASS |
| C69 | No arrows or triangles in text; names without arrow | A: e2e `C69:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:253`, `:259-260` | PASS |
| C70 | Hyphenation rules | A: e2e `C70:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:269`, `:277` | PASS |
| C71 | `role="list"`; numbers aria-hidden | A: e2e `C71:` ✓ | carried from 2529684: `web/e2e/interface-cotejo.spec.ts:292-293` | PASS |
| C72 | Regression suites green, no assertion loosened, existing tests changed only at the listed points (as ratified on 25/10/2026, plan.md:280) | A: Playwright 144/144 (a11y 19, navegacao 7+7, ordem 4, pdf 1+1+1, transparencia 7), vitest 53/53, orcamento ok, lighthouse ok | `web/e2e/navegacao.spec.ts:89` - `await expect.poll(() => sec.locator(".texto-item").allTextContents()).toEqual(esperados)`, exact again (no whitespace normalization); `web/scripts/lighthouse.mjs:33` - `const ok = perf >= 90 && a11y >= 90 && lcp < 2.0;` (`/` 99/100, LCP 1.58 s; `/tema/saude` 100/100, LCP 1.65 s); `web/scripts/orcamento.mjs:19` (53.0 KB); `web/e2e/a11y.spec.ts:13` - axe `toEqual([])`. The six other adjusted old tests and the gzip in `servir.mjs` are owner-ratified (plan.md:280) | PASS |
| C73 | Same component, classes and styles for both candidates | A: e2e `neutro` ✓ | carried from 2529684: `web/e2e/transparencia.spec.ts:67`, `:115` | PASS |
| C74 | `.atualizacao` datetime, title, canonical, JSON-LD kept; with `url` the build writes an absolute canonical on every route but the 404 | A: `geo.spec.ts` 3 ✓, `seo.test.ts` 5 ✓, vitest `C74:` ✓; fault M5 killed | `web/e2e/geo.spec.ts:27` - `toHaveAttribute("datetime", pagina.dateModified)`; `:23` (carried); `web/tests/interface.test.ts:316` - `expect(r.status, r.stderr).toBe(0)`; `:329` - `expect(canonicos(arquivo), arquivo).toEqual([url])` over 8 routes with `https://comparador.exemplo/...`; `:330` - `expect(canonicos("404.html")).toEqual([])` | PASS |
| C75 | Chat direction; chat/ask suites green; Chat por tema button outside the grid | A: `chat.spec.ts` 11 desktop + 11 android ✓, `ask.spec.ts` 3 ✓, e2e `C75:` ✓ | `web/e2e/interface-inicio.spec.ts:182` - `toHaveCount(1)`; `:185` - `closest('nav[aria-label="Temas"]')` is `false` | PASS |
| C76 | fc-match resolves to LiberationSans-Bold | A: printed `LiberationSans-Bold.ttf: "Liberation Sans" "Bold"` twice; `RC C76=0` | carried from 2529684: `docker/web.Dockerfile:5` | PASS |
| C77 | Unknown theme and route answer 404 with a link to `/` | A: e2e `404: tema inexistente` ✓ (desktop, android) | `web/e2e/navegacao.spec.ts:111` - `expect(r?.status()).toBe(404)`; `:113` - `toHaveAttribute("href", "/")` | PASS |
| C78 | Trocar ordem present on the 8 themes, `/semelhancas`, `/diferencas`, `/sobre`; absent from `/`, `/metodologia`, 404 and the viewer | A: e2e `C78:` ✓ | `web/e2e/interface-inicio.spec.ts:191` - `expect(publicados).toHaveLength(8)`; `:196-197` - `toHaveCount(1)`, `toBeVisible()`; `:199-200` - `toHaveCount(0)` and `button.trocar` count `0` | PASS |
| C79 | Owner-kept additions only: h2 "Temas", h2 "O que cada plano propõe", label "Aviso" outside the exact aviso text | A: e2e `C79:` ✓ | `web/e2e/interface-inicio.spec.ts:218` - `toEqual({ rotulos: ["Aviso"], fora: true, texto: AVISO })` on every site route; `:230` - `toEqual(["H1:Compare os planos de governo", "SPAN.rotulo:Aviso", "H2.rotulo:Temas"])`; `:238` - "Temas" right before the 8-item grid; `:251` - `expect(fora, rota).toEqual([])` on each theme; `:260` - the h2 precedes tabs and columns | PASS |

**Do the new pure modules change behaviour?** Read against the code they replaced (`git diff 6e6dcf0..HEAD -- web/src`): `criarVez` (`web/src/navegacao.ts:4-10`) keeps the old `++ultima` / `n === ultima` semantics, held in `useState(criarVez)` instead of `useRef(0)`, created once; `ancoraDaPagina` (`:27-29`) is the old condition verbatim; `filaDeDesenho`, `botoesDaPagina` and `redesenharNaLargura` (`web/src/paginacao.ts:7-41`) reproduce the old `pedir` loop, focus hand-off and width test (`botoes` still reads `document.activeElement` before disabling). The only differences are in `estadosAoEmpilhar` and `rolagemDoEstado` (`navegacao.ts:14-23`): a non-object `history.state` is dropped instead of spread, and a non-number `y` reads as 0 instead of passing through. `App` only ever writes `{ y: number }` objects or `null`, so neither branch can be reached. No observable behaviour change; all e2e proofs on these paths are green.

## Coverage

Verified at 28cd9d8 for the rows the fix touched; the others carried from 2529684.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Surface `GET /tema/<id>?filtro` statuses (2) | carried from 2529684 (plan.md Surface) | 200 -> C33 `interface-historico.spec.ts:107`; 404 -> C77 `navegacao.spec.ts:111` | - |
| `?filtro` values (4) | carried from 2529684 | C32, C33, C34 e2e; unit `tests/interface.test.ts:112-124` | - |
| Surface `#g-<id>` statuses (1) | carried from 2529684 | 200 -> C36 `interface-historico.spec.ts:154` | - |
| Landing doors (4) | carried from 2529684 | C32, C36, C53/C73/C62, C60 | - |
| Published themes (8) | carried from 2529684 | C2, C10, and now C78 (`interface-inicio.spec.ts:189-191`) and C79 (`:241`) loop all 8 | - |
| Draw orders (2) | carried from 2529684 | C1, C6, C12, C38, C57 | - |
| Routes (10) | carried from 2529684 | the 9 site routes -> C16, C17, C63, C71, C79 (aviso label); all 10 -> C48, C69 | - |
| Screen arrangement per §6, `/` (title, aviso, opening, highlights, "Temas", themes, footer) | §6 drawing plus plan.md:281 | nothing before `h1` -> C16 `:126`; aviso right after -> C16 `:128`; content after aviso -> C16 `:130`; title text, "Aviso", "Temas" -> C79 `:230`, `:238`; footer order and "·" -> C17 `:151`, `:166-171` | - |
| Screen arrangement per §6, `/tema/<id>` ("← Saúde", aviso, controls, "O que cada plano propõe", tabs, sections) | §6 drawing plus plan.md:281 | aviso right after `h1` -> C16; controls order -> C5; h2 before tabs and columns -> C79 `:260`; section titles -> C2; "Todos os temas" name -> C16 `:138` | the drawn "←" SVG of the back link (`paginas.tsx:61-67`); no assertion found |
| Footer separators (2) | §6 "Metodologia · Sobre" | both "·" visible and between links -> C17 `:167-171` | - |
| Running text with `text-wrap: pretty` (3) | plan crit. 46 with crit. 43's running text | opening text of `/`, `/metodologia`, `/sobre` -> C46 `interface-acabamento.spec.ts:184-197` | - |
| NBSP places (3) | carried from 2529684 | C46 `:177`, `:180`, `:182` | - |
| Full-colour places on C55's routes (4) | plan crit. 55 | bands -> C54; 3 px side rule on `/tema/saude`, `/semelhancas`, `/diferencas` -> C55 `:108-116` (M2 killed); square -> C55 `:104-105`; quote mark -> C64 | - |
| Green "=" glyph places (3) | plan crit. 58 and 65 | `/` highlight -> C58 `:158`; theme h2 -> C58 `:165`; `/semelhancas` title -> C58 `:185-188` | - |
| "Trocar ordem" placement (8) | plan.md:277 | present on themes, `/semelhancas`, `/diferencas`, `/sobre`; absent from `/`, `/metodologia`, 404, viewer -> C78 `interface-inicio.spec.ts:196-200` | - |
| Owner-kept §6 additions (3) plus removed kicker (1) | plan.md:281 | "Temas", "O que cada plano propõe", "Aviso" -> C79; kicker absent -> C16 `:126`, C79 `:230` | - |
| C74 GEO members (4) | plan crit. 74 | `.atualizacao` -> `geo.spec.ts:27`; `<title>` -> `geo.spec.ts:23`; JSON-LD -> `geo.spec.ts:19-22`, `seo.test.ts`; canonical -> `tests/interface.test.ts:329-330` (M5 killed) | - |
| C28 cases (2 triggers × 3 properties) | C28's claim | focus, history, no fetch for the skip link -> `interface-historico.spec.ts:26-29`; for the `#g-` link -> `:36-39` | - |
| Decision rows of the extracted pure functions | `web/src/navegacao.ts`, `web/src/paginacao.ts` | latest wins (2) -> `interface.test.ts:134-138`; scroll stored / restored / missing (4) -> `:147-154`; same-page anchor (6) -> `:159-164`; draw queue (latest wins, single) -> `:191-197`; focus hand-off (5) -> `:201-206`; width redraw (3) -> `:210-212` | - |
| Startup: build outputs with CSS, tokens, fonts (3) | the assembly: `web/scripts/build.ts` (`OUT_DIR`, `SITE_YAML` at `:53`) | `dist-teste` -> C60; `dist-previa` -> `ask.spec.ts`; `dist` -> `npm run build` exit 0 in run A ("build ok em /app/web/dist: 8 temas publicados") now that `revisao/aprovados.yaml` exists | - |
| Other carried rows (viewer failures 2, hover controls 6, 44 px links 4, 68ch text 3, S7 tokens 9, neutral tokens 4, tone places 3, text sizes 5, glyphs 5) | carried from 2529684 | as in round 1 | - |

## Test policy rows

Verified at 28cd9d8.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decide, alcançado pelo navegador | `web/src/rotas.ts`, `web/src/Citado.tsx`, and now (checks.md:386-387) client navigation in `web/src/App.tsx` "(C28-C31)" and viewer paging in `web/src/visualizador.ts` "(C19, C20, C26)", through `web/src/navegacao.ts` and `web/src/paginacao.ts` | e2e and unit, one unit case per decision-table row | no. Met for the six named decisions: unit proofs `C19:`, `C20:`, `C26:`, `C28:`, `C29:`, `C31:` exist, ran in A, cover each decision-table row, and M1 and M3 were killed at both levels. Unmet for `faltaBaixar` (`web/src/App.tsx:68-71`), the decision behind C30, which sits inside the row's own "C28-C31": three branches (chat not loaded; a theme JSON missing; everything cached), no unit proof, and e2e C30 exercises only the "theme missing" branch. The restore step of "a rolagem é guardada e devolvida" (`App.tsx:153-158`, anchor in the URL with y = 0 versus `scrollTo(y)`) also has no unit case. Separately, the six unit proofs exist but checks.md gives C19, C20, C26, C28, C29 and C31 no unit `Proof:` line, unlike C6, C10, C32 and C34, so a run of those checks' own proofs never reaches the unit level |
| Decide, sem fronteira | `tokens.css` contrast (C56); `build.ts` placeholder substitution (C50) and canonical per route (C74, command level) | unit | yes - `tests/interface.test.ts:66-70`, `:285`, `:329-330`; M5 killed |
| Apresentação | `estilo.css`, `tokens.css`, `visualizador.css`; markup in `paginas.tsx`, `App.tsx` footer, `Citado.tsx`, `icones.tsx` | e2e on the computed style or DOM, at the widths and routes the check names | yes - the round-1 misses are closed: C55 side rule on all three routes (`interface-cores.spec.ts:108-116`, M2 killed), C46 `pretty` on the named running text (`interface-acabamento.spec.ts:184-197`); the new markup has e2e proofs: C16 order (M4 killed), C17 separators, C58 title glyph, C78, C79 |
| Repasse, instrumentação | `web/scripts/servir.mjs` (gzip, owner-ratified), `docker/web.Dockerfile`, `web/e2e/interface-apoio.ts`, the `SITE_YAML` override in `build.ts:53` | none of its own | yes - `servir.mjs` exercised by every e2e and by Lighthouse; `SITE_YAML` by the C74 unit test; Dockerfile by C76 |

## Faults injected

Verified at 28cd9d8, each in the worktree and reverted with `git -C <wt> checkout -- web` before the next. Cap of 5 reached. Not mutated this round: the C17 separators, the C58 title glyph, C78, C79, C46, the C28 skip-link fetch assertion, and the `filaDeDesenho` and `botoesDaPagina` paths of `paginacao.ts`.

| Mutation | Location | Killed |
| --- | --- | --- |
| M1 = round-1 F1, re-injected in the extracted module: no width redraws (`return atual !== desenhada;` -> `return false;`) | `web/src/paginacao.ts:40` | yes - unit `tests/interface.test.ts:210` ("expected false to be true") and e2e `interface-visualizador.spec.ts:177` (bitmap 900 instead of 584) both failed |
| M2 = round-1 F5: cross-view sides lose the candidate colour (`.grupo-sem .lado, .grupo-dif .lado { border-top-color: var(--fio); }` added) | `web/src/estilo.css:461` (rule inserted after it) | yes - e2e C55 failed at `interface-cores.spec.ts:115` (expected `rgb(238, 72, 26)`, received `oklch(0.84 0.013 85)`) |
| M3: an older navigation still counts (`n === ultima` -> `n <= ultima`) | `web/src/navegacao.ts:8` | yes - unit `tests/interface.test.ts:134` and e2e C31 `interface-historico.spec.ts:81` (history 4 instead of 3) both failed |
| M4: the route's top content goes back before the aviso (`.sob-aviso` moved between `</header>` and `.faixa-aviso`) | `web/src/paginas.tsx:47`, `:55` | yes - e2e C16 failed at `interface-inicio.spec.ts:128` (`r.entre` not empty) |
| M5: the 404 also gets a canonical (`p.rota.tipo === "nao-encontrada" ? null :` removed) | `web/scripts/build.ts:129` | yes - unit C74 failed at `tests/interface.test.ts:330` (received `https://comparador.exemplo/404`) |

## Gate

Run A at 28cd9d8 (`DOCK_NOME=verif WD=web SAIDAS=web/test-results ./dock.sh web '...'`):

- `npx tsc --noEmit`: exit 0.
- `npm run build:teste`: exit 0.
- `npx vitest run --reporter=verbose`: 53 passed, 0 failed (6 files).
- `npx playwright test --reporter=list`: 144 passed, 0 failed (desktop-chrome, android-chrome, ios-safari, previa-ask).
- `npm run orcamento`: ok, 53.0 KB gzip on `index.html` and `tema/saude/index.html`.
- `npm run lighthouse`: `/` performance 99, accessibility 100, LCP 1.58 s; `/tema/saude` performance 100, accessibility 100, LCP 1.65 s.
- `fc-match "system-ui:bold"` and `fc-match "sans-serif:bold"`: `LiberationSans-Bold.ttf`, exit 0.
- `npm run build` (production, real `revisao/aprovados.yaml` from 9486214): exit 0, "build ok em /app/web/dist: 8 temas publicados".

Note: the owner's Assumption (plan.md:280) still asks for one Lighthouse run on a Cloudflare Pages preview before release; that is outside this gate.

## Ranked gaps

1. Binding source §6, `/tema/saude` "← Saúde": the drawn "←" (the `SetaVoltar` SVG in `a.voltar`, `web/src/paginas.tsx:61-67`) has no presence assertion on any route. `.voltar` is a fixed 44×44 box (`web/src/estilo.css:92`), so removing the SVG would leave an invisible back link and keep C16, C42 and C69 green. Round-1 ranked gap 4 named this, and the fix did not close it. No check covers it; it needs a check (for example, C16: `a.voltar` holds one visible `svg[aria-hidden="true"]`) and a proof.
2. Test policy "Decide, alcançado pelo navegador" is unmet for `faltaBaixar` (`web/src/App.tsx:68-71`), the C30 loading decision inside the row's own "C28-C31" range. It has three branches, no unit proof, and one branch covered by e2e. The restore branch at `App.tsx:153-158` (anchor versus stored y) also has no unit case.
3. Precision gap in checks.md (a checks fix, not a builder fix): C19, C20, C26, C28, C29 and C31 carry no `Proof: npx vitest run tests/interface.test.ts -t "Cn:"` line, although the Test policy Cost line counts 8 unit proofs and C6, C10, C32 and C34 carry theirs. The unit proofs exist (`web/tests/interface.test.ts:129-213`) and ran green in A, but the checks do not bind them.
