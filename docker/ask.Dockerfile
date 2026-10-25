# Imagem de desenvolvimento e teste do /ask (prévia, plano-final §11), usada pelo ./dock.sh ask.
# O código entra por tar como nos outros serviços; a imagem de serviço é docker/ask-servico.Dockerfile.
FROM python:3.11.9-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PYTHONPATH=/app/pipeline:/app/ask \
    LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false HF_HUB_DISABLE_TELEMETRY=1 FASTEMBED_CACHE_PATH=/modelos
COPY ask.requirements.txt /tmp/ask.requirements.txt
RUN pip install --no-cache-dir -r /tmp/ask.requirements.txt
# Modelo de embeddings embutido na imagem: em execução, nenhuma chamada externa para buscar pesos.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"
ENV HF_HUB_OFFLINE=1
WORKDIR /app
