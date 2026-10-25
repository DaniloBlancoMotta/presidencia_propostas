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
import { caminhoDaRota, dataBR } from "../src/rotas";
import { RAIZ, WEB, entradasPadrao } from "./caminhos";
import { ErroGuarda, verificarGuardas } from "./guardas";
import { absoluta, geradoEm, jsonLd, llms, robots, sitemap } from "./seo";

const SAIDA = resolve(WEB, process.env.OUT_DIR ?? "dist");
const SSR = resolve(WEB, ".ssr");
export const SCRIPT_ORDEM = `document.documentElement.dataset.ordem=Math.random()<0.5?"ab":"ba"`;
const FONTES = [
  ["newsreader", "newsreader-latin-wght-normal.woff2"],
  ["newsreader", "newsreader-latin-wght-italic.woff2"],
  ["atkinson-hyperlegible-next", "atkinson-hyperlegible-next-latin-wght-normal.woff2"],
];

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
  // SITE_YAML: outro site.yaml, para os testes de build no nível do comando (como COMPARACOES e APROVADOS)
  const arqSite = process.env.SITE_YAML ? resolve(process.env.SITE_YAML) : resolve(RAIZ, "dados", "site.yaml");
  const site = existsSync(arqSite)
    ? (parse(readFileSync(arqSite, "utf8")) as { responsavel: string | null; url?: string | null })
    : { responsavel: null, url: null };
  // Domínio final (plano-final §9, item 3): sem ele, nada de canonical nem sitemap (exigem endereço absoluto).
  const base = site.url ? new URL(site.url).origin + "/" : null;
  if (base && !base.startsWith("https://")) {
    console.error(`Build bloqueado: dados/site.yaml url precisa de https (${site.url}).`);
    process.exit(1);
  }

  // Pergunta livre /ask (plano-final §11) só na prévia: ASK_URL nunca entra no build de produção (dist).
  const askUrl = process.env.ASK_URL?.trim() || null;
  let askOrigem: string | null = null;
  if (askUrl) {
    if (!process.env.OUT_DIR || process.env.OUT_DIR === "dist") {
      console.error("Build bloqueado: ASK_URL só vale com OUT_DIR de prévia (o build de produção não fala com o /ask).");
      process.exit(1);
    }
    const u = new URL(askUrl);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      console.error(`Build bloqueado: ASK_URL precisa de https fora da máquina local (${askUrl}).`);
      process.exit(1);
    }
    askOrigem = u.origin;
  }

  const manifesto: Manifesto = {
    temas: pub.temas,
    fontes,
    candidatos: {
      "flavio-bolsonaro": { nome: "Flávio Bolsonaro", partido: "PL" },
      lula: { nome: "Lula", partido: "PT" },
    },
    responsavel: site.responsavel ?? null,
    ask: askUrl,
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
    renderizar: (d: DadosPagina) => { html: string; titulo: string; tituloDoc: string };
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
    { rota: { tipo: "chat" }, arquivo: "chat/index.html", ids: [] },
    { rota: { tipo: "conversa" }, arquivo: "chat/conversa/index.html", ids: [] },
    { rota: { tipo: "nao-encontrada" }, arquivo: "404.html", ids: [] },
  ];
  for (const p of paginas) {
    const dados: DadosPagina = {
      rota: p.rota,
      manifesto,
      comparacoes: Object.fromEntries(p.ids.map((id) => [id, pub.comparacoes[id]])),
    };
    const { html, titulo, tituloDoc } = renderizar(dados);
    const canonico = p.rota.tipo === "nao-encontrada" ? null : absoluta(base, caminhoDaRota(p.rota));
    const ld = jsonLd(dados, tituloDoc, base);
    // Funções de substituição: o 2º argumento de .replace/.replaceAll é interpretado como padrão
    // especial ($&, $', $`, $$) quando é uma string. titulo e html vêm do conteúdo aprovado dos
    // planos (pode conter "R$"), e um texto com "$'" ou "$$" corromperia a página sem aviso.
    const pagina = modelo
      .replace("<!--ordem-->", `<script>${SCRIPT_ORDEM}</script>`)
      .replace("<!--titulo-doc-->", () => escaparAttr(tituloDoc))
      .replace("<!--canonical-->", () =>
        canonico ? `<link rel="canonical" href="${escaparAttr(canonico)}" /><meta property="og:url" content="${escaparAttr(canonico)}" />` : "",
      )
      .replace("<!--jsonld-->", () => (ld ? `<script type="application/ld+json">${escaparJson(ld)}</script>` : ""))
      .replaceAll("<!--titulo-->", () => escaparAttr(titulo))
      .replaceAll("<!--descricao-->", () => escaparAttr(DESCRICAO_PREVIA))
      .replace("<!--app-->", () => html)
      .replace("<!--dados-->", () => `<script id="dados" type="application/json">${escaparJson(dados)}</script>`);
    escrever(resolve(SAIDA, p.arquivo), pagina);
  }
  const coleta = fontes.map((f) => f.coletado_em).sort()[0];
  const visualizador = resolve(SAIDA, "pdf", "visualizador.html");
  writeFileSync(
    visualizador,
    readFileSync(visualizador, "utf8").replace("<!--coleta-->", `Documentos coletados do TSE em ${dataBR(coleta)}`),
  );
  for (const [id, buf] of Object.entries(pub.bytes)) escrever(resolve(SAIDA, "comparacoes", `${id}.json`), buf);
  // Buscadores e motores de resposta com IA (GEO): robots.txt, llms.txt e, com domínio, sitemap.xml.
  escrever(resolve(SAIDA, "robots.txt"), robots(base));
  escrever(resolve(SAIDA, "llms.txt"), llms(manifesto, base, pub.comparacoes));
  if (base) {
    const todas = geradoEm(Object.values(pub.comparacoes));
    escrever(
      resolve(SAIDA, "sitemap.xml"),
      sitemap(base, [
        { caminho: "/", modificado: todas },
        ...pub.temas.map((t) => ({ caminho: `/tema/${t.id}`, modificado: pub.comparacoes[t.id].gerado_em })),
        { caminho: "/semelhancas", modificado: todas },
        { caminho: "/diferencas", modificado: todas },
        { caminho: "/metodologia" },
        { caminho: "/sobre" },
        { caminho: "/chat" },
      ]),
    );
  }
  // Fontes próprias (porta 4): só o subconjunto latino em woff2, servido de /fontes/ do próprio domínio.
  for (const [pacote, arquivo] of FONTES) {
    escrever(resolve(SAIDA, "fontes", arquivo), readFileSync(resolve(WEB, "node_modules", "@fontsource-variable", pacote, "files", arquivo)));
  }
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
    askOrigem ? `connect-src 'self' ${askOrigem}` : "connect-src 'self'",
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
      "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
      "/assets/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
    ].join("\n"),
  );
  rmSync(SSR, { recursive: true, force: true });
  console.log(`build ok em ${SAIDA}: ${pub.temas.length} temas publicados (${pub.temas.map((t) => t.id).join(", ")})`);
  if (askUrl) console.log(`PRÉVIA: o chat pergunta ao /ask em ${askUrl} (nunca publicar esta pasta)`);
}

void principal();
