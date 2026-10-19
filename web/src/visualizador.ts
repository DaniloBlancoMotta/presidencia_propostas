// "Ver no PDF" (decisão 11): PDF.js no próprio domínio, abrindo /pdf/<arquivo> na página pedida.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./visualizador.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Arquivo -> candidato: a barra leva no topo a faixa na cor do candidato daquele PDF (S7).
const CANDIDATO: Record<string, string> = { "plano-de-governo_flavio.pdf": "flavio-bolsonaro", "Programa-Governo-LULA-2026.pdf": "lula" };
const ARQUIVOS = new Set(Object.keys(CANDIDATO));
const q = new URLSearchParams(location.search);
const arquivo = q.get("arquivo") ?? "";
const pedida = Math.max(1, parseInt(q.get("pagina") ?? "1", 10) || 1);
if (ARQUIVOS.has(arquivo)) document.body.dataset.cand = CANDIDATO[arquivo];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tela = $<HTMLCanvasElement>("tela");
const titulo = $("titulo-pdf");
const indicador = $("indicador");
const erro = $("erro");
const anterior = $<HTMLButtonElement>("anterior");
const proxima = $<HTMLButtonElement>("proxima");

function falhar(msg: string) {
  erro.hidden = false;
  erro.textContent = msg;
  titulo.textContent = "PDF indisponível";
}

async function iniciar() {
  if (!ARQUIVOS.has(arquivo)) return falhar("Arquivo desconhecido.");
  const url = `/pdf/${encodeURIComponent(arquivo)}`;
  ($("baixar") as HTMLAnchorElement).href = url;
  const doc = await pdfjs.getDocument({ url, isEvalSupported: false, useSystemFonts: true }).promise;
  let atual = Math.min(pedida, doc.numPages);
  let tarefa: { cancel(): void } | null = null;

  async function desenhar(n: number) {
    tarefa?.cancel();
    const pagina = await doc.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const largura = Math.min(document.documentElement.clientWidth - 16, 900);
    const escala = largura / base.width;
    const vp = pagina.getViewport({ scale: escala * (window.devicePixelRatio || 1) });
    tela.width = vp.width;
    tela.height = vp.height;
    tela.style.width = `${Math.floor(vp.width / (window.devicePixelRatio || 1))}px`;
    const t = pagina.render({ canvasContext: tela.getContext("2d")!, viewport: vp });
    tarefa = t;
    try {
      await t.promise;
    } catch {
      return;
    }
    atual = n;
    document.body.dataset.pagina = String(n);
    titulo.textContent = `${arquivo} — página ${n} de ${doc.numPages}`;
    indicador.textContent = `${n} / ${doc.numPages}`;
    tela.setAttribute("aria-label", `Página ${n} de ${doc.numPages} de ${arquivo}`);
    anterior.disabled = n <= 1;
    proxima.disabled = n >= doc.numPages;
    const u = new URL(location.href);
    u.searchParams.set("pagina", String(n));
    history.replaceState(null, "", u);
  }
  anterior.addEventListener("click", () => atual > 1 && desenhar(atual - 1));
  proxima.addEventListener("click", () => atual < doc.numPages && desenhar(atual + 1));
  await desenhar(atual);
}

iniciar().catch(() => falhar("Não foi possível abrir o PDF. Use o botão para baixar o arquivo original."));
