import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { carregarChat } from "./chat-carga";
import "./estilo.css";
import type { DadosPagina } from "./tipos";

const el = document.getElementById("dados");
const raiz = document.getElementById("app");
if (el && raiz) {
  const dados = JSON.parse(el.textContent ?? "{}") as DadosPagina;
  // em /chat, o componente do chat (arquivo à parte) precisa estar baixado para a hidratação casar com o HTML
  const pronto = dados.rota.tipo === "chat" || dados.rota.tipo === "conversa" ? carregarChat() : Promise.resolve();
  void pronto.then(() => hydrateRoot(raiz, <App inicial={dados} />));
}
