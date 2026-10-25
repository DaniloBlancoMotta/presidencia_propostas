# Chat por tema: resumo executivo e comparação por `@tema`

> Pedido do dono em 18/10/2026. Estende o plano em vigor (`.specs/plano-final.md`) sem mudar as
> garantias dele: site estático, nenhum LLM nem backend em tempo de execução, só conteúdo
> verificado e aprovado por hash (AC 13). Os critérios abaixo continuam a numeração da §7 (38 a 44)
> e entram nela quando o `plano-final.md` for atualizado.

## O que vai ao ar

Rota `/chat`. A pessoa digita `@`, escolhe um dos 8 temas e recebe, para cada candidato, na ordem
sorteada e com o mesmo componente, o **resumo executivo**: até 3 pontos-chave, o que só aquele plano
trata no tema e todas as propostas do tema, cada item com trecho literal, arquivo, página e "Ver no
PDF". Depois do tema, "comparar" (ou "semelhanças", "diferenças") mostra o que os dois têm em comum,
onde divergem e o que só um trata. Uma palavra solta ("creche", "fila") busca nos pontos publicados.
"comparar os temas" mostra o panorama de todos os temas.

## Decisões

| # | Decisão | Forma final |
|---|---|---|
| 1 | Onde roda | No navegador, sobre os mesmos `/comparacoes/<id>.json` aprovados. Nenhum texto é gerado na hora; a resposta é escolhida por regra fixa (`web/src/consulta.ts`). A pergunta livre com LLM continua sendo o `/ask` da §11, depois de 25/10. |
| 2 | Resumo executivo | Campo novo `candidatos.<id>.executivo` no contrato `Comparação`: até 3 bullets no formato `bullet`, obrigatório (vazio quando `nao_encontrado`). |
| 3 | Geração | O nó `comparar` do grafo LangGraph devolve também `executivo` (prompt `comparar.md`), sem chamada extra ao Gemini. Sem chave, vem de `dados/rascunhos/<tema>.json`, como o resto. |
| 4 | Verificação | Cada ponto-chave só pode citar uma citação idêntica (arquivo, página, trecho) do resumo **já verificado** do mesmo candidato; senão sai com `fora_do_resumo`. Do 4º em diante sai com `acima_do_limite`. Passa pelo juiz como os outros itens e aparece no relatório como "Ponto-chave". |
| 5 | Interpretação | `@tema` (id, rótulo com ou sem acento, ou prefixo único de 3+ letras); sem `@`, o rótulo completo escrito na frase. Sem outra palavra: resumo executivo. Com "comparar"/"semelhanças"/"diferenças": comparação. Com outra palavra: busca (no tema citado ou em todos). Sem tema e com "comparar"/"temas": panorama. |
| 6 | Busca | No texto do item e nos trechos citados; termo de até 3 letras só como palavra inteira ("sus" não acha "sustentável"); maior que isso, como começo de palavra e sem o "s" final. Mostra os dois candidatos sempre; quem não tem ponto que mencione o termo recebe "Nenhum ponto publicado do plano de X menciona …". |
| 7 | Panorama | Por tema: em comum, divergências e só em um dos planos. Sem contagem de propostas por candidato (o número de bullets é efeito do resumo, não do plano). |
| 8 | Neutralidade | Mesmo componente e tokens para os dois; a ordem vigente vale nas respostas já mostradas ("Trocar ordem" re-renderiza tudo). Nenhuma cor por candidato no chat. |
| 9 | Desempenho | O chat é um arquivo JS à parte (`chat-carga.ts`), baixado só em `/chat` antes de hidratar ou ao navegar até lá; o JS inicial das outras rotas não cresce. |
| 10 | Estado | A conversa dura enquanto a aba estiver aberta (abrir um tema e voltar não apaga). Nada vai para cookie, `localStorage` ou URL. |
| 11 | Entrada | Botão "Chat por tema" na tela inicial, abaixo do texto de abertura e fora da grade; link "Chat por tema" no rodapé; parágrafo em `/metodologia`. |
| 12 | Página da conversa | Pedido do dono em 18/10/2026: a 1ª mensagem em `/chat` abre `/chat/conversa`, na mesma aba (a conversa vive só na memória da aba; "Voltar" volta a ela). Página ampla (até 110rem), com a conversa à esquerda e, a partir de 1100 px, um painel fixo à direita com o contexto da resposta escolhida ("Ver contexto"; por padrão, a última). Abaixo de 1100 px, o contexto vai num `<details>` em cada resposta. `/chat` mostra "Continuar a conversa (n perguntas)". O estado sai do componente para `chat-estado.ts`. |
| 13 | Contexto mostrado | Da pergunta: o texto, como o chat entendeu (intenção), temas, palavras buscadas, menções sem tema. Da resposta do chat: que é conteúdo aprovado (resumido por IA no pipeline, conferido, julgado e revisado), cada tema usado com data de geração, link da página e do JSON, e os dois PDFs com a data de coleta. Da IA (prévia): pergunta enviada, pergunta de fato respondida (se veio do cache), situação, modelo, tempo de resposta, termos da busca e os recortes de cada plano que o modelo recebeu, com página, marcas de virada de página, "citado na resposta" e "Ver no PDF". |

## Critérios de aceite

38. WHEN a pessoa digita `@` no campo do chat THEN o site SHALL listar os temas publicados filtrados pelo que vem depois do `@`, e Enter, Tab ou toque SHALL inserir a menção do tema; setas percorrem a lista e Esc a fecha.
39. WHEN a mensagem tem um tema e nenhuma outra palavra THEN o chat SHALL mostrar, para cada candidato, na ordem vigente, os pontos-chave do `executivo` aprovado, as omissões que só ele trata e todas as propostas do tema, com trecho, arquivo, página e "Ver no PDF".
40. WHEN a mensagem tem um tema e "comparar", "semelhanças" ou "diferenças" THEN o chat SHALL mostrar as listas pedidas do JSON do tema, com as omissões na ordem vigente dos candidatos.
41. WHEN a mensagem tem palavras que não são tema nem comando THEN o chat SHALL mostrar os pontos publicados cujo texto ou trecho as contém, nos temas citados ou em todos, para os dois candidatos, e dizer quando um deles não tem ponto que as mencione.
42. WHEN a mensagem pede para comparar os temas sem citar nenhum THEN o chat SHALL mostrar, por tema publicado, o número de semelhanças, de diferenças e de omissões.
43. The chat SHALL montar toda resposta só com os JSONs aprovados, buscando apenas `/comparacoes/<id>.json` do próprio domínio, e "Trocar ordem dos candidatos" SHALL inverter a ordem também nas respostas já mostradas.
44. IF um ponto-chave cita trecho que não está no resumo verificado do mesmo candidato THEN a verificação SHALL deixá-lo fora do JSON com o motivo `fora_do_resumo`; do 4º ponto-chave em diante, com `acima_do_limite`.
63. WHEN a pessoa envia a 1ª mensagem em `/chat` THEN o site SHALL abrir `/chat/conversa` na mesma aba, em página ampla, com a conversa e o contexto de cada resposta (pergunta, como foi entendida e de onde veio a resposta), lado a lado a partir de 1100 px e dentro da resposta abaixo disso.

Valem para `/chat` os AC 27, 28, 32, 35, 36 e 37 (mesma origem, aviso de IA, sem cookie, teclado,
axe e reflow a 320 px com zoom de 200%).

## Provas

- `pipeline/tests/test_verificar.py`: `fora_do_resumo`, `acima_do_limite`, juiz e queda junto com o bullet descartado (AC 44).
- `pipeline/tests/test_grafos.py::test_comparar_devolve_executivo` e `test_comparacoes_reais.py::test_resumo_executivo_publicado` (AC 39, 44).
- `web/tests/consulta.test.ts`: menção, interpretação, busca (AC 38-42).
- `web/e2e/chat.spec.ts`, desktop e Android: lista do `@` por teclado, resumo executivo igual ao JSON, comparação e troca de ordem, busca, panorama, mesma origem, voltar, axe e 160 px (AC 38-43).

## Entrada que só o dono fornece

Os 48 pontos-chave atuais vieram de rascunho (sem `GEMINI_API_KEY` nesta máquina) e estão com o juiz
`nao_executado` nos relatórios. Antes de aprovar, o dono roda `verificar --todos` com a chave (o juiz
Gemini julga os pontos-chave) ou confere esses itens no relatório de cada tema, e então `aprovar <tema>`.
