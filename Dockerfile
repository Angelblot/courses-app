FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements-render.txt .
RUN pip install --no-cache-dir -r requirements-render.txt

COPY backend/ ./

ENV PORT=8000
ENV PYTHONPATH=/app

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
