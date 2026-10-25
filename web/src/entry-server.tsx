import { renderToString } from "react-dom/server";
import { App, tituloDaRota, tituloDocumento } from "./App";
import { Chat } from "./Chat";
import { registrarChat } from "./chat-carga";
import type { DadosPagina } from "./tipos";

registrarChat(Chat);

export function renderizar(dados: DadosPagina): { html: string; titulo: string; tituloDoc: string } {
  return {
    html: renderToString(<App inicial={dados} />),
    titulo: tituloDaRota(dados.rota, dados),
    tituloDoc: tituloDocumento(dados.rota, dados),
  };
}
