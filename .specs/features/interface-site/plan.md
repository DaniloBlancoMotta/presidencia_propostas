# Interface do site: fiel às telas da §6, estável no 4G e utilizável no celular

## Problem

Quem abre o site no celular não fica sabendo, na tela inicial, quem está sendo comparado. A página não nomeia os candidatos nem o 2º turno. Ao entrar num tema, a pessoa lê dados que podem vir na ordem errada. Enquanto o JavaScript carrega no 4G, o HTML pré-renderizado mostra sempre a aba e o painel de Flávio Bolsonaro, qualquer que seja o candidato que o sorteio do `<head>` pôs primeiro. A troca para o outro candidato só acontece na hidratação, o que contradiz a decisão 12 e o AC 20. Achados E01 e P01, confirmados no `dist-teste/tema/saude/index.html`.

Os mesmos problemas de neutralidade aparecem em dois outros pontos:

- As omissões do tema e de `/diferencas` seguem a ordem do JSON. Em `/sobre`, a ordem do DOM e do teclado contradiz a ordem da tela. "Trocar ordem dos candidatos" não muda nenhuma das duas listas (P02, P03, E02, V01).
- A tela de tema não segue o desenho decidido. Faltam as contagens de "Semelhanças (n)", "Diferenças (n)" e "Omissões (n)" (D3, P10, V03).
- O nome do candidato se repete logo abaixo da própria aba (V08, P13).

Os outros achados se dividem assim:

- **Indicador de expandir.** É o triângulo nativo, preto e sobreposto à borda do cartão (V02, C6, D2, E04).
- **Lugar do "Trocar ordem".** Fica num cabeçalho global, inclusive em telas sem candidatos (V04, D14).
- **Espaço no celular.** Cabeçalho e aviso ocupam cerca de 22% da primeira tela do iPhone 12. O primeiro bullet do tema começa em cerca de 575 px (V06).
- **Grade da página inicial no desktop.** Monta 6 + 4. Semelhanças e Diferenças têm o mesmo tamanho dos temas e por isso não se destacam (D1, V07, D8).
- **Visualizador de PDF.** Com zoom de 200% em 320 px, a barra fixa fica mais alta que a tela e cobre a página o tempo todo (C1, E05, V12). Além disso:
  - tocar duas vezes em "Próxima página" no 4G desenha a página errada (C2);
  - o foco cai no `<body>` quando o botão é desabilitado (C3);
  - os controles parecem funcionar antes de o PDF carregar (C4).
- **Navegação no cliente.**
  - O link "Pular para o conteúdo" empilha uma entrada repetida no histórico (P04, C8, E14).
  - Voltar de um tema para `/diferencas` (cerca de 6.800 px no celular) leva ao topo (P05).
  - Nada indica que o toque foi recebido enquanto o JSON baixa (P06).
  - O filtro escolhido não vai para a URL, então não dá para mandar o link de "Saúde, só diferenças" (P07, V21).
- **Estados e tipografia.** Nenhum controle tem estado de hover nem `:active` (D4, E03, P18, V20). Links de navegação ficam com menos de 44 px de altura (V10). O texto corrido chega a cerca de 140 caracteres por linha no desktop (D5).

Pela decisão 22 e pelo AC 31, os dois candidatos aparecem hoje com as mesmas cores. Para saber de quem é um bullet, a pessoa precisa achar o nome no topo da coluna ou na aba. Numa lista longa no celular, o nome já saiu da tela depois de rolar, e nada no cartão diz de qual plano ele é. Semelhanças e Diferenças também usam o mesmo acento. Em 18/10/2026 o dono decidiu distinguir cada candidato pela cor do próprio PDF e usar um verde neutro para Semelhanças. No mesmo dia, pediu que as áreas da interface também levassem essas cores: laranja-avermelhado no que é de Lula, azul no que é de Flávio Bolsonaro e verde no que os dois planos propõem em comum. A tabela abaixo foi medida com PyMuPDF nos dois arquivos do corpus:

| PDF | Cor tipográfica mais usada | Outras cores do arquivo |
| --- | --- | --- |
| `Programa-Governo-LULA-2026.pdf` | `#ee481a`, 569 caracteres | amarelo `#ffbf0f` (faixas), vermelho `#ee302d` (faixa da capa), azul `#495eab`, verdes `#1c861d`, `#40ad49`, `#52943b` |
| `plano-de-governo_flavio.pdf` | `#004f9f`, 2.339 caracteres | azul da capa `#005090`, amarelo `#ffd000` |

O site também não tem cara própria. Usa a fonte do sistema e cartões arredondados iguais em toda parte, e a hierarquia vem só do tamanho. Nada na tela diz que ali se confere o texto de documentos oficiais. Em 18/10/2026 o dono pediu uma direção visual própria (`/frontend-design`). O protótipo "cotejo", com os dados reais de Saúde, está em `http://localhost:4173/prototipo/` enquanto o contêiner de teste estiver no ar.

**Evidência.** Revisão de 18/10/2026: cinco revisores (três de código pelas Web Interface Guidelines e dois visuais sobre 18 capturas no iPhone 12 e em 1366 px) produziram 117 achados. Céticos independentes confirmaram 100: 5 de severidade alta, 35 média e 60 baixa. Refutaram 13 e barraram 4 por contrariarem a §6. A lista está em `achados-revisao.txt`, nesta pasta.

**O que muda para quem usa.** A pessoa vê na primeira tela quem está sendo comparado. A ordem sorteada vale desde a primeira pintura e em todas as listas. A tela de tema fica como o desenho, com contagens, e cabe melhor no celular. O PDF fica legível com zoom. O Voltar e os links compartilhados preservam onde a pessoa estava.

## Flow

Reusa o pré-render de `web/scripts/build.ts`, os componentes `Tema`, `Transversal` e `Citado`, o padrão `html[data-ordem]` da decisão 12 e os tokens neutros de `estilo.css`. Nenhuma biblioteca nova: a camada de texto do item 6 já vem no `pdfjs-dist` que o visualizador usa.

1. a comparação aprovada -> `web/scripts/build.ts` (exists) - pré-renderiza cada rota com `App` (exists) e recalcula os hashes do CSP do CSS e do script inline
2. o navegador carrega a página -> script inline do head em `index.html` (exists) grava `data-ordem`, e `estilo.css` (exists) escolhe aba, painel e ordem antes da hidratação
3. `entry-client.tsx` (exists) hidrata `App` (exists), que lê `?filtro` (door 1) e anuncia mudanças numa região `role="status"`
4. navegação no cliente -> `App.tsx` (exists), função `ir` - mostra "Carregando…", busca `/comparacoes/<id>.json`, guarda e restaura a rolagem e deixa as âncoras da mesma página com o navegador
5. "Ver no PDF" -> `pdf/visualizador.html` (exists) e `visualizador.ts` (exists) - desenha com paginação serializada, foco preservado e, no item 6, camada de texto

## Impact

| Front | What changes |
| --- | --- |
| domain | título "Tratado só por um dos planos" passa a "Omissões (n)", como no desenho da §6. Quem depende do texto antigo: `web/e2e/navegacao.spec.ts` e a frase de `/metodologia` que cita "o botão do topo" |
| domain | rodapé: "Como funciona · Sobre os dados" passa a "Metodologia · Sobre", e os títulos das duas páginas acompanham. Quem depende dos rótulos antigos: e2e de navegação e de teclado |
| domain | o botão "Trocar ordem dos candidatos" sai do cabeçalho global e vai para as telas que mostram os dois candidatos (tema, `/semelhancas`, `/diferencas`, `/sobre`). Quem depende do lugar antigo: `web/e2e/ordem.spec.ts` |
| domain | decisão 22 e AC 31 do `plano-final.md` são substituídos pelo dono (18/10/2026): os candidatos passam a ter cor de identidade e tom claro de área, com a cor plena só em elementos não textuais. Quem depende da regra antiga: `web/e2e/transparencia.spec.ts:47` ("neutro"). Hoje esse teste só aceita `order` nas regras com `data-cand` e exige fundo e borda iguais nos dois painéis; passa a aceitar as três variáveis do critério 73 e a comparar os demais estilos calculados |
| domain | o cabeçalho global com a marca "Compare os planos de governo 2026" deixa de existir. Cada rota abre com o próprio título, precedido de "←" para `/` em toda rota exceto `/`, e logo abaixo vem o aviso de IA |
| stored data | nada a migrar. Os JSONs aprovados e os hashes de `revisao/aprovados.yaml` não mudam. Só o HTML gerado e o CSS inline mudam, e o build já recalcula o hash do CSP |
| trabalho em paralelo | a sessão `rag-planos-presidencia-50` constrói o chat por tema (`/chat`, campo `executivo` no contrato) e mexe em `App.tsx`, `paginas.tsx`, `Citado.tsx`, `estilo.css`, `build.ts`, `guardas.ts` e nos e2e. Ordem combinada em 18/10: o chat é commitado primeiro, e esta feature começa a partir desse commit. Isso foi feito em 19/10, a pedido do dono, em `dceb17c` (pipeline), `84b5a8a` (`/ask`) e `b0d599e` (site). A direção visual da S8 vale também para `/chat` e `/chat/conversa`, e as entradas do chat ficam: o botão na tela inicial, fora da grade, e o link no rodapé (critérios 16 e 17) |
| GEO em paralelo | a sessão `rag-planos-presidencia-50` também acrescenta, a pedido do dono: `<title>` descritivo (`tituloDocumento`), `canonical`, JSON-LD, `og:locale`, `robots.txt`, `llms.txt` e `sitemap.xml`, além do componente `Atualizacao` ("Comparação gerada em…", com `<time datetime>`) no tema e nas visões transversais, com teste em `e2e/geo.spec.ts`. O redesenho mantém tudo isso (critério 74) |
| já corrigido por outra sessão | `3efe517` (sessão `rag-planos-presidencia-a9`, relatório de segurança) trocou por função os `.replace` de placeholders do `web/scripts/build.ts`. O critério 50 fica só com a prova: um JSON de teste com `$&`, `$'` e `$$` sai idêntico no HTML. A mesma sessão levou a imagem do site para Playwright 1.64.1 em `12ffc5a`, e esta feature parte dessa base |
| ambiente de teste | `docker/web.Dockerfile` ganha um alias do fontconfig para Liberation Sans, já presente na imagem, porque hoje as capturas saem sem negrito (D6, V23) |

## Relations

None - no stored-data shape change

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /tema/<theme_id>?filtro=<valor>` | `filtro` = `semelhancas` ou `diferencas`, opcional | a tela do tema com aquele filtro aplicado; valor ausente ou desconhecido = "Mostrar tudo" | `200`, `404` (tema inexistente, como hoje) |
| `GET /semelhancas#g-<theme_id>`, `GET /diferencas#g-<theme_id>` | âncora do tema | a visão transversal rolada até o grupo do tema | `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Filtro na URL (porta 1) | `?filtro=semelhancas` e `?filtro=diferencas` em `/tema/<theme_id>`; "Mostrar tudo" = sem o parâmetro; atualizado por `history.replaceState`, sem criar entrada no histórico | `#semelhancas`: colide com o link de pular e com âncoras; `/tema/<id>/semelhancas`: triplica as páginas pré-renderizadas e muda as regras de 404 |
| Cor e tom de área por candidato (porta 3) | tokens num só arquivo: `--cand-lula: #ee481a`, `--cand-flavio-bolsonaro: #004f9f`, `--semelhanca: #2f7a55`, `--tom-lula: oklch(95% 0.03 35)`, `--tom-flavio-bolsonaro: oklch(95% 0.03 258)`, `--tom-semelhanca: oklch(95% 0.03 158)` e os `--tom-*-forte` em `oklch(93.5% 0.04 <matiz>)`. As únicas regras cujo seletor cita `data-cand` são `order` e `[data-cand="<id>"] { --cor-cand: var(--cand-<id>); --tom-cand: var(--tom-<id>); --tom-cand-forte: var(--tom-<id>-forte) }`. Os componentes leem só essas três variáveis, por classe (`.coluna`, `.aba`, `.lado`, `.omissao`), nunca por `[data-cand]`. Nunca borda lateral de cartão | cor do candidato no texto: o `#ee481a` mede 3,51:1 sobre o papel e reprovaria em texto, então só o lado de Lula precisaria ser escurecido. Fundo na cor plena ou num tom mais saturado: o texto em tinta perderia contraste e um lado pesaria mais que o outro. Cor da capa (`#ee302d`, `#005090`): é a cor da arte da capa, não a do texto do plano. Tokens neutros (decisão 22 original): substituídos pelo dono |
| Fontes próprias (porta 4) | `@fontsource-variable/newsreader@5.3.0` (títulos e citações) e `@fontsource-variable/atkinson-hyperlegible-next@5.3.0` (texto), OFL-1.1, só o subconjunto latino em woff2 (58 KB, 65 KB na itálica, 34 KB), copiados pelo build para `/fontes/` do próprio domínio, `font-display: swap`, `preload` só da Atkinson | fonte do sistema (decisão 22 original): sem identidade, a direção pedida pelo dono não existe sem tipografia; Google Fonts por CDN: viola o AC 27 e o CSP `font-src 'self'` |
| Âncoras públicas das visões transversais (porta 2) | `#g-<theme_id>`, o id que os `<section>` já têm, com `scroll-margin-top` | criar outro formato de âncora: os ids existentes já servem e não quebram nada |

- Nada mais nesta mudança é difícil de reverter: CSS, posição de botões e texto se revertem num diff.

## Criteria

### S1: Tela de tema igual ao desenho e estável desde a primeira pintura (P1)

O eleitor abre um tema no celular e vê a aba do candidato sorteado, as contagens e indicadores claros, sem repetição.

**Acceptance Criteria**

1. WHILE o bundle JavaScript ainda não executou e a largura é < 768 px THEN a tela de tema SHALL mostrar selecionada a aba e visível o painel do candidato que o `data-ordem` do `<head>` pôs primeiro, e a hidratação SHALL não trocar o painel visível (E01, P01).
2. WHEN `/tema/<id>` é exibida THEN o site SHALL titular as seções "Semelhanças (n)", "Diferenças (n)" e "Omissões (n)", com n igual ao tamanho de cada lista do JSON do tema (D3, P10, V03).
3. The site SHALL desenhar o indicador de cada item expansível como um triângulo preenchido em SVG, "▸" fechado e "▾" aberto, à direita do texto, na cor `--acento` (= `--tinta`), sem o marcador nativo do navegador (V02, C6, D2, E04).
4. WHILE a largura é < 768 px THEN a tela de tema SHALL mostrar o nome do candidato só na aba; o `h3` do painel SHALL continuar no DOM, escondido só visualmente (V08, P13).
5. WHEN `/tema/<id>` é exibida THEN o site SHALL mostrar, nesta ordem, o botão "Trocar ordem dos candidatos" e os filtros "Só semelhanças", "Só diferenças" e "Mostrar tudo", e os três filtros SHALL caber numa só linha a 390 px (P11, V14, V04).
6. The site SHALL listar as omissões, no tema e em `/diferencas`, primeiro as do candidato que aparece primeiro na ordem vigente, mantendo a ordem do JSON dentro de cada candidato (P03, V01).
7. WHEN "Trocar ordem dos candidatos" é tocado THEN a ordem das listas de omissões SHALL se inverter junto com o resto da tela (P03, V01).
8. The site SHALL usar `h3` para o nome do candidato dentro dos itens de semelhança e de diferença, sem saltar de `h2` para `h4` (C5, P09).
9. The site SHALL não criar landmark `region` para cada lado de um item expandido (C19, P25).
10. WHEN um item com citações consecutivas do mesmo arquivo e da mesma página é expandido THEN o site SHALL mostrar todos os trechos, uma só linha "arquivo · pág. N" e um só "Ver no PDF" para esse grupo (V18).
11. WHILE a largura é < 768 px e a altura é ≥ 500 px THEN as abas dos candidatos SHALL ficar fixas no topo enquanto o painel rola (V09).

**Independent test:** no iPhone 12 emulado, com o bundle JS bloqueado e o sorteio forçado em "ba", `/tema/saude` mostra a aba e o painel de Lula. Com o JS liberado, os títulos têm contagens, o indicador ▸/▾ fica à direita, e trocar a ordem inverte também as omissões.

### S2: Início que diz quem está sendo comparado e destaca Semelhanças e Diferenças (P1)

A primeira tela nomeia os candidatos e organiza a grade como o desenho.

**Acceptance Criteria**

12. WHEN `/` é exibida THEN o texto de abertura SHALL ser "Planos de governo de A e B, candidatos ao 2º turno de 2026, registrados no TSE. Escolha um tema para comparar o que cada plano propõe, com o trecho e a página do PDF original.", com A e B = "Nome (Partido)" na ordem vigente (V05, D18, P23).
13. WHILE a largura é ≥ 480 px THEN a grade de `/` SHALL ter Semelhanças e Diferenças numa linha própria, cada um com metade da largura, e os 8 temas em linhas de 4 (D1, V07).
14. WHILE a largura é < 480 px THEN os temas SHALL vir 2 por linha, com o ícone ao lado do rótulo e nenhum rótulo hifenizado; abaixo de 340 px, 1 por linha e os destaques empilhados, sem rolagem horizontal.
15. The site SHALL dar a mesma altura a todos os cartões de uma linha da grade (D8, E17).
16. The site SHALL abrir cada rota com o próprio título, com o aviso de IA logo abaixo e sem barra de marca (D11, V06, V15). Em toda rota exceto `/`, o título SHALL vir precedido de "←" com nome acessível "Todos os temas", que leva a `/`. Em `/chat/conversa`, o link de volta é "Chat por tema" e leva a `/chat`, como no plano do chat (decisão 12); a exceção foi decidida pelo dono em 19/10/2026.
17. The rodapé SHALL mostrar os links "Chat por tema · Metodologia · Sobre" antes da frase "Documentos coletados do TSE em DD/MM/AAAA", e as duas páginas SHALL se titular "Metodologia" e "Sobre" (V16). O link "Chat por tema" vem do plano do chat (decisão 11); manter as entradas do chat foi decisão do dono em 19/10/2026.

**Independent test:** em 390 px, `/` mostra os dois nomes no texto de abertura, uma linha com os dois destaques e duas linhas de 4 temas. Em 1366 px, a grade fica 2 / 4 / 4 sem lacunas.

### S3: Visualizador de PDF legível no celular e com zoom (P1)

"Ver no PDF" mostra a página citada sem a barra cobrir o conteúdo e sem paginação errada.

**Acceptance Criteria**

18. WHILE a largura é < 768 px ou a altura é < 576 px THEN a barra do visualizador SHALL rolar com a página; fora disso, SHALL ficar fixa no topo (C1, E05, V12).
19. WHEN "Próxima página" é tocada duas vezes antes de a primeira página terminar de desenhar THEN o visualizador SHALL desenhar a página atual + 2, e o indicador SHALL mostrar o mesmo número (C2).
20. WHEN a paginação chega à primeira ou à última página e desabilita o botão focado THEN o foco SHALL passar para o outro botão de paginação (C3).
21. WHILE o PDF não terminou de carregar THEN os botões de página SHALL ficar desabilitados e "Baixar o PDF original" SHALL ficar oculto (C4).
22. IF o arquivo pedido é desconhecido ou o download falha THEN o visualizador SHALL esconder canvas e paginação e mostrar a mensagem em `role="alert"` com um link "Voltar ao início" (C4).
23. The visualizador SHALL ter um `h1` com o nome do arquivo e uma única região viva com "Página N de M" (C10, C9, D15, E13).
24. WHEN uma página é desenhada THEN o `<title>` SHALL ser "<arquivo>, página N — Ver no PDF" (C11).
25. The canvas SHALL reservar a proporção 1:1,414 antes de o PDF carregar (C15, E12).
26. WHEN a largura da janela muda THEN a página SHALL ser redesenhada na nova largura em até 300 ms (C16).
27. The indicador de página SHALL usar algarismos tabulares com largura mínima, e ir de 9 para 10 SHALL não mover os botões (C13, E11).

**Independent test:** a 160 px de CSS (320 px com zoom de 200%), "Ver no PDF" de uma citação mostra a página depois de rolar a barra. Dois toques rápidos em "Próxima página" levam de 26 a 28 com o indicador em 28/76.

### S4: Navegação que preserva onde a pessoa estava (P2)

Pular, voltar, compartilhar e esperar funcionam sem perder posição nem estado.

**Acceptance Criteria**

28. WHEN "Pular para o conteúdo" ou outra âncora da mesma página é ativada THEN o foco SHALL ir ao destino sem nova entrada no histórico e sem buscar dados (P04, C8, E14).
29. WHEN a pessoa usa o Voltar do navegador para uma rota já visitada THEN o site SHALL restaurar a posição de rolagem que ela tinha lá (P05).
30. WHILE uma navegação no cliente busca JSON THEN o `<main>` SHALL ter `aria-busy="true"` e uma região `role="status"` SHALL dizer "Carregando…" (P06).
31. IF a pessoa toca um segundo destino antes de o primeiro carregar THEN o site SHALL mostrar o último destino tocado e empilhar só ele no histórico (P20).
32. WHEN um filtro é escolhido em `/tema/<id>` THEN a URL SHALL passar a ter `?filtro=semelhancas` ou `?filtro=diferencas`, e "Mostrar tudo" SHALL tirar o parâmetro, sem criar entrada no histórico (P07, V21).
33. WHEN `/tema/<id>?filtro=<valor válido>` é aberta THEN a tela SHALL abrir com aquele filtro pressionado e aplicado.
34. IF `?filtro` tem valor desconhecido THEN a tela SHALL abrir em "Mostrar tudo".
35. WHEN "Trocar ordem dos candidatos" é tocado THEN uma região `role="status"` SHALL anunciar "Ordem trocada: <Nome (Partido)> aparece primeiro." (P08).
36. WHEN `/semelhancas` ou `/diferencas` é exibida THEN o site SHALL mostrar abaixo do texto de abertura um índice com um link por tema com itens, para `#g-<theme_id>`, com a contagem de itens (V11, D17).
37. WHEN `/diferencas` é exibida THEN cada tema SHALL separar os subtítulos `h3` "Diferenças (n)" e "Omissões (n)", e os itens de diferença SHALL não repetir o selo "Diferença" (V11, D7).
38. The `/sobre` SHALL renderizar os cartões dos planos no DOM na ordem vigente, e em telas ≥ 768 px SHALL mostrá-los lado a lado em duas colunas (P02, E02, D10).
39. WHILE a largura é ≥ 768 px THEN os painéis dos candidatos SHALL não ter `role="tabpanel"` nem apontar para abas ocultas (P12).

**Independent test:** em `/diferencas`, rolar até Agronegócio, abrir um tema e voltar devolve a mesma posição. Abrir `/tema/saude?filtro=diferencas` num link novo mostra só diferenças e omissões.

### S5: Acabamento de toque, hover e texto com os mesmos tokens neutros (P2)

Cada controle responde ao toque e ao mouse, e o texto se lê sem quebras ruins nem linhas longas.

**Acceptance Criteria**

40. WHERE o dispositivo tem hover (`@media (hover:hover)`) THEN botões, cartões, abas e cabeçalhos de item SHALL mudar fundo ou borda sob o cursor, usando só tokens neutros (D4, E03, P18).
41. The controles tocáveis SHALL ter `touch-action: manipulation`, realce de toque na cor do acento com transparência e estado `:active` (E08, E09, P19, V20, C14).
42. The links de navegação (voltar, rodapé, títulos que são links, links de `/sobre`) SHALL ter pelo menos 44 px de altura de toque (V10).
43. The texto corrido (abertura, `/metodologia`, `/sobre`) SHALL ter no máximo 68ch de largura (D5).
44. The aviso de IA SHALL ocupar a largura toda da janela, com o texto alinhado à coluna do conteúdo (D12).
45. WHILE a página é mais curta que a janela THEN o rodapé SHALL ficar no fim da janela (D13).
46. The títulos SHALL usar `text-wrap: balance` e os parágrafos `text-wrap: pretty`, e "pág. N", "Nome (Partido)" e "2º turno" SHALL usar espaço não separável (E07, P16, C12, E06).
47. The selo de omissão SHALL estar em caixa de frase, "Omissão · só no plano de <Nome (Partido)>", igual para os dois candidatos (V17).
48. The páginas SHALL declarar `<meta name="theme-color" content="#faf7f1">` (a cor do papel) e `/favicon.svg` do próprio domínio, e nenhuma rota SHALL pedir `/favicon.ico` (E10, E20).
49. The cabeçalho `Permissions-Policy` SHALL não conter `interest-cohort` (E21).
50. IF o texto de uma comparação contém `$&`, `$'` ou `$$` THEN o HTML pré-renderizado SHALL conter exatamente esse texto, como no JSON (E22).
51. The site e o visualizador SHALL ler as cores de um só arquivo de tokens, sem cor fixa repetida no visualizador (E25).

**Independent test:** no desktop, passar o mouse por cartão, botão e item muda o fundo. Em 390 px, nenhum link de navegação mede menos de 44 px de altura. Um JSON de teste com `R$$ 10` aparece igual no HTML.

### S6: Texto da página do PDF selecionável (P3)

Quem confere uma citação acha o trecho na página com Ctrl+F.

**Acceptance Criteria**

52. WHEN uma página do PDF é desenhada THEN o visualizador SHALL sobrepor a camada de texto do pdf.js, de modo que o trecho citado possa ser selecionado e encontrado com a busca do navegador (C7).

**Independent test:** em "Ver no PDF" de uma citação de Saúde, Ctrl+F com as primeiras palavras do trecho acha o texto na página.

### S7: A área de cada candidato no tom do próprio PDF; concordância em verde (P1)

Em qualquer ponto da tela, a cor da área diz de qual plano é o item: laranja-avermelhado para Lula, azul para Flávio Bolsonaro e verde para o que os dois planos propõem em comum. Nenhum lado recebe tratamento diferente do outro.

**Acceptance Criteria**

53. The site SHALL definir, num só arquivo de tokens, a cor de identidade de cada candidato, que é a cor tipográfica mais usada no próprio PDF (Lula `#ee481a`, Flávio Bolsonaro `#004f9f`), e um tom claro de área derivado dela. Os tons têm a mesma luminosidade e o mesmo croma em OKLCH, e só o matiz muda: Lula `oklch(95% 0.03 35)`, Flávio Bolsonaro `oklch(95% 0.03 258)`, Semelhanças `oklch(95% 0.03 158)`. No hover e no toque, cada tom passa a `oklch(93.5% 0.04 <matiz>)`.
54. The site SHALL pintar no tom do candidato, com as mesmas formas e medidas para os dois:
    - a coluna inteira do candidato, com fio de 6 px na cor dele no topo (desktop e `/sobre`);
    - a aba ativa, com fio de 4 px na cor dele no topo e sem fio embaixo, emendada na área (celular);
    - cada item de Omissões, no tom do candidato cujo plano trata do ponto.
55. The site SHALL usar a cor plena do candidato só em elementos não textuais: os fios do critério 54, o fio de 3 px no topo de cada lado dos itens de dois lados (Semelhanças e Diferenças), o quadradinho antes de cada ocorrência do nome e as aspas de abertura de cada citação daquele plano.
56. The site SHALL manter todo texto em `--tinta` ou `--tinta-2`, com contraste ≥ 4,5:1 sobre o papel e sobre cada tom, inclusive o de hover. As cores plenas SHALL ter contraste ≥ 3:1 sobre o fundo em que aparecem; o par mais apertado, `#ee481a` sobre o hover de Lula, mede 3,05:1.
57. WHEN a ordem dos candidatos é sorteada ou trocada THEN cada cor e cada tom SHALL continuar com o seu candidato.
58. The site SHALL marcar a concordância em verde, com `#2f7a55` (cor que não aparece em nenhum dos dois PDFs):
    - em `/`, o destaque de Semelhanças fica no tom verde, com fio de 4 px e glifo "=" em `#2f7a55`;
    - no tema e em `/semelhancas`, a seção de Semelhanças inteira fica no tom verde, com fio de 6 px e glifo "=" em `#2f7a55`.

    Diferenças e o título de Omissões SHALL ficar no grafite `--diferenca` (= `--tinta-2`), sem tom e nunca com a cor de um candidato.
59. WHEN o visualizador abre o PDF de um candidato THEN a barra SHALL mostrar no topo uma faixa na cor desse candidato.

**Independent test:** em `/tema/saude`, no desktop:

- a coluna de Lula tem fundo `oklch(95% 0.03 35)` e fio de 6 px `#ee481a`;
- a de Flávio Bolsonaro tem fundo `oklch(95% 0.03 258)` e fio `#004f9f`;
- a seção de Semelhanças tem fundo `oklch(95% 0.03 158)` e fio `#2f7a55`;
- Diferenças fica sem tom, com fio grafite.

No celular, a aba ativa tem o tom da área que ela abre. Trocar a ordem mantém cada cor e cada tom com o seu candidato. Nenhum texto fica em cor de candidato.

### S8: Direção visual "cotejo": caderno de jornal de serviço público (P1)

A tela se lê como um documento de conferência: papel, tinta, fios e citações em destaque. Não lembra um template.

**Acceptance Criteria**

60. The site SHALL compor títulos e citações em Newsreader e o texto em Atkinson Hyperlegible Next, servidas de `/fontes/` do próprio domínio, com `font-display: swap`, `preload` só da Atkinson e nenhuma requisição de fonte a outro domínio.
61. The site SHALL usar papel e tinta como tokens OKLCH (`--papel: oklch(97.6% 0.008 85)`, `--tinta: oklch(24% 0.02 265)`, `--tinta-2: oklch(43% 0.018 265)`, `--fio: oklch(84% 0.013 85)`), sem `#fff` nem `#000` em nenhuma regra.
62. The site SHALL separar itens por fios de 1 px e seções por fios de 2 px, sem `box-shadow`, sem gradiente decorativo e sem borda lateral grossa em elemento arredondado. As faixas de 6 px do S7 só abrem as áreas de cor e a seção Diferenças.
63. The site SHALL usar uma escala de cinco tamanhos de texto: 13, 15, 17 e 21 px, e o título de página em `clamp(36px, …, 60px)`.
64. The site SHALL numerar os itens de cada lista (01, 02, …) em algarismos tabulares, e compor cada citação em Newsreader itálico com as aspas de abertura na cor do candidato (S7).
65. The site SHALL marcar Semelhanças com o glifo "=" verde e Diferenças com "≠" grafite, nos destaques de `/` e nos títulos de seção.
66. WHEN a pessoa abre um item THEN o conteúdo SHALL surgir em 260 ms, só com opacidade e deslocamento, e itens já abertos ao carregar a página SHALL não animar.
67. WHILE `prefers-reduced-motion: reduce` está ativo THEN o site SHALL não animar nem fazer transição.
68. The site SHALL apresentar os filtros como um controle segmentado em tinta (o pressionado com fundo de tinta e texto de papel) e "Trocar ordem dos candidatos" como botão de texto com ícone, mantendo os rótulos exatos dos AC 21 e 22.
69. The site SHALL desenhar em SVG com `aria-hidden="true"` todo glifo que não está no subconjunto latino das duas fontes (≠, ←, →, ▸, ▾), e SHALL tirar do nome acessível as setas decorativas de "Ver no PDF" e de "Todos os temas" (K11, K13).
70. The site SHALL nunca hifenizar o texto de uma citação, e SHALL hifenizar o texto dos itens só abaixo de 340 px.
71. The site SHALL manter a semântica de lista (`role="list"`) nas listas sem marcador e esconder do leitor de tela os números "01, 02, …", que só repetem a posição na lista (K14).

**Independent test:** em `/tema/saude`, no celular e no desktop, as fontes carregam de `/fontes/` e nenhum elemento tem sombra, gradiente ou borda lateral grossa. A citação mostra as aspas na cor do candidato. Com movimento reduzido, abrir um item não anima.

### Invariantes de regressão (todas as fatias)

72. The site SHALL manter verdes os testes dos AC 16 a 37 já existentes: e2e nos três perfis, vitest, JS inicial ≤ 200 KB gzip, Lighthouse mobile em `/` e `/tema/saude` com Performance ≥ 90, Acessibilidade ≥ 90 e LCP < 2,0 s, axe com zero `serious`/`critical` em toda rota, e reflow sem rolagem horizontal a 320 px com zoom de 200%.
73. The site SHALL usar para os dois candidatos o mesmo componente, as mesmas classes e os mesmos estilos calculados, exceto as propriedades que leem `--cor-cand`, `--tom-cand` ou `--tom-cand-forte`; as regras cujo seletor cita `data-cand` SHALL só definir `order` ou essas três variáveis (AC 31, como o dono o alterou em 18/10/2026).
74. The site SHALL manter, no tema e nas visões transversais, a linha `.atualizacao` com `<time datetime>` igual ao `dateModified` do JSON-LD, e manter o `<title>`, o `canonical` e o JSON-LD do trabalho de GEO, com `e2e/geo.spec.ts` verde.

## Out of scope

| Excluded | Why |
| --- | --- |
| Tema escuro | ninguém pediu, não está na §6, e um segundo tema exige nova verificação de contraste em todas as telas |
| Pontuação final dos textos aprovados (D20, V22) | é conteúdo aprovado por hash: muda no pipeline e exige nova aprovação do dono (AC 13), não na interface |
| Link direto para um bullet aberto (P21) | capacidade nova; o filtro na URL (porta 1) cobre o compartilhamento pedido |
| Responsável pelo site em `/sobre` (V19) | é entrada do dono (§9), não interface |
| Destacar o trecho citado dentro do PDF | capacidade nova; S6 só torna o texto selecionável e encontrável |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Fontes próprias | Newsreader + Atkinson Hyperlegible Next, hospedadas no próprio domínio (porta 4), substituindo a parte "fontes do sistema" da decisão 22 | é o que dá a identidade pedida, e cabe no orçamento: 34 KB com prioridade, o resto com `swap`. O Lighthouse do critério 72 continua sendo o piso | y |
| Grade de temas no celular | 2 por linha abaixo de 480 px, e não 4 como no desenho da §6 | com 4 por linha em 390 px os rótulos ficam hifenizados ("Progra-mas", "Agrone-gócio"), e o desenho só cabia porque abreviava ("Prog.", "Seg."), o que não é aceitável | y |
| Qual cor de cada PDF | a cor tipográfica mais usada (`#ee481a` e `#004f9f`), e não a da capa | é a cor que o próprio plano usa nos títulos; a capa de Lula mistura vermelho, amarelo, azul e verde | y |
| Diferenças, Omissões e acento | Diferenças e o título de Omissões em grafite neutro (`--diferenca` = `--tinta-2`); botões, links e foco em tinta (`--acento` = `--tinta`), e não mais em azul-petróleo | o dono definiu cor para os candidatos e para a concordância. Agora que azul significa Flávio Bolsonaro, um botão ou link azul pareceria do lado dele, e um terceiro matiz competiria com as cores dos candidatos | y |
| Perfil de verificação | `ui`: as telas da §6 conferidas tela a tela, com cópia e arranjo, mais injeção de falhas | a feature é toda de interface, e `light` não detecta uma tela que contradiz o desenho | y |
| A §6 vale como desenho obrigatório | onde o desenho decide (ordem dos controles, "← Saúde", "Omissões (n)", "Metodologia · Sobre"), ele vence o que existe hoje | é o plano em vigor, e os critérios 5, 16 e 17 vêm dele | y |
| Lugar do "Trocar ordem dos candidatos" | na tela de tema, ao lado dos filtros, e no topo de `/semelhancas`, `/diferencas` e `/sobre`; some de `/`, `/metodologia`, 404 e do visualizador | o desenho põe o botão na tela de tema; nas outras telas ele não muda nada visível (V04, D14) | y |
| Texto de abertura com os nomes | lido de `manifesto.candidatos` na ordem vigente; "2º turno de 2026" já aparece em `/sobre` | nenhum dado novo é inventado | y |
| Fonte das capturas | alias do fontconfig `system-ui`/`sans-serif` para Liberation Sans no `docker/web.Dockerfile` | sem isso, as capturas da verificação `ui` não mostram negrito (D6, V23) | y |

**Open questions:** none - all resolved or logged above. O dono aprovou o plano inteiro em 18/10/2026, com todos os padrões desta tabela como estão.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela `/` | vazio (nenhum tema aprovado) | existente: o build de produção falha sem aprovação (AC 13) |
| tela `/` | carregando, erro | n/a - pré-renderizada, sem busca de dados |
| tela `/tema/<id>` | listas vazias | existente: "Nenhuma semelhança encontrada neste tema." e equivalentes |
| tela `/tema/<id>` | candidato sem bullet | existente: AC 9, "Não encontrado no plano de governo registrado no TSE" |
| tela `/tema/<id>`, `/semelhancas`, `/diferencas` | carregando (navegação no cliente) | AC 30 |
| tela `/tema/<id>`, `/semelhancas`, `/diferencas` | erro ao buscar JSON | existente: `App.ir` cai para navegação completa (`window.location.assign`) |
| tela `/semelhancas`, `/diferencas` | vazio | existente: AC 24, "Nenhum ponto encontrado nos temas publicados" |
| visualizador de PDF | carregando | AC 21 |
| visualizador de PDF | erro (arquivo desconhecido, download falhou) | AC 22 |
| todas as telas | não autorizado | n/a - site público, sem login |
| todas as telas | ação destrutiva | n/a - nenhuma ação apaga ou altera dados |
| todas as telas | densidade e ordem | AC 2, 5, 6, 13, 36, 37 |
| texto da página inicial | o que a pessoa faz em seguida | AC 12: escolher um tema |
| URL `?filtro` e âncoras `#g-<id>` | versionamento, limite de taxa | n/a - site estático sem backend; valor desconhecido cai no padrão (AC 34) |

## Sources

- `.specs/plano-final.md` §6 (telas e rotas) e §7, AC 16-37: desenho e critérios em vigor, obrigatórios.
- `achados-revisao.txt` (nesta pasta): os 100 achados confirmados da revisão de 18/10/2026, com `arquivo:linha`, citados pelos IDs em cada critério.
