// Build de produção: guardas -> Vite (cliente) -> Vite SSR -> pré-render de cada rota -> _headers.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import { parse } from "yaml";
import type { DadosPagina, Fonte, Manifesto, Rota } from "../src/tipos";
import { DESCRICAO_PREVIA } from "../src/tipos";
import { dataBR } from "../src/rotas";
import { RAIZ, WEB, entradasPadrao } from "./caminhos";
import { ErroGuarda, verificarGuardas } from "./guardas";

const SAIDA = resolve(WEB, process.env.OUT_DIR ?? "dist");
const SSR = resolve(WEB, ".ssr");
export const SCRIPT_ORDEM = `document.documentElement.dataset.ordem=Math.random()<0.5?"ab":"ba"`;

function escrever(caminho: string, conteudo: string | Buffer) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, conteudo);
}

function escaparJson(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function escaparAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

async function principal() {
  let pub;
  try {
    pub = verificarGuardas(entradasPadrao());
  } catch (e) {
    console.error(e instanceof ErroGuarda ? e.message : e);
    process.exit(1);
  }
  const arqFontes = resolve(RAIZ, "dados", "fontes.json");
  if (!existsSync(arqFontes)) {
    console.error("Build bloqueado: dados/fontes.json ausente (rode o comando `fontes` do pipeline).");
    process.exit(1);
  }
  const fontes = JSON.parse(readFileSync(arqFontes, "utf8")) as Fonte[];
  const site = existsSync(resolve(RAIZ, "dados", "site.yaml"))
    ? (parse(readFileSync(resolve(RAIZ, "dados", "site.yaml"), "utf8")) as { responsavel: string | null })
    : { responsavel: null };

  const manifesto: Manifesto = {
    temas: pub.temas,
    fontes,
    candidatos: {
      "flavio-bolsonaro": { nome: "Flávio Bolsonaro", partido: "PL" },
      lula: { nome: "Lula", partido: "PT" },
    },
    responsavel: site.responsavel ?? null,
  };

  await build({ root: WEB, logLevel: "warn", build: { outDir: SAIDA, emptyOutDir: true } });
  await build({
    root: WEB,
    configFile: false,
    logLevel: "warn",
    plugins: [react()],
    build: { ssr: resolve(WEB, "src/entry-server.tsx"), outDir: SSR, emptyOutDir: true },
  });
  const { renderizar } = (await import(pathToFileURL(resolve(SSR, "entry-server.js")).href)) as {
    renderizar: (d: DadosPagina) => { html: string; titulo: string };
  };

  // CSS do site inline (evita uma requisição que bloqueia a 1ª pintura), liberado pelo hash na CSP.
  let modelo = readFileSync(resolve(SAIDA, "index.html"), "utf8");
  const link = /<link rel="stylesheet"[^>]*href="(\/assets\/site-[^"]+\.css)"[^>]*>/.exec(modelo);
  if (!link) throw new Error("CSS do site não encontrado no index.html gerado");
  const css = readFileSync(resolve(SAIDA, link[1].slice(1)), "utf8").trim();
  modelo = modelo.replace(link[0], () => `<style>${css}</style>`);
  const hashCss = createHash("sha256").update(css).digest("base64");
  const hashOrdem = createHash("sha256").update(SCRIPT_ORDEM).digest("base64");
  const paginas: { rota: Rota; arquivo: string; ids: string[] }[] = [
    { rota: { tipo: "inicio" }, arquivo: "index.html", ids: [] },
    ...pub.temas.map((t) => ({ rota: { tipo: "tema", id: t.id } as Rota, arquivo: `tema/${t.id}/index.html`, ids: [t.id] })),
    { rota: { tipo: "semelhancas" }, arquivo: "semelhancas/index.html", ids: pub.temas.map((t) => t.id) },
    { rota: { tipo: "diferencas" }, arquivo: "diferencas/index.html", ids: pub.temas.map((t) => t.id) },
    { rota: { tipo: "metodologia" }, arquivo: "metodologia/index.html", ids: [] },
    { rota: { tipo: "sobre" }, arquivo: "sobre/index.html", ids: [] },
    { rota: { tipo: "nao-encontrada" }, arquivo: "404.html", ids: [] },
  ];
  for (const p of paginas) {
    const dados: DadosPagina = {
      rota: p.rota,
      manifesto,
      comparacoes: Object.fromEntries(p.ids.map((id) => [id, pub.comparacoes[id]])),
    };
    const { html, titulo } = renderizar(dados);
    const pagina = modelo
      .replace("<!--ordem-->", `<script>${SCRIPT_ORDEM}</script>`)
      .replaceAll("<!--titulo-->", escaparAttr(titulo))
      .replaceAll("<!--descricao-->", escaparAttr(DESCRICAO_PREVIA))
      .replace("<!--app-->", html)
      .replace("<!--dados-->", `<script id="dados" type="application/json">${escaparJson(dados)}</script>`);
    escrever(resolve(SAIDA, p.arquivo), pagina);
  }
  const coleta = fontes.map((f) => f.coletado_em).sort()[0];
  const visualizador = resolve(SAIDA, "pdf", "visualizador.html");
  writeFileSync(
    visualizador,
    readFileSync(visualizador, "utf8").replace("<!--coleta-->", `Documentos coletados do TSE em ${dataBR(coleta)}`),
  );
  for (const [id, buf] of Object.entries(pub.bytes)) escrever(resolve(SAIDA, "comparacoes", `${id}.json`), buf);
  for (const f of fontes) {
    mkdirSync(resolve(SAIDA, "pdf"), { recursive: true });
    copyFileSync(resolve(RAIZ, "corpus", f.arquivo), resolve(SAIDA, "pdf", f.arquivo));
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${hashOrdem}'`,
    `style-src 'self' 'sha256-${hashCss}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  escrever(
    resolve(SAIDA, "_headers"),
    [
      "/*",
      `  Content-Security-Policy: ${csp}`,
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: no-referrer",
      "  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()",
      "/assets/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
    ].join("\n"),
  );
  rmSync(SSR, { recursive: true, force: true });
  console.log(`build ok em ${SAIDA}: ${pub.temas.length} temas publicados (${pub.temas.map((t) => t.id).join(", ")})`);
}

void principal();
