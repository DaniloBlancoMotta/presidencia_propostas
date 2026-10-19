// GEO: o HTML entregue tem título com contexto, dados estruturados válidos que repetem o que a página
// mostra (nome = <title>, dateModified = data visível, PDFs que existem), robots.txt e llms.txt.
import { expect, test } from "@playwright/test";
import { comparacao, publicados, temas } from "./apoio";

const PAGINAS = ["/", ...publicados.map((id) => `/tema/${id}`), "/semelhancas", "/diferencas", "/metodologia", "/sobre", "/chat"];

function dataBR(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

test("dados estruturados batem com a página, sem JavaScript", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  for (const caminho of PAGINAS) {
    await page.goto(caminho);
    const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocos, caminho).toHaveLength(1);
    const ld = JSON.parse(blocos[0]);
    expect(ld["@context"]).toBe("https://schema.org");
    const pagina = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "WebPage");
    expect(pagina.name, caminho).toBe(await page.title());
    expect(pagina.inLanguage).toBe("pt-BR");
    if (pagina.description) await expect(page.locator("main"), caminho).toContainText(pagina.description);
    if (pagina.dateModified) {
      await expect(page.locator(".atualizacao time").first(), caminho).toHaveAttribute("datetime", pagina.dateModified);
      await expect(page.locator(".atualizacao"), caminho).toContainText(dataBR(pagina.dateModified));
    }
    for (const d of pagina.isBasedOn ?? []) {
      expect((await page.request.get(`/pdf/${encodeURIComponent(d.name)}`)).status(), d.name).toBe(200);
    }
    for (const p of pagina.mentions ?? []) await expect(page.locator("body"), caminho).toContainText(p.name);
  }
  await ctx.close();
});

test("título de tema com o contexto da eleição; prévia do link continua o rótulo (decisão 15)", async ({ page }) => {
  for (const t of temas.filter((x) => publicados.includes(x.id))) {
    await page.goto(`/tema/${t.id}`);
    await expect(page).toHaveTitle(`${t.rotulo}: propostas dos planos de governo do 2º turno de 2026`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", t.rotulo);
    await expect(page.locator("h1")).toHaveText(t.rotulo);
    await expect(page.locator(".atualizacao")).toContainText(`Comparação gerada em ${dataBR(comparacao(t.id).gerado_em)}`);
  }
  // navegação no cliente atualiza o título do mesmo jeito
  await page.goto("/");
  await page.getByRole("link", { name: "Saúde" }).click();
  await expect(page).toHaveTitle("Saúde: propostas dos planos de governo do 2º turno de 2026");
});

test("robots.txt, llms.txt e sitemap (sem domínio configurado)", async ({ request }) => {
  const r = await request.get("/robots.txt");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("text/plain");
  const robots = await r.text();
  expect(robots).toContain("User-agent: *\nAllow: /\nDisallow: /pdf/visualizador.html");
  expect(robots).not.toContain("Sitemap:");
  const l = await request.get("/llms.txt");
  expect(l.status()).toBe(200);
  const llms = await l.text();
  for (const id of publicados) {
    expect(llms).toContain(`(/tema/${id})`);
    expect(llms).toContain(`(/comparacoes/${id}.json)`);
  }
  expect((await request.get("/sitemap.xml")).status()).toBe(404);
});
