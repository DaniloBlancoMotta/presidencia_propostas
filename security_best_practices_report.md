# Relatório de segurança — Comparador de planos de governo 2026

Data: 18/10/2026 (achados) · atualizado 18/10/2026 (correções) · Branch: `feat/langgraph` · Escopo: `web/` (Vite + React 18 + pdf.js), `pipeline/` (Python 3.11 + LangGraph + Gemini), `docker/`, `dock.sh`, `.github/workflows/ci.yml`, `contrato/`, dados versionados.

**Status das correções:** S02, S08 e S01 (parcial, ver nota) já comitados nesta branch (`173339b`, `3efe517`, `12ffc5a`). S03 a S14 ficam como achados, sem código pendente — ver cada um.

Método: leitura de todo o código-fonte dos dois lados, do HTML gerado em `web/dist-teste`, do `_headers` gerado, varredura do histórico do git por chaves, `npm audit` e `pip-audit` executados dentro dos contêineres do projeto (nada instalado no host). Referências aplicadas: especificação React/TypeScript e JavaScript frontend da skill `security-best-practices`; para o pipeline Python (CLI, sem servidor web) não há referência específica na skill, e a análise usou prática geral (segredos, injeção de prompt, deserialização, caminhos de arquivo, cadeia de suprimentos).

## Resumo executivo

O site é estático, sem backend, sem cookie, sem script de terceiro e com CSP forte por hash. O React escapa todo texto, não há nenhum sink de DOM (`innerHTML`, `eval`, `document.write`, handler inline), o visualizador de PDF só abre dois arquivos de uma lista fixa, e o conteúdo só é publicado depois de passar por schema, checagem literal contra o PDF, juiz LLM com falha fechada e aprovação humana por SHA-256. **Nenhuma vulnerabilidade foi encontrada no código que vai ao navegador, e as dependências de produção (`react`, `react-dom`, `pdfjs-dist`) estão sem advisories (`npm audit --omit=dev`: 0).** Não há segredo no repositório nem no histórico.

O que precisava de ação estava na cadeia de suprimentos e no processo. **Já corrigido nesta branch:**

1. **A toolchain de desenvolvimento do site tinha 20 vulnerabilidades conhecidas**, todas em `devDependencies`. Corrigido em `12ffc5a` (bump sem major de 7 pacotes + imagem do Playwright); fecha os 7 CVEs originais. A cadeia transitiva do `tinypool`/`lighthouse` só fecha por completo com major (deferido — ver S01).
2. `pytest` 8.3.4 tinha um advisory (PYSEC-2026-1845). Corrigido em `173339b`.
3. Os `.replace()` do build do site interpretavam `$&`/`$'`/`$$` do conteúdo aprovado. Corrigido em `3efe517`.

**Segue pendente, fora do código** (decisão do dono, não deste relatório):

4. **O portão de publicação (hash em `revisao/aprovados.yaml`) não tem proteção de escrita verificável**: quem consegue criar uma tag publica em produção, e não há CODEOWNERS, ruleset de tag nem ambiente com revisor obrigatório. O repositório ainda não tem remoto configurado nesta máquina, então a proteção da branch não pôde ser conferida (S04) — configuração do GitHub, não um commit.

Achados por severidade (estado original, antes das correções): **Crítica: 0 · Alta: 1 · Média: 3 · Baixa: 6 · Informativa: 4.**

---

## Alta

### S01 — Toolchain do site com 20 vulnerabilidades conhecidas (todas em devDependencies) — CORRIGIDO PARCIALMENTE (`12ffc5a`)

- **Impacto em uma frase:** quem roda os testes ou o dev server numa máquina de desenvolvimento ou no CI executa código com RCE conhecido (`vitest`/`tinypool`) e com leitura arbitrária de arquivos pelo navegador (`vite`/`esbuild`); nada disso vai ao site publicado.
- **Local:** [web/package.json:22-36](web/package.json#L22-L36); imagem [docker/web.Dockerfile:1](docker/web.Dockerfile#L1) e [.github/workflows/ci.yml:27](.github/workflows/ci.yml#L27).
- **Evidência (`npm audit` em 18/10/2026, dentro do contêiner):** `{"low":2,"moderate":5,"high":11,"critical":2,"total":20}`; `npm audit --omit=dev`: `found 0 vulnerabilities`.

| Pacote (direto) | Versão | Severidade | Advisories principais | Correção (`fixAvailable`, sem major) |
|---|---|---|---|---|
| `vitest` | 2.1.8 | crítica | GHSA-9crc-q9x8-hgqq (RCE ao visitar site malicioso com o servidor de API do Vitest ouvindo, CVSS 9.6), GHSA-5xrq-8626-4rwp (CVSS 9.8), GHSA-82fw-gwwq-j7x9; arrasta `tinypool` (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr) | `vitest@2.1.9` |
| `vite` | 5.4.11 | alta | 12 advisories do dev server (`server.fs.deny` bypass, inclusive em Windows GHSA-fx2h-pf6j-xcff CVSS 7.5; GHSA-vg6x-rcgg-rjx6 CVSS 6.5) | `vite@5.4.21` |
| `tsx` | 4.19.2 | moderada | arrasta `esbuild` ≤ 0.24.2 (GHSA-67mh-4wv8-2f99: qualquer site lê respostas do dev server) | `tsx@4.23.15` |
| `@playwright/test` | 1.49.1 | alta | GHSA-7mvr-c777-76hp (baixa navegadores sem validar TLS) | `@playwright/test@1.64.1` + imagem `mcr.microsoft.com/playwright:v1.64.1-noble` |
| `lighthouse` | 12.2.1 | alta | `extract-zip` (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3, CVSS 8.1), `puppeteer-core`, `basic-ftp`, `cookie`, `@sentry/node` | `lighthouse@12.8.2` |
| `ajv` | 8.17.1 | moderada | GHSA-2g4f-4pwh-qvx6 (ReDoS só com a opção `$data`, que [web/scripts/guardas.ts:46](web/scripts/guardas.ts#L46) não usa) | `ajv@8.20.0` |
| `yaml` | 2.6.1 | moderada | GHSA-48c2-rrv3-qjmp (stack overflow com YAML muito aninhado; os YAML lidos são do próprio repositório) | `yaml@2.9.1` |

- **Exposição real neste projeto:** o CI roda `vitest run` (sem servidor de API/UI) e `vite build` (sem dev server) num contêiner descartável; o `dock.sh` faz o mesmo. Por isso as duas críticas não têm caminho de exploração no fluxo atual. Mesmo assim, qualquer `npx vite` ou `vitest --ui` numa máquina de desenvolvimento expõe os arquivos do projeto a qualquer site aberto no navegador.
- **Correção aplicada (`12ffc5a`):** as sete versões diretas subiram para a coluna de correção, lock regenerado com `npm install` dentro do contêiner, imagem do Playwright trocada para `v1.64.1-noble` em `docker/web.Dockerfile:1` e `ci.yml:27`. Bateria completa roda limpa: typecheck, 24/24 vitest, build:teste, orçamento de JS, Lighthouse mobile (`/` 100/100, `/tema/saude` 98/100) e e2e Playwright em todas as specs do escopo atual (pdf, navegacao, ordem, a11y, transparencia), em todos os perfis. `npm audit --omit=dev` continua em 0, antes e depois.

- **Achado durante a correção — o feed de advisories do npm mudou entre a auditoria inicial e a aplicação do fix.** A auditoria original (18/10, mais cedo no dia) dizia que `vitest@2.1.9`, `vite@5.4.21` e `lighthouse@12.8.2` fechavam tudo sem major. Depois de aplicar e reauditar, o mesmo `npm audit` (mesma máquina, poucas horas depois) já aponta 33 vulnerabilidades (22 média, 9 alta, 2 crítica) nas mesmas sete dependências, agora exigindo major para fechar por completo:

  | Pacote | Intervalo vulnerável agora | Correção completa (major) |
  |---|---|---|
  | `tinypool` (via `vitest`) | `<=2.1.1` — `vitest@2.1.9` resolve `tinypool@1.1.1`, que **continua** no intervalo | `vitest@5.0.5` |
  | `vite` | `<=6.4.2` (esbuild aninhado em `node_modules/vite/node_modules/esbuild@0.21.5`) | `vite@8.3.4` |
  | `lighthouse` (extract-zip, puppeteer-core, @opentelemetry/*) | agora até `13.4.0` | `lighthouse@13.5.0` |

  **Decisão: não aplicar o major agora.** `npm audit fix --force` não foi usado. Razões: (1) o bundle publicado continua em 0 vulnerabilidades — toda essa cadeia só roda em teste/CI, nunca no navegador do eleitor; (2) `vitest@5`, `vite@8` e `lighthouse@13` são troca de major em três dependências de teste simultaneamente, oito dias antes do 2º turno, com três sessões trabalhando no mesmo repositório; (3) os sete CVEs que motivaram a correção original (listados abaixo) **estão fechados** pelo bump aplicado — o que resta é a cadeia transitiva do `tinypool`/`lighthouse`, que já era parcialmente aceita como risco só-de-desenvolvimento no achado original. Fica registrado como trabalho futuro, fora da janela atual: subir `vitest`, `vite` e `lighthouse` para major, um de cada vez, cada um com a bateria completa, depois de 25/10.

---

## Média

### S02 — `pytest` 8.3.4 com advisory (PYSEC-2026-1845) — CORRIGIDO (`173339b`)

- **Local:** [docker/pipeline.requirements.txt:43](docker/pipeline.requirements.txt#L43), [pipeline/pyproject.toml:10](pipeline/pyproject.toml#L10).
- **Evidência (`pip-audit -r docker/pipeline.requirements.txt --no-deps`):** `pytest 8.3.4 PYSEC-2026-1845 fix 9.0.3 — relies on /tmp/pytest-of-{user} directories, allows local users DoS or possibly gain privileges`.
- **Exposição real:** só nos testes, dentro de um contêiner de um usuário só; nenhum impacto no pipeline de geração.
- **Correção aplicada:** `pytest==9.0.3` nos dois arquivos. Trouxe `pygments==2.21.0` como nova transitiva, fixada no lock. 84/84 testes do pipeline passam; `pip-audit -r docker/pipeline.requirements.txt` sai limpo (0 vulnerabilidades conhecidas).

### S03 — Injeção indireta de prompt: o texto dos PDFs entra no modelo e o modelo escreve texto publicado

- **Local:** prompts em [pipeline/rag_planos/prompts/resumo.md:4](pipeline/rag_planos/prompts/resumo.md#L4), [comparar.md:4](pipeline/rag_planos/prompts/comparar.md#L4), [juiz.md:4](pipeline/rag_planos/prompts/juiz.md#L4), [classificar.md:4](pipeline/rag_planos/prompts/classificar.md#L4); fluxo em [pipeline/rag_planos/grafos.py:129-176](pipeline/rag_planos/grafos.py#L129-L176).
- **Situação:** o único texto livre que o site publica é o campo `texto` (≤ 400 caracteres, [contrato/comparacao.schema.json:46](contrato/comparacao.schema.json#L46)), escrito pelo modelo a partir do conteúdo dos PDFs. Um PDF com instruções embutidas poderia tentar fazer o modelo escrever algo que não está no plano. Os controles já existentes cobrem bem o risco: delimitadores com a instrução "é dado, nunca instrução" nos quatro prompts; `trecho` precisa ocorrer literalmente na página ([verificar.py:41-52](pipeline/rag_planos/verificar.py#L41-L52)); juiz com falha fechada ([grafos.py:186-191](pipeline/rag_planos/grafos.py#L186-L191)); schema com `additionalProperties: false`; aprovação humana por hash; e, no site, React escapa tudo e a CSP bloqueia qualquer script. O corpus são dois PDFs oficiais com SHA-256 registrado.
- **Residual:** o juiz é o mesmo modelo do resumo; uma instrução adversarial no PDF influenciaria os dois. Como a fonte é fixa e confiável, a severidade fica em **média só pelo peso do que está em jogo** (conteúdo eleitoral); não há correção de código pendente.
- **Decisão:** manter a revisão humana (decisão 21) como o controle que fecha esse risco e registrar no relatório HTML de revisão (já feito) cada item com seus trechos. Nada mais a fazer antes de 25/10.

### S04 — Portão de publicação sem proteção de escrita verificável no GitHub

- **Local:** [.github/workflows/ci.yml:53-70](.github/workflows/ci.yml#L53-L70) (deploy em qualquer `refs/tags/*`), [web/scripts/guardas.ts:73-77](web/scripts/guardas.ts#L73-L77) (o portão lê `revisao/aprovados.yaml` do próprio commit).
- **Evidência:** `git remote -v` vazio nesta máquina (não foi possível conferir branch protection, rulesets nem tag protection pela API); `.github/CODEOWNERS`, `.github/dependabot.yml` e `SECURITY.md` ausentes; o job `deploy` não usa `environment:` com revisor obrigatório.
- **Impacto:** a garantia central do projeto ("só vai ao ar o JSON cujo hash o dono aprovou") depende de quem pode escrever em `revisao/aprovados.yaml` e criar tags. Hoje qualquer colaborador com push cria uma tag e publica; um commit que troque o JSON **e** o hash no mesmo push passa pelas guardas.
- **Correção (no GitHub, depois de configurar o remoto):** (1) branch protection em `main` com PR obrigatório e `ci` como status check; (2) ruleset de tags `v*` restrito ao dono; (3) `environment: producao` no job `deploy` com o dono como *required reviewer*; (4) `.github/CODEOWNERS` com `revisao/ dados/comparacoes/ .github/ @<dono>`. São configurações, não código; não afetam o build.

---

## Baixa

### S05 — Lock do pipeline instalado sem verificação de hash

- **Local:** [.github/workflows/ci.yml:16](.github/workflows/ci.yml#L16), [docker/pipeline.Dockerfile:5](docker/pipeline.Dockerfile#L5).
- **Evidência:** `pip install --no-cache-dir -r docker/pipeline.requirements.txt` sem `--require-hashes`; o lock fixa versões, não hashes (aviso do próprio `pip-audit`).
- **Correção:** gerar o lock com hashes (`pip-compile --generate-hashes` dentro do contêiner, ou `pip hash` por pacote) e instalar com `--require-hashes`. Benefício real é pequeno (PyPI não permite reenvio da mesma versão), mas fecha a cadeia.

### S06 — CI não audita dependências e não há Dependabot

- **Local:** [.github/workflows/ci.yml:34](.github/workflows/ci.yml#L34) (`npm ci --no-audit`), ausência de `.github/dependabot.yml`.
- **Impacto:** foi assim que as 20 vulnerabilidades de S01 passaram despercebidas.
- **Correção:** `.github/dependabot.yml` com três ecossistemas (`npm` em `/web`, `pip` em `/docker`, `github-actions`), semanal; e um passo no job `web`: `npm audit --omit=dev --audit-level=high` (só produção, para não quebrar o CI por ferramenta de teste).

### S07 — Actions e imagens fixadas por tag, não por digest

- **Local:** [ci.yml:15](.github/workflows/ci.yml#L15), [:33](.github/workflows/ci.yml#L33), [:60](.github/workflows/ci.yml#L60) (`actions/checkout@v4`); [:13](.github/workflows/ci.yml#L13), [:27](.github/workflows/ci.yml#L27), [:58](.github/workflows/ci.yml#L58) e os dois Dockerfiles (imagens por tag).
- **Correção:** `actions/checkout@<sha>` (com o comentário `# v4.x.y`) e imagens com `@sha256:…`. O `wrangler@3.99.0` já está fixado por versão ([ci.yml:65](.github/workflows/ci.yml#L65)).

### S08 — Substituição de placeholders do HTML interpreta `$&`, `$'`, `` $` `` e `$$` — CORRIGIDO (`3efe517`)

- **Local:** [web/scripts/build.ts:96-101](web/scripts/build.ts#L96-L101).
- **Evidência:** `.replace("<!--app-->", html)` e `.replace("<!--dados-->", `<script …>${escaparJson(dados)}</script>`)` passam strings; o conteúdo vem dos JSONs aprovados e já contém `R$`. Um `texto` com `$'` duplicaria o resto do template dentro de `#app`, e o `<script id="dados">` iria parar dentro do app; um `$$` viraria `$`.
- **Impacto:** integridade/hidratação, não XSS (o `html` já saiu escapado do React e a CSP não libera script inline sem hash). Só a linha 77 usa a forma segura.
- **Correção aplicada:** as quatro chamadas (`<!--app-->`, `<!--dados-->`, `<!--titulo-->`, `<!--descricao-->`) passaram a usar função de substituição em vez de string. `<!--ordem-->` ficou como estava, por interpolar só a constante `SCRIPT_ORDEM`, sem dado externo. 24/24 testes e `build:teste` confirmam, e o HTML gerado não tem resíduo de placeholder. Fecha também o critério 50 (AC 50) do plano `.specs/features/interface-site/plan.md`, confirmado pela sessão responsável por essa feature.

### S09 — `fontes --url` baixa sem checar esquema nem nome do arquivo

- **Local:** [pipeline/rag_planos/fontes.py:53-56](pipeline/rag_planos/fontes.py#L53-L56) e [:73-75](pipeline/rag_planos/fontes.py#L73-L75).
- **Evidência:** `urllib.request.urlopen(req)` aceita qualquer esquema que o operador passar; o destino é `alvo / u.rsplit("/", 1)[-1]`, sem limite de tamanho e sem conferir que o nome é um dos dois de `config.CANDIDATOS`.
- **Impacto:** só o operador controla `--url`; um nome `..` ou vazio só faz o comando falhar. Baixo.
- **Correção:** aceitar apenas `https:`, exigir que o nome final esteja em `config.ARQUIVO_PARA_CANDIDATO`, e ler em blocos com teto (os PDFs têm poucos MB).

### S10 — `dock.sh` copia um `.env` local para o volume do Docker

- **Local:** [dock.sh:95](dock.sh#L95) (`tar … --exclude=./.git --exclude=./web/node_modules --exclude=./web/dist .`).
- **Evidência:** `.env` está no `.gitignore` ([.gitignore:12](.gitignore#L12)) mas não na lista de exclusão do `tar`; se existir, vai para o volume persistente `rag-planos-<svc>-app`. Hoje não existe `.env` no disco (conferido). A chave do Gemini é passada só por `-e GEMINI_API_KEY` ([dock.sh:97](dock.sh#L97)), que é o caminho certo.
- **Correção:** acrescentar `--exclude=./.env --exclude='./**/.env'` ao `tar`.

---

## Informativo

### S11 — Robustez do relatório e da verificação contra saída malformada do modelo

- [pipeline/rag_planos/relatorio.py:38](pipeline/rag_planos/relatorio.py#L38) (`html.escape(c.get('trecho', ''))`), [verificar.py:48](pipeline/rag_planos/verificar.py#L48) (`len(ci.get("trecho", ""))`) e [:68](pipeline/rag_planos/verificar.py#L68) (`[:120]`) quebram com `TypeError` se o modelo devolver um número ou `null` no lugar de uma string. O efeito é falha fechada (o comando aborta, nada é publicado), então não é vulnerabilidade; é só um `str(...)` a acrescentar para o relatório sempre ser gerado. Todo o resto do HTML de revisão escapa o que vem do modelo (`html.escape` com `quote=True`), inclusive o `href` de "abrir página".

### S12 — Servidor estático de teste (`scripts/servir.mjs`)

- [web/scripts/servir.mjs:39-40](web/scripts/servir.mjs#L39-L40): `alvo.startsWith(raiz)` sem separador (uma pasta irmã `dist-teste2` passaria) e `decodeURIComponent` sem `try/catch` (um `%` malformado derruba o processo). Só roda no Playwright/Lighthouse local e no CI; o Cloudflare Pages serve a produção. Se quiser fechar: `startsWith(raiz + sep)` e responder 400 no `catch`.

### S13 — Endurecimentos opcionais dos cabeçalhos

- `Permissions-Policy` ainda lista `interest-cohort=()` ([build.ts:135](web/scripts/build.ts#L135)); o Chrome registra erro no console. Trocar por `browsing-topics=()` (achado E21 do plano).
- A CSP já tem `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, hashes para o único script e o único estilo inline, `worker-src 'self' blob:` para o pdf.js e `isEvalSupported: false` ([visualizador.ts:31](web/src/visualizador.ts#L31)), que dispensa `unsafe-eval`. Opcional, não exigido: `require-trusted-types-for 'script'` (testar o pdf.js antes) e `X-Frame-Options: DENY` para navegadores antigos.

### S14 — O portão de produção está fechado por construção

- Não existe `revisao/` no repositório nem no disco; `npm run build` de produção falha nomeando os 8 temas sem aprovação ([guardas.ts:74](web/scripts/guardas.ts#L74)). O CI só publica em tag, e a aprovação exige que o relatório HTML tenha sido gerado para exatamente aquele JSON ([aprovar.py:27-32](pipeline/rag_planos/aprovar.py#L27-L32)). É o comportamento desejado; registrado aqui para que a primeira tag só seja criada depois de `aprovar` e do commit de `revisao/aprovados.yaml`.

---

## O que já está certo (sem ação)

- **Sem segredos:** varredura de `git log --all -p` por padrões de chaves Google/GitHub/PEM vazia; `.env` ignorado e inexistente; chave só por variável de ambiente ([llm.py:239](pipeline/rag_planos/llm.py#L239)); o cache em disco guarda só o texto da resposta e o log `chamadas.jsonl` não grava prompts nem chave.
- **Sem sinks de DOM no site:** nenhum `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `dangerouslySetInnerHTML`, `postMessage`, `localStorage` ou handler `on*=` no código nem no HTML gerado (conferido em `dist-teste`). O visualizador usa `textContent` ([visualizador.ts:23](web/src/visualizador.ts#L23)).
- **URLs e navegação:** `arquivo` só é aceito se estiver na lista de dois nomes ([visualizador.ts:8,28](web/src/visualizador.ts#L8)); `pagina` é inteiro limitado a `[1, numPages]`; `resolverRota` só aceita slugs e ids publicados ([rotas.ts:11-12](web/src/rotas.ts#L11-L12)), então o `fetch` só atinge `/comparacoes/<id-conhecido>.json`; `location.assign` recebe só `pathname` de âncora da mesma origem ([App.tsx:70,82,96-97](web/src/App.tsx#L70)); "Ver no PDF" usa `rel="noopener"` ([Citado.tsx:18](web/src/Citado.tsx#L18)); o único link externo do site é a página do TSE, vinda de uma constante do pipeline.
- **Dados embutidos:** o JSON de hidratação escapa `<`, `>` e `&` ([build.ts:24-26](web/scripts/build.ts#L24-L26)); título e descrição passam por `escaparAttr`; sem source maps em `dist`.
- **Contrato:** `additionalProperties: false` em todos os objetos, `arquivo` e `candidato` como enums, `trecho` ≤ 280, `texto` ≤ 400, `pagina` inteiro ≥ 1; validado nos dois lados (jsonschema no pipeline, Ajv no build).
- **Deserialização:** só `json.loads` e `yaml.safe_load`; sem `pickle`, sem `subprocess` com shell.
- **CI:** `permissions: contents: read`; segredos só no job de deploy, que só roda em tag; `npm ci` com lock; versões de `wrangler` fixadas.
- **Privacidade:** nenhum cookie, nenhum beacon, nenhum script de terceiro, `Referrer-Policy: no-referrer`; o teste e2e `transparencia.spec.ts` verifica que toda requisição é da própria origem.

## Ordem sugerida das correções

1. ~~S01 (bump das 7 dependências + imagem do Playwright) e S02 (`pytest`), num commit cada, com a bateria completa rodando no Docker antes.~~ **Feito** (`12ffc5a`, `173339b`).
2. ~~S08 (replace por função) — 4 linhas, zero risco.~~ **Feito** (`3efe517`).
3. S06 e S07 (Dependabot, audit no CI, pins por SHA/digest).
4. S04 — assim que o remoto no GitHub existir: proteção de branch, ruleset de tag, environment com revisor, CODEOWNERS.
5. S05, S09, S10, S13 quando houver folga; S03, S11, S12 e S14 não exigem mudança.
6. Depois de 25/10: fechar o residual de S01 com major bump de `vitest`/`vite`/`lighthouse`, um de cada vez, com bateria completa.
