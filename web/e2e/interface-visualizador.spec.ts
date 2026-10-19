// S3, S6 e C59 da feature interface-site: o visualizador "Ver no PDF".
import { expect, test, type Page } from "@playwright/test";
import { comparacao } from "./apoio";
import { normal, paginasDoPdf } from "./interface-apoio";

const LULA = "Programa-Governo-LULA-2026.pdf";
const ver = (arquivo: string, pagina: number) => `/pdf/visualizador.html?arquivo=${encodeURIComponent(arquivo)}&pagina=${pagina}`;

async function desenhada(page: Page, n: number) {
  await expect(page.locator("body")).toHaveAttribute("data-pagina", String(n), { timeout: 30_000 });
}

test("C59: a barra do visualizador traz no topo a faixa na cor do candidato do PDF", async ({ page }) => {
  for (const [arquivo, cand] of [
    ["Programa-Governo-LULA-2026.pdf", "cand-lula"],
    ["plano-de-governo_flavio.pdf", "cand-flavio-bolsonaro"],
  ]) {
    await page.goto(`/pdf/visualizador.html?arquivo=${arquivo}&pagina=1`);
    const esperada = await page.evaluate((n) => {
      const d = document.createElement("div");
      d.style.color = `var(--${n})`;
      document.body.append(d);
      const v = getComputedStyle(d).color;
      d.remove();
      return v;
    }, cand);
    const barra = await page.getByRole("banner").evaluate((el) => {
      const s = getComputedStyle(el);
      return { largura: parseFloat(s.borderTopWidth), cor: s.borderTopColor };
    });
    expect(barra.largura, arquivo).toBeGreaterThanOrEqual(4);
    expect(barra.cor, arquivo).toBe(esperada);
  }
});

test("C18: a barra fica fixa no topo só em telas largas e altas", async ({ page }) => {
  for (const [largura, altura, fixa] of [
    [1366, 900, true],
    [390, 844, false],
    [1366, 560, false],
  ] as const) {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto(ver(LULA, 1));
    const s = await page.getByRole("banner").evaluate((el) => ({ posicao: getComputedStyle(el).position, topo: getComputedStyle(el).top }));
    if (fixa) expect(s, `${largura}×${altura}`).toEqual({ posicao: "sticky", topo: "0px" });
    else expect(s.posicao, `${largura}×${altura}`).not.toBe("sticky");
  }
});

test("C19: dois toques em Próxima página antes de a página terminar de desenhar levam à página atual + 2", async ({ page }) => {
  const total = paginasDoPdf(LULA);
  await page.addInitScript(() => {
    // registra cada página desenhada (data-pagina do <body>)
    (window as unknown as { desenhos: string[] }).desenhos = [];
    new MutationObserver(() => (window as unknown as { desenhos: string[] }).desenhos.push(document.body.dataset.pagina ?? "")).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-pagina"],
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
  await page.goto(ver(LULA, 26));
  const proxima = page.getByRole("button", { name: "Próxima página" });
  await expect(proxima).toBeEnabled({ timeout: 30_000 });
  // os dois toques acontecem antes de a página 26 terminar de desenhar
  expect(await page.evaluate(() => document.body.dataset.pagina)).toBeUndefined();
  await proxima.click();
  await proxima.click();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await desenhada(page, 28);
  await expect(page.locator("#indicador")).toHaveText(`Página 28 de ${total}`);
  const desenhos = await page.evaluate(() => (window as unknown as { desenhos: string[] }).desenhos);
  expect(desenhos.at(-1)).toBe("28");
  await page.waitForTimeout(500);
  await expect(page.locator("body")).toHaveAttribute("data-pagina", "28");
});

test("C20: ao chegar na primeira ou na última página, o foco passa para o outro botão", async ({ page }) => {
  const total = paginasDoPdf(LULA);
  await page.goto(ver(LULA, 2));
  await desenhada(page, 2);
  const anterior = page.getByRole("button", { name: "Página anterior" });
  const proxima = page.getByRole("button", { name: "Próxima página" });
  await anterior.focus();
  await page.keyboard.press("Enter");
  await desenhada(page, 1);
  await expect(anterior).toBeDisabled();
  await expect(proxima).toBeFocused();
  await page.goto(ver(LULA, total - 1));
  await desenhada(page, total - 1);
  await proxima.focus();
  await page.keyboard.press("Enter");
  await desenhada(page, total);
  await expect(proxima).toBeDisabled();
  await expect(anterior).toBeFocused();
});

test("C21: enquanto o PDF baixa, a paginação fica desabilitada e Baixar o PDF original fica oculto", async ({ page }) => {
  let liberar: () => void = () => {};
  const espera = new Promise<void>((ok) => (liberar = ok));
  await page.route("**/pdf/*.pdf", async (r) => {
    await Promise.race([espera, new Promise((ok) => setTimeout(ok, 2000))]);
    await r.continue();
  });
  await page.goto(ver(LULA, 3), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.body.dataset.pagina)).toBeUndefined();
  await expect(page.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Baixar o PDF original" })).toBeHidden();
  liberar();
  await desenhada(page, 3);
  await expect(page.getByRole("link", { name: "Baixar o PDF original" })).toBeVisible();
});

test("C22: arquivo desconhecido ou download que falha: sem página nem paginação, alerta com link para o início", async ({ page }) => {
  for (const caso of ["desconhecido", "abortado"]) {
    if (caso === "abortado") await page.route("**/pdf/*.pdf", (r) => r.abort());
    await page.goto(caso === "desconhecido" ? "/pdf/visualizador.html?arquivo=nao-existe.pdf&pagina=1" : ver(LULA, 1));
    const alerta = page.getByRole("alert");
    await expect(alerta, caso).toBeVisible({ timeout: 30_000 });
    await expect(alerta.locator("p"), caso).not.toBeEmpty();
    await expect(alerta.getByRole("link", { name: "Voltar ao início" }), caso).toHaveAttribute("href", "/");
    await expect(page.locator("#tela"), caso).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Páginas" }), caso).toBeHidden();
    await expect(page.getByRole("button", { name: "Próxima página" }), caso).toBeHidden();
  }
});

test("C23: um único h1 com o nome do arquivo e uma única região viva com Página N de M", async ({ page }) => {
  const total = paginasDoPdf(LULA);
  await page.goto(ver(LULA, 5));
  await desenhada(page, 5);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText(LULA);
  await expect(page.locator("[aria-live]")).toHaveCount(1);
  await expect(page.locator("[aria-live]")).toHaveText(`Página 5 de ${total}`);
});

test("C24: depois de desenhar a página N, o título do documento é '<arquivo>, página N — Ver no PDF'", async ({ page }) => {
  await page.goto(ver(LULA, 7));
  await desenhada(page, 7);
  await expect(page).toHaveTitle(`${LULA}, página 7 — Ver no PDF`);
  await page.getByRole("button", { name: "Próxima página" }).click();
  await desenhada(page, 8);
  await expect(page).toHaveTitle(`${LULA}, página 8 — Ver no PDF`);
});

test("C25: antes de o PDF chegar, o canvas já reserva a proporção 1:1,414", async ({ page }) => {
  await page.route("**/pdf/*.pdf", async (r) => {
    await new Promise((ok) => setTimeout(ok, 2000));
    await r.continue();
  });
  await page.goto(ver(LULA, 1), { waitUntil: "domcontentloaded" });
  const caixa = await page.locator("#tela").boundingBox();
  expect(await page.evaluate(() => document.body.dataset.pagina)).toBeUndefined();
  expect(Math.abs(caixa!.height / caixa!.width - 1.414)).toBeLessThanOrEqual(0.01);
});

test("C26: ao estreitar a janela, a largura do canvas fica igual à de quem abre já estreito, em até 300 ms", async ({ page, browser }) => {
  const direto = await browser.newPage({ viewport: { width: 600, height: 900 } });
  await direto.goto(ver(LULA, 4));
  await desenhada(direto, 4);
  const esperada = (await direto.locator("#tela").boundingBox())!.width;
  await direto.close();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(ver(LULA, 4));
  await desenhada(page, 4);
  await page.setViewportSize({ width: 600, height: 900 });
  await page.waitForTimeout(300);
  expect(Math.abs((await page.locator("#tela").boundingBox())!.width - esperada)).toBeLessThanOrEqual(1);
});

test("C27: indicador com algarismos tabulares e largura mínima; os botões não se movem de 9 para 10", async ({ page }) => {
  await page.goto(ver(LULA, 9));
  await desenhada(page, 9);
  const s = await page.locator("#indicador").evaluate((el) => ({ num: getComputedStyle(el).fontVariantNumeric, min: parseFloat(getComputedStyle(el).minWidth) }));
  expect(s.num).toContain("tabular-nums");
  expect(s.min).toBeGreaterThan(0);
  const xs = async () => [
    (await page.getByRole("button", { name: "Página anterior" }).boundingBox())!.x,
    (await page.getByRole("button", { name: "Próxima página" }).boundingBox())!.x,
  ];
  const em9 = await xs();
  await page.getByRole("button", { name: "Próxima página" }).click();
  await desenhada(page, 10);
  const em10 = await xs();
  expect(Math.abs(em10[0] - em9[0])).toBeLessThanOrEqual(0.5);
  expect(Math.abs(em10[1] - em9[1])).toBeLessThanOrEqual(0.5);
});

test("C52: a página tem a camada de texto do pdf.js sobre o canvas, selecionável e com o trecho citado", async ({ page }) => {
  const citacao = comparacao("saude").candidatos.lula.resumo[0].citacoes[0];
  await page.goto(ver(citacao.arquivo, citacao.pagina));
  await desenhada(page, citacao.pagina);
  const camada = page.locator(".textLayer");
  await expect(camada.locator("span").first()).toBeAttached();
  const [c, t] = [(await page.locator("#tela").boundingBox())!, (await camada.boundingBox())!];
  for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(c[k] - t[k]), k).toBeLessThanOrEqual(2);
  const selecao = await camada.locator("span").first().evaluate((el) => getComputedStyle(el).userSelect);
  expect(selecao).not.toBe("none");
  const texto = normal(await camada.evaluate((el) => (el as HTMLElement).innerText));
  const cinco = normal(citacao.trecho).split(" ").slice(0, 5).join(" ");
  expect(cinco.split(" ")).toHaveLength(5);
  expect(texto).toContain(cinco);
});
