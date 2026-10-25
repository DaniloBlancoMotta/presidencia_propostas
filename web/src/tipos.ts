// Tipos do contrato (contrato/comparacao.schema.json). Única forma de dado que o site lê.

export type CandidatoId = "flavio-bolsonaro" | "lula";
export const CANDIDATOS_BASE: CandidatoId[] = ["flavio-bolsonaro", "lula"];
// PDF de cada candidato (dados/fontes.json): as aspas de cada citação ficam na cor do candidato do arquivo citado.
export const CANDIDATO_DO_ARQUIVO: Record<string, CandidatoId> = {
  "plano-de-governo_flavio.pdf": "flavio-bolsonaro",
  "Programa-Governo-LULA-2026.pdf": "lula",
};
export type Camada = "plano" | "declaracao" | "imprensa";

export interface Citacao {
  arquivo: string;
  pagina: number;
  trecho: string;
}

export interface Bullet {
  texto: string;
  camada: Camada;
  citacoes: Citacao[];
}

export interface ItemDoisLados {
  texto: string;
  camada: Camada;
  citacoes: Record<CandidatoId, Citacao[]>;
}

export interface Omissao {
  tratado_por: CandidatoId;
  texto: string;
  camada: Camada;
  citacoes: Citacao[];
}

export interface Comparacao {
  theme_id: string;
  gerado_em: string;
  fontes: { arquivo: string; candidato: CandidatoId; sha256: string; coletado_em: string }[];
  candidatos: Record<CandidatoId, { nao_encontrado: boolean; resumo: Bullet[]; executivo: Bullet[] }>; // executivo: até 3 pontos-chave
  semelhancas: ItemDoisLados[];
  diferencas: ItemDoisLados[];
  omissoes: Omissao[];
}

export interface TemaPublico {
  id: string;
  rotulo: string;
  icone: string;
  descricao: string;
}

export interface Fonte {
  arquivo: string;
  candidato: CandidatoId;
  partido: string;
  sha256: string;
  coletado_em: string;
  url_tse: string;
  conferido_tse: boolean;
}

export interface Manifesto {
  temas: TemaPublico[]; // só os aprovados, na ordem de themes.yaml
  fontes: Fonte[];
  candidatos: Record<CandidatoId, { nome: string; partido: string }>;
  responsavel: string | null;
  ask?: string | null; // endereço do POST /ask; só existe no build de prévia (ASK_URL), nunca em produção
}

export type Rota =
  | { tipo: "inicio" }
  | { tipo: "tema"; id: string }
  | { tipo: "semelhancas" }
  | { tipo: "diferencas" }
  | { tipo: "metodologia" }
  | { tipo: "sobre" }
  | { tipo: "chat" }
  | { tipo: "conversa" }
  | { tipo: "nao-encontrada" };

export interface DadosPagina {
  rota: Rota;
  manifesto: Manifesto;
  comparacoes: Record<string, Comparacao>; // as necessárias para a rota
}

export const NOME_SITE = "Compare os planos de governo 2026";
// A abertura de / começa por "Planos de governo de A e B, candidatos ao 2º turno de 2026, registrados no TSE.", com A e B
// na ordem vigente (paginas.tsx). LEAD_INICIO é a frase que não depende da ordem: é também a descrição de / nos
// dados estruturados, que precisam repetir texto visível sem fixar uma ordem.
export const LEAD_INICIO = "Escolha um tema para comparar o que cada plano propõe, com o trecho e a página do PDF original.";
export const LEAD_SEMELHANCAS = "Pontos em que os dois planos propõem a mesma coisa, em todos os temas publicados.";
export const LEAD_DIFERENCAS =
  "Pontos que os dois planos tratam de formas diferentes, e pontos tratados por só um deles, em todos os temas publicados.";

export const AVISO_IA =
  "Resumos gerados por IA a partir dos planos de governo registrados no TSE. Podem conter erros — o PDF original é a fonte definitiva.";
export const NAO_ENCONTRADO = "Não encontrado no plano de governo registrado no TSE";
export const TRANSVERSAL_VAZIA = "Nenhum ponto encontrado nos temas publicados";
export const DESCRICAO_PREVIA = "Compare o que cada plano de governo propõe, com a página do PDF oficial";
