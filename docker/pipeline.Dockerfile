FROM python:3.11.9-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PYTHONPATH=/app/pipeline \
    LANGSMITH_TRACING=false LANGCHAIN_TRACING_V2=false
COPY pipeline.requirements.txt /tmp/pipeline.requirements.txt
RUN pip install --no-cache-dir -r /tmp/pipeline.requirements.txt
WORKDIR /app
