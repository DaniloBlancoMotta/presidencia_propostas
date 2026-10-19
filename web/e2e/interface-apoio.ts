// Apoio dos e2e da feature interface-site (.specs/features/interface-site/checks.md).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { ROTAS } from "./apoio";

const RAIZ = resolve(import.meta.dirname, "..", "..");

/** Rotas do site, sem o visualizador de PDF. */
export const ROTAS_SITE = ROTAS.filter((r) => !r.startsWith("/pdf/"));
export const VISUALIZADOR = ROTAS.find((r) => r.startsWith("/pdf/"))!;
export const NOMES = { lula: "Lula (PT)", "flavio-bolsonaro": "Flávio Bolsonaro (PL)" } as const;
export type Cand = keyof typeof NOMES;
export const CANDS: Cand[] = ["lula", "flavio-bolsonaro"];

/** Número de páginas de um PDF do corpus: uma entrada por página física em dados/paginas. */
export function paginasDoPdf(arquivo: string): number {
  return (JSON.parse(readFileSync(resolve(RAIZ, "dados", "paginas", `${arquivo}.json`), "utf8")) as unknown[]).length;
}

/** Texto com o espaço não separável trocado por espaço comum e espaços colapsados ("U+00A0 normalizado"). */
export function normal(s: string): string {
  return s.replace(/\xa0/g, " ").replace(/\s+/g, " ").trim();
}

/** Cor calculada de um token, lida de uma sonda com `color: var(--<nome>)`, nunca de um literal copiado. */
export function token(page: Page, nome: string): Promise<string> {
  return page.evaluate((n) => {
    const d = document.createElement("div");
    d.style.color = `var(--${n})`;
    document.body.append(d);
    const v = getComputedStyle(d).color;
    d.remove();
    return v;
  }, nome);
}

export async function abrir(page: Page, rota: string, largura = 1366, altura = 900) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Sorteio fixo do script inline do <head>: < 0,5 dá "ab" (Flávio primeiro), ≥ 0,5 dá "ba" (Lula primeiro). */
export async function fixarSorteio(page: Page, valor: number) {
  await page.addInitScript((v) => {
    Math.random = () => v;
  }, valor);
}

/** Espera a hidratação: o App tirou a marca data-pre das abas (ou a rota não tem abas). */
export async function hidratado(page: Page) {
  await page.waitForFunction(() => !document.querySelector("[data-pre]") && document.documentElement.dataset.ordem !== undefined);
  await page.waitForFunction(() => {
    const r = document.getElementById("app");
    return !!r && Object.keys(r).some((k) => k.startsWith("__reactContainer"));
  });
}

export async function abrirTudo(page: Page) {
  for (const s of await page.locator("summary:visible").all()) {
    if (!(await s.evaluate((el) => (el.parentElement as HTMLDetailsElement).open))) await s.click();
  }
}
