// Servidor estático de teste que imita o Cloudflare Pages: índice de diretório, 404.html com
// status 404, e os cabeçalhos de _headers. Uso: node scripts/servir.mjs <pasta> <porta>
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const raiz = resolve(process.argv[2] ?? "dist");
const porta = Number(process.argv[3] ?? 4173);
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".pdf": "application/pdf",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".map": "application/json",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
};

function regras() {
  const arq = join(raiz, "_headers");
  if (!existsSync(arq)) return [];
  const saida = [];
  let atual = null;
  for (const linha of readFileSync(arq, "utf8").split("\n")) {
    if (!linha.trim()) continue;
    if (!linha.startsWith(" ")) {
      atual = { padrao: linha.trim(), cabecalhos: [] };
      saida.push(atual);
    } else if (atual) {
      const i = linha.indexOf(":");
      atual.cabecalhos.push([linha.slice(0, i).trim(), linha.slice(i + 1).trim()]);
    }
  }
  return saida;
}

function casa(padrao, caminho) {
  const re = new RegExp("^" + padrao.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return re.test(caminho);
}

function achar(caminho) {
  const alvo = normalize(join(raiz, decodeURIComponent(caminho)));
  if (!alvo.startsWith(raiz)) return null;
  for (const c of [alvo, join(alvo, "index.html"), alvo + ".html"]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let arq = achar(url.pathname);
  let status = 200;
  if (!arq) {
    arq = join(raiz, "404.html");
    status = 404;
  }
  for (const r of regras()) if (casa(r.padrao, url.pathname)) for (const [k, v] of r.cabecalhos) res.setHeader(k, v);
  res.setHeader("Content-Type", TIPOS[extname(arq)] ?? "application/octet-stream");
  res.writeHead(status);
  res.end(req.method === "HEAD" ? undefined : readFileSync(arq));
}).listen(porta, () => console.log(`servindo ${raiz} em http://localhost:${porta}`));
