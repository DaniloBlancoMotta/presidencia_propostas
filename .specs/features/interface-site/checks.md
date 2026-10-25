# Interface do site - checks

Profile: ui
Plan: `.specs/features/interface-site/plan.md`

## Intent

79 checks em 8 fatias e nos invariantes · 4 portas de mão única · 0 em aberto

Cada check Cn corresponde ao critério n do plano (C1 a C74). C75 a C77 são regressões que o
`Impact` e o `Surface` do plano exigem. C78 e C79 vieram da rodada 1 do verificador (25/10/2026):
cobrem o lugar do "Trocar ordem" (premissa do plano) e os acréscimos à §6 que o dono manteve.
Na mesma rodada, C16, C17, C58 e C74 foram reescritos para o tamanho do critério e da §6. Todas as provas rodam em `web/`, dentro do contêiner
(`DOCK_NOME=<sessão> ./dock.sh web '<comando>'`), depois de `npm run build:teste`. Os testes
novos levam o id do check no início do título (`"C12: ..."`), para que `-g "C12:"` selecione
só aquele teste. Os e2e novos rodam no projeto `desktop-chrome` e definem a própria janela; os
nomes dos arquivos (`interface-*.spec.ts`) não casam com os filtros dos projetos móveis.

Onde o check diz "U+00A0 normalizado", o texto é comparado depois de trocar o espaço não
separável por espaço comum. Onde diz `--token`, o valor esperado é a cor calculada de um
elemento de sonda com aquela variável, e não um literal copiado no teste.

## Checks

### S1 - Tela de tema igual ao desenho e estável desde a primeira pintura · 12 arquivos · 67 KB · ~17k

**C1** - Em 390×844, com `/assets/*.js` abortado e `Math.random` fixado em 0,9 (`data-ordem="ba"`), `/tema/saude` mostra visível o painel `data-cand="lula"` e oculto o de `flavio-bolsonaro`, e a aba de Lula tem os mesmos estilos calculados que a aba com `aria-selected="true"` tem depois da hidratação. Com 0,1 vale o inverso. Com o JS liberado, o painel visível na primeira pintura é o mesmo depois da hidratação (crit. 1)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C1:"`

**C2** - Em cada um dos 8 temas publicados, os `h2` de seção leem exatamente `Semelhanças (n)`, `Diferenças (n)` e `Omissões (n)`, com n = tamanho de `semelhancas`, `diferencas` e `omissoes` no JSON do tema (crit. 2)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C2:"`

**C3** - Todo `summary` de item expansível tem `list-style-type: none` e nenhum marcador nativo visível, e termina num `svg` com `aria-hidden="true"` cuja borda esquerda fica à direita do fim do texto. O `svg` tem `color` = `--tinta` e desenha um triângulo preenchido: sem rotação com o item fechado (▸) e com rotação de 90° com o item aberto (▾) (crit. 3)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C3:"`

**C4** - Em 390 px, o nome do candidato aparece só na aba: o `h3` de cada painel existe no DOM, aparece na árvore de acessibilidade como título de nível 3 e mede no máximo 1×1 px (crit. 4)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C4:"`

**C5** - Em `/tema/saude`, os controles aparecem no DOM nesta ordem: "Trocar ordem dos candidatos", "Só semelhanças", "Só diferenças", "Mostrar tudo". Em 390 px, os três filtros têm o mesmo `top` (±1 px) (crit. 5)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C5:"`

**C6** - Em `/tema/saude` e em cada grupo de `/diferencas`, nas ordens `ab` e `ba`, a lista de omissões traz primeiro todas as de `tratado_por` = 1º candidato da ordem e, dentro de cada candidato, a ordem do JSON (crit. 6)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C6:"`
Proof: `npx vitest run tests/interface.test.ts -t "C6:"`

**C7** - Tocar "Trocar ordem dos candidatos" inverte a ordem dos grupos de omissões em `/tema/saude` e em `/diferencas` (crit. 7)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C7:"`

**C8** - O nome do candidato dentro de cada item de semelhança e de diferença é `h3` em `/tema/saude` e em `/semelhancas`, e `h4` em `/diferencas`, onde o crit. 37 põe os subtítulos `h3`. Em todas as rotas do site, com todos os itens abertos, nenhum título pula nível (crit. 8)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C8:"`

**C9** - Com todos os itens de `/tema/saude` e de `/diferencas` abertos, nenhum elemento dentro das listas tem papel `region` (crit. 9)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C9:"`

**C10** - Em todo item dos 8 temas, aberto, o nº de trechos citados é igual ao nº de citações do JSON. Os nºs de linhas "arquivo · pág. N" e de links "Ver no PDF" são iguais ao nº de grupos de citações consecutivas com o mesmo arquivo e a mesma página (crit. 10)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C10:"`
Proof: `npx vitest run tests/interface.test.ts -t "C10:"`

**C11** - Em 390×844, com a página rolada 1.500 px dentro do painel, a lista de abas (`role="tablist"`) está visível com `top` = 0 (±1 px) (crit. 11)
Proof: `npx playwright test e2e/interface-tema.spec.ts --project=desktop-chrome -g "C11:"`

### S2 - Início que diz quem está sendo comparado · 6 arquivos · 78 KB · ~20k

**C12** - Nas ordens `ab` e `ba`, `/` mostra como texto de abertura exatamente "Planos de governo de A e B, candidatos ao 2º turno de 2026, registrados no TSE. Escolha um tema para comparar o que cada plano propõe, com o trecho e a página do PDF original.", com A e B = "Flávio Bolsonaro (PL)" e "Lula (PT)" na ordem vigente (U+00A0 normalizado) (crit. 12)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C12:"`

**C13** - Em 1366 px e em 480 px, a grade de `/` tem Semelhanças e Diferenças numa mesma linha, com larguras iguais (±1 px) que somam a largura da grade menos o espaço entre eles. Os 8 temas ficam em 2 linhas de 4 (crit. 13)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C13:"`

**C14** - Em 390 px, os temas vêm 2 por linha, o ícone fica na mesma linha do rótulo (centros verticais a ±4 px) e os rótulos têm `hyphens` diferente de `auto`. Em 339 px, os temas vêm 1 por linha e os dois destaques ficam empilhados. Em 160 px, `scrollWidth` ≤ `clientWidth` (crit. 14)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C14:"`

**C15** - Em 1366 px e em 390 px, os cartões de uma mesma linha da grade, destaques e temas, têm a mesma altura (±1 px) (crit. 15)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C15:"`

**C16** - Em todas as rotas do site, nada vem antes do `h1` além do link de voltar: nenhum sobretítulo. O aviso de IA é o bloco logo depois do `h1`, como na §6; texto de abertura, descrição do tema, linha de atualização, controles e listas vêm depois do aviso. Não há barra de marca: nenhum `.marca` e nenhum link "Compare os planos de governo 2026" antes do `h1`. Nas rotas que não são `/`, o último link antes do `h1` tem nome acessível exato "Todos os temas" e `href="/"`. Em `/chat/conversa`, esse link é "Chat por tema", com `href="/chat"` (crit. 16)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C16:"`

**C17** - Em todas as rotas do site, o rodapé tem os links "Chat por tema", "Metodologia" e "Sobre", nesta ordem e separados por "·" (o texto do grupo é "Chat por tema · Metodologia · Sobre"), antes do parágrafo "Documentos coletados do TSE em DD/MM/AAAA" (data = a coleta mais antiga de `fontes.json`). `/metodologia` tem `h1` "Metodologia" e `/sobre` tem `h1` "Sobre" (crit. 17)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C17:"`

### S3 - Visualizador de PDF legível no celular e com zoom · 5 arquivos · 16 KB · ~4k

**C18** - A barra do visualizador tem `position: sticky` e `top: 0` em 1366×900, e não é `sticky` em 390×844 nem em 1366×560 (crit. 18)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C18:"`

**C19** - Em `?arquivo=Programa-Governo-LULA-2026.pdf&pagina=26`, com a CPU desacelerada, dois cliques em "Próxima página" antes de a página 26 terminar de desenhar terminam com `body[data-pagina="28"]` e o indicador lendo "Página 28 de M" (M = páginas do arquivo) (crit. 19)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C19:"`

**C20** - Na página 2, com o foco em "Página anterior", ir à página 1 desabilita esse botão e põe o foco em "Próxima página". Na penúltima página, com o foco em "Próxima página", ir à última desabilita esse botão e põe o foco em "Página anterior" (crit. 20)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C20:"`

**C21** - Com o download do PDF atrasado em 2 s, enquanto ele não termina, "Página anterior" e "Próxima página" estão `disabled` e "Baixar o PDF original" não está visível (crit. 21)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C21:"`

**C22** - Com `?arquivo=nao-existe.pdf` e com o download do PDF abortado, o canvas e a paginação ficam ocultos, e um elemento `role="alert"` mostra a mensagem e um link "Voltar ao início" com `href="/"` (crit. 22)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C22:"`

**C23** - O visualizador tem um único `h1`, com o nome do arquivo, e um único elemento com `aria-live`, cujo texto, depois de desenhar a página N, é "Página N de M" (crit. 23)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C23:"`

**C24** - Depois de desenhar a página N, `document.title` é "<arquivo>, página N — Ver no PDF" (crit. 24)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C24:"`

**C25** - Com o download do PDF atrasado, o canvas já ocupa uma caixa com altura/largura = 1,414 (±0,01) (crit. 25)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C25:"`

**C26** - Até 300 ms depois de a janela passar de 1366 para 600 px de largura, a largura CSS do canvas é a mesma (±1 px) que ele tem quando a página é aberta direto em 600 px (crit. 26)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C26:"`

**C27** - O indicador tem `font-variant-numeric` com `tabular-nums` e `min-width` > 0, e os `x` de "Página anterior" e "Próxima página" são os mesmos (±0,5 px) nas páginas 9 e 10 (crit. 27)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C27:"`

### S4 - Navegação que preserva onde a pessoa estava · 6 arquivos · 43 KB · ~11k

**C28** - Ativar "Pular para o conteúdo" pelo teclado, ou um link `#g-<theme_id>` do índice de `/diferencas`, põe o foco no destino, não muda `history.length` e não faz requisição a `/comparacoes/` (crit. 28)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C28:"`

**C29** - Em `/diferencas`, rolar até o grupo de Agronegócio, abrir o tema pelo link do título e voltar pelo Voltar do navegador devolve o mesmo `scrollY` de antes (±2 px) (crit. 29)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C29:"`

**C30** - Com `/comparacoes/*.json` atrasado em 1 s, depois de tocar "Saúde" em `/`, e até a tela do tema aparecer, o `main` tem `aria-busy="true"` e uma região `role="status"` diz "Carregando…". Depois, `aria-busy` não é mais `"true"` e o status fica vazio (crit. 30)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C30:"`

**C31** - Com `/comparacoes/*.json` atrasado, tocar "Saúde" e logo "Educação" termina em `/tema/educacao`, com `h1` "Educação", e `history.length` cresce exatamente 1 (crit. 31)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C31:"`

**C32** - Em `/tema/saude`, "Só semelhanças" leva a URL a `/tema/saude?filtro=semelhancas`, "Só diferenças" a `?filtro=diferencas` e "Mostrar tudo" a `/tema/saude`, e `history.length` não muda (crit. 32)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C32:"`
Proof: `npx vitest run tests/interface.test.ts -t "C32:"`

**C33** - Abrir `/tema/saude?filtro=semelhancas` mostra só a lista de semelhanças, com "Só semelhanças" em `aria-pressed="true"`. Abrir `?filtro=diferencas` mostra só diferenças e omissões, com "Só diferenças" pressionado (crit. 33)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C33:"`

**C34** - Abrir `/tema/saude?filtro=xyz` mostra "Mostrar tudo" pressionado e as quatro listas visíveis (crit. 34)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C34:"`
Proof: `npx vitest run tests/interface.test.ts -t "C34:"`

**C35** - Tocar "Trocar ordem dos candidatos" deixa numa região `role="status"` o texto "Ordem trocada: Lula (PT) aparece primeiro." quando Lula passa a primeiro, e "Ordem trocada: Flávio Bolsonaro (PL) aparece primeiro." no caso inverso (U+00A0 normalizado) (crit. 35)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C35:"`

**C36** - Em `/semelhancas` e `/diferencas`, logo depois do texto de abertura vem uma lista com um link por tema com itens, na ordem de `themes.yaml`. Cada link tem `href="#g-<theme_id>"` e traz no texto o nº de itens do tema (em `/diferencas`, diferenças mais omissões). Ativar um link põe o `h2#g-<theme_id>` com `top` entre 0 e 64 px (crit. 36)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C36:"`

**C37** - Em `/diferencas`, cada grupo de tema tem `h3` "Diferenças (n)" quando há diferenças e `h3` "Omissões (n)" quando há omissões, com n do JSON, e nenhum item de diferença mostra o selo "Diferença" (crit. 37)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C37:"`

**C38** - `/sobre` tem os cartões dos planos no DOM na ordem vigente (`ab`: Flávio, Lula; `ba`: Lula, Flávio), e em 1024 px os dois ficam lado a lado, com o mesmo `top` e a mesma largura (±1 px) (crit. 38)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C38:"`

**C39** - Em 1024 px, depois da hidratação, a tela de tema não tem nenhum elemento com `role="tabpanel"`, e nenhum `aria-labelledby` ou `aria-controls` aponta para elemento oculto (crit. 39)
Proof: `npx playwright test e2e/interface-historico.spec.ts --project=desktop-chrome -g "C39:"`

### S5 - Acabamento de toque, hover e texto · 9 arquivos · 51 KB · ~13k

**C40** - Num contexto com hover, o mouse sobre cada um destes controles muda o `background-color` ou a borda calculada, para uma cor que é um token: filtro não pressionado, "Trocar ordem", cartão de tema, destaque, `summary` de item e, em 390 px, a aba não selecionada. Fora das áreas de cor, o token é neutro; dentro delas, é o `--tom-*-forte` da área (crit. 40 com o crit. 53). Toda regra `:hover` do CSS usa só `var(--…)` para cor
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C40:"`
Proof: `npx vitest run tests/interface.test.ts -t "C40:"`

**C41** - Em `/tema/saude`, todo `a`, `button` e `summary` visível tem `touch-action: manipulation` e `-webkit-tap-highlight-color` com o matiz do acento e alfa entre 0 e 1 (exclusive). Com o botão do mouse pressionado (`:active`), o fundo calculado muda num filtro, num cartão de tema e num `summary` (crit. 41)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C41:"`

**C42** - Em 390 px, os links de navegação medem pelo menos 44 px de altura: o de voltar, os do rodapé, os títulos-link de `/semelhancas` e `/diferencas` e os links de `/sobre` (crit. 42)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C42:"`

**C43** - Em 1366 px, o texto de abertura de `/` e os parágrafos de `/metodologia` e de `/sobre` têm largura ≤ 68 × a largura do "0" na fonte do elemento (+1 px) (crit. 43)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C43:"`

**C44** - Em 1366 px, a faixa do aviso de IA tem a largura da janela (±1 px), e o conteúdo dela começa no mesmo `x` do `h1` (±1 px) (crit. 44)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C44:"`

**C45** - Em 1366×900, em `/rota-que-nao-existe`, a borda inferior do rodapé coincide com a da janela (±1 px) (crit. 45)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C45:"`

**C46** - `h1`, `h2` e `h3` têm `text-wrap` (ou `text-wrap-style`) `balance`, e os parágrafos de texto corrido têm `pretty`. Contêm U+00A0 no lugar do espaço: "pág. N" nas linhas de fonte das citações, "Nome (Partido)" antes do parêntese e "2º turno" no texto de abertura (crit. 46)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C46:"`

**C47** - Em `/tema/saude` e `/diferencas`, o selo de cada omissão lê exatamente "Omissão · só no plano de Lula (PT)" ou "Omissão · só no plano de Flávio Bolsonaro (PL)" (U+00A0 normalizado) (crit. 47)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C47:"`

**C48** - Toda rota do site e o visualizador têm `<meta name="theme-color" content="#faf7f1">` e `<link rel="icon" href="/favicon.svg">`. `/favicon.svg` responde 200 com `image/svg+xml`, e nenhuma requisição a `/favicon.ico` acontece ao abrir as rotas (crit. 48)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C48:"`

**C49** - O `_headers` de `dist-teste` e a resposta de `/` trazem `Permissions-Policy` sem `interest-cohort` (crit. 49)
Proof: `npx playwright test e2e/interface-acabamento.spec.ts --project=desktop-chrome -g "C49:"`

**C50** - Um build com uma comparação de teste cujos textos contêm `R$& 10`, `R$' 10` e `R$$ 10` gera HTML pré-renderizado com exatamente essas três sequências (crit. 50)
Proof: `npx vitest run tests/interface.test.ts -t "C50:"`

**C51** - Todas as cores literais (`#…`, `rgb(`, `hsl(`, `oklch(`) do CSS do site e do visualizador estão num único arquivo de tokens, importado por `estilo.css` e por `visualizador.css`. Esses dois arquivos não têm nenhuma cor literal (crit. 51)
Proof: `npx vitest run tests/interface.test.ts -t "C51:"`

### S6 - Texto da página do PDF selecionável · 4 arquivos · 7 KB · ~1k

**C52** - Depois de desenhar a página de uma citação de Saúde, o visualizador tem uma camada de texto do pdf.js sobre o canvas (mesma caixa, ±2 px), com `user-select` diferente de `none`, cujo texto contém as 5 primeiras palavras do trecho citado (crit. 52)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C52:"`

### S7 - A área de cada candidato no tom do próprio PDF; concordância em verde · 5 arquivos · 35 KB · ~9k

**C53** - O arquivo de tokens declara exatamente estes valores (crit. 53):
- `--cand-lula: #ee481a`, `--cand-flavio-bolsonaro: #004f9f` e `--semelhanca: #2f7a55`;
- `--tom-lula: oklch(95% 0.03 35)`, `--tom-flavio-bolsonaro: oklch(95% 0.03 258)` e `--tom-semelhanca: oklch(95% 0.03 158)`;
- `--tom-lula-forte`, `--tom-flavio-bolsonaro-forte` e `--tom-semelhanca-forte` em `oklch(93.5% 0.04 <35|258|158>)`.

Proof: `npx vitest run tests/interface.test.ts -t "C53:"`

**C54** - Os tons do candidato aparecem assim (crit. 54):
- Em 1366 px, a coluna de cada candidato em `/tema/saude` e o cartão de cada plano em `/sobre` têm fundo `--tom-<cand>` e `border-top` de 6 px na cor `--cand-<cand>`.
- Em 390 px, a aba selecionada tem fundo `--tom-<cand>`, `border-top` de 4 px na cor do candidato e `border-bottom` de largura 0 ou transparente.
- Cada item de Omissões tem fundo `--tom-<tratado_por>`.

Proof: `npx playwright test e2e/interface-cores.spec.ts --project=desktop-chrome -g "C54:"`

**C55** - Verificado em `/`, `/tema/saude` (tudo aberto), `/semelhancas`, `/diferencas` e `/sobre` (crit. 55):
- nenhum elemento visível com texto próprio e sem `aria-hidden` tem `color` igual a `#ee481a`, `#004f9f` ou `#2f7a55`;
- cada lado dos itens de dois lados tem `border-top` de 3 px na cor do seu candidato;
- o quadradinho antes do nome é um elemento ou pseudo-elemento sem texto, com fundo na cor do candidato.

Proof: `npx playwright test e2e/interface-cores.spec.ts --project=desktop-chrome -g "C55:"`

**C56** - Calculados a partir dos valores do arquivo de tokens (crit. 56):
- `--tinta` e `--tinta-2` têm contraste ≥ 4,5:1 sobre `--papel` e sobre cada um dos 6 tons, normais e fortes;
- `#ee481a`, `#004f9f` e `#2f7a55` têm contraste ≥ 3:1 sobre `--papel`, sobre o seu tom e sobre o seu tom forte;
- `#ee481a` sobre `--tom-lula-forte` mede 3,05:1 (±0,02).

Proof: `npx vitest run tests/interface.test.ts -t "C56:"`

**C57** - Nas ordens `ab` e `ba`, e depois de "Trocar ordem", todo elemento com `data-cand="lula"` tem as cores e os tons de Lula, e todo elemento com `data-cand="flavio-bolsonaro"` os de Flávio. Vale para coluna, aba, lado, omissão e quadradinho (crit. 57)
Proof: `npx playwright test e2e/interface-cores.spec.ts --project=desktop-chrome -g "C57:"`

**C58** - A concordância fica em verde e a diferença em grafite (crit. 58):
- Em `/`, o destaque de Semelhanças tem fundo `--tom-semelhanca`, `border-top` de 4 px `#2f7a55` e glifo "=" com `color` `#2f7a55`.
- Em `/tema/saude`, a seção de Semelhanças tem fundo `--tom-semelhanca`, `border-top` de 6 px `#2f7a55` e glifo "=" verde.
- Em `/semelhancas`, cada grupo de tema tem fundo `--tom-semelhanca` e `border-top` de 6 px `#2f7a55`, e o título da página traz o glifo "=" (`svg`) com `color` `#2f7a55`.
- A seção Diferenças do tema e o título de Omissões usam `--tinta-2` nos fios e glifos, sem fundo de tom.

Proof: `npx playwright test e2e/interface-cores.spec.ts --project=desktop-chrome -g "C58:"`

**C59** - No visualizador de `Programa-Governo-LULA-2026.pdf`, a barra tem no topo uma faixa (borda superior) de pelo menos 4 px na cor `#ee481a`. No de `plano-de-governo_flavio.pdf`, a faixa é `#004f9f` (crit. 59)
Proof: `npx playwright test e2e/interface-visualizador.spec.ts --project=desktop-chrome -g "C59:"`

### S8 - Direção visual "cotejo" · 10 arquivos · 95 KB · ~24k

**C60** - Em `/tema/saude`, as fontes ficam assim (crit. 60):
- `h1` e o trecho citado têm `font-family` começando por "Newsreader", e o `body` por "Atkinson Hyperlegible Next";
- toda requisição de fonte vai para `/fontes/` do próprio domínio;
- há um único `<link rel="preload" as="font">`, para a Atkinson;
- as `FontFace` têm `display` = "swap";
- `web/package.json` traz `@fontsource-variable/newsreader` e `@fontsource-variable/atkinson-hyperlegible-next` na versão exata `5.3.0`.

Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C60:"`

**C61** - O arquivo de tokens declara `--papel: oklch(97.6% 0.008 85)`, `--tinta: oklch(24% 0.02 265)`, `--tinta-2: oklch(43% 0.018 265)` e `--fio: oklch(84% 0.013 85)`. Nenhum CSS do site ou do visualizador contém `#fff`, `#ffffff`, `#000` ou `#000000` (crit. 61)
Proof: `npx vitest run tests/interface.test.ts -t "C61:"`

**C62** - Verificado em `/`, `/tema/saude` (tudo aberto), `/semelhancas`, `/diferencas`, `/sobre`, `/chat` e no visualizador (crit. 62):
- nenhum elemento tem `box-shadow` diferente de `none` nem `background-image` com gradiente;
- nenhum elemento com `border-radius` > 0 tem borda esquerda ou direita ≥ 2 px;
- os itens de lista se separam por borda inferior de 1 px, e os `h2` de seção por borda inferior de 2 px;
- bordas de 6 px só existem nas áreas de C54 e C58 e na seção Diferenças.

Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C62:"`

**C63** - Em 390 e 1366 px, em todas as rotas do site (sem o visualizador), todo elemento visível com texto próprio e sem `aria-hidden` tem `font-size` calculado de 13, 15, 17 ou 21 px. A exceção é o `h1`, que fica entre 36 e 60 px (crit. 63)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C63:"`

**C64** - Os itens de cada lista mostram o número "01", "02", … na ordem, com `font-variant-numeric` contendo `tabular-nums`. Cada trecho citado tem `font-family` Newsreader e `font-style: italic`, e as aspas de abertura têm `color` igual à cor do candidato da citação (crit. 64)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C64:"`

**C65** - Nos destaques de `/` e nos `h2` de seção de `/tema/saude`, o glifo de Semelhanças é um `svg` "=" com `color` `#2f7a55`, e o de Diferenças é um `svg` "≠" com `color` = `--tinta-2` (crit. 65)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C65:"`

**C66** - Sem movimento reduzido, abrir um item fechado roda no conteúdo uma animação de 260 ms cujos `@keyframes` só têm `opacity` e `transform`. Um item que chega aberto no HTML (`<details open>`) tem `animation-name: none` depois do carregamento (crit. 66)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C66:"`

**C67** - Com `reducedMotion: "reduce"`, abrir um item em `/tema/saude` deixa `animation-name: none` no conteúdo, e nenhum elemento tem `transition-duration` maior que 0 s (crit. 67)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C67:"`

**C68** - No grupo de filtros, o botão com `aria-pressed="true"` tem `background-color` = `--tinta` e `color` = `--papel`, e os outros têm fundo transparente e texto `--tinta`. "Trocar ordem dos candidatos" é um `button` com um `svg`, borda de largura 0 e fundo transparente. Os rótulos são exatamente "Trocar ordem dos candidatos", "Só semelhanças", "Só diferenças" e "Mostrar tudo" (crit. 68)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C68:"`

**C69** - Em todas as rotas do site e no visualizador, o `innerText` do `body` não contém "≠", "←", "→", "▸" nem "▾". O nome acessível dos links "Ver no PDF" e "Todos os temas" não contém seta (crit. 69)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C69:"`

**C70** - Os trechos citados têm `hyphens` diferente de `auto` em 160, 339, 390 e 1366 px. O texto dos itens tem `hyphens: auto` em 339 px e diferente de `auto` em 340 px (crit. 70)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C70:"`

**C71** - Toda `ul` e `ol` com `list-style-type: none` tem `role="list"`, e os números de item ("01", "02", …) têm `aria-hidden="true"` (crit. 71)
Proof: `npx playwright test e2e/interface-cotejo.spec.ts --project=desktop-chrome -g "C71:"`

### Invariantes de regressão · 4 arquivos · 10 KB · ~2k

**C72** - Continuam verdes, sem afrouxar nenhuma asserção (crit. 72):
- o e2e nos três perfis;
- o vitest;
- o JS inicial ≤ 200 KB em gzip;
- o Lighthouse mobile em `/` e `/tema/saude`, com Performance ≥ 90, Acessibilidade ≥ 90 e LCP < 2,0 s;
- o axe, com zero `serious` ou `critical` em toda rota;
- o reflow a 160 px.

Testes existentes cujo valor esperado o plano muda são atualizados para o valor novo, e só nesses pontos:
- `navegacao.spec.ts`: "Omissões (n)" no lugar de "Tratado só por um dos planos" (Impact); sem `role="tabpanel"` a partir de 768 px (C39).
- `ordem.spec.ts`: "Trocar ordem" fora do cabeçalho (Impact); o link "Todos os temas" sem seta (C69).
- `transparencia.spec.ts`: a regra "neutro" passa a ser a do C73; o link "Todos os temas".
- `chat.spec.ts`: o link "Chat por tema" sem seta (C69).
- `geo.spec.ts` e `seo.test.ts`: os títulos "Metodologia" e "Sobre" (C17).

Proof: `npx playwright test e2e/a11y.spec.ts e2e/navegacao.spec.ts e2e/ordem.spec.ts e2e/pdf.spec.ts e2e/transparencia.spec.ts`
Proof: `npx vitest run tests/guardas.test.ts tests/render.test.tsx tests/consulta.test.ts tests/ask-cliente.test.ts tests/seo.test.ts`
Proof: `npm run orcamento`
Proof: `npm run lighthouse`

**C73** - Na tela de tema (1024 e 390 px) e em `/sobre`, os elementos equivalentes dos dois candidatos têm o mesmo `tagName`, as mesmas classes e os mesmos estilos calculados: coluna ou painel, aba, `h3`, item, citação, lado e omissão. Só podem diferir as propriedades que leem `--cor-cand`, `--tom-cand` ou `--tom-cand-forte`. No CSS servido, toda regra cujo seletor cita `data-cand` só declara `order`, `--cor-cand`, `--tom-cand` ou `--tom-cand-forte` (crit. 73)
Proof: `npx playwright test e2e/transparencia.spec.ts --project=desktop-chrome -g "neutro"`

**C74** - Continuam no tema e nas visões transversais a linha `.atualizacao`, com `<time datetime>` igual ao `dateModified` do JSON-LD, o `<title>`, o `canonical` e o JSON-LD (crit. 74). Com `url` em `dados/site.yaml`, o build grava `<link rel="canonical">` com o endereço absoluto de cada rota, menos a 404
Proof: `npx playwright test e2e/geo.spec.ts --project=desktop-chrome`
Proof: `npx vitest run tests/seo.test.ts`
Proof: `npx vitest run tests/interface.test.ts -t "C74:"`

**C75** - Em `/chat` e `/chat/conversa`, a direção da S8 vale (coberta por C60 a C63 e C69), e `e2e/chat.spec.ts` (desktop e Android) e `e2e/ask.spec.ts` (prévia) ficam verdes. A entrada do chat continua: o botão "Chat por tema" na tela inicial, com `href="/chat"`, fora da grade de temas (Impact, plano do chat, decisão 11)
Proof: `npx playwright test e2e/chat.spec.ts e2e/ask.spec.ts`
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C75:"`

**C76** - Na imagem `rag-planos-web`, `fc-match "system-ui:bold"` e `fc-match "sans-serif:bold"` resolvem para `LiberationSans-Bold.ttf` (Impact, ambiente de teste)
Proof: `fc-match "system-ui:bold" | grep -q LiberationSans-Bold && fc-match "sans-serif:bold" | grep -q LiberationSans-Bold`

**C77** - `/tema/tema-inexistente` e `/qualquer/coisa` respondem 404 com link para `/` (Surface)
Proof: `npx playwright test e2e/navegacao.spec.ts --project=desktop-chrome -g "404: tema inexistente"`

**C78** - O botão "Trocar ordem dos candidatos" aparece em `/tema/<id>`, `/semelhancas`, `/diferencas` e `/sobre`, e não aparece em `/`, `/metodologia`, na 404 nem no visualizador (premissa "Lugar do Trocar ordem" e Impact do plano)
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C78:"`

**C79** - Os acréscimos à §6 que o dono manteve em 25/10/2026: em `/`, um `h2` "Temas" antecede a grade de temas; na tela de tema, o `h2` "O que cada plano propõe" antecede abas e colunas; a faixa do aviso traz o rótulo "Aviso" fora do elemento com o texto do aviso, que continua exato (AC 28). Nenhum outro título ou rótulo fora da §6 aparece nessas telas
Proof: `npx playwright test e2e/interface-inicio.spec.ts --project=desktop-chrome -g "C79:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /tema/<theme_id>?filtro=<valor>` statuses (2) | 200 C33 · 404 C77 | - |
| `?filtro` valores (4) | `semelhancas` C32 · `diferencas` C33 · ausente C32 · desconhecido C34 | - |
| `GET /semelhancas#g-<theme_id>`, `GET /diferencas#g-<theme_id>` statuses (1) | 200 C36 | - |
| portas do `Landing` (4) | porta 1 C32 · porta 2 C36 · porta 3 C53 · porta 4 C60 | - |
| temas publicados (8) | `programas-sociais` C2, C10 · `seguranca-publica` C2, C10 · `saude` C2, C10 · `tecnologia-ia` C2, C10 · `educacao` C2, C10 · `meio-ambiente` C2, C10 · `custo-de-vida` C2, C10 · `agronegocio` C2, C10 | - |
| ordens sorteadas (2) | `ab` C1, C6, C12, C38, C57 · `ba` C1, C6, C12, C38, C57 | - |
| rotas do site e visualizador (10) | `/` C16, C17, C48, C63, C69 · `/tema/<id>` C16, C17, C48, C63, C69 · `/semelhancas` C16, C17, C48, C63, C69 · `/diferencas` C16, C17, C48, C63, C69 · `/metodologia` C16, C17, C48, C63, C69 · `/sobre` C16, C17, C48, C63, C69 · `/chat` C16, C17, C48, C63, C69 · `/chat/conversa` C16, C17, C48, C63, C69 · 404 C16, C17, C48, C63, C69 · visualizador C48, C69 | - |
| falhas do visualizador (2) | arquivo desconhecido C22 · download abortado C22 | - |
| controles com hover (6) | filtro C40 · "Trocar ordem" C40 · cartão de tema C40 · destaque C40 · `summary` C40 · aba C40 | - |
| links de navegação ≥ 44 px (4) | voltar C42 · rodapé C42 · títulos-link C42 · links de `/sobre` C42 | - |
| texto corrido ≤ 68ch (3) | abertura C43 · `/metodologia` C43 · `/sobre` C43 | - |
| espaço não separável (3) | "pág. N" C46 · "Nome (Partido)" C46 · "2º turno" C46 | - |
| tokens de cor do S7 (9) | `--cand-lula` C53, C56 · `--cand-flavio-bolsonaro` C53, C56 · `--semelhanca` C53, C56 · `--tom-lula` C53, C56 · `--tom-flavio-bolsonaro` C53, C56 · `--tom-semelhanca` C53, C56 · `--tom-lula-forte` C53, C56 · `--tom-flavio-bolsonaro-forte` C53, C56 · `--tom-semelhanca-forte` C53, C56 | - |
| tokens neutros (4) | `--papel` C61 · `--tinta` C61 · `--tinta-2` C61 · `--fio` C61 | - |
| lugares do tom do candidato (3) | coluna C54 · aba C54 · omissão C54 | - |
| lugares da cor plena (4) | faixas de 6 e 4 px C54 · fio de 3 px dos lados C55 · quadradinho C55 · aspas C64 | - |
| tamanhos de texto (5) | 13 px C63 · 15 px C63 · 17 px C63 · 21 px C63 · `h1` de 36 a 60 px C63 | - |
| glifos fora da fonte (5) | "≠" C69 · "←" C69 · "→" C69 · "▸" C3 · "▾" C3 | - |
| lugar do "Trocar ordem" (8) | `/tema/<id>` C78 · `/semelhancas` C78 · `/diferencas` C78 · `/sobre` C78 · `/` C78 · `/metodologia` C78 · 404 C78 · visualizador C78 | - |
| startup: CSS, tokens e fontes nas saídas do build, todas montadas pelo mesmo `build.ts` (3) | `dist-teste` C60 · `dist` C72 (`guardas.test.ts`, build no nível do comando) · `dist-previa` C75 (`ask.spec.ts`) | - |

- Claims naming a status code, route or response shape: C33, C36, C48, C49, C77 - cada uma com prova que atravessa o servidor de teste (`servir.mjs`)
- Nenhum outro check afirma mais do que o caso que a prova exercita
- As provas sem seletor de C72, C74, C75 e C76 são deliberadas: esses checks afirmam que uma suíte inteira continua verde, ou que um comando do ambiente responde, e não um caso isolado

## Test policy

O repositório diz onde ficam os testes e como rodá-los (CI, `package.json`). Não diz qual nível
prova qual código, então estas linhas são a régua desta construção. Por decisão do dono
(19/10/2026), elas valem só para esta feature e não vão para um arquivo de diretrizes.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decide, alcançado pelo navegador | uma no e2e **e** uma unitária | o contrato no e2e; um caso por linha da tabela de decisão no unitário |
| Decide, sem fronteira | uma unitária | um caso por linha da tabela de decisão |
| Apresentação (CSS, marcação sem condição) | uma no e2e, por estilo calculado | os valores do check, nos pontos de largura que o check nomeia |
| Repasse, instrumentação | nenhuma própria | coberta pela prova de quem a usa |

Evidence:

- leitura de `?filtro`: decide entre 3 valores + desconhecido, 4 ramos -> decide, alcançado pelo navegador (C32, C34)
- ordem das omissões: decide pela ordem vigente, 2 ordens × 2 candidatos -> decide, alcançado pelo navegador (C6)
- agrupamento de citações consecutivas: decide por arquivo e página, 3 casos (mesmo grupo, troca de página, troca de arquivo) -> decide, alcançado pelo navegador (C10)
- contraste dos tokens: cálculo puro sobre 9 + 4 valores -> decide, sem fronteira (C56)
- montagem do HTML com `$&`, `$'`, `$$`: substituição no build -> decide, sem fronteira, provada no nível do comando como em `tests/guardas.test.ts` (C50)
- navegação no cliente (`App.tsx`): o último destino tocado vence, a rolagem é guardada e devolvida por entrada do histórico, e a âncora da mesma página não busca dados nem empilha entrada -> decide, alcançado pelo navegador (C28-C31); classificada na rodada 1 do verificador
- paginação do visualizador: o pedido mais recente vence, o foco passa ao outro botão quando o focado se desabilita, e só uma largura nova redesenha -> decide, alcançado pelo navegador (C19, C20, C26); classificada na rodada 1 do verificador
- análogo no repositório: `tests/consulta.test.ts` prova a lógica do chat no próprio nível, um caso por intenção, e `e2e/chat.spec.ts` prova o contrato no navegador

Cost: 8 provas unitárias em `tests/interface.test.ts`, duas delas da rodada 1 (navegação no
cliente e paginação do visualizador). Sem estas linhas, essas decisões ficariam provadas só por
um caminho que o e2e por acaso percorre.

## Swept

- validation: C34 (filtro desconhecido), C22 (arquivo desconhecido)
- failure modes: C22 (download do PDF falha), C30 (JSON lento)
- idempotency: C32 (filtro com `replaceState`, sem entrada no histórico), C28
- authorization: n/a - site estático público, sem login nem área restrita
- concurrency: C19 (dois toques durante o desenho), C31 (segundo destino antes de o primeiro carregar)
- data lifecycle: n/a - nada é gravado; os JSONs aprovados e os hashes não mudam (Impact, stored data)
- dependency failure: C22 (PDF indisponível), C60 (fontes com `swap`: sem a fonte, o texto aparece na fonte de reserva); existing - `App.ir` cai para navegação completa quando o JSON falha
- state transitions: C1 (pré-JS para hidratado sem trocar painel), C7, C20, C21
- observability: n/a - o site é estático e não registra nada (sem backend nem analytics); os anúncios ao leitor de tela são C30 e C35

## Handoff

- S1 = 17k; S2 = 20k (37k); S3 = 4k (41k); S4 = 11k (52k); S5 = 13k (65k); S6 = 1k (66k); S7 = 9k (75k); S8 = 24k (99k); invariantes = 2k (101k); mais a leitura do plano e destes checks, ~17k: ~118k, abaixo do orçamento de 150k. Um construtor, sem handoff.
- A conta soma os arquivos de cada fatia, então os compartilhados (`estilo.css`, `paginas.tsx`) entram mais de uma vez. Ela não inclui a saída dos testes nem as capturas de tela, que a S8 vai produzir em volume.
- Boundary: C1-C77 fechados em `1111704` (S7 e a regra do C73 em `fb807f1`; C76 em `e601c4a`), com todas as provas verdes nesse commit: tsc, vitest 46/46, `build:teste`, Playwright 142/142 nos quatro projetos, orçamento 52,8 KB gzip e Lighthouse 99/100 em `/` (LCP 1,63 s) e em `/tema/saude` (LCP 1,56 s). O C72 depende de o dono ratificar duas coisas que a lista dele não previu: (1) testes existentes mudados para o valor novo que outro check fixa, fora dos pontos listados: `ordem.spec.ts` e `pdf.spec.ts` acham o painel por `.painel` (C39), `a11y.spec.ts` chega a "Mostrar tudo" com dois Tab (C5), `navegacao.spec.ts` espera as omissões de `/diferencas` na ordem vigente (C6) e "pág. N" com U+00A0 (C46), `chat.spec.ts` idem (C46), e o teste "mesma origem" de `transparencia.spec.ts` ganhou 150 s de prazo, porque com "Mostrar tudo" por último abre todos os itens; nenhuma asserção foi afrouxada; (2) `web/scripts/servir.mjs` passou a comprimir texto com gzip, como o Pages: sem isso, com as fontes da porta 4, o Lighthouse media LCP de 2,39 s e 2,70 s.
- Settled mid-build: antes da hidratação, aba e painel são escolhidos pelo CSS com `data-pre` e `:first-child`/`:last-child`, posições na ordem "ab" do HTML pré-renderizado, para nenhuma regra com `data-cand` declarar mais que `order` e as três variáveis (C73); a abertura de `/` traz os dois pares de nomes e o CSS mostra o da ordem sorteada, e `LEAD_INICIO` virou a frase que não depende da ordem (também a descrição de `/` no JSON-LD); a prova do C73 iguala as três variáveis nos dois candidatos e compara todos os estilos calculados, menos `order` (a própria ordem sorteada) e as medidas, que dependem do texto de cada plano; o candidato da citação fica no `blockquote.trecho`, e não no `li`, para não somar `li[data-cand]` às omissões do C54; o último grupo das visões transversais tem altura mínima para a âncora dele também chegar ao topo (C36); o visualizador mantém o próprio mapa arquivo -> candidato, para não dividir um pedaço de JS com o site; o `h1` do visualizador mostra só o arquivo e diz ", página N de M" ao leitor de tela.
- Abandoned: tirar o `preload` da Atkinson (o LCP não melhorou e apareceu deslocamento de layout); carregar a Newsreader só depois da hidratação (sem JS os títulos ficariam sem a fonte); numerar o índice de temas de `/` com elementos, como no protótipo (o texto exato de cada cartão é prova de `navegacao.spec.ts`), trocado por contador CSS com texto alternativo vazio.
- Rodada 2 - Boundary: gaps da rodada 1 do verificador e C16, C17, C58, C74, C78 e C79 reescritos ou novos fechados em `e829ae3` (`c6442e1` navegação e paginação em funções puras com provas unitárias, C26 e C28; `9b06ab4` título, aviso e conteúdo na ordem da §6, rodapé com "·", glifo "=" em `/semelhancas`, C46, C55, C72, C78, C79; `e829ae3` C74), com todas as provas verdes nesse commit: tsc, vitest 53/53, `build:teste`, Playwright 144/144 nos quatro projetos, orçamento 53,0 KB gzip, Lighthouse 99/100 em `/` (LCP 1,62 s) e em `/tema/saude` (LCP 1,56 s). Os mutantes F1 (redesenho por largura desligado) e F5 (lados das visões transversais sem a cor) foram reaplicados no contêiner e morrem no C26 e no C55.
- Rodada 2 - Settled mid-build: o que a rota traz no topo (abertura de `/`, descrição e data de geração do tema, data das visões transversais, texto de `/chat/conversa`) sai do `header` e vai para um `.sob-aviso` logo depois da faixa do aviso, sem o recuo do link de voltar, alinhado ao aviso e ao conteúdo; os separadores "·" do rodapé são `span` com `aria-hidden`; as provas unitárias exigidas pela política de testes estão em `tests/interface.test.ts` com os títulos "C19:", "C20:", "C26:", "C28:", "C29:" e "C31:", sobre `src/navegacao.ts` e `src/paginacao.ts` (este só importado pelo visualizador, para ele não dividir um pedaço de JS com o site); o C74 builda com `SITE_YAML` apontando para um site.yaml temporário, nunca o `dados/site.yaml`; a comparação exata de `navegacao.spec.ts` usa `expect.poll` sobre `allTextContents()` com `toEqual`, que espera a hidratação aplicar a ordem sorteada sem normalizar espaços.
- Rodada 2 - Abandoned: pôr a margem entre aviso e conteúdo com margem negativa no `.sob-aviso` (trocada por `.faixa-aviso:has(+ .sob-aviso)`); zerar o contador de buscas antes do "Pular para o conteúdo" no C28 (a asserção conta todas as buscas desde a abertura de `/`); um glifo "≠" no título de `/diferencas`, que nenhum check pede.
