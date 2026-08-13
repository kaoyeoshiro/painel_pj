# ============================================================
# Portal PGE-MS — Dockerfile Multi-Stage
# ============================================================
# Targets:
#   dev  — hot reload via bind mount (docker compose --profile dev)
#   prod — imagem otimizada para deploy (docker compose --profile prod)
#
# Build:
#   docker compose --profile dev build
#   docker compose --profile prod build
# ============================================================

# ===== BASE =====
FROM python:3.11.9-slim AS base

# Evita prompts interativos e buffering de output
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Dependencias de sistema:
# - libpq-dev: psycopg2
# - Demais: Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    # Playwright Chromium deps
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libdbus-1-3 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia requirements e instala deps Python (camada cacheada)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Instala Playwright Chromium
RUN playwright install chromium

# ===== DEV =====
FROM base AS dev

# Dev nao copia codigo — usa bind mount do docker-compose
# Hot reload via --reload do uvicorn
EXPOSE 8000

CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]

# ===== PROD =====
FROM base AS prod

# Copia todo o codigo da aplicacao
COPY . .

# Garante que o entrypoint e executavel
RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
