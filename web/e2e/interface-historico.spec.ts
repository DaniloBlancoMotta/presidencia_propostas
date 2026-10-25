// S4 da feature interface-site: navegação que preserva onde a pessoa estava.
import { expect, test, type Page } from "@playwright/test";
import { comparacao, publicados, temas } from "./apoio";
import { abrir, fixarSorteio, hidratado, normal } from "./interface-apoio";

const historico = (page: Page) => page.evaluate(() => history.length);

function atrasarComparacoes(page: Page, ms = 1000) {
  return page.route("**/comparacoes/*.json", async (r) => {
    await new Promise((ok) => setTimeout(ok, ms));
    await r.continue();
  });
}

test("C28: Pular para o conteúdo e o índice de /diferencas põem o foco no destino, sem histórico nem busca", async ({ page }) => {
  const buscas: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/comparacoes/")) buscas.push(r.url());
  });
  await abrir(page, "/");
  await hidratado(page);
  const antes = await historico(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#conteudo")).toBeFocused();
  expect(await historico(page)).toBe(antes);
  await page.waitForTimeout(300);
  expect(buscas).toEqual([]);

  await abrir(page, "/diferencas");
  await hidratado(page);
  buscas.length = 0;
  const n = await historico(page);
  await page.locator('.indice-temas a[href="#g-saude"]').click();
  await expect(page.locator("#g-saude")).toBeFocused();
  expect(await historico(page)).toBe(n);
  await page.waitForTimeout(300);
  expect(buscas).toEqual([]);
});

test("C29: voltar de um tema para /diferencas devolve a mesma posição de rolagem", async ({ page }) => {
  await abrir(page, "/diferencas", 390, 844);
  await hidratado(page);
  await page.locator("#g-agronegocio").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(200);
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(1000);
  await page.locator("#g-agronegocio a").click();
  await expect(page.locator("h1")).toHaveText("Agronegócio");
  await page.goBack();
  await expect(page.locator("h1")).toHaveText("Diferenças");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 3);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2);
});

test("C30: enquanto o JSON do tema baixa, o main fica aria-busy e o status diz Carregando…", async ({ page }) => {
  await atrasarComparacoes(page);
  await abrir(page, "/");
  await hidratado(page);
  await page.getByRole("link", { name: "Saúde" }).click();
  await expect(page.locator("main")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toHaveText("Carregando…");
  await expect(page.locator("h1")).toHaveText("Saúde", { timeout: 10_000 });
  await expect(page.locator("main")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toHaveText("");
});

test("C31: tocar Saúde e logo Educação termina em Educação, com uma só entrada nova no histórico", async ({ page }) => {
  await atrasarComparacoes(page);
  await abrir(page, "/");
  await hidratado(page);
  const antes = await historico(page);
  await page.getByRole("link", { name: "Saúde" }).click();
  await page.getByRole("link", { name: "Educação" }).click();
  await expect(page.locator("h1")).toHaveText("Educação", { timeout: 10_000 });
  await page.waitForTimeout(1500); // a resposta de Saúde chega depois e não muda nada
  await expect(page).toHaveURL(/\/tema\/educacao$/);
  await expect(page.locator("h1")).toHaveText("Educação");
  expect(await historico(page)).toBe(antes + 1);
});

test("C32: cada filtro vai para a URL, sem entrada nova no histórico", async ({ page }) => {
  await abrir(page, "/tema/saude");
  await hidratado(page);
  const antes = await historico(page);
  await page.getByRole("button", { name: "Só semelhanças" }).click();
  await expect(page).toHaveURL(/\/tema\/saude\?filtro=semelhancas$/);
  await page.getByRole("button", { name: "Só diferenças" }).click();
  await expect(page).toHaveURL(/\/tema\/saude\?filtro=diferencas$/);
  await page.getByRole("button", { name: "Mostrar tudo" }).click();
  await expect(page).toHaveURL(/\/tema\/saude$/);
  expect(await historico(page)).toBe(antes);
});

test("C33: abrir o tema com ?filtro mostra só aquela lista, com o filtro pressionado", async ({ page }) => {
  await abrir(page, "/tema/saude?filtro=semelhancas");
  await expect(page.getByRole("button", { name: "Só semelhanças" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-lista]")).toHaveCount(1);
  await expect(page.locator('[data-lista="semelhancas"]')).toBeVisible();
  await abrir(page, "/tema/saude?filtro=diferencas");
  await expect(page.getByRole("button", { name: "Só diferenças" })).toHaveAttribute("aria-pressed", "true");
  const listas = await page.locator("[data-lista]").evaluateAll((els) => els.map((e) => e.getAttribute("data-lista")));
  expect(listas).toEqual(["diferencas", "omissoes"]);
  const r = await page.request.get("/tema/saude?filtro=diferencas");
  expect(r.status()).toBe(200);
});

test("C34: ?filtro com valor desconhecido abre em Mostrar tudo", async ({ page }) => {
  await abrir(page, "/tema/saude?filtro=xyz");
  await hidratado(page);
  await expect(page.getByRole("button", { name: "Mostrar tudo" })).toHaveAttribute("aria-pressed", "true");
  const listas = await page.locator("[data-lista]").evaluateAll((els) => els.map((e) => e.getAttribute("data-lista")));
  expect(listas).toEqual(["resumo", "semelhancas", "diferencas", "omissoes"]);
  for (const l of listas) await expect(page.locator(`[data-lista="${l}"]`)).toBeVisible();
});

test("C35: Trocar ordem anuncia quem passou a aparecer primeiro", async ({ page }) => {
  await fixarSorteio(page, 0.1); // Flávio primeiro
  await abrir(page, "/tema/saude");
  await hidratado(page);
  const status = page.getByRole("status");
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect.poll(async () => normal((await status.textContent()) ?? "")).toBe("Ordem trocada: Lula (PT) aparece primeiro.");
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect.poll(async () => normal((await status.textContent()) ?? "")).toBe("Ordem trocada: Flávio Bolsonaro (PL) aparece primeiro.");
});

test("C36: /semelhancas e /diferencas abrem com um índice dos temas, com âncoras e contagens", async ({ page }) => {
  for (const tipo of ["semelhancas", "diferencas"] as const) {
    await abrir(page, `/${tipo}`);
    await hidratado(page);
    const comItens = temas
      .filter((t) => publicados.includes(t.id))
      .map((t) => ({ t, n: comparacao(t.id)[tipo].length + (tipo === "diferencas" ? comparacao(t.id).omissoes.length : 0) }))
      .filter(({ n }) => n > 0);
    const depois = await page.locator(".lead").evaluate((el) => {
      const prox = el.nextElementSibling!;
      const lista = prox.matches("ul, ol") ? prox : prox.querySelector(":scope > ul, :scope > ol");
      return lista ? [...lista.querySelectorAll(":scope > li > a")].map((a) => ({ href: a.getAttribute("href"), texto: a.textContent })) : null;
    });
    expect(depois, tipo).not.toBeNull();
    expect(depois!.map((l) => l.href), tipo).toEqual(comItens.map(({ t }) => `#g-${t.id}`));
    depois!.forEach((l, i) => expect(normal(l.texto!), tipo).toContain(String(comItens[i].n)));
    for (const { t } of [comItens[0], comItens[comItens.length - 1]]) {
      await page.locator(`.lead + * a[href="#g-${t.id}"]`).click();
      const topo = (await page.locator(`h2#g-${t.id}`).boundingBox())!.y;
      expect(topo, `${tipo} ${t.id}`).toBeGreaterThanOrEqual(0);
      expect(topo, `${tipo} ${t.id}`).toBeLessThanOrEqual(64);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
  expect((await page.request.get("/diferencas#g-saude")).status()).toBe(200);
});

test("C37: em /diferencas, subtítulos Diferenças (n) e Omissões (n) por tema, sem o selo Diferença", async ({ page }) => {
  await abrir(page, "/diferencas");
  for (const id of publicados) {
    const c = comparacao(id);
    const esperados = [...(c.diferencas.length ? [`Diferenças (${c.diferencas.length})`] : []), ...(c.omissoes.length ? [`Omissões (${c.omissoes.length})`] : [])];
    if (!esperados.length) continue;
    const h3 = await page.locator(`section[data-tema="${id}"] > h3`).allTextContents();
    expect(h3.map(normal), id).toEqual(esperados);
  }
  const selos = await page.locator("li.item:not(.omissao) .selo").allTextContents();
  expect(selos.filter((s) => normal(s) === "Diferença")).toEqual([]);
});

test("C38: /sobre traz os cartões dos planos na ordem vigente, lado a lado em 1024 px", async ({ page }) => {
  for (const [sorteio, ordem] of [
    [0.1, ["flavio-bolsonaro", "lula"]],
    [0.9, ["lula", "flavio-bolsonaro"]],
  ] as const) {
    await fixarSorteio(page, sorteio);
    await abrir(page, "/sobre", 1024);
    await hidratado(page);
    const cartoes = page.locator(".fontes > li");
    expect(await cartoes.evaluateAll((els) => els.map((e) => e.getAttribute("data-cand")))).toEqual(ordem);
    const [a, b] = [(await cartoes.nth(0).boundingBox())!, (await cartoes.nth(1).boundingBox())!];
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(b.x).toBeGreaterThan(a.x + a.width - 1);
  }
});

test("C39: em 1024 px, sem tabpanel e sem aria-labelledby ou aria-controls apontando para elemento oculto", async ({ page }) => {
  await abrir(page, "/tema/saude", 1024);
  await hidratado(page);
  await expect(page.locator('[role="tabpanel"]')).toHaveCount(0);
  const ocultos = await page.evaluate(() => {
    const saida: string[] = [];
    for (const el of document.querySelectorAll("[aria-labelledby], [aria-controls]")) {
      for (const atr of ["aria-labelledby", "aria-controls"]) {
        for (const id of (el.getAttribute(atr) ?? "").split(/\s+/).filter(Boolean)) {
          const alvo = document.getElementById(id);
          if (!alvo || !alvo.checkVisibility()) saida.push(`${el.tagName}#${el.id} ${atr}=${id}`);
        }
      }
    }
    return saida;
  });
  expect(ocultos).toEqual([]);
});
