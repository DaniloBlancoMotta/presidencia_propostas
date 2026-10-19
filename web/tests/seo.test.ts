// GEO: dados estruturados só com o que a página mostra; robots, sitemap e llms.txt com e sem domínio.
import { describe, expect, it } from "vitest";
import { jsonLd, llms, robots, sitemap } from "../scripts/seo";
import { LEAD_INICIO, type Comparacao, type DadosPagina } from "../src/tipos";

const F = "plano-de-governo_flavio.pdf";
const L = "Programa-Governo-LULA-2026.pdf";
const manifesto: DadosPagina["manifesto"] = {
  temas: [
    { id: "saude", rotulo: "Saúde", icone: "cruz", descricao: "SUS, filas, atenção básica, medicamentos" },
    { id: "educacao", rotulo: "Educação", icone: "livro", descricao: "Educação básica, ensino técnico, universidades" },
  ],
  fontes: [
    { arquivo: F, candidato: "flavio-bolsonaro", partido: "PL", sha256: "a".repeat(64), coletado_em: "2026-10-17", url_tse: "https://tse", conferido_tse: true },
    { arquivo: L, candidato: "lula", partido: "PT", sha256: "b".repeat(64), coletado_em: "2026-10-17", url_tse: "https://tse", conferido_tse: true },
  ],
  candidatos: { "flavio-bolsonaro": { nome: "Flávio Bolsonaro", partido: "PL" }, lula: { nome: "Lula", partido: "PT" } },
  responsavel: null,
};
const comp = (id: string, gerado_em: string) => ({ theme_id: id, gerado_em }) as unknown as Comparacao;
const tema: DadosPagina = { rota: { tipo: "tema", id: "saude" }, manifesto, comparacoes: { saude: comp("saude", "2026-10-18T13:12:13-03:00") } };

describe("GEO", () => {
  it("tema: WebPage com o tema, os dois candidatos, os dois PDFs e a data de geração", () => {
    const ld = jsonLd(tema, "Saúde: propostas", "https://comparador.exemplo/") as { "@graph": Record<string, any>[] };
    const [site, pagina] = ld["@graph"];
    expect(site).toMatchObject({ "@type": "WebSite", "@id": "https://comparador.exemplo/#site", url: "https://comparador.exemplo/" });
    expect(pagina).toMatchObject({
      "@type": "WebPage",
      name: "Saúde: propostas",
      url: "https://comparador.exemplo/tema/saude",
      description: "SUS, filas, atenção básica, medicamentos",
      about: { name: "Saúde" },
      dateModified: "2026-10-18T13:12:13-03:00",
      isPartOf: { "@id": "https://comparador.exemplo/#site" },
    });
    expect(pagina.mentions.map((p: any) => p.name).sort()).toEqual(["Flávio Bolsonaro", "Lula"]);
    expect(pagina.isBasedOn.map((d: any) => d.url)).toEqual([
      "https://comparador.exemplo/pdf/plano-de-governo_flavio.pdf",
      "https://comparador.exemplo/pdf/Programa-Governo-LULA-2026.pdf",
    ]);
  });

  it("sem domínio: nenhum endereço absoluto inventado", () => {
    const ld = jsonLd(tema, "Saúde: propostas", null)!;
    const texto = JSON.stringify(ld);
    expect(texto).not.toMatch(/https?:\/\/(?!schema\.org)/);
    expect(jsonLd({ ...tema, rota: { tipo: "inicio" }, comparacoes: {} }, "Início", null)).toMatchObject({
      "@graph": [{}, { description: LEAD_INICIO }],
    });
    expect(jsonLd({ ...tema, rota: { tipo: "nao-encontrada" } }, "x", null)).toBeNull();
  });

  it("robots.txt abre tudo menos o visualizador, e só aponta sitemap com domínio", () => {
    expect(robots(null)).toContain("User-agent: *\nAllow: /\nDisallow: /pdf/visualizador.html\n");
    expect(robots(null)).not.toContain("Sitemap");
    expect(robots("https://comparador.exemplo/")).toContain("Sitemap: https://comparador.exemplo/sitemap.xml");
  });

  it("sitemap com lastmod só onde há data de conteúdo", () => {
    const x = sitemap("https://comparador.exemplo/", [{ caminho: "/tema/saude", modificado: "2026-10-18T13:12:13-03:00" }, { caminho: "/sobre" }]);
    expect(x).toContain("<url><loc>https://comparador.exemplo/tema/saude</loc><lastmod>2026-10-18</lastmod></url>");
    expect(x).toContain("<url><loc>https://comparador.exemplo/sobre</loc></url>");
  });

  it("llms.txt lista temas, fontes e dados, com o aviso de IA", () => {
    const t = llms(manifesto, null, { saude: comp("saude", "2026-10-18T13:12:13-03:00") });
    expect(t.startsWith("# Compare os planos de governo 2026\n")).toBe(true);
    expect(t).toContain("Flávio Bolsonaro (PL) e Lula (PT)");
    expect(t).toContain("- [Saúde](/tema/saude): SUS, filas, atenção básica, medicamentos.");
    expect(t).toContain("- [Educação (JSON)](/comparacoes/educacao.json)");
    expect(t).toContain("o PDF original é a fonte definitiva");
    expect(t).toContain("Documentos coletados do TSE em 17/10/2026. Comparações geradas até 18/10/2026.");
  });
});
