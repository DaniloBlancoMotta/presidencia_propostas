import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./estilo.css";
import type { DadosPagina } from "./tipos";

const el = document.getElementById("dados");
const raiz = document.getElementById("app");
if (el && raiz) {
  const dados = JSON.parse(el.textContent ?? "{}") as DadosPagina;
  hydrateRoot(raiz, <App inicial={dados} />);
}
