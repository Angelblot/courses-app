FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libssl-dev \
    pkg-config \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN python -m playwright install --with-deps chromium

COPY backend/ ./

ENV PYTHONPATH=/app
ENV PORT=10000

EXPOSE 10000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
