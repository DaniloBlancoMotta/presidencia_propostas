// Chat por tema (AC 38-43). Cada resposta é montada no navegador com os JSONs aprovados de
// /comparacoes, os mesmos das páginas de tema: nenhum texto é gerado na hora e nada sai do domínio.
// Só no build de prévia (manifesto.ask), a busca ganha "Perguntar à IA", que chama o /ask (§11).
// Duas páginas: /chat (entrada) e /chat/conversa (página ampla, com o contexto de cada resposta);
// a conversa vive em chat-estado.ts e passa de uma para a outra.
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { TAM_MAX_PERGUNTA, TEXTO_CARREGANDO, TEXTO_RECUSA, type RecorteAsk, type RespostaAsk } from "./ask-cliente";
import { enviar as enviarAoEstado, limpar, perguntarIA, selecionar, semear, usarChat, type Mensagem } from "./chat-estado";
import { ItemCitado, ItemDoisLados, nomeCandidato } from "./Citado";
import { buscar, inserirMencao, interpretar, mencaoNoCursor, sugerir, type Consulta } from "./consulta";
import { dataBR, linkPdf } from "./rotas";
import { NAO_ENCONTRADO, type CandidatoId, type Comparacao, type Manifesto, type TemaPublico } from "./tipos";

type Enviar = (texto: string) => void;

interface Contexto {
  manifesto: Manifesto;
  ordem: CandidatoId[];
  comps: Record<string, Comparacao>;
  enviar: Enviar;
}

function rotulo(m: Manifesto, id: string) {
  return m.temas.find((t) => t.id === id)?.rotulo ?? id;
}

function lista(nomes: string[]) {
  return nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

const aspas = (termos: string[]) => `“${termos.join(" ")}”`;

export function tituloResposta(c: Consulta, m: Manifesto): string {
  const temas = lista(c.temas.map((id) => rotulo(m, id)));
  switch (c.intencao) {
    case "executivo":
      return `Resumo executivo · ${temas}`;
    case "comparar":
      return `Comparação · ${temas}`;
    case "semelhancas":
      return `Semelhanças · ${temas}`;
    case "diferencas":
      return `Diferenças · ${temas}`;
    case "busca":
      return `Busca por ${aspas(c.termosOriginais)}${c.temas.length ? ` · ${temas}` : ""}`;
    case "panorama":
      return "Panorama dos temas";
    case "desconhecido":
      return "Tema não encontrado";
    default:
      return "Como usar o chat";
  }
}

// ------------------------------------------------------------------ peças das respostas

function Atalhos({ manifesto, enviar }: { manifesto: Manifesto; enviar: Enviar }) {
  return (
    <div className="atalhos" role="group" aria-label="Atalhos">
      {manifesto.temas.map((t) => (
        <button key={t.id} type="button" className="botao pequeno" onClick={() => enviar(`@${t.id}`)}>
          @{t.rotulo}
        </button>
      ))}
      <button type="button" className="botao pequeno" onClick={() => enviar("comparar os temas")}>
        Comparar os temas
      </button>
    </div>
  );
}

function Acoes({ tema, enviar, executivo }: { tema: TemaPublico; enviar: Enviar; executivo: boolean }) {
  return (
    <div className="acoes">
      {executivo ? (
        <button type="button" className="botao pequeno" onClick={() => enviar(`@${tema.id}`)}>
          Resumo executivo de {tema.rotulo}
        </button>
      ) : (
        <button type="button" className="botao pequeno" onClick={() => enviar(`@${tema.id} comparar`)}>
          Comparar os dois planos em {tema.rotulo}
        </button>
      )}
      <a href={`/tema/${tema.id}`}>Abrir a página de {tema.rotulo}</a>
    </div>
  );
}

function Bloco({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <article className="bloco-resposta" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </article>
  );
}

function Executivo({ ctx, tema, chave }: { ctx: Contexto; tema: TemaPublico; chave: string }) {
  const comp = ctx.comps[tema.id];
  return (
    <Bloco id={chave} titulo={`Resumo executivo · ${tema.rotulo}`}>
      <p className="meta">
        Em comum: {comp.semelhancas.length} · Divergências: {comp.diferencas.length} · Só em um dos planos: {comp.omissoes.length}
      </p>
      <div className="lado-a-lado">
        {ctx.ordem.map((c) => {
          const area = comp.candidatos[c];
          const pontos = area.executivo ?? [];
          const so = comp.omissoes.filter((o) => o.tratado_por === c);
          const todas = (
            <ul className="itens">
              {area.resumo.map((b, i) => (
                <ItemCitado key={i} texto={b.texto} citacoes={b.citacoes} />
              ))}
            </ul>
          );
          return (
            <div key={c} className="candidato-resposta" data-cand={c}>
              <h3>{nomeCandidato(ctx.manifesto, c)}</h3>
              {area.nao_encontrado ? (
                <p className="nao-encontrado">{NAO_ENCONTRADO}</p>
              ) : (
                <>
                  {pontos.length > 0 ? (
                    <>
                      <h4>Pontos-chave</h4>
                      <ul className="itens" data-lista="executivo">
                        {pontos.map((b, i) => (
                          <ItemCitado key={i} texto={b.texto} citacoes={b.citacoes} />
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <h4>Propostas do plano ({area.resumo.length})</h4>
                      {todas}
                    </>
                  )}
                  {so.length > 0 && (
                    <>
                      <h4>Só neste plano ({so.length})</h4>
                      <ul className="itens" data-lista="so-neste">
                        {so.map((o, i) => (
                          <ItemCitado key={i} texto={o.texto} citacoes={o.citacoes} />
                        ))}
                      </ul>
                    </>
                  )}
                  {pontos.length > 0 && (
                    <details className="todas">
                      <summary>Todas as propostas do tema ({area.resumo.length})</summary>
                      {todas}
                    </details>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <Acoes tema={tema} enviar={ctx.enviar} executivo={false} />
    </Bloco>
  );
}

function Omissoes({ ctx, comp }: { ctx: Contexto; comp: Comparacao }) {
  const itens = ctx.ordem.flatMap((c) => comp.omissoes.filter((o) => o.tratado_por === c));
  return (
    <ul className="itens" data-lista="omissoes">
      {itens.map((o, i) => (
        <ItemCitado key={i} rotulo={`Só no plano de ${nomeCandidato(ctx.manifesto, o.tratado_por)}`} texto={o.texto} citacoes={o.citacoes} />
      ))}
    </ul>
  );
}

function Comparar({ ctx, tema, chave, tipo }: { ctx: Contexto; tema: TemaPublico; chave: string; tipo: "comparar" | "semelhancas" | "diferencas" }) {
  const comp = ctx.comps[tema.id];
  const titulo = { comparar: "Comparação", semelhancas: "Semelhanças", diferencas: "Diferenças" }[tipo];
  return (
    <Bloco id={chave} titulo={`${titulo} · ${tema.rotulo}`}>
      {tipo !== "diferencas" && (
        <>
          <h3>Em comum ({comp.semelhancas.length})</h3>
          {comp.semelhancas.length ? (
            <ul className="itens" data-lista="semelhancas">
              {comp.semelhancas.map((it, i) => (
                <ItemDoisLados key={i} texto={it.texto} citacoes={it.citacoes} ordem={ctx.ordem} manifesto={ctx.manifesto} />
              ))}
            </ul>
          ) : (
            <p className="vazio">Nenhuma semelhança encontrada neste tema.</p>
          )}
        </>
      )}
      {tipo !== "semelhancas" && (
        <>
          <h3>Divergências ({comp.diferencas.length})</h3>
          {comp.diferencas.length ? (
            <ul className="itens" data-lista="diferencas">
              {comp.diferencas.map((it, i) => (
                <ItemDoisLados key={i} texto={it.texto} citacoes={it.citacoes} ordem={ctx.ordem} manifesto={ctx.manifesto} />
              ))}
            </ul>
          ) : (
            <p className="vazio">Nenhuma diferença encontrada neste tema.</p>
          )}
          <h3>Só em um dos planos ({comp.omissoes.length})</h3>
          {comp.omissoes.length ? <Omissoes ctx={ctx} comp={comp} /> : <p className="vazio">Nenhuma omissão encontrada neste tema.</p>}
        </>
      )}
      <Acoes tema={tema} enviar={ctx.enviar} executivo />
    </Bloco>
  );
}

function Busca({ ctx, consulta, chave }: { ctx: Contexto; consulta: Consulta; chave: string }) {
  const ids = consulta.temas.length ? consulta.temas : ctx.manifesto.temas.map((t) => t.id);
  const achados = buscar(consulta.termos, ids, ctx.comps);
  const termos = aspas(consulta.termosOriginais);
  if (!achados.length) {
    const onde = consulta.temas.length ? ` em ${lista(consulta.temas.map((id) => rotulo(ctx.manifesto, id)))}` : " nos temas publicados";
    return (
      <Bloco id={chave} titulo={tituloResposta(consulta, ctx.manifesto)}>
        <p className="vazio">
          Nenhum ponto publicado menciona {termos}
          {onde}. Digite @ para escolher um tema ou tente outra palavra.
        </p>
        <Atalhos manifesto={ctx.manifesto} enviar={ctx.enviar} />
      </Bloco>
    );
  }
  return (
    <>
      {achados.map((a, k) => {
        const tema = ctx.manifesto.temas.find((t) => t.id === a.tema)!;
        const comp = ctx.comps[a.tema];
        return (
          <Bloco key={a.tema} id={`${chave}-${k}`} titulo={`${termos} em ${tema.rotulo}`}>
            <div className="lado-a-lado">
              {ctx.ordem.map((c) => {
                const r = a.candidatos[c];
                const nome = nomeCandidato(ctx.manifesto, c);
                return (
                  <div key={c} className="candidato-resposta" data-cand={c}>
                    <h3>{nome}</h3>
                    {comp.candidatos[c].nao_encontrado ? (
                      <p className="nao-encontrado">{NAO_ENCONTRADO}</p>
                    ) : r.resumo.length + r.omissoes.length === 0 ? (
                      <p className="vazio">
                        Nenhum ponto publicado do plano de {nome} menciona {termos} neste tema.
                      </p>
                    ) : (
                      <ul className="itens" data-lista="achados">
                        {r.resumo.map((b, i) => (
                          <ItemCitado key={`r${i}`} texto={b.texto} citacoes={b.citacoes} />
                        ))}
                        {r.omissoes.map((o, i) => (
                          <ItemCitado key={`o${i}`} rotulo="Só neste plano" texto={o.texto} citacoes={o.citacoes} />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            {a.semelhancas.length > 0 && (
              <>
                <h3>Em comum ({a.semelhancas.length})</h3>
                <ul className="itens">
                  {a.semelhancas.map((it, i) => (
                    <ItemDoisLados key={i} texto={it.texto} citacoes={it.citacoes} ordem={ctx.ordem} manifesto={ctx.manifesto} />
                  ))}
                </ul>
              </>
            )}
            {a.diferencas.length > 0 && (
              <>
                <h3>Divergências ({a.diferencas.length})</h3>
                <ul className="itens">
                  {a.diferencas.map((it, i) => (
                    <ItemDoisLados key={i} texto={it.texto} citacoes={it.citacoes} ordem={ctx.ordem} manifesto={ctx.manifesto} />
                  ))}
                </ul>
              </>
            )}
            <Acoes tema={tema} enviar={ctx.enviar} executivo />
          </Bloco>
        );
      })}
    </>
  );
}

function Panorama({ ctx, chave }: { ctx: Contexto; chave: string }) {
  return (
    <Bloco id={chave} titulo="Panorama dos temas">
      <p className="meta">Por tema, quantos pontos os dois planos têm em comum, onde divergem e quantos só um deles trata.</p>
      <ul className="panorama">
        {ctx.manifesto.temas.map((t) => {
          const c = ctx.comps[t.id];
          return (
            <li key={t.id} className="cartao-panorama" data-tema={t.id}>
              <h3>{t.rotulo}</h3>
              <dl>
                <div>
                  <dt>Em comum</dt>
                  <dd>{c.semelhancas.length}</dd>
                </div>
                <div>
                  <dt>Divergências</dt>
                  <dd>{c.diferencas.length}</dd>
                </div>
                <div>
                  <dt>Só em um dos planos</dt>
                  <dd>{c.omissoes.length}</dd>
                </div>
              </dl>
              <div className="acoes">
                <button type="button" className="botao pequeno" onClick={() => ctx.enviar(`@${t.id}`)}>
                  Resumo de {t.rotulo}
                </button>
                <button type="button" className="botao pequeno" onClick={() => ctx.enviar(`@${t.id} comparar`)}>
                  Comparar {t.rotulo}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Bloco>
  );
}

function Ajuda({ ctx, chave, titulo }: { ctx: Contexto; chave: string; titulo: string }) {
  return (
    <Bloco id={chave} titulo={titulo}>
      <ul className="como-usar">
        <li>
          Digite <kbd>@</kbd> e escolha um tema para ver o resumo executivo de cada candidato.
        </li>
        <li>Depois do tema, escreva “comparar” para ver o que os dois planos têm em comum, onde divergem e o que só um deles trata.</li>
        <li>Escreva uma palavra, como “creche” ou “fronteira”, para achar os pontos que a mencionam.</li>
        <li>Escreva “comparar os temas” para ver o panorama de todos os temas.</li>
      </ul>
      <Atalhos manifesto={ctx.manifesto} enviar={ctx.enviar} />
    </Bloco>
  );
}

function Resposta({ ctx, m }: { ctx: Contexto; m: Mensagem }) {
  const chave = `r${m.id}`;
  const c = m.consulta;
  if (m.estado === "carregando") return <p className="carregando">Buscando nos planos…</p>;
  if (m.estado === "erro")
    return (
      <Bloco id={chave} titulo="Não foi possível carregar">
        <p>Não consegui baixar os dados do tema agora. Verifique a conexão e tente de novo.</p>
        <button type="button" className="botao pequeno" onClick={() => ctx.enviar(m.texto)}>
          Tentar de novo
        </button>
      </Bloco>
    );
  const nota =
    c.desconhecidos.length > 0 && c.intencao !== "desconhecido" ? (
      <p className="nota">Não há tema {lista(c.desconhecidos.map((d) => `“@${d}”`))}; a resposta usa só o que foi reconhecido.</p>
    ) : null;
  const temas = c.temas.map((id) => ctx.manifesto.temas.find((t) => t.id === id)!);
  let corpo: ReactNode;
  switch (c.intencao) {
    case "executivo":
      corpo = temas.map((t, k) => <Executivo key={t.id} ctx={ctx} tema={t} chave={`${chave}-${k}`} />);
      break;
    case "comparar":
    case "semelhancas":
    case "diferencas":
      corpo = temas.map((t, k) => <Comparar key={t.id} ctx={ctx} tema={t} chave={`${chave}-${k}`} tipo={c.intencao as "comparar"} />);
      break;
    case "busca":
      corpo = <Busca ctx={ctx} consulta={c} chave={chave} />;
      break;
    case "panorama":
      corpo = <Panorama ctx={ctx} chave={chave} />;
      break;
    case "desconhecido":
      corpo = (
        <Bloco id={chave} titulo="Tema não encontrado">
          <p>Não há tema {lista(c.desconhecidos.map((d) => `“@${d}”`))}. Escolha um destes:</p>
          <Atalhos manifesto={ctx.manifesto} enviar={ctx.enviar} />
        </Bloco>
      );
      break;
    default:
      corpo = <Ajuda ctx={ctx} chave={chave} titulo="Como usar o chat" />;
  }
  return (
    <>
      {nota}
      {corpo}
    </>
  );
}

/** O texto da pessoa, com as menções reconhecidas destacadas pelo rótulo do tema. */
function FalaPessoa({ texto, manifesto }: { texto: string; manifesto: Manifesto }) {
  const partes = texto.split(/(@[\p{L}\p{N}-]+)/u);
  return (
    <p className="fala fala-pessoa">
      <span className="sr">Você: </span>
      {partes.map((p, i) => {
        if (!p.startsWith("@")) return p;
        const t = manifesto.temas.find((x) => x.id === interpretar(p, manifesto.temas).temas[0]);
        return t ? (
          <span key={i} className="mencao">
            @{t.rotulo}
          </span>
        ) : (
          p
        );
      })}
    </p>
  );
}

/** Pergunta livre ao /ask, só na prévia: botão, carregando, erro ou a resposta gerada, sempre rotulada. */
function BlocoIA({ ctx, m, perguntar }: { ctx: Contexto; m: Mensagem; perguntar: () => void }) {
  const ia = m.ia;
  if (!ia)
    return (
      <div className="acoes ia-acao">
        <button type="button" className="botao pequeno" onClick={perguntar}>
          Perguntar à IA (prévia)
        </button>
        <span className="meta">Gera uma resposta na hora a partir dos dois planos, sem revisão humana.</span>
      </div>
    );
  if (ia.estado === "carregando") return <p className="carregando">{TEXTO_CARREGANDO}</p>;
  if (ia.estado === "erro")
    return (
      <div className="acoes ia-acao">
        <p className="nota" data-ia="erro">
          {ia.erro}
        </p>
        <button type="button" className="botao pequeno" onClick={perguntar}>
          Tentar de novo
        </button>
      </div>
    );
  const r = ia.resposta!;
  const extrativo = r.origem === "extrativo";
  return (
    <Bloco id={`ia${m.id}`} titulo={extrativo ? "Trechos dos planos (IA indisponível)" : "Resposta da IA (prévia)"}>
      <p className="aviso-previa" data-origem={r.origem}>
        {extrativo
          ? "A IA não respondeu a tempo: estes são os trechos dos dois planos mais próximos da pergunta, sem resumo."
          : "Gerada na hora por IA a partir de trechos dos dois planos, sem revisão humana. Confira cada citação no PDF."}
        {r.origem === "cache" ? " Esta resposta já tinha sido dada a uma pergunta parecida." : ""}
      </p>
      {r.recusada && r.motivo !== "fora_dos_planos" ? (
        <p className="vazio" data-ia="recusa">
          {TEXTO_RECUSA}
        </p>
      ) : (
        <div className="lado-a-lado">
          {ctx.ordem.map((c) => {
            const area = r.candidatos[c];
            return (
              <div key={c} className="candidato-resposta" data-cand={c}>
                <h3>{nomeCandidato(ctx.manifesto, c)}</h3>
                {area.nao_encontrado ? (
                  <p className="nao-encontrado">{NAO_ENCONTRADO}</p>
                ) : (
                  <ul className="itens" data-lista="ia">
                    {area.resumo.map((b, i) => (
                      <ItemCitado key={i} texto={b.texto} citacoes={b.citacoes} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Bloco>
  );
}

// ------------------------------------------------------------------ contexto da resposta

const INTENCOES: Record<Consulta["intencao"], string> = {
  executivo: "Resumo executivo do tema",
  comparar: "Comparação dos dois planos no tema",
  semelhancas: "Semelhanças entre os planos no tema",
  diferencas: "Diferenças entre os planos no tema",
  busca: "Busca por palavra nos pontos publicados",
  panorama: "Panorama de todos os temas",
  ajuda: "Ajuda",
  desconhecido: "Tema não reconhecido",
};

const MOTIVOS: Record<string, string> = {
  opiniao: "recusada por pedir opinião",
  previsao: "recusada por pedir previsão eleitoral",
  ataque: "recusada por atacar candidato",
  fora_dos_planos: "nenhum dos dois planos trata do assunto",
};

function situacaoIA(r: RespostaAsk): string {
  if (r.recusada && r.motivo) return `Sem resposta: ${MOTIVOS[r.motivo]}.`;
  if (r.origem === "cache") return "Resposta guardada de uma pergunta parecida (sem nova chamada ao modelo).";
  if (r.origem === "extrativo") return "Sem modelo disponível: trechos dos planos mais próximos da pergunta, sem resumo.";
  return "Gerada pelo modelo na hora e conferida: trechos literais na página do PDF, sem número ou nome fora deles.";
}

const normal = (s: string) => s.replace(/[‐‑]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

/** Um recorte que foi ao modelo, com a página onde cada parte começa e o link para ela. */
function Recorte({ r, citado }: { r: RecorteAsk; citado: boolean }) {
  const viradas = r.viradas.length ? r.viradas : [[0, r.pagina] as [number, number]];
  const pags = r.paginas.length > 1 ? `págs. ${r.paginas[0]}–${r.paginas[r.paginas.length - 1]}` : `pág. ${r.pagina}`;
  return (
    <li className="recorte" data-citado={citado ? "sim" : "nao"}>
      <p className="origem">
        <span className="arquivo">{r.arquivo}</span> · <span className="pagina">{pags}</span>
        {citado && <span className="selo-citado"> · citado na resposta</span>}
      </p>
      <p className="texto-recorte">
        {viradas.map(([inicio, pag], i) => (
          <span key={i}>
            {i > 0 && <span className="marca-pagina">[pág. {pag}] </span>}
            {r.texto.slice(inicio, i + 1 < viradas.length ? viradas[i + 1][0] : r.texto.length)}
          </span>
        ))}
      </p>
      <a href={linkPdf(r.arquivo, r.pagina)} target="_blank" rel="noopener">
        Ver no PDF<span className="sr"> (abre em nova aba, página {r.pagina})</span>
      </a>
    </li>
  );
}

/** Contexto de uma troca: como a pergunta foi entendida, de onde veio a resposta do chat e, na
 *  prévia, o que foi ao modelo (pergunta enviada, termos, recortes de cada plano) e quem respondeu. */
function ContextoResposta({ ctx, m }: { ctx: Contexto; m: Mensagem }) {
  const c = m.consulta;
  const temas = c.temas.map((id) => ctx.manifesto.temas.find((t) => t.id === id)).filter((t): t is TemaPublico => !!t);
  const usados = c.intencao === "panorama" || (c.intencao === "busca" && !c.temas.length) ? ctx.manifesto.temas : temas;
  const coleta = ctx.manifesto.fontes.map((f) => f.coletado_em).sort()[0];
  const ia = m.ia;
  const r = ia?.resposta;
  const recortes = r?.contexto && Object.values(r.contexto.trechos).some((l) => l.length > 0) ? r.contexto : null;
  return (
    <div className="contexto">
      <h3>Pergunta</h3>
      <dl className="contexto-dados">
        <div>
          <dt>Você escreveu</dt>
          <dd>“{m.texto}”</dd>
        </div>
        <div>
          <dt>Como o chat entendeu</dt>
          <dd>{INTENCOES[c.intencao]}</dd>
        </div>
        {temas.length > 0 && (
          <div>
            <dt>Temas</dt>
            <dd>{lista(temas.map((t) => t.rotulo))}</dd>
          </div>
        )}
        {c.termosOriginais.length > 0 && (
          <div>
            <dt>Palavras buscadas</dt>
            <dd>{c.termosOriginais.join(", ")}</dd>
          </div>
        )}
        {c.desconhecidos.length > 0 && (
          <div>
            <dt>Menções sem tema</dt>
            <dd>{c.desconhecidos.map((d) => `@${d}`).join(", ")}</dd>
          </div>
        )}
      </dl>
      {usados.length > 0 && m.estado === "pronta" && (
        <>
          <h3>De onde vem a resposta do chat</h3>
          <p className="meta">
            Pontos já publicados no site: resumidos por IA no pipeline, conferidos palavra por palavra na página do PDF,
            julgados por um segundo modelo e revisados por uma pessoa. Nada desta parte é gerado na hora.
          </p>
          <ul className="fontes-contexto">
            {usados.map((t) =>
              ctx.comps[t.id] ? (
                <li key={t.id}>
                  <a href={`/tema/${t.id}`}>{t.rotulo}</a>: comparação gerada em {dataBR(ctx.comps[t.id].gerado_em)} ·{" "}
                  <a href={`/comparacoes/${t.id}.json`}>dados de {t.rotulo} (JSON)</a>
                </li>
              ) : null,
            )}
          </ul>
          <p className="meta">
            Planos coletados do TSE em {dataBR(coleta)}:{" "}
            {ctx.manifesto.fontes.map((f, i) => (
              <span key={f.arquivo}>
                {i ? " e " : ""}
                <a href={`/pdf/${encodeURIComponent(f.arquivo)}`}>{f.arquivo}</a>
              </span>
            ))}
            .
          </p>
        </>
      )}
      {ia && (
        <>
          <h3>Resposta da IA (prévia)</h3>
          <dl className="contexto-dados">
            <div>
              <dt>Pergunta enviada</dt>
              <dd>“{ia.pergunta}”</dd>
            </div>
            {r?.origem === "cache" && r.contexto && (
              <div>
                <dt>Respondida antes para</dt>
                <dd>“{r.contexto.pergunta}”</dd>
              </div>
            )}
            <div>
              <dt>Situação</dt>
              <dd data-ia-situacao>{ia.estado === "carregando" ? TEXTO_CARREGANDO : ia.estado === "erro" ? ia.erro : situacaoIA(r!)}</dd>
            </div>
            {r && r.modelos.length > 0 && (
              <div>
                <dt>Modelo</dt>
                <dd>{r.modelos.join(", ")}</dd>
              </div>
            )}
            {ia.ms !== undefined && (
              <div>
                <dt>Tempo de resposta</dt>
                <dd>{(ia.ms / 1000).toFixed(1).replace(".", ",")} s</dd>
              </div>
            )}
            {r?.contexto && r.contexto.termos.length > 0 && (
              <div>
                <dt>Termos da busca</dt>
                <dd>{r.contexto.termos.join(", ")}</dd>
              </div>
            )}
          </dl>
          {recortes && r && (
            <>
              <h3>Trechos que o modelo recebeu</h3>
              <p className="meta">
                Busca separada em cada plano: as 2 partes mais próximas da pergunta em 5 trechos. A resposta só pode citar
                estes trechos, e o que não estiver literalmente na página do PDF é descartado.
              </p>
              {ctx.ordem.map((cid) => {
                const lista_ = recortes.trechos[cid] ?? [];
                const citados = r.candidatos[cid].resumo.flatMap((b) => b.citacoes.map((x) => normal(x.trecho)));
                return (
                  <div key={cid} className="recortes-cand" data-cand={cid}>
                    <h4>
                      {nomeCandidato(ctx.manifesto, cid)} ({lista_.length})
                    </h4>
                    <ol className="recortes" aria-label={`Trechos de ${nomeCandidato(ctx.manifesto, cid)}`}>
                      {lista_.map((rec, i) => (
                        <Recorte key={i} r={rec} citado={citados.some((t) => normal(rec.texto).includes(t))} />
                      ))}
                    </ol>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ campo de mensagem

/** Campo com a lista do @ (combobox), o botão "@ Tema" e "Enviar". */
function Compositor({ manifesto, enviar }: { manifesto: Manifesto; enviar: (texto: string) => void }) {
  const [texto, setTexto] = useState("");
  const [cursor, setCursor] = useState(0);
  const [fechada, setFechada] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const mencao = mencaoNoCursor(texto, cursor);
  const opcoes = mencao && !fechada ? sugerir(mencao.busca, manifesto.temas) : [];
  const aberta = opcoes.length > 0;
  const atual = Math.min(ativo, Math.max(opcoes.length - 1, 0));

  function escolher(t: TemaPublico) {
    if (!mencao) return;
    const r = inserirMencao(texto, cursor, mencao.inicio, t.id);
    setTexto(r.texto);
    setCursor(r.cursor);
    setAtivo(0);
    requestAnimationFrame(() => {
      campo.current?.focus();
      campo.current?.setSelectionRange(r.cursor, r.cursor);
    });
  }

  function mudou(e: ChangeEvent<HTMLInputElement>) {
    setTexto(e.target.value);
    setCursor(e.target.selectionStart ?? e.target.value.length);
    setFechada(false);
    setAtivo(0);
  }

  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (!aberta) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = opcoes.length;
      setAtivo((atual + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      escolher(opcoes[atual]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setFechada(true);
    }
  }

  function arroba() {
    const el = campo.current;
    const pos = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, pos);
    const insere = antes && !/\s$/.test(antes) ? " @" : "@";
    setTexto(antes + insere + texto.slice(pos));
    setCursor(pos + insere.length);
    setFechada(false);
    setAtivo(0);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + insere.length, pos + insere.length);
    });
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) {
      campo.current?.focus();
      return;
    }
    setTexto("");
    setCursor(0);
    setAtivo(0);
    enviar(t);
  }

  return (
    <form className="compositor" onSubmit={aoEnviar}>
      <label htmlFor="campo-chat" className="rotulo-campo">
        Sua mensagem
      </label>
      <div className="linha-campo">
        <button type="button" className="botao pequeno" onClick={arroba}>
          @ Tema
        </button>
        <div className="campo-combo">
          <input
            id="campo-chat"
            ref={campo}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={aberta}
            aria-controls="lista-temas"
            aria-activedescendant={aberta ? `opcao-${opcoes[atual].id}` : undefined}
            aria-describedby="dica-chat"
            autoComplete="off"
            maxLength={TAM_MAX_PERGUNTA}
            enterKeyHint="send"
            placeholder="Ex.: @saude comparar"
            value={texto}
            onChange={mudou}
            onKeyDown={teclado}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
          />
          <ul id="lista-temas" role="listbox" aria-label="Temas" className="lista-temas" hidden={!aberta}>
            {opcoes.map((t, i) => (
              <li
                key={t.id}
                id={`opcao-${t.id}`}
                role="option"
                aria-selected={i === atual}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(t)}
              >
                <span className="rotulo-tema">{t.rotulo}</span> <span className="id-tema">@{t.id}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="submit" className="botao">
          Enviar
        </button>
      </div>
    </form>
  );
}

function Dica({ manifesto }: { manifesto: Manifesto }) {
  return (
    <p id="dica-chat" className="dica">
      {manifesto.ask
        ? "Digite @ para escolher um tema. As respostas reúnem pontos já verificados dos planos; nesta prévia, “Perguntar à IA” gera uma resposta na hora, sem revisão humana."
        : "Digite @ para escolher um tema. As respostas reúnem só pontos já verificados dos planos, com trecho e página; nada é gerado na hora."}
    </p>
  );
}

// ------------------------------------------------------------------ páginas

export function Chat(props: {
  manifesto: Manifesto;
  ordem: CandidatoId[];
  comparacoes: Record<string, Comparacao>;
  modo: "entrada" | "conversa";
  navegar: (caminho: string) => void;
}) {
  const { manifesto, ordem, modo, navegar } = props;
  const est = usarChat();
  const rolar = useRef<number | null>(null);
  useEffect(() => semear(props.comparacoes), [props.comparacoes]);
  useEffect(() => {
    if (rolar.current !== null) {
      document.getElementById(`fala-${rolar.current}`)?.scrollIntoView({ block: "start" });
      rolar.current = null;
    }
  }, [est.mensagens.length]);

  function enviar(texto: string) {
    const id = enviarAoEstado(texto, manifesto, (c) => tituloResposta(c, manifesto));
    if (id === null) return;
    if (modo === "entrada") navegar("/chat/conversa");
    else rolar.current = id;
  }

  const ctx: Contexto = { manifesto, ordem, comps: { ...props.comparacoes, ...est.comps }, enviar };
  const status = (
    <p className="sr" role="status">
      {est.status}
    </p>
  );

  if (modo === "entrada") {
    const n = est.mensagens.length;
    return (
      <div className="chat">
        <p className="voltar">
          <a href="/">← Todos os temas</a>
        </p>
        <h1 id="titulo" tabIndex={-1}>
          Chat por tema
        </h1>
        <div className="fala fala-site boas-vindas">
          <p>
            Digite <kbd>@</kbd> e escolha um tema para ver o resumo executivo de cada candidato: os pontos-chave, o que só ele
            trata e todas as propostas do tema. Escreva “comparar” depois do tema para ver semelhanças e diferenças, ou uma
            palavra, como “creche”, para buscar nos dois planos. A conversa abre numa página ampla, com o contexto de cada
            resposta ao lado.
          </p>
          <Atalhos manifesto={manifesto} enviar={enviar} />
        </div>
        {n > 0 && (
          <p className="continuar">
            <a href="/chat/conversa">
              Continuar a conversa ({n} {n === 1 ? "pergunta" : "perguntas"})
            </a>
          </p>
        )}
        {status}
        <Compositor manifesto={manifesto} enviar={enviar} />
        <Dica manifesto={manifesto} />
      </div>
    );
  }

  const sel = est.mensagens.find((m) => m.id === est.selecionada) ?? est.mensagens[est.mensagens.length - 1];
  return (
    <div className="chat chat-conversa">
      <p className="voltar">
        <a href="/chat">← Chat por tema</a>
      </p>
      <h1 id="titulo" tabIndex={-1}>
        Conversa
      </h1>
      <p className="lead">
        Ao lado de cada resposta fica o contexto: como a pergunta foi entendida e de onde veio a resposta. A conversa fica só
        nesta aba e some ao recarregar a página.
      </p>
      <div className="conversa-ampla">
        <div className="coluna-conversa">
          <section className="conversa" aria-label="Conversa">
            {est.mensagens.length === 0 && (
              <div className="fala fala-site boas-vindas">
                <p>Nenhuma pergunta ainda. Digite @ e escolha um tema, ou use um atalho:</p>
                <Atalhos manifesto={manifesto} enviar={enviar} />
              </div>
            )}
            <ol className="falas">
              {est.mensagens.map((m) => (
                <li key={m.id} id={`fala-${m.id}`} className="troca" data-selecionada={sel?.id === m.id ? "sim" : "nao"}>
                  <FalaPessoa texto={m.texto} manifesto={manifesto} />
                  <div className="fala fala-site" aria-busy={m.estado === "carregando"}>
                    <Resposta ctx={ctx} m={m} />
                    {manifesto.ask && m.estado === "pronta" && m.consulta.intencao === "busca" && (
                      <BlocoIA ctx={ctx} m={m} perguntar={() => perguntarIA(m.id, manifesto)} />
                    )}
                    <div className="acoes ver-contexto">
                      <button
                        type="button"
                        className="botao pequeno"
                        aria-pressed={sel?.id === m.id}
                        aria-controls="painel-contexto"
                        onClick={() => selecionar(m.id)}
                      >
                        Ver contexto
                      </button>
                    </div>
                    <details className="contexto-inline">
                      <summary>Contexto da pergunta e da resposta</summary>
                      <ContextoResposta ctx={ctx} m={m} />
                    </details>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {status}
          <Compositor manifesto={manifesto} enviar={enviar} />
          <Dica manifesto={manifesto} />
          {est.mensagens.length > 0 && (
            <button type="button" className="limpar" onClick={limpar}>
              Limpar conversa
            </button>
          )}
        </div>
        <aside id="painel-contexto" className="painel-contexto" aria-labelledby="h-contexto">
          <h2 id="h-contexto">Contexto{sel ? `: “${sel.texto}”` : ""}</h2>
          {sel ? (
            <ContextoResposta ctx={ctx} m={sel} />
          ) : (
            <p className="meta">Faça uma pergunta para ver aqui como ela foi entendida e de onde veio a resposta.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
