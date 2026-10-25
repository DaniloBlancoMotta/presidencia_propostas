// AC 38-43: chat por tema montado só com os JSONs aprovados.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { comparacao, publicados, temas } from "./apoio";
import type { CandidatoId } from "../src/tipos";

const CANDIDATOS: CandidatoId[] = ["flavio-bolsonaro", "lula"];
const nomes: Record<CandidatoId, string> = { "flavio-bolsonaro": "Flávio Bolsonaro (PL)", lula: "Lula (PT)" };

function campo(page: Page) {
  return page.getByRole("combobox", { name: "Sua mensagem" });
}

async function perguntar(page: Page, texto: string) {
  await campo(page).fill(texto);
  await campo(page).press("Enter");
  // fill não move o cursor como a digitação: se a lista do @ abriu, o Enter escolheu; envia de novo
  if ((await campo(page).inputValue()) !== "") await campo(page).press("Enter");
  const ultima = page.locator(".troca").last();
  await expect(ultima.locator(".carregando")).toHaveCount(0);
  return ultima;
}

async function fixarSorteio(page: Page, valor: number) {
  await page.addInitScript((v) => {
    Math.random = () => v;
  }, valor);
}

test("@ abre a lista de temas, o teclado escolhe e Enter mostra o resumo executivo", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.locator("h1")).toHaveText("Chat por tema");
  const c = campo(page);
  await c.click();
  await c.pressSequentially("@sa");
  const lista = page.getByRole("listbox", { name: "Temas" });
  await expect(lista).toBeVisible();
  await expect(c).toHaveAttribute("aria-expanded", "true");
  await expect(lista.getByRole("option").first()).toContainText("Saúde");
  await expect(c).toHaveAttribute("aria-activedescendant", "opcao-saude");
  await c.press("Enter");
  await expect(c).toHaveValue("@saude ");
  await expect(lista).toBeHidden();
  await c.press("Enter");
  const r = page.locator(".troca").last();
  await expect(r.locator(".fala-pessoa .mencao")).toHaveText("@Saúde");
  await expect(r.getByRole("heading", { level: 2 })).toHaveText("Resumo executivo · Saúde");
  await expect(page.getByRole("status")).toHaveText("Resposta pronta: Resumo executivo · Saúde.");
  await expect(c).toHaveValue("");
  const comp = comparacao("saude");
  for (const cand of CANDIDATOS) {
    const bloco = r.locator(`.candidato-resposta[data-cand="${cand}"]`);
    await expect(bloco.getByRole("heading", { level: 3 })).toHaveText(nomes[cand]);
    await expect(bloco.locator('[data-lista="executivo"] .texto-item')).toHaveText(comp.candidatos[cand].executivo.map((b) => b.texto));
    const so = comp.omissoes.filter((o) => o.tratado_por === cand);
    await expect(bloco.locator('[data-lista="so-neste"] .texto-item')).toHaveText(so.map((o) => o.texto));
    await expect(bloco.locator(".todas > summary")).toHaveText(`Todas as propostas do tema (${comp.candidatos[cand].resumo.length})`);
  }
  // ponto-chave expandido: trecho literal, arquivo, página e Ver no PDF
  const ponto = r.locator('[data-lista="executivo"] .item').first();
  await ponto.locator("summary").click();
  await expect(ponto.locator(".trecho").first()).toBeVisible();
  // "pág. N" com espaço não separável (C46)
  await expect(ponto.locator(".pagina").first()).toHaveText(/^pág\.\xa0\d+$/);
  await expect(ponto.getByRole("link", { name: /Ver no PDF/ }).first()).toHaveAttribute("href", /\/pdf\/visualizador\.html\?arquivo=.+&pagina=\d+$/);
});

test("teclado: setas percorrem a lista, Esc fecha e o botão @ Tema abre com todos os temas", async ({ page }) => {
  await page.goto("/chat");
  await page.getByRole("button", { name: "@ Tema" }).click();
  const c = campo(page);
  await expect(c).toBeFocused();
  await expect(c).toHaveValue("@");
  const opcoes = page.getByRole("listbox", { name: "Temas" }).getByRole("option");
  await expect(opcoes).toHaveCount(publicados.length);
  await c.press("ArrowDown");
  await expect(opcoes.nth(1)).toHaveAttribute("aria-selected", "true");
  await c.press("ArrowUp");
  await c.press("ArrowUp");
  await expect(opcoes.last()).toHaveAttribute("aria-selected", "true");
  await c.press("Escape");
  await expect(page.getByRole("listbox", { name: "Temas" })).toBeHidden();
  await c.pressSequentially("xyz");
  await c.press("Enter");
  await expect(page.locator(".troca").last().getByRole("heading", { level: 2 })).toHaveText("Tema não encontrado");
});

test("comparar: semelhanças, divergências e omissões do tema, com as citações do JSON", async ({ page }) => {
  await fixarSorteio(page, 0.9); // Lula primeiro
  await page.goto("/chat");
  const r = await perguntar(page, "@saude comparar");
  const comp = comparacao("saude");
  await expect(r.getByRole("heading", { level: 2 })).toHaveText("Comparação · Saúde");
  await expect(r.getByRole("heading", { level: 3 })).toHaveText([
    `Em comum (${comp.semelhancas.length})`,
    `Divergências (${comp.diferencas.length})`,
    `Só em um dos planos (${comp.omissoes.length})`,
  ]);
  await expect(r.locator('[data-lista="semelhancas"] .texto-item')).toHaveText(comp.semelhancas.map((i) => i.texto));
  await expect(r.locator('[data-lista="diferencas"] .texto-item')).toHaveText(comp.diferencas.map((i) => i.texto));
  const omissoes = [...comp.omissoes.filter((o) => o.tratado_por === "lula"), ...comp.omissoes.filter((o) => o.tratado_por !== "lula")];
  await expect(r.locator('[data-lista="omissoes"] .texto-item')).toHaveText(omissoes.map((o) => o.texto));
  const item = r.locator('[data-lista="semelhancas"] .item').first();
  await item.locator("summary").click();
  await expect(item.locator(".lado").first()).toHaveAttribute("data-cand", "lula");
  await expect(item.locator(".trecho", { hasText: comp.semelhancas[0].citacoes.lula[0].trecho.slice(0, 40) })).toHaveCount(1);
  // "Trocar ordem" vale também para as respostas já mostradas
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect(item.locator(".lado").first()).toHaveAttribute("data-cand", "flavio-bolsonaro");
  const invertidas = [...comp.omissoes.filter((o) => o.tratado_por === "flavio-bolsonaro"), ...comp.omissoes.filter((o) => o.tratado_por !== "flavio-bolsonaro")];
  await expect(r.locator('[data-lista="omissoes"] .texto-item')).toHaveText(invertidas.map((o) => o.texto));
  // atalho da resposta: resumo executivo do mesmo tema
  await r.getByRole("button", { name: "Resumo executivo de Saúde" }).click();
  await expect(page.locator(".troca").last().getByRole("heading", { level: 2 })).toHaveText("Resumo executivo · Saúde");
  await expect(page.locator(".troca").last().locator(".candidato-resposta").first()).toHaveAttribute("data-cand", "flavio-bolsonaro");
});

test("ordem sorteada: o resumo executivo segue a ordem vigente", async ({ page }) => {
  await fixarSorteio(page, 0.1); // Flávio primeiro
  await page.goto("/chat");
  await page.getByRole("button", { name: "@Educação" }).click();
  const r = page.locator(".troca").last();
  await expect(r.getByRole("heading", { level: 2 })).toHaveText("Resumo executivo · Educação");
  await expect(r.locator(".candidato-resposta").first()).toHaveAttribute("data-cand", "flavio-bolsonaro");
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect(r.locator(".candidato-resposta").first()).toHaveAttribute("data-cand", "lula");
});

test("busca por palavra: só pontos que a mencionam, dos dois candidatos", async ({ page }) => {
  await page.goto("/chat");
  const r = await perguntar(page, "fila");
  const saude = r.locator(".bloco-resposta", { has: page.getByRole("heading", { level: 2, name: "“fila” em Saúde" }) });
  await expect(saude).toHaveCount(1);
  for (const li of await r.locator(".item").all()) {
    const t = ((await li.textContent()) ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    expect(t).toMatch(/\bfila/);
  }
  for (const cand of CANDIDATOS) {
    await expect(saude.locator(`.candidato-resposta[data-cand="${cand}"] [data-lista="achados"] .item`).first()).toBeVisible();
  }
  // a ordem dos blocos é a de themes.yaml
  const titulos = await r.locator(".bloco-resposta > h2").allTextContents();
  const ordem = temas.filter((t) => titulos.includes(`“fila” em ${t.rotulo}`)).map((t) => `“fila” em ${t.rotulo}`);
  expect(titulos).toEqual(ordem);
  const nada = await perguntar(page, "@saude submarino");
  await expect(nada.locator(".vazio")).toContainText("Nenhum ponto publicado menciona “submarino” em Saúde.");
});

test("panorama: comparar os temas mostra as contagens de cada tema publicado", async ({ page }) => {
  await page.goto("/chat");
  const r = await perguntar(page, "comparar os temas");
  await expect(r.getByRole("heading", { level: 2 })).toHaveText("Panorama dos temas");
  const cartoes = r.locator(".cartao-panorama");
  await expect(cartoes).toHaveCount(publicados.length);
  const ordem = temas.filter((t) => publicados.includes(t.id));
  await expect(cartoes.locator("h3")).toHaveText(ordem.map((t) => t.rotulo));
  for (const t of ordem) {
    const c = comparacao(t.id);
    await expect(r.locator(`.cartao-panorama[data-tema="${t.id}"] dd`)).toHaveText([
      String(c.semelhancas.length),
      String(c.diferencas.length),
      String(c.omissoes.length),
    ]);
  }
});

test("mesma origem: as respostas só baixam /comparacoes do próprio domínio", async ({ page, baseURL }) => {
  const origem = new URL(baseURL!).origin;
  const pedidos: string[] = [];
  page.on("request", (req) => pedidos.push(req.url()));
  await page.goto("/chat");
  await page.waitForLoadState("networkidle");
  const antes = pedidos.length;
  await perguntar(page, "@agronegocio comparar");
  await perguntar(page, "fertilizantes");
  const depois = pedidos.slice(antes);
  expect(depois.length).toBeGreaterThan(0);
  for (const u of depois) {
    expect(new URL(u).origin).toBe(origem);
    expect(new URL(u).pathname).toMatch(/^\/comparacoes\/[a-z0-9-]+\.json$/);
  }
});

test("conversa: a 1ª mensagem abre a página ampla, com o contexto da pergunta e da resposta", async ({ page, isMobile }) => {
  await page.goto("/chat");
  await expect(page.locator("#app > div.pagina")).not.toHaveClass(/ampla/);
  await perguntar(page, "@saude");
  await expect(page).toHaveURL(/\/chat\/conversa$/);
  await expect(page.locator("h1")).toHaveText("Conversa");
  await expect(page).toHaveTitle(/^Conversa · Chat por tema/);
  await expect(page.locator("#app > div.pagina")).toHaveClass(/ampla/);
  await perguntar(page, "fila");
  const trocas = page.locator(".troca");
  await expect(trocas).toHaveCount(2);
  const g = comparacao("saude").gerado_em;
  if (!isMobile) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const painel = page.getByRole("complementary", { name: /Contexto/ });
    await expect(painel).toBeVisible();
    // o painel mostra a última pergunta; "Ver contexto" troca para outra
    await expect(painel.locator(".contexto-dados").first()).toContainText("Busca por palavra nos pontos publicados");
    await expect(painel.locator(".contexto-dados").first()).toContainText("fila");
    await trocas.first().getByRole("button", { name: "Ver contexto" }).click();
    await expect(trocas.first().getByRole("button", { name: "Ver contexto" })).toHaveAttribute("aria-pressed", "true");
    await expect(painel.locator(".contexto-dados").first()).toContainText("Resumo executivo do tema");
    await expect(painel.locator(".contexto-dados").first()).toContainText("Saúde");
    await expect(painel.getByRole("link", { name: "dados de Saúde (JSON)" })).toHaveAttribute("href", "/comparacoes/saude.json");
    await expect(painel).toContainText(`comparação gerada em ${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}`);
    // página ampla: a conversa e o painel lado a lado
    const [a, b] = [await page.locator(".coluna-conversa").boundingBox(), await painel.boundingBox()];
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
    expect(a!.width + b!.width).toBeGreaterThan(1100);
    await expect(page.locator(".contexto-inline").first()).toBeHidden();
  } else {
    await expect(page.getByRole("complementary", { name: /Contexto/ })).toBeHidden();
    const inline = trocas.first().locator(".contexto-inline");
    await inline.locator("summary").click();
    await expect(inline.locator(".contexto-dados").first()).toContainText("Resumo executivo do tema");
  }
  // voltar à entrada mostra o atalho para continuar
  await page.getByRole("link", { name: "Chat por tema", exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Continuar a conversa (2 perguntas)" })).toHaveAttribute("href", "/chat/conversa");
});

test("produção: sem /ask — nenhum botão de IA e a CSP só conecta ao próprio domínio", async ({ page }) => {
  await page.goto("/chat");
  const r = await perguntar(page, "fertilizantes");
  await expect(r.locator(".bloco-resposta").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Perguntar à IA/ })).toHaveCount(0);
  await expect(page.locator("#dica-chat")).toContainText("nada é gerado na hora");
  const csp = (await page.request.get("/chat")).headers()["content-security-policy"];
  expect(csp).toContain("connect-src 'self';");
});

test("voltar: abrir um tema pela resposta e voltar mantém a conversa", async ({ page }) => {
  await page.goto("/chat");
  await perguntar(page, "@saude");
  await page.getByRole("link", { name: "Abrir a página de Saúde" }).click();
  await expect(page.locator("h1")).toHaveText("Saúde");
  await page.goBack();
  await expect(page).toHaveURL(/\/chat\/conversa$/);
  await expect(page.locator("h1")).toHaveText("Conversa");
  await expect(page.locator(".troca")).toHaveCount(1);
  await expect(page.locator(".troca").getByRole("heading", { level: 2 })).toHaveText("Resumo executivo · Saúde");
});

test("acessível: axe sem serious/critical e sem rolagem horizontal em 160 px com respostas abertas", async ({ page }) => {
  await page.goto("/chat");
  await perguntar(page, "@seguranca-publica");
  await perguntar(page, "@seguranca-publica comparar");
  await perguntar(page, "comparar os temas");
  await perguntar(page, "presídios");
  for (const s of await page.locator("summary:visible").all()) await s.click();
  await page.getByRole("button", { name: "@ Tema" }).click();
  const res = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  await page.setViewportSize({ width: 160, height: 700 });
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
});
