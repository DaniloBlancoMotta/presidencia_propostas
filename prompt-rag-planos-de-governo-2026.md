# Prompt de Planejamento — RAG Comparador de Planos de Governo (Eleições 2026)

> Cole este prompt inteiro no seu agente de código (Claude Code, Cursor, etc.) ou use-o como especificação para a equipe. Ele pede um **plano** primeiro e só depois a implementação.

---

## 1. Papel

Você é um(a) arquiteto(a) de software sênior especializado(a) em sistemas RAG (Retrieval-Augmented Generation), engenharia de dados de documentos e frontends de alta usabilidade. Sua tarefa é **planejar** (e, após aprovação, implementar) uma aplicação web que compara, de forma **neutra, verificável e citada**, os planos de governo dos dois candidatos que disputam o 2º turno da eleição presidencial brasileira de 2026.

## 2. Contexto

- 2º turno: **25 de outubro de 2026**, entre **Flávio Bolsonaro (PL, nº 22)** e **Lula (PT, nº 13 — coligação "Brasil Pronto pra Mais")**.
- Fonte oficial e única dos planos: página de **Planos de Governo do TSE** (2º turno), que oferece o PDF completo de cada candidato e uma visão "por assunto" organizada em **8 macrotemas**. Fonte secundária: sistema **DivulgaCandContas**.
  - https://www.tse.jus.br/eleicoes/eleicoes-2026-content/propostas-de-governo-dos-candidatos-ao-cargo-de-presidente-da-republica-eleicoes-2026-segundo-turno/planos-de-governo-dos-candidatos-ao-cargo-de-presidente-da-republica-eleicoes-2026-2-turno
- Público: eleitor comum, inclusive com baixa familiaridade digital, acessando majoritariamente pelo **celular**.
- Prazo: o 2º turno está muito próximo — planeje um **MVP entregável em poucos dias** e uma fase 2 opcional.

## 3. Objetivo do produto

Permitir que qualquer pessoa, com 1 ou 2 toques, veja **o que cada candidato propõe sobre um tema**, **onde eles convergem**, **onde divergem** e **onde um deles é omisso** — sempre com o trecho e a página do PDF original como prova.

## 4. Princípios inegociáveis (neutralidade e confiabilidade)

1. **Neutralidade estrita**: o sistema nunca recomenda voto, nunca avalia qual proposta é "melhor", nunca usa adjetivos valorativos. Mesma estrutura, mesmo espaço e mesma ordem de tratamento para ambos (alternar ou randomizar a ordem de exibição dos candidatos e permitir que o usuário troque).
2. **Toda afirmação é citada**: cada ponto exibido traz o trecho literal curto, o nome do arquivo e o número da página, com link "Ver no PDF original".
3. **Sem invenção**: se o plano não trata do tema, exibir explicitamente "Não encontrado no plano de governo registrado no TSE" — nunca preencher com conhecimento externo do modelo, notícias, declarações de campanha ou histórico de governo.
4. **Somente os documentos oficiais** entram no índice. Nada de entrevistas, redes sociais ou matérias jornalísticas.
5. **Transparência sobre IA**: rótulo visível informando que resumos foram gerados por IA a partir dos documentos oficiais, com aviso de que podem conter erros e que o PDF é a fonte definitiva. Verificar e seguir as resoluções do TSE vigentes sobre uso de IA em conteúdo eleitoral.
6. **Sem coleta de dados pessoais** (LGPD): sem login, sem cookies de rastreamento, logs anonimizados.
7. **Proteção contra uso indevido**: o chat livre recusa pedidos de opinião, ataques pessoais, previsões eleitorais e conteúdo fora dos planos.

## 5. Temas (botões clicáveis)

Mapear cada tema para os 8 macrotemas do TSE quando possível. Botões obrigatórios:

| # | Botão | Observação |
|---|---|---|
| 1 | **Semelhanças** | Visão transversal: pontos em que os dois planos convergem, em todos os temas |
| 2 | **Diferenças** | Visão transversal: divergências e omissões, em todos os temas |
| 3 | Programas sociais | Bolsa Família/transferência de renda, BPC, salário mínimo, combate à fome |
| 4 | Segurança pública | Tema nº 1 de preocupação do eleitor em 2026 (pesquisas Quaest/Datafolha) |
| 5 | Saúde | SUS, filas, atenção básica, medicamentos |
| 6 | Tecnologia e Inteligência Artificial | Regulação de IA, governo digital, conectividade, soberania de dados, big techs |

Temas adicionais sugeridos (relevância comprovada em pesquisas de 2026):

| # | Botão | Por que entra |
|---|---|---|
| 7 | Custo de vida, dívidas e preço dos alimentos | ~75% dizem que custo de vida/endividamento pesa no voto |
| 8 | Impostos e reforma tributária | Redução de impostos lidera prioridades (Indexa/Broadcast, set/2026) |
| 9 | Emprego e renda | Empatado tecnicamente com impostos no topo das prioridades |
| 10 | Corrupção, instituições e Judiciário/STF | Tema citado como decisivo por parte relevante do eleitorado |
| 11 | Educação | Educação básica, ensino técnico, universidades |
| 12 | Meio ambiente, clima e Amazônia | Desmatamento, transição energética, agro sustentável |
| 13 | Agronegócio e economia regional | Peso econômico e eleitoral |
| 14 | Infraestrutura, moradia e transporte | Obras, saneamento, habitação |
| 15 | Política externa e comércio | Relações internacionais, tarifas, Mercosul |
| 16 | Apostas online (bets) | Regras para bets aparecem entre as prioridades do eleitor |
| 17 | Trabalho e jornada (escala 6x1, contratação por hora, regime alternativo à CLT) | Principal contraste trabalhista apontado pela imprensa no 2º turno |
| 18 | Contas públicas e ajuste fiscal ("Tesouraço", arcabouço fiscal) | Tema mais disputado da reta final (Folha, Poder360, Nexo) |
| 19 | Previdência, aposentados, BPC e idosos | Flávio tem eixo próprio para idosos; Lula tem a Política Nacional de Cuidados |
| 20 | Mulheres e violência doméstica | Eixo transversal no plano de Flávio; Casas da Mulher Brasileira no de Lula |
| 21 | Energia e conta de luz | Ambos prometem reduzir a conta de luz, com caminhos diferentes |
| 22 | Judiciário/STF, reeleição e anistia | Reforma do STF e fim da reeleição (Flávio) vs. defesa das instituições (Lula) |

O conjunto final de temas deve ser **configurável via arquivo** (`themes.yaml`) com: id, rótulo, ícone, descrição curta, palavras-chave/sinônimos para busca, e macrotema TSE correspondente.

## 6. Requisitos funcionais

### 6.1 Ingestão (pipeline offline)
- Baixar os dois PDFs do TSE; guardar hash SHA-256 e data de coleta (exibir no rodapé: "Documentos coletados do TSE em DD/MM/AAAA").
- Extrair texto **preservando número de página** e hierarquia de títulos (PyMuPDF/pdfplumber; OCR com Tesseract `por` apenas se houver páginas escaneadas).
- Chunking semântico por seção/título (≈400–800 tokens, overlap ~15%), com metadados: `candidato`, `partido`, `pagina`, `secao`, `tema_classificado`.
- Classificação de cada chunk nos temas do `themes.yaml` (multi-rótulo) usando LLM + palavras-chave; salvar a confiança.
- Embeddings multilíngues com bom desempenho em português.

### 6.2 Comparações pré-computadas (essencial para o plano gratuito)
Para **cada tema**, gerar offline e salvar em JSON versionado:
- Resumo das propostas de cada candidato (bullets objetivos, cada um com citação).
- Lista de **semelhanças** e **diferenças**, cada item com citação dos dois lados.
- Lista de **omissões** (tema tratado por um e não pelo outro).
- Os botões do frontend leem esse JSON estático → resposta instantânea, custo zero de LLM por clique.
- Etapa de **verificação automática**: um segundo passe confere se cada bullet é sustentado pelo trecho citado (string match + checagem por LLM); itens não sustentados são descartados.
- Etapa de **revisão humana**: gerar um relatório HTML/Markdown para revisão antes de publicar.

### 6.3 Busca/pergunta livre (RAG em tempo real)
- Caixa "Pergunte sobre os planos" com respostas sempre lado a lado (Candidato A | Candidato B).
- Retrieval híbrido (BM25 + vetorial) filtrado por candidato, recuperando top-k de **cada** plano separadamente para garantir equilíbrio.
- Prompt de geração com regras de neutralidade, obrigação de citar e de dizer "não encontrado".
- Cache de respostas por pergunta normalizada; rate limit por IP; perguntas sugeridas para reduzir chamadas.

### 6.4 Frontend
- **Mobile-first**, carregamento < 2 s em 4G, Lighthouse ≥ 90 em performance e acessibilidade.
- Tela inicial: grade de botões grandes com ícone + rótulo (Semelhanças e Diferenças em destaque no topo).
- Tela de tema: duas colunas no desktop / abas ou cards empilhados no celular; cada bullet expansível mostrando o trecho e a página; botão "Ver no PDF" abrindo o PDF na página exata.
- Seletor "Trocar ordem dos candidatos".
- Filtro "Mostrar só diferenças / só semelhanças" dentro de cada tema.
- Acessibilidade WCAG 2.1 AA: contraste, navegação por teclado, leitor de tela, fonte ajustável, linguagem simples. Considerar modo "Leitura fácil" (resumos em linguagem simples).
- Cores neutras (evitar cores partidárias como vermelho/azul/verde-amarelo associadas a candidatos).
- Página "Como funciona / Metodologia" e "Sobre os dados".
- Compartilhamento de um tema via link (sem imagens de candidatos manipuladas; no máximo foto oficial do TSE, se houver licença).

## 7. Requisitos não funcionais
- Linguagem: escolha entre **Python, Java, TypeScript ou .NET** e justifique. Recomendação padrão a avaliar: **Python (FastAPI)** no backend/pipeline (ecossistema RAG mais maduro) + **TypeScript (Next.js ou Vite + React)** no frontend, com tipagem forte e testes.
- Código limpo, modular, com camada de abstração para trocar LLM, embedding e vector store sem reescrever a aplicação.
- Observabilidade básica (logs estruturados, contagem de uso por tema).
- Testes: unitários (chunking, classificação), testes de RAG com conjunto de avaliação (≥ 30 perguntas com respostas esperadas e páginas), testes de neutralidade (mesma pergunta para ambos produz estrutura equivalente), testes de prompt injection.

## 7.1 Capacidade: ≥ 3.000 acessos por dia

**Meta de projeto:** suportar 3.000 acessos/dia com folga para **picos de 10×** (dia de debate, véspera e dia da eleição). Ou seja, dimensionar para 30.000 acessos/dia sem sair do plano gratuito e sem degradar a navegação por temas.

### Premissas de dimensionamento (validar com teste de carga)
| Item | Normal | Pico 10× |
|---|---|---|
| Acessos/dia | 3.000 | 30.000 |
| Hora de pico (~25% do dia) | ~750 acessos/h | ~7.500 acessos/h (~2 acessos/s) |
| Rajada a suportar | 10 req/s | 50 req/s |
| Peso por visita (meta) | ≤ 500 KB | ≤ 500 KB |
| Tráfego estático/dia | ~1,5 GB | ~15 GB |
| Perguntas livres (30% dos usuários × 2) | ~1.800/dia | ~18.000/dia |

### Decisões de arquitetura que garantem a escala
1. **Botões de tema = arquivos estáticos em CDN.**
   - Os JSONs pré-computados (seção 6.2) são publicados junto com o frontend.
   - Clicar em um tema gera **zero** chamadas ao backend e **zero** chamadas ao LLM.
   - Assim, ~90% do uso não depende de servidor.
2. **Hospedagem do frontend com banda ilimitada no gratuito.**
   - Usar **Cloudflare Pages**: o plano gratuito não mede banda nem requisições de arquivos estáticos.
   - **Não** usar Firebase Hosting no plano Spark. A cota diária de transferência dele (360 MB/dia) estoura com poucas centenas de visitas.
3. **Orçamento de performance.**
   - Bundle inicial ≤ 200 KB (gzip) e cada JSON de tema ≤ 30 KB.
   - Fontes do sistema, ícones em SVG inline, imagens em WebP/AVIF com lazy-load.
   - Cache HTTP longo com hash no nome do arquivo.
4. **Backend só para `/ask`.**
   - Rodar no Cloud Run com `min-instances=0`, concorrência alta (~80) e imagem enxuta.
   - Usar modelo de embedding pequeno e índice embutido, para reduzir cold start; avaliar o startup CPU boost.
   - Em 18.000 perguntas/dia, o volume de requisições fica muito abaixo dos 2 milhões/mês gratuitos. O ponto a verificar no teste é o consumo de vCPU-segundos.
5. **O gargalo real é a cota do LLM.** Mitigações, em camadas:
   - **FAQ pré-gerada:** ~200 perguntas mais prováveis, respondidas e verificadas offline e servidas como estático.
   - **Cache semântico:** se uma pergunta nova tiver similaridade ≥ 0,92 com uma já respondida, devolver a resposta em cache. Meta: taxa de acerto ≥ 60%.
   - **Cadeia de provedores:** Gemini Flash (free) → Groq → OpenRouter `:free`, com circuit breaker por provedor.
   - **Modo extrativo de contingência:** quando todas as cotas acabarem, `/ask` devolve os 3 trechos mais relevantes de **cada** plano, com página, sem geração. Custo zero de LLM, a resposta continua útil e verificável, e o site nunca "cai".
   - **Opcional, decisão do dono do projeto:** habilitar um tier pago barato com teto de gasto diário rígido. Calcular o custo estimado no plano com os preços vigentes e apresentá-lo antes de ativar.
6. **Cache persistente das respostas.**
   - Usar um store gratuito com cota diária compatível (ex.: Firestore Spark, Upstash Redis ou Neon Postgres). Verificar os limites atuais.
   - Evitar stores com limite de escrita muito baixo.
7. **Proteção contra abuso** (para não queimar cotas):
   - Rate limit de 10 perguntas/hora por IP.
   - Limite de tamanho da pergunta.
   - Bloqueio de bots via regras gratuitas do Cloudflare (WAF/Bot Fight Mode).

### Testes de carga obrigatórios antes de publicar
- **k6 ou Locust:** cenário de navegação por temas a 50 req/s por 10 min, e cenário `/ask` a 5 req/s por 10 min, com o LLM simulado (mock) e depois real.
- **Critérios de aceite:**
  - temas com p95 < 500 ms;
  - `/ask` com p95 < 6 s (geração) e < 1,5 s (cache/extrativo);
  - taxa de erro < 1%;
  - nenhuma cota gratuita acima de 70% no pico simulado.
- **Painel e alertas:** uso diário de cada cota (requisições Cloud Run, vCPU-s, RPD do LLM, leituras e escritas do cache), com alerta em 70% e 90%.

## 8. Restrição de custo: plano gratuito

O sistema deve rodar **inteiramente em camadas gratuitas**. Avalie e compare ao menos estas opções, verificando os limites **atuais** na documentação oficial (eles mudam com frequência):

| Componente | Opções a avaliar |
|---|---|
| Backend | **GCP Cloud Run** (free tier mensal de vCPU-s, GiB-s e 2 milhões de requisições), AWS Lambda + API Gateway, Azure Container Apps, Fly.io, Render |
| Frontend estático | **Cloudflare Pages (recomendado: banda estática ilimitada)**. Alternativas: Vercel Hobby (limite mensal de banda; verificar termos de uso não comercial), AWS Amplify, Azure Static Web Apps. Firebase Hosting Spark só com plano Blaze, por causa da cota diária baixa |
| Vector store | **Índice embutido no container** (FAISS/LanceDB/Chroma — viável pois são só 2 documentos), Neon/Supabase com pgvector (free), Qdrant Cloud free |
| Embeddings | Modelo local open-source multilíngue rodando na ingestão (ex.: família e5/bge multilíngue), ou API com tier gratuito |
| LLM | Gemini API (free tier hoje restrito a modelos Flash e com cotas baixas), Groq, OpenRouter (modelos `:free`), Cloudflare Workers AI |

Diretrizes de custo:
- **Pré-computar tudo o que for possível** (seção 6.2) — o LLM em tempo real fica só para a pergunta livre.
- Embeddings da consulta gerados localmente no backend para não depender de cota externa.
- Fallback entre provedores de LLM e degradação graciosa: se a cota acabar, mostrar "Pergunta livre indisponível no momento — veja os temas acima" sem quebrar o site.
  > Nota de planejamento (2026-10-17): isto contradiz a seção 7.1, item 5 (modo extrativo). Fica valendo: cota esgotada em todos os provedores → `/ask` responde em **modo extrativo** (3 trechos de cada plano). A mensagem "indisponível" aparece só quando o próprio backend não responde. Ver `.tasks/pergunta-livre-ask.md`.
- Atenção aos termos de uso dos tiers gratuitos (uso de dados para treino, restrições regionais, proibição de revenda).
- Configurar alerta de orçamento/limite de gasto em zero na nuvem escolhida.

## 9. Segurança
- Defesa contra prompt injection (inclusive texto malicioso dentro dos PDFs — tratar conteúdo recuperado como dado, não instrução).
- Rate limiting, CORS restrito, headers de segurança, segredos em Secret Manager/variáveis de ambiente.
- Sem armazenamento de perguntas com dados pessoais.

## 10. Entregáveis que espero de você (nesta ordem)

1. **Documento de arquitetura** com diagrama (Mermaid) dos fluxos de ingestão, pré-computação, consulta e frontend.
2. **Decisões técnicas justificadas**: linguagem, framework RAG (LangChain, LlamaIndex, Haystack ou implementação própria), vector store, LLM, embeddings, cloud — com tabela de prós, contras e custo estimado = R$ 0.
3. **Estrutura de pastas** do monorepo.
4. **Esquemas de dados**: chunk, tema, comparação pré-computada (JSON Schema), resposta da API.
5. **Contratos de API** (OpenAPI): `GET /themes`, `GET /themes/{id}/comparison`, `GET /comparison/similarities`, `GET /comparison/differences`, `POST /ask`, `GET /health`.
   > Nota de planejamento (2026-10-17): pela seção 7.1, item 1, os quatro `GET` de temas/comparações **não são endpoints de backend** — são arquivos JSON estáticos publicados com o frontend no CDN (zero chamadas ao backend por clique). Só `POST /ask` e `GET /health` existem no backend. Ver `.tasks/comparador-temas-mvp.md`.
6. **Prompts do sistema** (classificação, resumo por tema, semelhanças/diferenças, verificação, pergunta livre) com regras de neutralidade e formato de citação.
7. **Wireframes** em texto/ASCII das telas: início, tema, pergunta livre, metodologia — versões celular e desktop.
8. **Plano de avaliação** de qualidade e neutralidade, com métricas (fidelidade/groundedness, cobertura de páginas, taxa de "não encontrado" correta, equilíbrio entre candidatos), partindo do conjunto-ouro da seção 11.3 validado contra os PDFs.
9. **Plano de deploy** passo a passo no free tier escolhido, com CI/CD (GitHub Actions) e infraestrutura como código (Terraform ou equivalente) se não aumentar a complexidade do MVP.
10. **Cronograma** em fases: MVP (temas pré-computados + frontend), Fase 2 (pergunta livre), Fase 3 (melhorias), com riscos e mitigações.

## 11. Referência jornalística (enriquecimento, NÃO corpus do RAG)

A cobertura da imprensa serve para três coisas: (a) calibrar os temas e as palavras-chave do `themes.yaml`; (b) montar o **conjunto-ouro de avaliação** (perguntas + resposta esperada + página do PDF); (c) opcionalmente, alimentar uma aba separada "O que a imprensa reportou". Ela **nunca** entra no índice que responde "o que o plano diz".

### 11.1 Veículos de referência e regras de uso
- Veículos-base: **Estadão, Folha de S.Paulo, UOL, Metrópoles e CNN Brasil**. Complementares (alto volume de comparativos por tema no 2º turno): Poder360, SBT News, Nexo, BBC News Brasil, InvestNews, Canal Rural.
- Excluir veículos e entidades com alinhamento partidário declarado (sites de partidos, fundações partidárias, sindicatos, blogs de campanha), de ambos os lados.
- Respeitar paywall e termos de uso: **não raspar o texto integral**. Armazenar só título, veículo, URL, data, tema e um resumo de 1–2 frases escrito pela equipe, e linkar para o original.
- Equilíbrio: para cada tema, o número de matérias de referência sobre cada candidato deve ser equivalente.
- Distinguir sempre três camadas, com rótulos diferentes na interface:
  1. **Está no plano registrado no TSE**, com página;
  2. **Declaração do candidato ou da campanha** (entrevista, sabatina, rede social);
  3. **Apuração jornalística** sobre a campanha (ex.: estudos internos da equipe econômica), sempre com a resposta da campanha.

### 11.2 Padrões encontrados na cobertura (usar para desenhar a comparação)
- **Eixo geral**: a imprensa descreve o plano de Flávio como liberal na economia, focado em desburocratização e endurecimento penal. O de Lula aparece centrado no Estado de bem-estar social, no desenvolvimento sustentável e na indução estatal da economia.
- **Estrutura dos documentos** (útil para chunking por seção):
  - Lula: 84 páginas, 13 diretrizes temáticas.
  - Flávio: 76 páginas, 9 eixos.
  - Flávio trata a segurança como pré-condição para os demais temas; a proteção à mulher atravessa o plano inteiro.
- **Convergências já identificadas**:
  - digitalizar todos os serviços públicos passíveis de digitalização;
  - prontuário eletrônico único na saúde;
  - reduzir filas do SUS e ampliar o ensino integral;
  - em meio ambiente: infraestrutura hídrica, combate ao desmatamento e instrumentos econômicos de conservação;
  - reduzir a dependência de fertilizantes importados (com caminhos diferentes);
  - regularização fundiária como segurança jurídica no campo.
  O botão **Semelhanças** deve encontrar ao menos esses pontos.
- **Lacunas apontadas pela imprensa** (o sistema deve sinalizá-las como "não especificado no plano", sem juízo de valor):
  - Lula: o plano não fixa meta numérica de resultado primário.
  - Flávio: o plano não detalha quais gastos seriam cortados nem como a redução de impostos seria compensada.
  - Ambos: boa parte das medidas depende do Congresso.
  - Custo de vida: nenhum dos dois traz metas numéricas de preço.
- **Divergência entre plano e campanha**:
  - Bolsa Família: o plano de Flávio não cita o programa pelo nome; prevê manter os programas sociais com melhoria de gestão e combate a fraudes. Em declarações, o candidato prometeu manter e reajustar o benefício.
  - Previdência: a Folha reportou que a equipe econômica de Flávio estudou um ajuste de até 2% do PIB, limitando o reajuste de aposentadorias e do BPC ao INPC. Flávio negou e disse que manterá reajuste acima da inflação.
  - Esse é o caso-modelo para a regra das três camadas da seção 11.1.

### 11.3 Conjunto-ouro inicial por tema (expandir para ≥ 30 itens)
Cada item deve ser **conferido no PDF** antes de entrar no teste; as páginas citadas vêm da imprensa e precisam de validação.

> Nota de planejamento (2026-10-17): conferido nos arquivos locais — nos dois PDFs o número impresso na página coincide com o índice da página no arquivo (pág. 1 = 1ª página), então "pág. ~N" pode ser validada direto pelo índice. A linha "Economia e trabalho" não corresponde a um botão da seção 5; ao entrar no conjunto-ouro, cada item deve ser atribuído a um `theme_id` (impostos, emprego e renda, trabalho e jornada ou contas públicas).

| Tema | Lula (esperado) | Flávio (esperado) |
|---|---|---|
| Segurança | Ministério da Segurança Pública (condicionado à aprovação da PEC); asfixia financeira das facções dentro dos limites constitucionais; câmeras corporais; R$ 10 bi do FIIS para estados e municípios | Classificar PCC e CV como narcoterroristas; 5 presídios federais de segurança máxima; reconhecimento facial ("Muralha Brasileira"); dobrar investimento federal em segurança |
| Saúde | Fortalecer o SUS e o programa Agora Tem Especialistas; saúde digital; Farmácia Popular | Corrigir a tabela SUS (pág. ~37); prontuário único (pág. ~26); ampliar a Saúde da Família; integrar capacidade privada já existente |
| Programas sociais | Manter e ampliar o Bolsa Família; Política Nacional de Cuidados; valorização do salário mínimo | Manter os programas existentes com gestão e combate a fraudes; trilha de qualificação para beneficiários; Casa Verde e Amarela (pág. ~47) |
| Educação | Tempo integral, creches pelo Novo PAC, Pé-de-Meia, piso do magistério, 111 novos institutos/campi | Escolas cívico-militares, alfabetização pelo método fônico, vouchers, repasses vinculados a metas, ensino superior sob o MCTI |
| Tecnologia e IA | Soberania digital; Nova Indústria Brasil com incentivo a IA; regras para direitos autorais na era da IA; conectividade escolar | Identidade digital única no Gov.br; assistente "ClarIA"; estratégia nacional de IA para micro, pequenas e médias empresas; atração de data centers |
| Economia e trabalho | Manter o arcabouço fiscal; isenção de IR até R$ 5 mil; fim da escala 6x1; sem meta numérica de crescimento | "Tesouraço"; corte de ≥ 10 ministérios; retomar o PND (privatizações); meta de PIB de 4% ao ano; revisar a reforma tributária; apoio à contratação por hora (PEC 12) |
| Meio ambiente | Clima como emergência; desmatamento líquido zero em todos os biomas até 2030 | Conservação com geração de renda, mercado de carbono, bioeconomia; barragens e drenagem contra eventos extremos |
| Custo de vida | Plano Safra da Agricultura Familiar com foco na cesta básica; PAA (PT, págs. ~48–49, 58–60, 63–65) | Corredores logísticos, armazenagem, seguro rural, fertilizantes nacionais (PL, págs. ~29–33) |
| Agro | Fertilizantes com participação central da Petrobras e bioinsumos; regularização ligada à reforma agrária | Fertilizantes a partir de gás natural; titulação acelerada; outorgas de irrigação mais simples |

### 11.4 Requisitos derivados para o sistema
- Campo `camada` (`plano` | `declaracao` | `imprensa`) em todo item exibido; o MVP mostra apenas `plano`.
- Aba opcional "Na imprensa" por tema: lista de links equilibrada, com data e veículo, sem resumo gerado por IA de texto protegido.
- Teste automático: toda resposta do botão de tema deve cobrir os itens do conjunto-ouro daquele tema (recall ≥ 90%) sem trazer nada da camada `imprensa`.

## 12. Regras de trabalho
- Antes de escrever código, apresente o plano completo e **aguarde minha aprovação**.
- Liste explicitamente suposições e perguntas em aberto.
- Se algum limite de free tier não puder ser confirmado, sinalize como "a verificar" em vez de presumir.
- Prefira simplicidade: para 2 documentos, evite infraestrutura superdimensionada.
