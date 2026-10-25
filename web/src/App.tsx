import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { carregarChat, chatCarregado } from "./chat-carga";
import { nomeCandidato } from "./Citado";
import { ancoraDaPagina, criarVez, estadosAoEmpilhar, rolagemDoEstado } from "./navegacao";
import { Inicio, Metodologia, NaoEncontrada, Sobre, Tema, Transversal } from "./paginas";
import { caminhoDaRota, dataBR, resolverRota } from "./rotas";
import { CANDIDATOS_BASE, NOME_SITE, type CandidatoId, type Comparacao, type DadosPagina, type Rota } from "./tipos";

export type Ordem = "ab" | "ba";

export function candidatosNaOrdem(o: Ordem): CandidatoId[] {
  return o === "ab" ? CANDIDATOS_BASE : [...CANDIDATOS_BASE].reverse();
}

export function tituloDaRota(r: Rota, d: DadosPagina): string {
  const site = NOME_SITE;
  switch (r.tipo) {
    case "inicio":
      return site;
    case "tema":
      return d.manifesto.temas.find((t) => t.id === r.id)?.rotulo ?? site;
    case "semelhancas":
      return "Semelhanças";
    case "diferencas":
      return "Diferenças";
    case "metodologia":
      return "Metodologia";
    case "sobre":
      return "Sobre";
    case "chat":
      return "Chat por tema";
    case "conversa":
      return "Conversa";
    default:
      return "Página não encontrada";
  }
}

/** <title> da página: o rótulo com o contexto da eleição, para quem chega por busca. O título da
 *  prévia do link (og:title) continua sendo `tituloDaRota` (decisão 15). */
export function tituloDocumento(r: Rota, d: DadosPagina): string {
  const base = tituloDaRota(r, d);
  switch (r.tipo) {
    case "tema":
      return `${base}: propostas dos planos de governo do 2º turno de 2026`;
    case "semelhancas":
      return "Semelhanças entre os planos de governo do 2º turno de 2026";
    case "diferencas":
      return "Diferenças entre os planos de governo do 2º turno de 2026";
    case "metodologia":
    case "sobre":
    case "chat":
      return `${base} · ${NOME_SITE}`;
    case "conversa":
      return `Conversa · Chat por tema · ${NOME_SITE}`;
    default:
      return base;
  }
}

function temasDaRota(rota: Rota, atual: DadosPagina): string[] {
  if (rota.tipo === "tema") return [rota.id];
  if (rota.tipo === "semelhancas" || rota.tipo === "diferencas") return atual.manifesto.temas.map((t) => t.id);
  return [];
}

/** Se a rota precisa baixar algo (o JSON de um tema ou o arquivo do chat) antes de aparecer. */
function faltaBaixar(rota: Rota, atual: DadosPagina): boolean {
  if ((rota.tipo === "chat" || rota.tipo === "conversa") && !chatCarregado()) return true;
  return temasDaRota(rota, atual).some((id) => !atual.comparacoes[id]);
}

async function carregarDados(rota: Rota, atual: DadosPagina): Promise<DadosPagina> {
  if (rota.tipo === "chat" || rota.tipo === "conversa") await carregarChat();
  const comparacoes: Record<string, Comparacao> = { ...atual.comparacoes };
  await Promise.all(
    temasDaRota(rota, atual)
      .filter((id) => !comparacoes[id])
      .map(async (id) => {
        const r = await fetch(`/comparacoes/${id}.json`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        comparacoes[id] = (await r.json()) as Comparacao;
      }),
  );
  return { rota, manifesto: atual.manifesto, comparacoes };
}

export function App({ inicial }: { inicial: DadosPagina }) {
  const [dados, setDados] = useState(inicial);
  const [ordem, setOrdem] = useState<Ordem>("ab");
  const [pronto, setPronto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const atual = useRef(dados);
  atual.current = dados;
  const [vez] = useState(criarVez); // só a navegação mais recente chega à tela (crit. 31)
  const rolar = useRef<number | null>(null);

  // A ordem foi sorteada pelo script inline do <head> antes da 1ª pintura (decisão 12). Até aqui o CSS
  // escolheu aba e painel por ela (crit. 1); a partir daqui, o estado do React.
  useEffect(() => {
    const o = document.documentElement.dataset.ordem;
    if (o === "ab" || o === "ba") setOrdem(o);
    setPronto(true);
    // a posição de cada rota fica em history.state e volta com o Voltar do navegador (crit. 29)
    history.scrollRestoration = "manual";
  }, []);

  const trocar = useCallback(() => {
    const n: Ordem = document.documentElement.dataset.ordem === "ba" ? "ab" : "ba";
    document.documentElement.dataset.ordem = n;
    setOrdem(n);
    setAnuncio(`Ordem trocada: ${nomeCandidato(atual.current.manifesto, candidatosNaOrdem(n)[0])} aparece primeiro.`);
  }, []);

  const ir = useCallback(async (destino: string, empilhar: boolean, y = 0) => {
    const url = new URL(destino, window.location.href);
    const d = atual.current;
    const rota = resolverRota(url.pathname, d.manifesto.temas.map((t) => t.id));
    if (rota.tipo === "nao-encontrada") {
      window.location.assign(destino); // o servidor responde 404
      return;
    }
    const n = vez.nova();
    if (faltaBaixar(rota, d)) {
      setCarregando(true);
      setAnuncio("Carregando…");
    }
    try {
      const novo = await carregarDados(rota, d);
      if (!vez.vale(n)) return; // outro destino foi tocado depois deste
      if (empilhar) {
        const { saida, nova } = estadosAoEmpilhar(history.state, window.scrollY);
        history.replaceState(saida, "");
        history.pushState(nova, "", caminhoDaRota(rota) + url.search + url.hash);
      }
      rolar.current = y;
      setDados(novo);
      document.title = tituloDocumento(rota, novo);
      requestAnimationFrame(() => document.getElementById("titulo")?.focus({ preventScroll: true }));
    } catch {
      if (vez.vale(n)) window.location.assign(destino);
    } finally {
      if (vez.vale(n)) {
        setCarregando(false);
        setAnuncio("");
      }
    }
  }, [vez]);

  // Depois de trocar de rota: a posição guardada (Voltar) ou o topo; uma âncora no endereço vale como destino.
  useEffect(() => {
    if (rolar.current === null) return;
    const y = rolar.current;
    rolar.current = null;
    const alvo = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    if (alvo && y === 0) alvo.scrollIntoView({ block: "start" });
    else window.scrollTo(0, y);
  }, [dados]);

  useEffect(() => {
    const voltar = (e: PopStateEvent) => void ir(window.location.pathname + window.location.search, false, rolagemDoEstado(e.state));
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
  }, [ir]);

  function aoClicar(e: MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a");
    if (!a || a.target || a.origin !== window.location.origin) return;
    if (a.pathname.startsWith("/pdf/") || a.pathname.startsWith("/comparacoes/")) return;
    e.preventDefault();
    // Âncora da mesma página ("Pular para o conteúdo", índice dos temas): foco no destino, sem entrada nova
    // no histórico e sem buscar dados (crit. 28).
    if (ancoraDaPagina(a, window.location)) {
      const alvo = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!alvo) return;
      history.replaceState(history.state, "", a.hash);
      if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
      alvo.scrollIntoView({ block: "start" });
      alvo.focus({ preventScroll: true });
      return;
    }
    void ir(a.href, true);
  }

  const lista = candidatosNaOrdem(ordem);
  const base = { manifesto: dados.manifesto, ordem: lista, trocar, pronto };
  const r = dados.rota;
  const chat = r.tipo === "chat" || r.tipo === "conversa";
  let conteudo;
  if (r.tipo === "inicio") conteudo = <Inicio {...base} />;
  else if (r.tipo === "tema") {
    const tema = dados.manifesto.temas.find((t) => t.id === r.id)!;
    conteudo = <Tema key={r.id} {...base} tema={tema} comp={dados.comparacoes[r.id]} />;
  } else if (r.tipo === "semelhancas" || r.tipo === "diferencas")
    conteudo = <Transversal key={r.tipo} {...base} tipo={r.tipo} comparacoes={dados.comparacoes} />;
  else if (r.tipo === "metodologia") conteudo = <Metodologia {...base} />;
  else if (r.tipo === "sobre") conteudo = <Sobre {...base} />;
  else if (chat) {
    const Chat = chatCarregado();
    const modo = r.tipo === "chat" ? "entrada" : "conversa";
    conteudo = Chat ? <Chat {...base} comparacoes={dados.comparacoes} modo={modo} navegar={(c) => void ir(c, true)} /> : null;
  }
  else conteudo = <NaoEncontrada {...base} />;

  const coleta = dados.manifesto.fontes.map((f) => f.coletado_em).sort()[0];
  return (
    <div className={r.tipo === "conversa" ? "pagina ampla" : "pagina"} onClick={aoClicar}>
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <main id="conteudo" tabIndex={-1} aria-busy={carregando || undefined}>
        {conteudo}
      </main>
      {/* "Carregando…" e "Ordem trocada" (crit. 30 e 35); o chat anuncia na região dele */}
      {!chat && (
        <p className="sr" role="status">
          {anuncio}
        </p>
      )}
      <footer className="rodape">
        <div className="envelope">
          <nav aria-label="Rodapé">
            {/* "Chat por tema · Metodologia · Sobre", como no desenho da §6 (crit. 17) */}
            <a href="/chat">Chat por tema</a>
            <span className="sep" aria-hidden="true"> · </span>
            <a href="/metodologia">Metodologia</a>
            <span className="sep" aria-hidden="true"> · </span>
            <a href="/sobre">Sobre</a>
          </nav>
          <p className="coleta">Documentos coletados do TSE em {dataBR(coleta)}</p>
        </div>
      </footer>
    </div>
  );
}
