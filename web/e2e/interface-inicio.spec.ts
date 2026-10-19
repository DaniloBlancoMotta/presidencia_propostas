// S2 da feature interface-site: o início diz quem está sendo comparado; títulos, aviso e rodapé de toda rota.
import { expect, test, type Page } from "@playwright/test";
import { dataColeta } from "./apoio";
import { ROTAS_SITE, abrir, fixarSorteio, normal } from "./interface-apoio";

type Caixa = { x: number; y: number; width: number; height: number };

async function caixas(page: Page, seletor: string): Promise<Caixa[]> {
  return page.locator(seletor).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

/** Agrupa caixas em linhas pelo topo (±1 px). */
function linhas(cs: Caixa[]): Caixa[][] {
  const saida: Caixa[][] = [];
  for (const c of cs) {
    const l = saida.find((x) => Math.abs(x[0].y - c.y) <= 1);
    if (l) l.push(c);
    else saida.push([c]);
  }
  return saida;
}

test("C12: a abertura nomeia os dois candidatos na ordem vigente", async ({ page }) => {
  for (const [sorteio, a, b] of [
    [0.1, "Flávio Bolsonaro (PL)", "Lula (PT)"],
    [0.9, "Lula (PT)", "Flávio Bolsonaro (PL)"],
  ] as const) {
    await fixarSorteio(page, sorteio);
    await abrir(page, "/");
    const texto = await page.locator(".abertura").evaluate((el) => (el as HTMLElement).innerText);
    expect(normal(texto)).toBe(
      `Planos de governo de ${a} e ${b}, candidatos ao 2º turno de 2026, registrados no TSE. Escolha um tema para comparar o que cada plano propõe, com o trecho e a página do PDF original.`,
    );
  }
});

test("C13: em 1366 e 480 px, os destaques dividem uma linha e os 8 temas ficam em 2 linhas de 4", async ({ page }) => {
  for (const largura of [1366, 480]) {
    await abrir(page, "/", largura);
    const [sem, dif] = await caixas(page, ".destaques > li");
    const grade = (await caixas(page, ".destaques"))[0];
    const espaco = await page.locator(".destaques").evaluate((e) => parseFloat(getComputedStyle(e).columnGap) || 0);
    expect(Math.abs(sem.y - dif.y), `${largura}`).toBeLessThanOrEqual(1);
    expect(Math.abs(sem.width - dif.width), `${largura}`).toBeLessThanOrEqual(1);
    expect(Math.abs(sem.width + dif.width - (grade.width - espaco)), `${largura}`).toBeLessThanOrEqual(1);
    const temas = await caixas(page, ".indice > li");
    expect(temas).toHaveLength(8);
    expect(linhas(temas).map((l) => l.length), `${largura}`).toEqual([4, 4]);
  }
});

test("C14: em 390 px, 2 temas por linha com o ícone ao lado do rótulo; abaixo de 340 px, 1 por linha; 160 px sem rolagem lateral", async ({ page }) => {
  await abrir(page, "/", 390, 844);
  const temas = await caixas(page, ".indice > li");
  expect(linhas(temas).map((l) => l.length)).toEqual([2, 2, 2, 2]);
  for (const a of await page.locator(".indice a").all()) {
    const d = await a.evaluate((el) => {
      const i = el.querySelector("svg")!.getBoundingClientRect();
      const r = el.querySelector(".nome")!;
      const t = r.getBoundingClientRect();
      return { icone: i.y + i.height / 2, rotulo: t.y + t.height / 2, hifens: getComputedStyle(r).hyphens };
    });
    expect(Math.abs(d.icone - d.rotulo)).toBeLessThanOrEqual(4);
    expect(d.hifens).not.toBe("auto");
  }
  await abrir(page, "/", 339, 844);
  expect(linhas(await caixas(page, ".indice > li")).every((l) => l.length === 1)).toBe(true);
  const [sem, dif] = await caixas(page, ".destaques > li");
  expect(dif.y).toBeGreaterThanOrEqual(sem.y + sem.height - 1);
  expect(Math.abs(dif.x - sem.x)).toBeLessThanOrEqual(1);
  await abrir(page, "/", 160, 700);
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
});

test("C15: os cartões de uma mesma linha da grade têm a mesma altura", async ({ page }) => {
  for (const largura of [1366, 390]) {
    await abrir(page, "/", largura);
    for (const seletor of [".destaques a", ".indice a"]) {
      for (const l of linhas(await caixas(page, seletor))) {
        for (const c of l) expect(Math.abs(c.height - l[0].height), `${largura} ${seletor}`).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("C16: cada rota abre com o próprio título e o aviso logo abaixo, sem barra de marca", async ({ page }) => {
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    expect(await page.locator(".marca").count(), rota).toBe(0);
    const r = await page.evaluate(() => {
      const h1 = document.querySelector("h1")!;
      const aviso = document.querySelector(".aviso-ia")!;
      const antes = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const entre = [...document.querySelectorAll("main button, main ul, main ol")].filter((el) => antes(h1, el) && antes(el, aviso));
      const links = [...document.querySelectorAll("a")].filter((a) => antes(a, h1));
      links.at(-1)?.setAttribute("data-teste-ultimo", "");
      return {
        h1AntesDoAviso: antes(h1, aviso),
        entre: entre.map((e) => e.tagName),
        marcaAntes: links.some((a) => a.textContent!.includes("Compare os planos de governo 2026")),
        href: links.at(-1)?.getAttribute("href") ?? null,
      };
    });
    expect(r.h1AntesDoAviso, rota).toBe(true);
    expect(r.entre, rota).toEqual([]);
    expect(r.marcaAntes, rota).toBe(false);
    if (rota === "/") continue;
    const ultimo = page.locator("[data-teste-ultimo]");
    if (rota === "/chat/conversa") {
      await expect(ultimo, rota).toHaveAccessibleName("Chat por tema");
      expect(r.href, rota).toBe("/chat");
    } else {
      await expect(ultimo, rota).toHaveAccessibleName("Todos os temas");
      expect(r.href, rota).toBe("/");
    }
  }
});

test("C17: rodapé com Chat por tema, Metodologia e Sobre antes da data de coleta; títulos das duas páginas", async ({ page }) => {
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    const rodape = await page.locator("footer").evaluate((f) => {
      const itens = [...f.querySelectorAll("a, p")];
      return itens.map((e) => (e.tagName === "A" ? `a:${e.textContent!.trim()}` : `p:${e.textContent!.trim()}`));
    });
    expect(rodape, rota).toEqual(["a:Chat por tema", "a:Metodologia", "a:Sobre", `p:Documentos coletados do TSE em ${dataColeta()}`]);
  }
  await abrir(page, "/metodologia");
  await expect(page.locator("h1")).toHaveText("Metodologia");
  await abrir(page, "/sobre");
  await expect(page.locator("h1")).toHaveText("Sobre");
});

test("C75: o botão Chat por tema continua na tela inicial, fora da grade de temas", async ({ page }) => {
  await abrir(page, "/");
  const chat = page.locator("main a[href='/chat']");
  await expect(chat).toHaveCount(1);
  await expect(chat).toBeVisible();
  await expect(chat).toContainText("Chat por tema");
  expect(await chat.evaluate((a) => !!a.closest('nav[aria-label="Temas"]'))).toBe(false);
});
