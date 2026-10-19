// /ask na prévia (plano-final §11), com o serviço interceptado: o botão só existe no build de prévia
// (dist-previa), a resposta gerada aparece rotulada, na ordem vigente, e os erros usam os textos da §11.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ASK = "http://127.0.0.1:8099/ask";
const F = "plano-de-governo_flavio.pdf";

const recorte = (pagina: number, texto: string) => ({ arquivo: F, pagina, paginas: [pagina], viradas: [[0, pagina]], texto });
const gerada = {
  origem: "gerado",
  camada: "plano",
  modelos: ["groq:openai/gpt-oss-120b"],
  contexto: {
    pergunta: "filas Saúde",
    termos: ["filas", "saude"],
    trechos: {
      "flavio-bolsonaro": [recorte(38, "Com a telessaúde, médicos atendem onde as filas são longas."), recorte(26, "Prontuário eletrônico único.")],
      lula: [{ arquivo: "Programa-Governo-LULA-2026.pdf", pagina: 37, paginas: [37, 38], viradas: [[0, 37], [10, 38]], texto: "Primeira p. e segunda página." }],
    },
  },
  candidatos: {
    "flavio-bolsonaro": {
      nao_encontrado: false,
      resumo: [{ texto: "Prevê telessaúde onde as filas são longas.", citacoes: [{ arquivo: F, pagina: 38, trecho: "onde as filas são longas" }] }],
    },
    lula: { nao_encontrado: true, resumo: [] },
  },
};

async function buscar(page: Page, texto: string) {
  const campo = page.getByRole("combobox", { name: "Sua mensagem" });
  await campo.fill(texto);
  await campo.press("Enter");
  // se a mensagem termina numa menção, o primeiro Enter escolhe o tema na lista; o segundo envia
  if ((await campo.inputValue()) !== "") await campo.press("Enter");
  return page.locator(".troca").last();
}

test("prévia: a busca ganha 'Perguntar à IA' e a resposta aparece rotulada, na ordem vigente", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.9; // Lula primeiro
  });
  const pedidos: string[] = [];
  await page.route(ASK, async (rota) => {
    pedidos.push(rota.request().postData() ?? "");
    await rota.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(gerada) });
  });
  await page.goto("/chat");
  await expect(page.locator("#dica-chat")).toContainText("nesta prévia");
  const r = await buscar(page, "filas @saude");
  await r.getByRole("button", { name: "Perguntar à IA (prévia)" }).click();
  const bloco = r.locator("article", { has: page.getByRole("heading", { name: "Resposta da IA (prévia)" }) });
  await expect(bloco).toBeVisible();
  expect(JSON.parse(pedidos[0])).toEqual({ pergunta: "filas Saúde" });
  await expect(bloco.locator(".aviso-previa")).toContainText("sem revisão humana");
  await expect(bloco.locator(".candidato-resposta").first()).toHaveAttribute("data-cand", "lula");
  await expect(bloco.locator('.candidato-resposta[data-cand="lula"] .nao-encontrado')).toHaveText("Não encontrado no plano de governo registrado no TSE");
  const item = bloco.locator('[data-lista="ia"] .item').first();
  await item.locator("summary").click();
  await expect(item.locator(".pagina")).toHaveText("pág. 38");
  await expect(item.getByRole("link", { name: /Ver no PDF/ })).toHaveAttribute("href", `/pdf/visualizador.html?arquivo=${encodeURIComponent(F)}&pagina=38`);
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect(bloco.locator(".candidato-resposta").first()).toHaveAttribute("data-cand", "flavio-bolsonaro");
  // o painel de contexto mostra o que foi ao modelo e quem respondeu
  await page.setViewportSize({ width: 1440, height: 900 });
  const painel = page.getByRole("complementary", { name: /Contexto/ });
  await expect(painel).toContainText("Pergunta enviada");
  await expect(painel).toContainText("“filas Saúde”");
  await expect(painel).toContainText("groq:openai/gpt-oss-120b");
  await expect(painel.getByRole("heading", { name: "Trechos que o modelo recebeu" })).toBeVisible();
  const flavio = painel.locator('.recortes-cand[data-cand="flavio-bolsonaro"] .recorte');
  await expect(flavio).toHaveCount(2);
  await expect(flavio.first()).toHaveAttribute("data-citado", "sim");
  await expect(flavio.nth(1)).toHaveAttribute("data-citado", "nao");
  await expect(painel.locator('.recortes-cand[data-cand="lula"] .marca-pagina')).toHaveText("[pág. 38] ");
  await expect(painel.locator('.recortes-cand[data-cand="lula"] .pagina')).toHaveText("págs. 37–38");
  const res = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(res.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("prévia: recusa, limite por hora e 15 s sem resposta usam os textos da §11", async ({ page }) => {
  let modo = "recusa";
  await page.route(ASK, async (rota) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Retry-After" };
    if (modo === "recusa")
      return rota.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ...gerada, origem: "extrativo", recusada: true, motivo: "opiniao" }) });
    if (modo === "limite")
      return rota.fulfill({ status: 429, contentType: "application/json", headers: { ...cors, "Retry-After": "1200" }, body: '{"erro":"limite"}' });
    // "lento": nunca responde
  });
  await page.clock.install();
  await page.goto("/chat");
  const r1 = await buscar(page, "qual plano é mais bonito");
  await r1.getByRole("button", { name: "Perguntar à IA (prévia)" }).click();
  await expect(r1.locator('[data-ia="recusa"]')).toHaveText(
    "Este site só mostra o que os planos de governo registrados no TSE dizem. Ele não opina, não compara qual é melhor e não faz previsões.",
  );
  modo = "limite";
  const r2 = await buscar(page, "fertilizantes");
  await r2.getByRole("button", { name: "Perguntar à IA (prévia)" }).click();
  await expect(r2.locator('[data-ia="erro"]')).toHaveText("Você chegou ao limite de 10 perguntas por hora. Tente de novo em 20 min.");
  modo = "lento";
  const r3 = await buscar(page, "creches");
  await r3.getByRole("button", { name: "Perguntar à IA (prévia)" }).click();
  await expect(r3.locator(".carregando")).toHaveText("Buscando nos dois planos…");
  await page.clock.runFor(15_000);
  await expect(r3.locator('[data-ia="erro"]')).toHaveText("Pergunta livre indisponível no momento — veja os temas acima");
});

test("prévia: só o /ask configurado entra na CSP", async ({ page }) => {
  const r = await page.request.get("/chat");
  expect(r.headers()["content-security-policy"]).toContain("connect-src 'self' http://127.0.0.1:8099;");
});
