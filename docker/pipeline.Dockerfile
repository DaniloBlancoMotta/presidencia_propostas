FROM python:3.11.9-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PYTHONPATH=/app/pipeline
RUN pip install --no-cache-dir pymupdf==1.28.2 pyyaml==6.0.2 jsonschema==4.23.0 pytest==8.3.4
WORKDIR /app
