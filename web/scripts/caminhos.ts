import { resolve } from "node:path";
import type { Entradas } from "./guardas";

export const RAIZ = resolve(import.meta.dirname, "..", "..");
export const WEB = resolve(RAIZ, "web");

export function entradasPadrao(): Entradas {
  return {
    pastaComparacoes: resolve(RAIZ, "dados", "comparacoes"),
    aprovados: process.env.APROVADOS ? resolve(process.env.APROVADOS) : resolve(RAIZ, "revisao", "aprovados.yaml"),
    themes: resolve(RAIZ, "dados", "themes.yaml"),
    contrato: resolve(RAIZ, "contrato"),
  };
}
