// "Ver no PDF" (decisão 11): PDF.js no próprio domínio, abrindo /pdf/<arquivo> na página pedida.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./visualizador.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const q = new URLSearchParams(location.search);
const arquivo = q.get("arquivo") ?? "";
const pedida = Math.max(1, parseInt(q.get("pagina") ?? "1", 10) || 1);
// Arquivo -> candidato (o mesmo mapa de tipos.ts, repetido aqui para o visualizador não dividir um pedaço de JS
// com o site, o que acrescentaria um pedido ao carregamento das páginas).
const CANDIDATO: Record<string, string> = { "plano-de-governo_flavio.pdf": "flavio-bolsonaro", "Programa-Governo-LULA-2026.pdf": "lula" };
const candidato = Object.prototype.hasOwnProperty.call(CANDIDATO, arquivo) ? CANDIDATO[arquivo] : null;
// a barra leva no topo a faixa na cor do candidato daquele PDF (S7)
if (candidato) document.body.dataset.cand = candidato;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const folha = $("folha");
const tela = $<HTMLCanvasElement>("tela");
const camada = $("texto");
const titulo = $("titulo-pdf");
const indicador = $("indicador");
const erro = $("erro");
const anterior = $<HTMLButtonElement>("anterior");
const proxima = $<HTMLButtonElement>("proxima");
const baixar = $<HTMLAnchorElement>("baixar");
const paginacao = document.querySelector<HTMLElement>(".paginacao")!;

// Falha (arquivo desconhecido ou download que não terminou): sem página nem paginação, a mensagem num
// alerta e o caminho de volta (crit. 22).
function falhar(msg: string) {
  folha.hidden = true;
  paginacao.hidden = true;
  baixar.hidden = true;
  titulo.textContent = "PDF indisponível";
  const p = document.createElement("p");
  p.textContent = msg;
  const a = document.createElement("a");
  a.href = "/";
  a.textContent = "Voltar ao início";
  erro.replaceChildren(p, a);
  erro.hidden = false;
}

async function iniciar() {
  if (!candidato) return falhar("Arquivo desconhecido: este endereço não aponta para nenhum dos dois planos de governo.");
  const url = `/pdf/${encodeURIComponent(arquivo)}`;
  titulo.textContent = arquivo;
  baixar.href = url;
  // até o PDF chegar, os botões de página ficam desabilitados e "Baixar" fica oculto (crit. 21)
  const doc = await pdfjs.getDocument({ url, isEvalSupported: false, useSystemFonts: true }).promise;
  const total = doc.numPages;
  let alvo = Math.min(pedida, total); // a página pedida por último
  let pedido = 0; // cada pedido (página ou largura nova) invalida o desenho em curso
  let ocupado = false;
  let largura = 0;
  let tarefa: { cancel(): void } | null = null;
  let texto: pdfjs.TextLayer | null = null;

  /** Desenha a página do alvo; falso se um pedido mais novo chegou no meio (crit. 19). */
  async function desenhar(meu: number): Promise<boolean> {
    const n = alvo;
    const pagina = await doc.getPage(n);
    if (meu !== pedido) return false;
    const escala = folha.clientWidth / pagina.getViewport({ scale: 1 }).width;
    const vp = pagina.getViewport({ scale: escala * (window.devicePixelRatio || 1) });
    tela.width = Math.floor(vp.width);
    tela.height = Math.floor(vp.height);
    const t = pagina.render({ canvasContext: tela.getContext("2d")!, viewport: vp });
    tarefa = t;
    try {
      await t.promise;
    } catch (e) {
      if (meu !== pedido) return false;
      throw e;
    }
    if (meu !== pedido) return false;
    folha.classList.add("desenhada");
    largura = folha.clientWidth;
    // camada de texto do pdf.js na escala CSS, sobre o desenho: o trecho pode ser selecionado e achado com a
    // busca do navegador (crit. 52)
    camada.replaceChildren();
    camada.style.setProperty("--scale-factor", String(escala));
    texto = new pdfjs.TextLayer({ textContentSource: pagina.streamTextContent(), container: camada, viewport: pagina.getViewport({ scale: escala }) });
    try {
      await texto.render();
    } catch (e) {
      if (meu !== pedido) return false;
      throw e;
    }
    if (meu !== pedido) return false;
    document.body.dataset.pagina = String(n);
    const onde = document.createElement("span");
    onde.className = "sr";
    onde.textContent = `, página ${n} de ${total}`;
    titulo.replaceChildren(arquivo, onde);
    indicador.textContent = `Página ${n} de ${total}`;
    document.title = `${arquivo}, página ${n} — Ver no PDF`;
    tela.setAttribute("aria-label", `Página ${n} de ${total} de ${arquivo}`);
    const u = new URL(location.href);
    u.searchParams.set("pagina", String(n));
    history.replaceState(null, "", u);
    return true;
  }

  // Um desenho por vez: um pedido no meio cancela o desenho em curso, e o laço desenha o mais recente.
  async function pedir() {
    pedido++;
    tarefa?.cancel();
    texto?.cancel();
    if (ocupado) return;
    ocupado = true;
    try {
      while (!(await desenhar(pedido))) {
        // um pedido mais novo chegou: desenha de novo
      }
    } finally {
      ocupado = false;
    }
  }

  function botoes() {
    const foco = document.activeElement;
    anterior.disabled = alvo <= 1;
    proxima.disabled = alvo >= total;
    // o botão focado ficou desabilitado: o foco passa para o outro, e não para o <body> (crit. 20)
    if (foco === anterior && anterior.disabled) proxima.focus();
    if (foco === proxima && proxima.disabled) anterior.focus();
  }

  function irPara(n: number) {
    alvo = Math.max(1, Math.min(total, n));
    botoes();
    void pedir().catch(() => falhar("Não foi possível desenhar a página do PDF."));
  }

  anterior.addEventListener("click", () => irPara(alvo - 1));
  proxima.addEventListener("click", () => irPara(alvo + 1));
  let espera: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(espera);
    espera = window.setTimeout(() => {
      if (folha.clientWidth !== largura) void pedir().catch(() => falhar("Não foi possível desenhar a página do PDF."));
    }, 120);
  });
  baixar.hidden = false;
  botoes();
  await pedir();
}

iniciar().catch(() => falhar("Não foi possível abrir o PDF. Tente de novo mais tarde."));
