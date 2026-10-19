import { useState, type KeyboardEvent } from "react";
import { ItemCitado, ItemDoisLados, nomeCandidato } from "./Citado";
import { Icone } from "./icones";
import { dataBR } from "./rotas";
import {
  LEAD_DIFERENCAS,
  LEAD_INICIO,
  LEAD_SEMELHANCAS,
  NAO_ENCONTRADO,
  TRANSVERSAL_VAZIA,
  type CandidatoId,
  type Comparacao,
  type Manifesto,
  type TemaPublico,
} from "./tipos";

interface Base {
  manifesto: Manifesto;
  ordem: CandidatoId[];
}

function Titulo({ children }: { children: string }) {
  return (
    <h1 id="titulo" tabIndex={-1}>
      {children}
    </h1>
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
  return (
    <>
      <Titulo>Compare os planos de governo</Titulo>
      <p className="lead">{LEAD_INICIO}</p>
      <p className="chamada-chat">
        <a className="cartao-chat" href="/chat">
          <Icone nome="chat" />
          <span>
            <span className="titulo-chat">Chat por tema</span>
            <span className="sub">Digite @, escolha um tema e veja o resumo executivo de cada candidato.</span>
          </span>
        </a>
      </p>
      <nav aria-label="Temas">
        <ul className="grade">
          <li className="destaque">
            <a className="cartao" href="/semelhancas">
              <Icone nome="semelhancas" />
              <span>Semelhanças</span>
            </a>
          </li>
          <li className="destaque">
            <a className="cartao" href="/diferencas">
              <Icone nome="diferencas" />
              <span>Diferenças</span>
            </a>
          </li>
          {manifesto.temas.map((t) => (
            <li key={t.id}>
              <a className="cartao" href={`/tema/${t.id}`}>
                <Icone nome={t.icone} />
                <span>{t.rotulo}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

// ------------------------------------------------------------------ tema

type Filtro = "tudo" | "semelhancas" | "diferencas";

function Abas(props: {
  ordem: CandidatoId[];
  ativo: CandidatoId;
  escolher: (c: CandidatoId) => void;
  manifesto: Manifesto;
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
  return (
    <div className="abas" role="tablist" aria-label="Candidatos" onKeyDown={teclado}>
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
          {nomeCandidato(props.manifesto, c)}
        </button>
      ))}
    </div>
  );
}

export function Tema(props: Base & { tema: TemaPublico; comp: Comparacao }) {
  const { tema, comp, ordem, manifesto } = props;
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [escolhido, setEscolhido] = useState<CandidatoId | null>(null);
  const ativo = escolhido ?? ordem[0];
  const mostra = (s: Filtro) => filtro === "tudo" || filtro === s;
  const filtros: [Filtro, string][] = [
    ["tudo", "Mostrar tudo"],
    ["semelhancas", "Só semelhanças"],
    ["diferencas", "Só diferenças"],
  ];
  return (
    <>
      <p className="voltar">
        <a href="/">← Todos os temas</a>
      </p>
      <Titulo>{tema.rotulo}</Titulo>
      <p className="lead">{tema.descricao}</p>
      <Atualizacao comps={[comp]} manifesto={manifesto} />
      <div className="filtros" role="group" aria-label="Filtrar itens do tema">
        {filtros.map(([f, rotulo]) => (
          <button key={f} type="button" className="botao filtro" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
            {rotulo}
          </button>
        ))}
      </div>

      {filtro === "tudo" && (
        <section className="bloco" aria-labelledby="h-resumo" data-lista="resumo">
          <h2 id="h-resumo">O que cada plano propõe</h2>
          <Abas ordem={ordem} ativo={ativo} escolher={setEscolhido} manifesto={manifesto} />
          <div className="colunas">
            {ordem.map((c) => {
              const area = comp.candidatos[c];
              return (
                <section
                  key={c}
                  id={`painel-${c}`}
                  role="tabpanel"
                  aria-labelledby={`aba-${c}`}
                  className={`painel${c === ativo ? " ativo" : ""}`}
                  data-cand={c}
                >
                  <h3 className="nome-candidato">{nomeCandidato(manifesto, c)}</h3>
                  {area.nao_encontrado ? (
                    <p className="nao-encontrado">{NAO_ENCONTRADO}</p>
                  ) : (
                    <ul className="itens">
                      {area.resumo.map((b, i) => (
                        <ItemCitado key={i} texto={b.texto} citacoes={b.citacoes} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}

      {mostra("semelhancas") && (
        <section className="bloco" aria-labelledby="h-sem" data-lista="semelhancas">
          <h2 id="h-sem">Semelhanças</h2>
          <ListaDoisLados itens={comp.semelhancas} ordem={ordem} manifesto={manifesto} vazio="Nenhuma semelhança encontrada neste tema." />
        </section>
      )}
      {mostra("diferencas") && (
        <>
          <section className="bloco" aria-labelledby="h-dif" data-lista="diferencas">
            <h2 id="h-dif">Diferenças</h2>
            <ListaDoisLados itens={comp.diferencas} ordem={ordem} manifesto={manifesto} vazio="Nenhuma diferença encontrada neste tema." />
          </section>
          <section className="bloco" aria-labelledby="h-omi" data-lista="omissoes">
            <h2 id="h-omi">Tratado só por um dos planos</h2>
            <ListaOmissoes comp={comp} manifesto={manifesto} vazio="Nenhuma omissão encontrada neste tema." />
          </section>
        </>
      )}
    </>
  );
}

function ListaDoisLados(props: {
  itens: Comparacao["semelhancas"];
  ordem: CandidatoId[];
  manifesto: Manifesto;
  vazio: string;
  rotulo?: string;
}) {
  if (!props.itens.length) return <p className="vazio">{props.vazio}</p>;
  return (
    <ul className="itens">
      {props.itens.map((it, i) => (
        <ItemDoisLados key={i} texto={it.texto} citacoes={it.citacoes} ordem={props.ordem} manifesto={props.manifesto} rotulo={props.rotulo} />
      ))}
    </ul>
  );
}

function ListaOmissoes({ comp, manifesto, vazio }: { comp: Comparacao; manifesto: Manifesto; vazio?: string }) {
  if (!comp.omissoes.length) return vazio ? <p className="vazio">{vazio}</p> : null;
  return (
    <ul className="itens">
      {comp.omissoes.map((o, i) => (
        <ItemCitado
          key={i}
          rotulo={`Omissão · só no plano de ${nomeCandidato(manifesto, o.tratado_por)}`}
          texto={o.texto}
          citacoes={o.citacoes}
        />
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ visões transversais

export function Transversal(props: Base & { tipo: "semelhancas" | "diferencas"; comparacoes: Record<string, Comparacao> }) {
  const { manifesto, ordem, tipo, comparacoes } = props;
  const grupos = manifesto.temas
    .map((t) => ({ t, c: comparacoes[t.id] }))
    .filter(({ c }) => c && (c[tipo].length > 0 || (tipo === "diferencas" && c.omissoes.length > 0)));
  return (
    <>
      <p className="voltar">
        <a href="/">← Todos os temas</a>
      </p>
      <Titulo>{tipo === "semelhancas" ? "Semelhanças" : "Diferenças"}</Titulo>
      <p className="lead">{tipo === "semelhancas" ? LEAD_SEMELHANCAS : LEAD_DIFERENCAS}</p>
      <Atualizacao comps={Object.values(comparacoes)} manifesto={manifesto} varias />
      {grupos.length === 0 ? (
        <p className="vazio">{TRANSVERSAL_VAZIA}</p>
      ) : (
        grupos.map(({ t, c }) => (
          <section key={t.id} className="bloco" aria-labelledby={`g-${t.id}`} data-tema={t.id}>
            <h2 id={`g-${t.id}`}>
              <a href={`/tema/${t.id}`}>{t.rotulo}</a>
            </h2>
            {c[tipo].length > 0 && (
              <ListaDoisLados itens={c[tipo]} ordem={ordem} manifesto={manifesto} vazio="" rotulo={tipo === "diferencas" ? "Diferença" : undefined} />
            )}
            {tipo === "diferencas" && <ListaOmissoes comp={c} manifesto={manifesto} />}
          </section>
        ))
      )}
    </>
  );
}

// ------------------------------------------------------------------ páginas de apoio

export function Sobre({ manifesto }: Base) {
  return (
    <>
      <Titulo>Sobre os dados</Titulo>
      <p>
        Este site usa somente os dois planos de governo registrados no TSE pelos candidatos ao 2º turno da
        eleição presidencial de 2026. Cada arquivo é identificado pelo seu SHA-256: se o arquivo mudar, o
        código muda.
      </p>
      <ul className="fontes">
        {manifesto.fontes.map((f) => (
          <li key={f.arquivo} className="fonte" data-cand={f.candidato}>
            <h2>{nomeCandidato(manifesto, f.candidato)}</h2>
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
                <a href={f.url_tse} rel="noopener">Planos de Governo — 2º turno (TSE)</a>
              </dd>
              <dt>Conferência com o TSE</dt>
              <dd>{f.conferido_tse ? "SHA-256 conferido com o arquivo da página do TSE." : "SHA-256 ainda não conferido com o arquivo da página do TSE."}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <h2>Responsável pelo site</h2>
      <p className="responsavel">{manifesto.responsavel ?? "Responsável ainda não informado."}</p>
    </>
  );
}

export function Metodologia(_: Base) {
  return (
    <>
      <Titulo>Como funciona</Titulo>
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
        fonte. A ordem dos candidatos é sorteada a cada visita, e você pode trocá-la no botão do topo.
      </p>
      <p>
        Na comparação, o mesmo modelo também condensa o resumo de cada plano em até três pontos-chave, o resumo
        executivo. Cada ponto-chave só pode citar trechos que já passaram na verificação do resumo daquele plano, e
        passa pelas mesmas verificações e pela mesma revisão humana. O <a href="/chat">chat por tema</a> não gera texto
        na hora: ele junta, conforme o que você pede, esses mesmos pontos aprovados, com o trecho e a página do PDF.
      </p>
    </>
  );
}

export function NaoEncontrada(_: Base) {
  return (
    <>
      <Titulo>Página não encontrada</Titulo>
      <p>Este endereço não existe.</p>
      <p>
        <a className="botao" href="/">Ir para o início</a>
      </p>
    </>
  );
}
