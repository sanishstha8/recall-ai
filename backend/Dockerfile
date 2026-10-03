# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# libpq for psycopg is bundled in psycopg[binary]; curl is used by the healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ARG REQUIREMENTS=production
COPY requirements/ requirements/
RUN pip install -r requirements/${REQUIREMENTS}.txt

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 recallai \
    && mkdir -p /app/storage /app/media /app/staticfiles \
    && chown -R recallai:recallai /app

USER recallai

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
# gthread workers keep long-lived SSE chat streams from blocking other requests.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--worker-class", "gthread", "--workers", "2", "--threads", "8", "--timeout", "300", "--access-logfile", "-"]
