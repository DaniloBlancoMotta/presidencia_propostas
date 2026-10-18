// AC 33: JS inicial (scripts e modulepreload da página inicial e de um tema) <= 200 KB em gzip.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const LIMITE = 200 * 1024;
const raiz = resolve(process.argv[2] ?? "dist");
const tema = "saude"; // plano-final §6, CI passo 4
let falhou = false;
for (const pagina of ["index.html", `tema/${tema}/index.html`]) {
  const html = readFileSync(join(raiz, pagina), "utf8");
  const srcs = [...html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*rel="modulepreload"[^>]*\bhref)="([^"]+\.js)"/g)].map((m) => m[1]);
  let total = 0;
  for (const s of srcs) {
    const arq = join(raiz, s);
    if (!existsSync(arq)) throw new Error(`script ausente: ${s}`);
    total += gzipSync(readFileSync(arq)).length;
  }
  const ok = total <= LIMITE && srcs.length > 0;
  falhou ||= !ok;
  console.log(`${ok ? "ok" : "FALHA"}: ${pagina}: ${(total / 1024).toFixed(1)} KB gzip em ${srcs.length} arquivo(s) (limite 200 KB)`);
}
process.exit(falhou ? 1 : 0);
