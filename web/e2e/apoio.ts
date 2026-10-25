import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { Comparacao, Fonte } from "../src/tipos";

const RAIZ = resolve(import.meta.dirname, "..", "..");
const DIST = resolve(RAIZ, "web", "dist-teste");

export const temas = (parse(readFileSync(resolve(RAIZ, "dados", "themes.yaml"), "utf8")) as { temas: { id: string; rotulo: string }[] }).temas;
export const fontes = JSON.parse(readFileSync(resolve(RAIZ, "dados", "fontes.json"), "utf8")) as Fonte[];
export const publicados = readdirSync(resolve(DIST, "comparacoes")).map((f) => f.replace(/\.json$/, ""));
export const comparacao = (id: string) => JSON.parse(readFileSync(resolve(DIST, "comparacoes", `${id}.json`), "utf8")) as Comparacao;

export const ROTAS = [
  "/",
  ...publicados.map((id) => `/tema/${id}`),
  "/semelhancas",
  "/diferencas",
  "/metodologia",
  "/sobre",
  "/chat",
  "/chat/conversa",
  "/rota-que-nao-existe",
  "/pdf/visualizador.html?arquivo=plano-de-governo_flavio.pdf&pagina=1",
];

export const AVISO =
  "Resumos gerados por IA a partir dos planos de governo registrados no TSE. Podem conter erros — o PDF original é a fonte definitiva.";

export function dataColeta() {
  const [a, m, d] = fontes.map((f) => f.coletado_em).sort()[0].split("-");
  return `${d}/${m}/${a}`;
}
