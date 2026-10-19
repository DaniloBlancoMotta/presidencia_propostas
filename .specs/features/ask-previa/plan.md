# Pergunta livre `/ask` em prévia

> Pedido do dono em 18/10/2026: "RAG com LLM, só em preview". Implementa o §11 do
> `.specs/plano-final.md` para rodar localmente e no Cloud Run, **sem ir ao ar**: o build de produção
> não conhece o `/ask`, e publicar depende das entradas do dono no fim deste documento. Os critérios
> continuam a numeração da §7 (45 a 56), depois dos 38 a 44 do chat por tema.

## O que existe

- **Serviço** `ask/` (Python 3.11, FastAPI + LangGraph), imagem `docker/ask-servico.Dockerfile`, com
  modelo de embeddings e índice embutidos. `POST /ask` e `GET /health` no contrato da §11.
- **Prévia do site**: `npm run build:previa` gera `web/dist-previa` com `ASK_URL`. No chat, toda
  resposta de busca ganha "Perguntar à IA (prévia)", rotulada como gerada na hora e sem revisão humana.
- **Prévia local**: `ask/previa.sh` sobe a API em `localhost:8080` e o site em `localhost:4174/chat`.

## Decisões

| # | Decisão | Forma final |
|---|---|---|
| 1 | Grafo | LangGraph `recuperar → gerar (um por candidato, Send em paralelo) → montar`. |
| 2 | Recuperação | Por candidato: BM25 (radicais de 6 letras, sem plural) + vetorial (`paraphrase-multilingual-MiniLM-L12-v2`, fastembed/ONNX, janelas de 80 palavras com passo 60), juntos por RRF ponderada (k = 60; BM25 1,0, vetorial 0,5); 5 chunks por plano. No ouro: 53/54 (pesos iguais 52/54; vetorial 0,3 54/54, descartado porque o ouro usa o vocabulário do plano e favorece o BM25). |
| 3 | Contexto do modelo | Das 5 peças, só as 2 janelas mais próximas da pergunta (recortes, com os marcadores `[página N]` refeitos). Prompt com mediana de 6,4 mil caracteres, contra 20,7 mil com chunks inteiros, e a mesma página do ouro dentro em 52/54. |
| 4 | Guardas da saída | Trecho saneado (hífen não separável vira hífen; "..." divide em citações, cada uma conferida); página corrigida pela faixa do recorte (a mesma função do pipeline); citação literal na página do PDF do próprio candidato (`rag_planos.literal`); todo número, sigla ou nome próprio do texto presente nos trechos citados (sigla vale pelas iniciais: IA, MCMV, RNDS); aderência do texto aos trechos ≥ 0,4; até 4 bullets de 300 caracteres e 1–3 citações de 280. |
| 5 | Simetria | Se um dos dois candidatos ficar sem resposta do modelo, os dois vão para o modo extrativo (3 frases por plano com termos da pergunta, literais na página). |
| 6 | Recusa | Opinião, previsão e ataque: por regra, antes de qualquer busca ou modelo (`ask/ask/triagem.py`). `fora_dos_planos`: quando nenhum dos dois planos trata. |
| 7 | Cadeia de LLM | **Groq → Gemini → OpenRouter `:free`** na prévia (a §11 previa Gemini primeiro). Medido em 18/10/2026: Groq `openai/gpt-oss-120b` 1,5–2,7 s; Gemini `gemini-3.8-flash` 3–10 s com raciocínio "low" (19,7 s no padrão) e cota gratuita compartilhada com o juiz do pipeline. Ordem e modelos por `ASK_PROVEDORES` e `*_MODELO`. Falha ou 10 s → próximo; 3 falhas seguidas → provedor fora por 5 min; orçamento de 12 s por pergunta. |
| 8 | Cache | Chave = versão do índice (SHA-256 dos PDFs + modelo de embeddings) + pergunta normalizada; semântico com cosseno ≥ 0,92 (entre 1.891 pares de perguntas diferentes, o máximo foi 0,859; paráfrases: 0,931 e 0,976); só respostas geradas; até 30/11/2026. |
| 9 | Limite e privacidade | 10 por hora por IP, chave HMAC-SHA256(IP, chave do dia aleatória em memória); 429 com `Retry-After` exposto no CORS. O registro em stdout não tem IP nem texto da pergunta (só 12 hex do resumo). |
| 10 | Segurança HTTP | CORS só de `ASK_ORIGEM_SITE`; `default-src 'none'`, `nosniff`, `no-referrer`, `no-store`; erro interno vira `{"erro": "interno"}`. No Cloud Run, `ASK_IP_DO_CABECALHO=1` (último IP de X-Forwarded-For). |
| 11 | Site | O `/ask` só existe no build com `ASK_URL` e `OUT_DIR` de prévia; o build de produção recusa `ASK_URL`. A CSP da prévia acrescenta só a origem do `/ask` ao `connect-src`. Pedido sem cookie e sem referrer; citação de arquivo que não é do candidato é descartada antes de virar link. |

## Critérios de aceite

45. WHEN alguém faz `POST /ask` com `{pergunta}` válida THEN o serviço SHALL responder `{origem, camada: "plano", candidatos, modelos, contexto}` com os dois candidatos, cada bullet com 1–3 citações `{arquivo, pagina, trecho}`; `contexto` = `{pergunta, termos, trechos: {<candidato>: [{arquivo, pagina, paginas, viradas, texto}]}}`, os recortes que foram ao modelo (na resposta do cache, `pergunta` é a que foi de fato respondida).
46. The serviço SHALL publicar só citação cujo trecho ocorre literalmente na página citada do PDF do próprio candidato, e só bullet cujo texto adere aos trechos que cita.
47. IF a pergunta pede opinião, previsão ou ataca candidato THEN o serviço SHALL recusar com o motivo, sem buscar nem chamar modelo.
48. IF nenhum dos dois planos trata do assunto THEN o serviço SHALL responder `recusada: true, motivo: "fora_dos_planos"`.
49. IF um provedor falha ou passa de 10 s THEN o serviço SHALL tentar o próximo; com 3 falhas seguidas, SHALL tirá-lo por 5 min; sem nenhum, SHALL responder no modo extrativo, igual para os dois candidatos.
50. WHEN a mesma pergunta (ou uma com cosseno ≥ 0,92) já foi respondida pelo modelo THEN o serviço SHALL devolver a resposta guardada com `origem: "cache"`, até 30/11/2026.
51. WHEN um IP passa de 10 perguntas na última hora THEN o serviço SHALL responder 429 com `Retry-After`.
52. IF a pergunta passa de 300 caracteres THEN o serviço SHALL responder 400 `{"erro": "pergunta_muito_longa"}`.
53. The serviço SHALL não gravar IP em claro nem o texto da pergunta junto de qualquer identificador.
54. WHEN o site de prévia recebe uma busca no chat THEN SHALL oferecer "Perguntar à IA (prévia)" e mostrar a resposta na ordem vigente, rotulada como gerada na hora e sem revisão humana, com "Buscando nos dois planos…", o texto de recusa e, após 15 s, "Pergunta livre indisponível no momento — veja os temas acima".
55. The build de produção SHALL não conter o endereço do `/ask` e SHALL recusar `ASK_URL`.
56. WHEN `python -m ask avaliar` roda THEN SHALL gravar `dados/ask/avaliacao.md` com recuperação, cobertura de páginas, "fora dos planos", recusas, equilíbrio entre candidatos e injeção (≥ 20 casos), e sair ≠ 0 abaixo dos limiares.

## Provas

- `ask/tests/` (pytest, 36): recuperação no ouro e nos recortes, guardas, extrativo simétrico, cadeia e disjuntor, cache, limite, contrato HTTP, CORS e cabeçalhos, registro sem IP, 22 injeções com modelo que obedece à injeção.
- `web/tests/ask-cliente.test.ts` e `guardas.test.ts` (vitest): pedido, validação, 429/400/500/15 s; produção recusa `ASK_URL`.
- `web/e2e/ask.spec.ts` (projeto `previa-ask`) e `chat.spec.ts` (produção sem botão e com `connect-src 'self'`).
- `dados/ask/avaliacao.md`: avaliação com provedor real.

## Avaliação com provedor real (Groq `gpt-oss-120b`, 16 perguntas do ouro + 8 fora + 9 recusa + 22 injeção)

Rodada 1 (18/10/2026), reprovada nos limiares provisórios: recuperação 88% (2/16 com o chunk certo
em 1º no BM25 e fora do top 5 depois da fusão), cobertura 50%, fora dos planos 100%, recusa 89%
("chances de ser eleito" não casava a regra), **1 vazamento** em 22 injeções (marcador no começo de
um bullet de resto fiel, aderência 0,85–0,93). Das 62 respostas de bullet do modelo, 12 tinham trecho
com "..." ou hífen não separável e 7 eram paráfrases legítimas abaixo da aderência de 0,6. Correções:
fusão ponderada, regra de recusa, saneamento do trecho, guarda de nomes e números, aderência 0,4 e
prompt que pede para responder com o que os trechos dizem mesmo em parte. Cada falha virou teste.

Rodada 2: recuperação 100%, recusa 100%, **0 vazamentos**, equilíbrio 0,94 (1,81 contra 1,94 bullets por
resposta), cobertura 69%. "Fora dos planos" caiu para 12% porque as 8 perguntas, as últimas da rodada,
pegaram o Groq no limite de 8.000 tokens/min e foram ao modo extrativo, que devolvia qualquer frase
com um termo da pergunta. Decisão: no extrativo, a frase precisa de 2 termos distintos da pergunta
(no ouro custa 1 página em 54; deixa sem trecho 13 de 18 perguntas fora dos planos). Um limiar
semântico para recusar sem modelo foi medido e descartado: "Quem descobriu o Brasil?" chega a 0,63 de
similaridade, acima do mínimo das perguntas legítimas (0,42). O relatório passou a dizer quantas
respostas de "fora dos planos" vieram do extrativo.

Rodada 3 e releitura do cache (18/10/2026): recuperação 100%, recusa 100%, **0 vazamentos**, fora dos
planos 75% (as 8 no extrativo, que agora devolve vazio em 6), equilíbrio 0,84, cobertura 75% (6 de
10 nas respostas do modelo; 6 de 6 no extrativo). As falhas restantes do Groq não eram do serviço: o
gratuito tem **200.000 tokens por dia** (`gpt-oss-120b`), e as três rodadas os gastaram. Duas guardas
foram ajustadas pelo que a releitura mostrou: trecho acima de 280 caracteres é cortado em vez de
derrubar o bullet, e página errada é corrigida pela página única do PDF onde o trecho está. O que
falta de cobertura é escolha do modelo (passagem vizinha ou "não encontrado" com a página no contexto).
**Reprovado nos limiares provisórios**: a prévia não está pronta para o público com o tier gratuito.

## Entradas que só o dono fornece antes de publicar

1. Parecer jurídico para texto gerado em tempo real sem revisão humana (§11).
2. Aceite dos termos dos tiers gratuitos (Groq, Gemini, OpenRouter) quanto ao uso das perguntas do público.
3. Limiares definitivos da avaliação; os provisórios estão em `ask/ask/avaliar.py` (`LIMIARES`).
4. Projeto no Google Cloud (Cloud Run com `min-instances=0`, chaves no Secret Manager, alertas de orçamento).
