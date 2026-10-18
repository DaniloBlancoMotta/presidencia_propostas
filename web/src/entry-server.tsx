import { renderToString } from "react-dom/server";
import { App, tituloDaRota } from "./App";
import type { DadosPagina } from "./tipos";

export function renderizar(dados: DadosPagina): { html: string; titulo: string } {
  return { html: renderToString(<App inicial={dados} />), titulo: tituloDaRota(dados.rota, dados) };
}
