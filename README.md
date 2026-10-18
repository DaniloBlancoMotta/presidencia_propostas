# Comparador de planos de governo 2026

Site estático que mostra, tema a tema, o que os planos de governo de Flávio Bolsonaro (PL) e de
Lula (PT), registrados no TSE para o 2º turno, propõem, onde convergem, onde divergem e o que só
um deles trata. Cada ponto traz o trecho literal, o arquivo, a página e o botão "Ver no PDF".
O plano em vigor é [.specs/plano-final.md](.specs/plano-final.md).

Nada é instalado na máquina: todo comando roda em Docker pelo [dock.sh](dock.sh).

```
./dock.sh pipeline python -m rag_planos <comando>     # pipeline (Python 3.11 + PyMuPDF + LangGraph)
WD=web ./dock.sh web npm run <script>                 # site (Vite + React + Playwright)
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `corpus/` | os dois PDFs, imutáveis |
| `contrato/` | JSON Schema de `Comparação`, `Citação` e `themes.yaml` |
| `pipeline/rag_planos/` | extração, chunking, classificação, comparação, verificação, relatório, avaliação, aprovação; as chamadas ao LLM são grafos LangGraph em `grafos.py` |
| `docker/pipeline.requirements.txt` | lock das 56 dependências do pipeline; mudou a imagem, rode com `REBUILD=1` |
| `dados/` | `themes.yaml`, `fontes.json`, páginas extraídas, chunks, rascunhos, vereditos do juiz, comparações, relatórios, conjunto-ouro |
| `revisao/aprovados.yaml` | portão de publicação: `theme_id: sha256` do JSON aprovado |
| `web/` | site; `scripts/build.ts` aplica as guardas e pré-renderiza as rotas |

## Fluxo de um tema

```
./dock.sh pipeline python -m rag_planos fontes --tse-dir dados/tse   # confere SHA-256 com o TSE
./dock.sh pipeline python -m rag_planos ingest
./dock.sh pipeline python -m rag_planos comparar saude               # --origem gemini com GEMINI_API_KEY (*)
./dock.sh pipeline python -m rag_planos verificar saude              # JSON + dados/relatorios/saude.html
./dock.sh pipeline python -m rag_planos aprovar saude                # só o dono, depois de ler o relatório
./dock.sh pipeline python -m rag_planos ouro && ./dock.sh pipeline python -m rag_planos avaliar
WD=web ./dock.sh web npm run build                                   # falha se algum JSON não estiver aprovado
```

(*) Com chave, as chamadas ao Gemini passam pelos grafos LangGraph de `grafos.py`. Variáveis opcionais,
repassadas pelo `dock.sh`: `GEMINI_MODELO` (padrão `gemini-3.8-flash`), `LLM_CONCORRENCIA` (padrão 4)
e `LLM_RPM`, o limite de pedidos por minuto que o AI Studio mostra para a sua conta. Cada comando
imprime chamadas, acertos de cache, falhas e tokens; o detalhe por chamada fica em
`dados/cache-llm/chamadas.jsonl`, fora do git.

## Testes

```
WD=pipeline ./dock.sh pipeline python -m pytest -q
WD=web ./dock.sh web "npx vitest run && npm run build:teste && npx playwright test && npm run orcamento && npm run lighthouse"
```

`build:teste` aprova os JSONs atuais num arquivo temporário em `/tmp` e grava em `web/dist-teste`,
que nunca volta para o disco nem é publicado.
