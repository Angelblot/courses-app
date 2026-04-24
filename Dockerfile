# syntax=docker/dockerfile:1.6

# ============================================================================
# Stage 1 — build the React frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ============================================================================
# Stage 2 — Python/Playwright runtime
# ============================================================================
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_HOME=/app \
    DATA_DIR=/data

WORKDIR ${APP_HOME}

# Create unprivileged user + data dir
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --create-home app \
    && mkdir -p ${DATA_DIR} \
    && chown -R app:app ${DATA_DIR}

# Install Python deps first for layer caching
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code
COPY backend/ ./backend/

# Built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Runtime config — point the app at the data volume
ENV DATABASE_URL=sqlite:////data/courses.db \
    FRONTEND_DIST=/app/frontend/dist \
    PLAYWRIGHT_HEADLESS=true \
    PYTHONPATH=/app/backend

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3).status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000"]
