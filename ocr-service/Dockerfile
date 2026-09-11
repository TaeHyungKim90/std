FROM python:3.12.13-slim-bookworm AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv==0.11.19
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable --no-cache
COPY models.py ./
RUN .venv/bin/python models.py

FROM python:3.12.13-slim-bookworm
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home ocr
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/models /app/models
COPY app.py engine.py worker.py receipt_parser.py models.py ./
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    OCR_MODEL_DIR=/app/models PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True \
    PADDLE_PDX_CACHE_HOME=/tmp/paddlex HOME=/tmp OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2
USER 10001:10001
EXPOSE 8010
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "1", "--no-access-log", "--limit-concurrency", "8", "--timeout-keep-alive", "5"]
