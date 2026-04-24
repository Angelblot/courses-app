FROM python:3.11-slim

# Installer les dépendances système pour compiler les extensions C + Playwright
RUN apt-get update && apt-get install -y \
    gcc libssl-dev pkg-config \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Installer Chromium pour Playwright (seulement le browser, pas tous)
RUN playwright install chromium

COPY . .

ENV PORT=8000
ENV PYTHONPATH=/app

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
