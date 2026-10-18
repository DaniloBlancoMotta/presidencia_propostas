# Comparador de planos de governo por tema (MVP estático)

Profile: light (nenhum `AGENTS.md` declara outro). Handoff: on.

Sources:

- `.specs/plano-final.md` - decisões 1-22, contrato §4, pipeline §5, site §6, critérios AC 1-37 (§7)
- `prompt-rag-planos-de-governo-2026.md` - princípios §4, temas §5, convergências §11.2, conjunto-ouro §11.3
- `corpus/Programa-Governo-LULA-2026.pdf`, `corpus/plano-de-governo_flavio.pdf` - único corpus; nenhum dado publicado sai de outro lugar

## Out of scope

- `/ask`, FAQ, embeddings, cadeia de provedores - plano §1 e §11
- camadas `declaracao`/`imprensa`, lacunas da imprensa - decisão 16
- aprovação dos temas - decisão 21: só o dono registra hashes; este build não aprova nada em `revisao/aprovados.yaml`
- deploy em produção e push - exige conta Cloudflare (§9 item 3) e go-ahead explícito

## Landing

Repositório novo. Pipeline em `pipeline/rag_planos`, site em `web/`, contrato em `contrato/`.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Contagem de tokens | `len(re.findall(r"\w+\|[^\w\s]", texto))` | tiktoken: baixa o vocabulário pela rede no primeiro uso e mede tokens de um modelo que não é o usado |
| `secao` | Lula: faixas de página do índice da pág. 3 (13 diretrizes + texto de abertura); Flávio: títulos em Montserrat-Bold 16,6 pt (9 eixos + apresentação + conclusão). Subtítulos vão em `subsecao` | detectar por negrito genérico: no plano de Lula os subtítulos e o cabeçalho vertical "PROGRAMA DE GOVERNO" também são negrito |
| Texto da página para checagem literal | só spans do corpo; removidos o número de página e o cabeçalho vertical (Lula: Transducer 9-10 pt; ambos: span que é só o número da página) | texto bruto: o cabeçalho letra-a-letra intercala com o corpo e quebra trechos legítimos |
| Provedor de LLM | `llm.py` com interface `Provedor.gerar(prompt) -> str`; `gemini` (requer `GEMINI_API_KEY`) e `arquivo` (lê respostas já produzidas em `dados/rascunhos/<tema>.json`) | só Gemini: sem chave nesta máquina, nenhum tema seria gerado |
| Juiz LLM sem chave | `verificar` registra `juiz: "nao_executado"` no relatório, e o item segue para revisão humana marcado | descartar tudo sem juiz: nenhum tema chegaria à revisão |
| Caminho do portão | build lê `APROVADOS` (env), padrão `revisao/aprovados.yaml` | caminho fixo: testes teriam de escrever no arquivo do dono |
| Navegação | HTML pré-renderizado por rota + navegação no cliente (pushState) entre rotas internas, buscando `/comparacoes/<id>.json` | MPA puro: cada clique recarrega e re-sorteia a ordem, violando AC 20 |
| Script inline da ordem sob CSP | `script-src 'self' 'sha256-<hash do script>'` gerado no build em `_headers` | `'unsafe-inline'`: abre a CSP inteira |
| PDF.js | `pdfjs-dist@4.10.38`, worker no próprio domínio, `isEvalSupported: false` | `#page=N` no PDF cru (decisão 11) |

| Bind mount do drive D: não funciona no Docker Desktop desta máquina | `dock.sh` copia o código por `tar` para um contêiner persistente e devolve só artefatos (`dados`, `revisao`, `web/dist`) | bind mount: a pasta aparece vazia dentro do contêiner |
| Geração e juiz sem chave de API | rascunhos e vereditos produzidos por agentes Claude independentes, lidos de `dados/rascunhos/` e `dados/juiz/`; `origem` gravada em `dados/geracao/<tema>.json` | inventar uma chave ou pular o juiz |
| Data de coleta sem acesso ao TSE | `fontes --sem-tse --coletado-em` exige data explícita e grava `conferido_tse: false`, exibido em `/sobre` | usar a data de hoje em silêncio |
| CSS do site | inline no HTML, liberado por `style-src 'self' 'sha256-…'` | arquivo externo: uma requisição que bloqueava a pintura e levava o LCP do tema a 2,01 s |
| "Só diferenças" no tema | mostra diferenças e omissões | só diferenças: a §5 da especificação define Diferenças como "divergências e omissões" |
| Aviso de IA e rodapé no visualizador de PDF | o visualizador também exibe o aviso e a data de coleta | deixar a tela do PDF sem eles: AC 28 diz "toda tela" |
| Dados da rota no HTML | `<script id="dados" type="application/json">` com o manifesto e as comparações da rota | buscar o JSON antes de hidratar: uma requisição a mais no caminho crítico |

- Nada mais nesta mudança é difícil de reverter

## Checks

### S1 - Ingestão rastreável até a página

**C1** (AC 1) - todo chunk tem candidato, partido, arquivo, pagina ≥ 1, secao e temas com confianca em [0,1]
Proof: `pytest pipeline/tests/test_ingest.py::test_todo_chunk_tem_campos`

**C2** (AC 2) - fontes.json grava sha256 e coletado_em de cada PDF
Proof: `pytest pipeline/tests/test_fontes.py::test_grava_sha256_e_data`

**C3** (AC 2) - rodapé de toda rota exibe "Documentos coletados do TSE em DD/MM/AAAA"
Proof: `npx playwright test e2e/transparencia.spec.ts -g "rodapé"`

**C4** (AC 3) - hash do TSE divergente sai ≠ 0 e nomeia o arquivo
Proof: `pytest pipeline/tests/test_fontes.py::test_hash_divergente_sai_nao_zero`

**C5** (AC 4) - chunks de 400-800 tokens com sobreposição de 15%
Proof: `pytest pipeline/tests/test_chunk.py::test_tamanho_e_sobreposicao`

**C6** (AC 4) - nenhum chunk cruza secao; seção < 400 vira um chunk
Proof: `pytest pipeline/tests/test_chunk.py::test_nao_cruza_secao`
Proof: `pytest pipeline/tests/test_chunk.py::test_secao_curta_um_chunk`

### S2 - Comparação citada, verificada e aprovada

**C7** (AC 5) - JSON gerado respeita os mínimos de citação por lista
Proof: `pytest pipeline/tests/test_verificar.py::test_minimos_de_citacao`

**C8** (AC 6) - normalização: espaços/quebras viram um espaço, hífen de fim de linha removido
Proof: `pytest pipeline/tests/test_literal.py::test_normaliza`

**C9** (AC 6) - todo trecho publicado ocorre na página citada do arquivo citado
Proof: `pytest pipeline/tests/test_comparacoes_reais.py::test_todo_trecho_publicado_e_literal`

**C10** (AC 7) - trecho inexistente sai do JSON e entra no relatório como `trecho_nao_encontrado`
Proof: `pytest pipeline/tests/test_verificar.py::test_trecho_inexistente_descartado`

**C11** (AC 8) - juiz que diz não sustentado remove o bullet, motivo `nao_sustentado` + justificativa
Proof: `pytest pipeline/tests/test_verificar.py::test_juiz_nao_sustentado`

**C12** (AC 9) - candidato sem bullet recebe `nao_encontrado: true`
Proof: `pytest pipeline/tests/test_verificar.py::test_sem_bullet_nao_encontrado`

**C13** (AC 9) - tela mostra exatamente "Não encontrado no plano de governo registrado no TSE"
Proof: `npx vitest run tests/render.test.tsx -t "nao encontrado"`

**C14** (AC 10) - camada ≠ plano falha o build
Proof: `npx vitest run tests/guardas.test.ts -t "camada"`

**C15** (AC 11) - JSON > 30 KB falha o build
Proof: `npx vitest run tests/guardas.test.ts -t "30 KB"`

**C16** (AC 12) - relatório HTML lista itens, trechos, link de página, descartes com motivo e contagem por candidato
Proof: `pytest pipeline/tests/test_relatorio.py::test_relatorio_completo`

**C17** (AC 13) - hash não registrado falha o build e nomeia o tema
Proof: `npx vitest run tests/guardas.test.ts -t "hash"`

**C18** (AC 14) - recall < 90% sai ≠ 0 listando faltantes
Proof: `pytest pipeline/tests/test_avaliar.py::test_recall_baixo_sai_nao_zero`

**C19** (AC 15) - convergência faltando sai ≠ 0
Proof: `pytest pipeline/tests/test_avaliar.py::test_convergencia_faltando_sai_nao_zero`

### S3 - Navegar por tema no celular

**C20** (AC 16) - `/`: Semelhanças e Diferenças primeiro, depois temas na ordem de themes.yaml, cada um com SVG
Proof: `npx playwright test e2e/navegacao.spec.ts -g "grade"`

**C21** (AC 17) - ≥ 768 px duas colunas de mesma largura; < 768 px duas abas
Proof: `npx playwright test e2e/navegacao.spec.ts -g "colunas e abas"`

**C22** (AC 18) - bullet expandido mostra trecho, arquivo, página e "Ver no PDF"
Proof: `npx playwright test e2e/navegacao.spec.ts -g "expandir"`

**C23** (AC 19) - "Ver no PDF" abre o visualizador do próprio domínio na página citada
Proof: `npx playwright test e2e/pdf.spec.ts -g "abre na página"`

**C24** (AC 20) - ordem sorteada 50/50 e mantida entre telas até recarregar
Proof: `npx playwright test e2e/ordem.spec.ts -g "sorteio"`

**C25** (AC 21) - "Trocar ordem dos candidatos" inverte em todas as telas
Proof: `npx playwright test e2e/ordem.spec.ts -g "trocar"`

**C26** (AC 22) - filtros "Só semelhanças" / "Só diferenças" / "Mostrar tudo"
Proof: `npx playwright test e2e/navegacao.spec.ts -g "filtro"`

**C27** (AC 23) - visões transversais agrupadas por tema, `/diferencas` com omissões rotuladas
Proof: `npx playwright test e2e/navegacao.spec.ts -g "transversal"`

**C28** (AC 24) - visão vazia mostra "Nenhum ponto encontrado nos temas publicados"
Proof: `npx vitest run tests/render.test.tsx -t "vazia"`

**C29** (AC 25) - link direto para `/tema/<id>` abre o tema
Proof: `npx playwright test e2e/navegacao.spec.ts -g "link direto"`

**C30** (AC 26) - tema inexistente e rota desconhecida respondem 404 com link para `/`
Proof: `npx playwright test e2e/navegacao.spec.ts -g "404"`

**C31** (AC 27) - só requisições ao próprio domínio, em todas as rotas e controles
Proof: `npx playwright test e2e/transparencia.spec.ts -g "mesma origem"`

### S4 - Transparência e neutralidade

**C32** (AC 28) - aviso de IA em toda rota
Proof: `npx playwright test e2e/transparencia.spec.ts -g "aviso"`

**C33** (AC 29) - `/sobre` mostra arquivo, sha256, data, link TSE e responsável
Proof: `npx playwright test e2e/transparencia.spec.ts -g "sobre"`

**C34** (AC 30) - `/metodologia` mostra as 5 etapas e "só documentos oficiais"
Proof: `npx playwright test e2e/transparencia.spec.ts -g "metodologia"`

**C35** (AC 31) - os dois candidatos usam o mesmo componente e as mesmas classes
Proof: `npx playwright test e2e/transparencia.spec.ts -g "neutro"`

**C36** (AC 32) - nenhum Set-Cookie e nenhum script de outro domínio
Proof: `npx playwright test e2e/transparencia.spec.ts -g "cookie"`

### S5 - Rápido e acessível

**C37** (AC 33) - JS inicial ≤ 200 KB gzip
Proof: `node scripts/orcamento.mjs`

**C38** (AC 34) - Lighthouse mobile em `/` e `/tema/saude`: P ≥ 90, A ≥ 90, LCP < 2,0 s
Proof: `node scripts/lighthouse.mjs`

**C39** (AC 35) - toda rota operável por teclado, foco visível
Proof: `npx playwright test e2e/a11y.spec.ts -g "teclado"`

**C40** (AC 36) - axe sem serious/critical em cada rota
Proof: `npx playwright test e2e/a11y.spec.ts -g "axe"`

**C41** (AC 37) - 320 px a 200% (160 px CSS) sem rolagem horizontal
Proof: `npx playwright test e2e/a11y.spec.ts -g "reflow"`

## Swept

- validation: C14, C15, C17 e schema no build (`guardas.test.ts -t "schema"`)
- failure modes: C10, C11, C12; TSE inacessível → `fontes` sai ≠ 0 com a mensagem do HTTP
- idempotency and retry: cache em disco do LLM por hash do prompt; regerar muda o hash e reabre o portão (C17)
- authorization: n/a - site público sem login
- concurrency and ordering: n/a - geração offline por um operador
- data lifecycle: versão do PDF identificada por SHA-256 (C2, C4)
- external-dependency failure: TSE com 403 (constatado em 17/10) → `fontes --tse-dir` aceita PDFs baixados no navegador; Gemini sem chave → provedor `arquivo`
- state transitions: gerado → verificado → aprovado → publicado, guardado por C17
- observability: analytics do Cloudflare por caminho (decisão 18), sem código

## Handoff

S1-S2 tocam só `pipeline/` (~60k de leitura estimada, corpus extraído incluído); S3-S5 tocam só `web/` (~70k). Juntos ficam abaixo de 150k, mas a superfície muda de Python para TypeScript entre S2 e S3: a fronteira natural fica depois de S2. Construção conduzida nesta sessão, que orquestra a feature inteira.
