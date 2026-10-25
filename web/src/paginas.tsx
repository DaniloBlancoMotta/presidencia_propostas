import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { ItemCitado, ItemDoisLados, NomeCand, ordenarOmissoes } from "./Citado";
import { Icone, IconeTrocar, SetaVoltar } from "./icones";
import { dataBR, filtroDaUrl, urlComFiltro, type Filtro } from "./rotas";
import {
  AVISO_IA,
  CANDIDATOS_BASE,
  LEAD_DIFERENCAS,
  LEAD_INICIO,
  LEAD_SEMELHANCAS,
  NAO_ENCONTRADO,
  TRANSVERSAL_VAZIA,
  type CandidatoId,
  type Comparacao,
  type Manifesto,
  type Omissao,
  type TemaPublico,
} from "./tipos";

export interface Base {
  manifesto: Manifesto;
  ordem: CandidatoId[];
  /** "Trocar ordem dos candidatos" (decisão 12): o botão fica só nas telas que mostram os dois candidatos. */
  trocar: () => void;
  /** Falso no HTML pré-renderizado e na hidratação; verdadeiro depois que o App leu a ordem sorteada. */
  pronto: boolean;
}

const NBSP = "\xa0";

/** Abertura de cada rota (crit. 16 e §6): só o link de volta antes do título; logo abaixo do título, o aviso de
 *  IA de ponta a ponta; o que a rota traz no topo (abertura, descrição, data de geração) vem depois do aviso. */
export function Cabeca(props: { voltar?: ReactNode; glifo?: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <>
      <header className={props.voltar ? "cabeca com-voltar" : "cabeca"}>
        <div className="envelope">
          <div className="topo">
            {props.voltar}
            <h1 id="titulo" tabIndex={-1} className={props.glifo ? "com-glifo" : undefined}>
              {props.glifo}
              {props.titulo}
            </h1>
          </div>
        </div>
      </header>
      <div className="faixa-aviso">
        <div className="envelope aviso">
          <span className="rotulo">Aviso</span>
          <p className="aviso-ia" role="note">
            {AVISO_IA}
          </p>
        </div>
      </div>
      {props.children && <div className="envelope sob-aviso">{props.children}</div>}
    </>
  );
}

/** "←" antes do título: leva a `/` (ou, na conversa, a `/chat`); o nome acessível não tem seta (crit. 69). */
export function Voltar({ para = "/", rotulo = "Todos os temas" }: { para?: string; rotulo?: string }) {
  return (
    <a className="voltar" href={para}>
      <SetaVoltar />
      <span className="sr">{rotulo}</span>
    </a>
  );
}

export function Trocar({ trocar }: { trocar: () => void }) {
  return (
    <button type="button" className="trocar" onClick={trocar}>
      <IconeTrocar />
      Trocar ordem dos candidatos
    </button>
  );
}

/** Data de geração visível (a mesma do `dateModified` dos dados estruturados) e data de coleta. */
function Atualizacao({ comps, manifesto, varias }: { comps: Comparacao[]; manifesto: Manifesto; varias?: boolean }) {
  const gerado = comps.map((c) => c.gerado_em).sort().at(-1);
  if (!gerado) return null;
  const coleta = manifesto.fontes.map((f) => f.coletado_em).sort()[0];
  return (
    <p className="atualizacao">
      <time dateTime={gerado}>{varias ? `Comparações geradas até ${dataBR(gerado)}` : `Comparação gerada em ${dataBR(gerado)}`}</time>
      {" a partir dos planos coletados do TSE em "}
      <time dateTime={coleta}>{dataBR(coleta)}</time>.
    </p>
  );
}

// ------------------------------------------------------------------ início

export function Inicio({ manifesto }: Base) {
  const [a, b] = CANDIDATOS_BASE;
  const par = (x: CandidatoId, y: CandidatoId) => (
    <>
      <NomeCand manifesto={manifesto} c={x} /> e <NomeCand manifesto={manifesto} c={y} />
    </>
  );
  return (
    <>
      <Cabeca titulo="Compare os planos de governo">
        {/* Os dois pares estão no HTML; o CSS mostra o da ordem sorteada desde a 1ª pintura (decisão 12). */}
        <p className="abertura">
          {"Planos de governo de "}
          <span className="na-ordem-ab">{par(a, b)}</span>
          <span className="na-ordem-ba">{par(b, a)}</span>
          {`, candidatos ao 2º${NBSP}turno de 2026, registrados no TSE. ${LEAD_INICIO}`}
        </p>
      </Cabeca>
      <div className="envelope">
        <nav aria-label="Temas" className="grade">
          <ul className="destaques" role="list">
            <li className="destaque sem">
              <a className="cartao" href="/semelhancas">
                <Icone nome="semelhancas" classe="glifo" />
                <span className="nome">Semelhanças</span>
              </a>
            </li>
            <li className="destaque dif">
              <a className="cartao" href="/diferencas">
                <Icone nome="diferencas" classe="glifo" />
                <span className="nome">Diferenças</span>
              </a>
            </li>
          </ul>
          <h2 className="rotulo">Temas</h2>
          <ul className="indice" role="list">
            {manifesto.temas.map((t) => (
              <li key={t.id}>
                <a className="cartao" href={`/tema/${t.id}`}>
                  <Icone nome={t.icone} />
                  <span className="nome">{t.rotulo}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="chamada-chat">
          <a className="cartao-chat" href="/chat">
            <Icone nome="chat" />
            <span>
              <span className="titulo-chat">Chat por tema</span>
              <span className="sub">Digite @, escolha um tema e veja o resumo executivo de cada candidato.</span>
            </span>
          </a>
        </p>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ tema

/** Largura de duas colunas (decisão 13). Só há abas abaixo dela, então só ali os painéis são `tabpanel`
 *  (crit. 39). No HTML pré-renderizado e na hidratação vale o celular. */
function useLargo() {
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const ver = () => setLargo(m.matches);
    ver();
    m.addEventListener("change", ver);
    return () => m.removeEventListener("change", ver);
  }, []);
  return largo;
}

function Abas(props: {
  ordem: CandidatoId[];
  ativo: CandidatoId;
  escolher: (c: CandidatoId) => void;
  manifesto: Manifesto;
  pre: boolean;
}) {
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = props.ordem.indexOf(props.ativo);
    const n = props.ordem.length;
    const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
    props.escolher(props.ordem[j]);
    document.getElementById(`aba-${props.ordem[j]}`)?.focus();
  }
  // data-pre: antes da hidratação, o CSS escolhe a aba pela ordem sorteada, e não pelo aria-selected (crit. 1)
  return (
    <div className="abas" role="tablist" aria-label="Candidatos" data-pre={props.pre ? "" : undefined} onKeyDown={teclado}>
      {props.ordem.map((c) => (
        <button
          key={c}
          id={`aba-${c}`}
          type="button"
          role="tab"
          className="aba"
          data-cand={c}
          aria-selected={c === props.ativo}
          aria-controls={`painel-${c}`}
          tabIndex={c === props.ativo ? 0 : -1}
          onClick={() => props.escolher(c)}
        >
          <NomeCand manifesto={props.manifesto} c={c} />
        </button>
      ))}
    </div>
  );
}

export function Tema(props: Base & { tema: TemaPublico; comp: Comparacao }) {
  const { tema, comp, ordem, manifesto, pronto } = props;
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [escolhido, setEscolhido] = useState<CandidatoId | null>(null);
  const largo = useLargo();
  // ?filtro só existe no navegador: o HTML pré-renderizado sai com "Mostrar tudo" (porta 1).
  useEffect(() => setFiltro(filtroDaUrl(window.location.search)), []);
  function filtrar(f: Filtro) {
    setFiltro(f);
    history.replaceState(history.state, "", urlComFiltro(window.location.pathname, f));
  }
  const ativo = escolhido ?? ordem[0];
  const mostra = (s: Filtro) => filtro === "tudo" || filtro === s;
  const filtros: [Filtro, string][] = [
    ["semelhancas", "Só semelhanças"],
    ["diferencas", "Só diferenças"],
    ["tudo", "Mostrar tudo"],
  ];
  return (
    <>
      <Cabeca voltar={<Voltar />} titulo={tema.rotulo}>
        <p className="descricao">{tema.descricao}</p>
        <Atualizacao comps={[comp]} manifesto={manifesto} />
      </Cabeca>
      <div className="envelope">
        <div className="controles">
          <Trocar trocar={props.trocar} />
          <div className="filtros" role="group" aria-label="Filtrar itens do tema">
            {filtros.map(([f, rotulo]) => (
              <button key={f} type="button" className="filtro" aria-pressed={filtro === f} onClick={() => filtrar(f)}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {filtro === "tudo" && (
          <section className="bloco propostas" aria-labelledby="h-resumo" data-lista="resumo">
            <h2 id="h-resumo">O que cada plano propõe</h2>
            <Abas ordem={ordem} ativo={ativo} escolher={setEscolhido} manifesto={manifesto} pre={!pronto} />
            <div className="colunas" data-pre={pronto ? undefined : ""}>
              {ordem.map((c) => {
                const area = comp.candidatos[c];
                const n = area.resumo.length;
                return (
                  <section
                    key={c}
                    id={`painel-${c}`}
                    role={largo ? undefined : "tabpanel"}
                    aria-labelledby={largo ? `nome-${c}` : `aba-${c}`}
                    className={`painel${c === ativo ? " ativo" : ""}`}
                    data-cand={c}
                  >
                    <div className="cabeca-col">
                      <h3 id={`nome-${c}`} className="nome-candidato">
                        <NomeCand manifesto={manifesto} c={c} />
                      </h3>
                      {!area.nao_encontrado && <p className="conta">{n === 1 ? "1 proposta" : `${n} propostas`}</p>}
                    </div>
                    {area.nao_encontrado ? (
                      <p className="nao-encontrado">{NAO_ENCONTRADO}</p>
                    ) : (
                      <ol className="itens" role="list">
                        {area.resumo.map((b, i) => (
                          <ItemCitado key={i} n={i + 1} texto={b.texto} citacoes={b.citacoes} />
                        ))}
                      </ol>
                    )}
                  </section>
                );
              })}
            </div>
          </section>
        )}

        {mostra("semelhancas") && (
          <section className="bloco" aria-labelledby="h-sem" data-lista="semelhancas">
            <h2 id="h-sem">
              <Icone nome="semelhancas" classe="glifo" />
              Semelhanças <span className="n">({comp.semelhancas.length})</span>
            </h2>
            <ListaDoisLados itens={comp.semelhancas} ordem={ordem} manifesto={manifesto} nivel={3} vazio="Nenhuma semelhança encontrada neste tema." />
          </section>
        )}
        {mostra("diferencas") && (
          <>
            <section className="bloco" aria-labelledby="h-dif" data-lista="diferencas">
              <h2 id="h-dif">
                <Icone nome="diferencas" classe="glifo" />
                Diferenças <span className="n">({comp.diferencas.length})</span>
              </h2>
              <ListaDoisLados itens={comp.diferencas} ordem={ordem} manifesto={manifesto} nivel={3} vazio="Nenhuma diferença encontrada neste tema." />
            </section>
            <section className="bloco" aria-labelledby="h-omi" data-lista="omissoes">
              <h2 id="h-omi">
                Omissões <span className="n">({comp.omissoes.length})</span>
              </h2>
              <ListaOmissoes omissoes={ordenarOmissoes(comp.omissoes, ordem)} manifesto={manifesto} vazio="Nenhuma omissão encontrada neste tema." />
            </section>
          </>
        )}
      </div>
    </>
  );
}

function ListaDoisLados(props: {
  itens: Comparacao["semelhancas"];
  ordem: CandidatoId[];
  manifesto: Manifesto;
  nivel: 3 | 4;
  vazio: string;
}) {
  if (!props.itens.length) return props.vazio ? <p className="vazio">{props.vazio}</p> : null;
  return (
    <ol className="itens" role="list">
      {props.itens.map((it, i) => (
        <ItemDoisLados key={i} n={i + 1} texto={it.texto} citacoes={it.citacoes} ordem={props.ordem} manifesto={props.manifesto} nivel={props.nivel} />
      ))}
    </ol>
  );
}

function ListaOmissoes({ omissoes, manifesto, vazio }: { omissoes: Omissao[]; manifesto: Manifesto; vazio?: string }) {
  if (!omissoes.length) return vazio ? <p className="vazio">{vazio}</p> : null;
  return (
    <ol className="itens" role="list">
      {omissoes.map((o, i) => (
        <ItemCitado
          key={i}
          n={i + 1}
          cand={o.tratado_por}
          rotulo={
            <>
              Omissão · só no plano de <NomeCand manifesto={manifesto} c={o.tratado_por} />
            </>
          }
          texto={o.texto}
          citacoes={o.citacoes}
        />
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ visões transversais

export function Transversal(props: Base & { tipo: "semelhancas" | "diferencas"; comparacoes: Record<string, Comparacao> }) {
  const { manifesto, ordem, tipo, comparacoes } = props;
  const grupos = manifesto.temas
    .map((t) => ({ t, c: comparacoes[t.id] }))
    .filter(({ c }) => c && (c[tipo].length > 0 || (tipo === "diferencas" && c.omissoes.length > 0)));
  const itens = (c: Comparacao) => c[tipo].length + (tipo === "diferencas" ? c.omissoes.length : 0);
  return (
    <>
      <Cabeca
        voltar={<Voltar />}
        glifo={tipo === "semelhancas" ? <Icone nome="semelhancas" classe="glifo glifo-titulo" /> : undefined}
        titulo={tipo === "semelhancas" ? "Semelhanças" : "Diferenças"}
      >
        <Atualizacao comps={Object.values(comparacoes)} manifesto={manifesto} varias />
      </Cabeca>
      <div className="envelope">
        <div className="controles">
          <Trocar trocar={props.trocar} />
        </div>
        <p className="lead">{tipo === "semelhancas" ? LEAD_SEMELHANCAS : LEAD_DIFERENCAS}</p>
        {/* Índice dos temas (crit. 36), com as âncoras públicas #g-<theme_id> (porta 2) */}
        {grupos.length > 0 && (
          <nav className="indice-temas" aria-label="Temas nesta página">
            <ul role="list">
              {grupos.map(({ t, c }) => (
                <li key={t.id}>
                  <a href={`#g-${t.id}`}>
                    {t.rotulo} <span className="n">({itens(c)})</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {grupos.length === 0 ? (
          <p className="vazio">{TRANSVERSAL_VAZIA}</p>
        ) : (
          grupos.map(({ t, c }) => (
            <section
              key={t.id}
              className={tipo === "semelhancas" ? "bloco grupo-sem" : "bloco grupo-dif"}
              aria-labelledby={`g-${t.id}`}
              data-tema={t.id}
            >
              <h2 id={`g-${t.id}`}>
                <a href={`/tema/${t.id}`}>{t.rotulo}</a>
              </h2>
              {tipo === "semelhancas" ? (
                <ListaDoisLados itens={c.semelhancas} ordem={ordem} manifesto={manifesto} nivel={3} vazio="" />
              ) : (
                <>
                  {c.diferencas.length > 0 && (
                    <>
                      <h3 className="subtitulo">
                        <Icone nome="diferencas" classe="glifo" />
                        Diferenças <span className="n">({c.diferencas.length})</span>
                      </h3>
                      <ListaDoisLados itens={c.diferencas} ordem={ordem} manifesto={manifesto} nivel={4} vazio="" />
                    </>
                  )}
                  {c.omissoes.length > 0 && (
                    <>
                      <h3 className="subtitulo">
                        Omissões <span className="n">({c.omissoes.length})</span>
                      </h3>
                      <ListaOmissoes omissoes={ordenarOmissoes(c.omissoes, ordem)} manifesto={manifesto} />
                    </>
                  )}
                </>
              )}
            </section>
          ))
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ páginas de apoio

export function Sobre({ manifesto, ordem, trocar }: Base) {
  // cartões no DOM na ordem vigente (crit. 38): a ordem do teclado e do leitor de tela é a da tela
  const fontes = ordem.flatMap((c) => manifesto.fontes.filter((f) => f.candidato === c));
  return (
    <>
      <Cabeca voltar={<Voltar />} titulo="Sobre" />
      <div className="envelope">
        <div className="controles">
          <Trocar trocar={trocar} />
        </div>
        <p>
          Este site usa somente os dois planos de governo registrados no TSE pelos candidatos ao 2º{NBSP}turno da
          eleição presidencial de 2026. Cada arquivo é identificado pelo seu SHA-256: se o arquivo mudar, o código muda.
        </p>
        <ul className="fontes" role="list">
          {fontes.map((f) => (
            <li key={f.arquivo} className="fonte" data-cand={f.candidato}>
              <h2>
                <NomeCand manifesto={manifesto} c={f.candidato} />
              </h2>
              <dl>
                <dt>Arquivo</dt>
                <dd>
                  <a href={`/pdf/${encodeURIComponent(f.arquivo)}`}>{f.arquivo}</a>
                </dd>
                <dt>SHA-256</dt>
                <dd>
                  <code className="hash">{f.sha256}</code>
                </dd>
                <dt>Data de coleta</dt>
                <dd>{dataBR(f.coletado_em)}</dd>
                <dt>Página do TSE</dt>
                <dd>
                  <a href={f.url_tse} rel="noopener">
                    Planos de Governo — 2º{NBSP}turno (TSE)
                  </a>
                </dd>
                <dt>Conferência com o TSE</dt>
                <dd>{f.conferido_tse ? "SHA-256 conferido com o arquivo da página do TSE." : "SHA-256 ainda não conferido com o arquivo da página do TSE."}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <h2 className="titulo-secao">Responsável pelo site</h2>
        <p className="responsavel">{manifesto.responsavel ?? "Responsável ainda não informado."}</p>
      </div>
    </>
  );
}

export function Metodologia(_: Base) {
  return (
    <>
      <Cabeca voltar={<Voltar />} titulo="Metodologia" />
      <div className="envelope">
        <p>
          <strong>Regra: só documentos oficiais.</strong> Entram apenas os dois planos de governo registrados no
          TSE. Notícias, entrevistas, redes sociais e declarações de campanha não entram.
        </p>
        <ol className="etapas">
          <li>
            <strong>Ingestão.</strong> O texto de cada PDF é extraído página por página, guardando o número da
            página e a diretriz ou o eixo de onde vem.
          </li>
          <li>
            <strong>Classificação.</strong> Cada trecho é associado aos temas por palavras-chave.
          </li>
          <li>
            <strong>Comparação.</strong> Um modelo de inteligência artificial resume, por tema, o que cada plano
            propõe, onde os dois convergem, onde divergem e o que só um deles trata. Cada ponto precisa citar um
            trecho literal do plano.
          </li>
          <li>
            <strong>Verificação automática.</strong> Um programa confere se cada trecho citado aparece, palavra por
            palavra, na página indicada do PDF. Um segundo modelo de IA confere se o resumo diz só o que o trecho
            sustenta. O que falha é descartado.
          </li>
          <li>
            <strong>Revisão humana.</strong> Uma pessoa lê o relatório de cada tema antes da publicação. O site só
            publica o conteúdo exato que foi aprovado.
          </li>
        </ol>
        <p>
          Quando um plano não trata de um tema, o site mostra “{NAO_ENCONTRADO}”, em vez de completar com outra
          fonte. A ordem dos candidatos é sorteada a cada visita, e você pode trocá-la no botão “Trocar ordem dos
          candidatos”, nas telas que mostram os dois planos.
        </p>
        <p>
          Na comparação, o mesmo modelo também condensa o resumo de cada plano em até três pontos-chave, o resumo
          executivo. Cada ponto-chave só pode citar trechos que já passaram na verificação do resumo daquele plano, e
          passa pelas mesmas verificações e pela mesma revisão humana. O <a href="/chat">chat por tema</a> não gera texto
          na hora: ele junta, conforme o que você pede, esses mesmos pontos aprovados, com o trecho e a página do PDF.
        </p>
      </div>
    </>
  );
}

export function NaoEncontrada(_: Base) {
  return (
    <>
      <Cabeca voltar={<Voltar />} titulo="Página não encontrada" />
      <div className="envelope">
        <p>Este endereço não existe.</p>
        <p>
          <a className="botao" href="/">
            Ir para o início
          </a>
        </p>
      </div>
    </>
  );
}
