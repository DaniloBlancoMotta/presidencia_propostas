#!/usr/bin/env bash
# Prévia local do /ask (plano-final §11): API em http://localhost:8080 e site de prévia (chat com
# "Perguntar à IA") em http://localhost:4174. Nada é publicado. As chaves vêm do ambiente, carregadas
# num subshell a partir do arquivo do dono, fora do repositório:
#   ( set -a; . <(tr -d '\r' < ~/.segredos/rag-planos.env); set +a; ./ask/previa.sh )
# Parar: docker rm -f rag-planos-ask-previa rag-planos-site-previa
set -euo pipefail
export MSYS_NO_PATHCONV=1
raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"
porta_api="${PORTA_API:-8080}"; porta_site="${PORTA_SITE:-4174}"

docker build -q -f docker/ask-servico.Dockerfile -t rag-planos-ask-servico . >/dev/null
docker rm -f rag-planos-ask-previa rag-planos-site-previa >/dev/null 2>&1 || true
docker run -d --name rag-planos-ask-previa -p "$porta_api:8080" \
  -e GEMINI_API_KEY -e GROQ_API_KEY -e OPENROUTER_API_KEY -e GEMINI_MODELO -e GROQ_MODELO -e OPENROUTER_MODELO \
  -e ASK_PROVEDORES -e ASK_ORIGEM_SITE="http://localhost:$porta_site" rag-planos-ask-servico >/dev/null

# Site de prévia: build com ASK_URL num contêiner próprio do serviço web, servido na porta do site.
ASK_URL="http://localhost:$porta_api/ask" DOCK_NOME=previa WD=web SAIDAS="web/dist-previa" ./dock.sh web "npm run build:previa" >/dev/null
docker run -d --name rag-planos-site-previa -p "$porta_site:$porta_site" -w /srv rag-planos-web sleep infinity >/dev/null
docker cp web/dist-previa rag-planos-site-previa:/srv/dist-previa
docker cp web/scripts/servir.mjs rag-planos-site-previa:/srv/servir.mjs
docker exec -d rag-planos-site-previa node servir.mjs dist-previa "$porta_site"

for _ in $(seq 1 60); do
  curl -fsS "http://localhost:$porta_api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://localhost:$porta_api/health" >/dev/null
echo "API:  http://localhost:$porta_api/ask   (provedores com chave no ambiente; ordem em ASK_PROVEDORES)"
echo "Site: http://localhost:$porta_site/chat  (busque uma palavra e toque em \"Perguntar à IA (prévia)\")"
