# Visibilidade para buscadores e motores de resposta com IA (GEO)

> Pedido do dono em 18/10/2026 (skill de GEO). Muda só o que o build entrega no `<head>` e em
> arquivos estáticos, mais uma linha visível de data. Nenhum texto aprovado muda, e a decisão 15
> (prévia do link) continua valendo. Os critérios continuam a numeração da §7 (57 a 62).

## Auditoria (pilares) e decisão

| Pilar | Achado | Decisão |
|---|---|---|
| Descoberta | Sem robots.txt, sitemap e canonical; domínio final ainda não definido (§9, item 3) | `robots.txt` sempre; `canonical`, `og:url` e `sitemap.xml` quando `dados/site.yaml` tiver `url` (https) |
| Descoberta | `/pdf/visualizador.html?...` gera URLs infinitas, sem texto para robôs | `Disallow: /pdf/visualizador.html`; PDFs e `/comparacoes/*.json` abertos |
| Compreensão | `<title>` de tema era só o rótulo ("Saúde") | `<title>` = "Saúde: propostas dos planos de governo do 2º turno de 2026"; `og:title` continua o rótulo (decisão 15); o mesmo na navegação no cliente |
| Confiança / Citação | Nenhum dado estruturado ligava a página aos PDFs e aos candidatos | JSON-LD `WebSite` + `WebPage` com `description` (o texto de abertura visível), `about` (tema), `mentions` (candidatos e partidos) e `isBasedOn` (os dois PDFs); sem nada que a página não mostre |
| Atualização | Data de geração invisível | Linha "Comparação gerada em DD/MM/AAAA a partir dos planos coletados do TSE em DD/MM/AAAA" no tema e nas visões transversais, igual ao `dateModified` e ao `lastmod` |
| Uso por agentes | Os JSONs com trechos literais e páginas não eram anunciados | `llms.txt` com temas, visões, fontes (PDF e SHA-256), contrato dos JSONs e o aviso de IA |
| Compreensão | A mesma descrição em todas as páginas (decisão 15) | Mantida; descrição por tema fica como recomendação ao dono |
| Confiança | Responsável pelo site ainda não informado | Entrada do dono (§9, item 1); entra em `/sobre` e no `publisher` quando vier |

## Critérios de aceite

57. The build SHALL gravar `robots.txt` com `User-agent: *`, `Allow: /` e `Disallow: /pdf/visualizador.html`, e a linha `Sitemap:` só com domínio.
58. WHEN `dados/site.yaml` tem `url` THEN o build SHALL gravar `canonical` e `og:url` em toda página exceto 404, e `sitemap.xml` com as 14 rotas; IF `url` não é https THEN o build SHALL falhar.
59. The `<title>` de cada tema SHALL ser "<rótulo>: propostas dos planos de governo do 2º turno de 2026", e o `og:title` SHALL continuar o rótulo.
60. The toda página exceto 404 SHALL ter um único JSON-LD com `WebPage.name` igual ao `<title>`, e `description`, `mentions` e `isBasedOn` só com o que a página mostra; os PDFs citados SHALL responder 200.
61. WHEN a página mostra comparações THEN SHALL exibir a data de geração em `<time datetime>` igual ao `dateModified`.
62. The build SHALL gravar `llms.txt` com cada tema publicado, sua página e seu JSON, os dois PDFs com SHA-256 e o aviso de IA.

## Provas

`web/tests/seo.test.ts` (vitest) e `web/e2e/geo.spec.ts` (HTML sem JavaScript). Conferido também um
build com `url: https://comparador.exemplo` (canonical, sitemap com 14 URLs e `lastmod`, linha `Sitemap:`).

## Depois de publicar (dono)

Cadastrar o domínio no Google Search Console e no Bing Webmaster Tools, enviar o `sitemap.xml` e
validar uma página de tema no Rich Results Test e no Schema Markup Validator. Nada disso garante
citação por motor de IA; mede só se o site está acessível e legível para eles.
