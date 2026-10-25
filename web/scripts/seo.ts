// Sinais para buscadores e motores de resposta com IA (GEO): dados estruturados por página, robots.txt,
// sitemap.xml e llms.txt. Regra: tudo aqui repete o que está visível na página; nada novo é afirmado.
// Endereços absolutos (canonical, sitemap) só com o domínio final em dados/site.yaml (`url`).
import { caminhoDaRota, dataBR } from "../src/rotas";
import type { Comparacao, DadosPagina, Manifesto, Rota, TemaPublico } from "../src/tipos";
import { LEAD_DIFERENCAS, LEAD_INICIO, LEAD_SEMELHANCAS, NOME_SITE } from "../src/tipos";

export function absoluta(base: string | null, caminho: string): string | null {
  return base ? new URL(caminho, base).href : null;
}

/** `gerado_em` mais recente entre as comparações (ISO, com fuso); null se não houver nenhuma. */
export function geradoEm(comps: Comparacao[]): string | null {
  return comps.map((c) => c.gerado_em).sort().at(-1) ?? null;
}

function descricaoVisivel(r: Rota, m: Manifesto): string | null {
  if (r.tipo === "inicio") return LEAD_INICIO;
  if (r.tipo === "semelhancas") return LEAD_SEMELHANCAS;
  if (r.tipo === "diferencas") return LEAD_DIFERENCAS;
  if (r.tipo === "tema") return m.temas.find((t) => t.id === r.id)?.descricao ?? null;
  return null;
}

/** JSON-LD da página: WebSite + WebPage. Os candidatos (`mentions`) e os dois PDFs (`isBasedOn`) entram
 *  nas páginas que os mostram; `dateModified` é a data de geração que a página exibe. */
export function jsonLd(d: DadosPagina, titulo: string, base: string | null): Record<string, unknown> | null {
  const r = d.rota;
  if (r.tipo === "nao-encontrada") return null;
  const m = d.manifesto;
  const url = absoluta(base, caminhoDaRota(r));
  const site: Record<string, unknown> = { "@type": "WebSite", name: NOME_SITE, inLanguage: "pt-BR" };
  if (base) Object.assign(site, { "@id": `${absoluta(base, "/")}#site`, url: absoluta(base, "/") });
  const pagina: Record<string, unknown> = {
    "@type": "WebPage",
    name: titulo,
    inLanguage: "pt-BR",
    isPartOf: base ? { "@id": site["@id"] } : { "@type": "WebSite", name: NOME_SITE },
  };
  if (url) Object.assign(pagina, { "@id": url, url });
  const descricao = descricaoVisivel(r, m);
  if (descricao) pagina.description = descricao;
  if (r.tipo === "tema") {
    const t = m.temas.find((x) => x.id === r.id) as TemaPublico;
    pagina.about = { "@type": "Thing", name: t.rotulo, description: t.descricao };
  }
  if (r.tipo === "tema" || r.tipo === "semelhancas" || r.tipo === "diferencas" || r.tipo === "sobre") {
    pagina.mentions = m.fontes.map((f) => ({
      "@type": "Person",
      name: m.candidatos[f.candidato].nome,
      affiliation: { "@type": "Organization", name: m.candidatos[f.candidato].partido },
    }));
    pagina.isBasedOn = m.fontes.map((f) => {
      const doc: Record<string, unknown> = {
        "@type": "DigitalDocument",
        name: f.arquivo,
        encodingFormat: "application/pdf",
        author: { "@type": "Person", name: m.candidatos[f.candidato].nome },
      };
      const u = absoluta(base, `/pdf/${encodeURIComponent(f.arquivo)}`);
      if (u) doc.url = u;
      return doc;
    });
  }
  const data = geradoEm(Object.values(d.comparacoes));
  if (data && (r.tipo === "tema" || r.tipo === "semelhancas" || r.tipo === "diferencas")) pagina.dateModified = data;
  return { "@context": "https://schema.org", "@graph": [site, pagina] };
}

export function robots(base: string | null): string {
  const linhas = [
    "# Conteúdo público e informativo: aberto a buscadores e a motores de resposta com IA.",
    "# O visualizador de PDF e a página da conversa são só telas, sem conteúdo próprio; os PDFs em",
    "# /pdf/ e os dados em /comparacoes/ ficam abertos.",
    "User-agent: *",
    "Allow: /",
    "Disallow: /pdf/visualizador.html",
    "Disallow: /chat/conversa",
  ];
  if (base) linhas.push(`Sitemap: ${absoluta(base, "/sitemap.xml")}`);
  return linhas.join("\n") + "\n";
}

export function sitemap(base: string, entradas: { caminho: string; modificado?: string | null }[]): string {
  const urls = entradas.map((e) => {
    const lastmod = e.modificado ? `<lastmod>${e.modificado.slice(0, 10)}</lastmod>` : "";
    return `  <url><loc>${absoluta(base, e.caminho)}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** llms.txt: guia em Markdown para agentes; não controla rastreamento (isso é o robots.txt). */
export function llms(m: Manifesto, base: string | null, comps: Record<string, Comparacao>): string {
  const u = (c: string) => absoluta(base, c) ?? c;
  const nomes = m.fontes.map((f) => `${m.candidatos[f.candidato].nome} (${m.candidatos[f.candidato].partido})`).sort();
  const coleta = m.fontes.map((f) => f.coletado_em).sort()[0];
  const ultima = geradoEm(Object.values(comps));
  return [
    `# ${NOME_SITE}`,
    "",
    `> Compara, tema a tema, o que os planos de governo de ${nomes.join(" e ")}, candidatos ao 2º turno de 2026, ` +
      "registrados no TSE, propõem: onde convergem, onde divergem e o que só um deles trata. Cada ponto traz o trecho " +
      "literal do plano, o arquivo e a página do PDF. Resumos gerados por IA, verificados automaticamente e revisados " +
      "por uma pessoa antes da publicação. Podem conter erros: o PDF original é a fonte definitiva.",
    "",
    `Documentos coletados do TSE em ${dataBR(coleta)}.${ultima ? ` Comparações geradas até ${dataBR(ultima)}.` : ""}`,
    "",
    "## Temas",
    "",
    ...m.temas.map((t) => `- [${t.rotulo}](${u(`/tema/${t.id}`)}): ${t.descricao}.`),
    "",
    "## Visões transversais",
    "",
    `- [Semelhanças](${u("/semelhancas")}): ${LEAD_SEMELHANCAS}`,
    `- [Diferenças](${u("/diferencas")}): ${LEAD_DIFERENCAS}`,
    "",
    "## Fontes e método",
    "",
    `- [Sobre](${u("/sobre")}): para cada plano, arquivo, SHA-256, data de coleta e link da página do TSE.`,
    `- [Metodologia](${u("/metodologia")}): ingestão, classificação, comparação, verificação automática e revisão humana; só documentos oficiais.`,
    ...m.fontes.map((f) => `- [Plano de governo de ${m.candidatos[f.candidato].nome} (PDF)](${u(`/pdf/${encodeURIComponent(f.arquivo)}`)}): ${f.arquivo}, SHA-256 ${f.sha256}.`),
    "",
    "## Dados",
    "",
    "Um JSON por tema, o mesmo que a página mostra. Em `candidatos.<id>`: `resumo` (propostas) e `executivo` (até 3 " +
      "pontos-chave); depois `semelhancas`, `diferencas` e `omissoes`. Todo item tem `citacoes` com `arquivo`, `pagina` " +
      "(número impresso na página do PDF) e `trecho` (cópia literal, até 280 caracteres).",
    "",
    ...m.temas.map((t) => `- [${t.rotulo} (JSON)](${u(`/comparacoes/${t.id}.json`)})`),
    "",
  ].join("\n");
}
