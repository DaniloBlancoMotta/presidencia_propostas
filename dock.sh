#!/usr/bin/env bash
# Executa qualquer comando do projeto dentro do Docker; nada é instalado na máquina.
#   ./dock.sh pipeline python -m rag_planos ingest
#   ./dock.sh web npm test
# O código vai para um contêiner persistente por tar (bind mount do drive D: não funciona
# neste Docker Desktop); só os artefatos gerados voltam para o disco.
set -euo pipefail
export MSYS_NO_PATHCONV=1
svc="$1"; shift
raiz="$(cd "$(dirname "$0")" && pwd)"
img="rag-planos-$svc"; nome="rag-planos-$svc-dev"
cd "$raiz"
if [ -z "$(docker images -q "$img")" ] || [ "${REBUILD:-0}" = 1 ]; then
  docker build -q -t "$img" -f "docker/$svc.Dockerfile" docker >/dev/null
fi
# recria quando não está rodando ou quando a imagem foi refeita (REBUILD=1) depois de ele subir
if [ -z "$(docker ps -q -f "name=^${nome}$")" ] \
   || [ "$(docker inspect -f '{{.Image}}' "$nome" 2>/dev/null)" != "$(docker image inspect -f '{{.Id}}' "$img")" ]; then
  docker rm -f "$nome" >/dev/null 2>&1 || true
  extra=()
  [ "$svc" = web ] && extra=(-v rag-planos-node-modules:/app/web/node_modules --ipc=host)
  docker run -d --name "$nome" -v "rag-planos-$svc-app:/app" "${extra[@]}" "$img" sleep infinity >/dev/null
fi
docker exec "$nome" sh -c 'mkdir -p /app/web && find /app -mindepth 1 -maxdepth 1 ! -name web -exec rm -rf {} + && find /app/web -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +'
tar -cf - --exclude=./.git --exclude=./web/node_modules --exclude=./web/dist . | docker exec -i "$nome" tar -xf - -C /app
set +e
docker exec -i -e GEMINI_API_KEY -e APROVADOS -e PREVIA_RESPONSAVEL -w "/app/${WD:-}" "$nome" sh -c "$*"
rc=$?
set -e
saidas="${SAIDAS:-dados revisao web/dist web/package-lock.json web/test-results web/relatorios}"
docker exec "$nome" sh -c "cd /app && tar -cf - \$(for p in $saidas; do [ -e \"\$p\" ] && echo \"\$p\"; done) 2>/dev/null" | tar -xf - 2>/dev/null || true
exit $rc
