# Imagem do serviço /ask (prévia, plano-final §11), para Cloud Run ou para a prévia local
# (ask/previa.sh). Contexto = raiz do repositório; o que entra está em ask-servico.Dockerfile.dockerignore:
#   docker build -f docker/ask-servico.Dockerfile -t rag-planos-ask-servico .
FROM python:3.11.9-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PYTHONPATH=/srv/pipeline:/srv/ask \
    LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false HF_HUB_DISABLE_TELEMETRY=1 FASTEMBED_CACHE_PATH=/modelos
COPY docker/ask.requirements.txt /tmp/ask.requirements.txt
RUN pip install --no-cache-dir -r /tmp/ask.requirements.txt
# Modelo de embeddings embutido: em execução, nenhuma chamada externa para buscar pesos.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"
ENV HF_HUB_OFFLINE=1
WORKDIR /srv
COPY pipeline/rag_planos pipeline/rag_planos
COPY ask/ask ask/ask
COPY dados/chunks dados/chunks
COPY dados/paginas dados/paginas
COPY dados/fontes.json dados/fontes.json
# Índice pronto na imagem (embutir as 858 janelas leva ~35 s; no cold start, só carregar).
RUN python -m ask indexar
RUN useradd --system --uid 10001 ask
USER 10001
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn ask.servidor:app --host 0.0.0.0 --port ${PORT:-8080} --no-access-log"]
