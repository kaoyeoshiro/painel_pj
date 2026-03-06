# main.py
"""
Portal PGE-MS - Aplicação FastAPI Principal

Unifica os sistemas:
- Assistência Judiciária
- Matrículas Confrontantes

Com autenticação centralizada via JWT.
"""

import logging
from fastapi import FastAPI, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
import os

from config import IS_PRODUCTION

# Middleware de Request ID para rastreamento
from middleware.request_id import RequestIDMiddleware, get_request_id

# Logging estruturado
from utils.logging_config import setup_logging, get_logger

# Configura logging para silenciar requests de polling repetitivos
class StatusPollingFilter(logging.Filter):
    """Filtra logs de polling de status que são muito frequentes"""
    def filter(self, record):
        # Silencia logs de polling de status (GET .../status)
        if '/status HTTP' in record.getMessage():
            return False
        return True

# Aplica filtro ao logger do uvicorn
logging.getLogger("uvicorn.access").addFilter(StatusPollingFilter())

from database.init_db import init_database
from auth.dependencies import require_admin
from auth.models import User

# SECURITY: Rate Limiting
from slowapi.errors import RateLimitExceeded
from utils.rate_limit import limiter, rate_limit_exceeded_handler

# SECURITY: Exception handling
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import traceback

# Import do middleware de performance
from admin.middleware_performance import PerformanceMiddleware

# Métricas de request (Prometheus-style)
from middleware.metrics import MetricsMiddleware
from utils.metrics import get_metrics_text, get_metrics_summary

# Bootstrap centralizado de routers
from app.api.bootstrap import register_routers

# Diretórios base
BASE_DIR = Path(__file__).resolve().parent

# Frontend React SPA (unico modo ativo — legado Jinja2 removido na Fase 1)
REACT_DIST_DIR = BASE_DIR / "frontend-react" / "dist"


# IMPORTANTE: Inicializa banco de dados ANTES de criar o app
# Isso garante que migrações sejam executadas antes de qualquer query
print("[*] Pré-inicializando banco de dados...")
init_database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle events da aplicação.
    Executa na inicialização e no shutdown.
    """
    # Startup
    print("[+] Iniciando Portal PGE-MS...")

    # Configura logging estruturado
    setup_logging()
    logger = get_logger("portal-pge")
    logger.info(f"Iniciando aplicação (environment={'production' if IS_PRODUCTION else 'development'})")

    init_database()

    # ==========================================================================
    # Inicializa tabela de embeddings vetoriais (com pgvector se disponível)
    # ==========================================================================
    try:
        from sistemas.gerador_pecas.models_embeddings import init_embeddings_table
        pgvector_ok = init_embeddings_table()
        print(f"[EMBEDDINGS] Tabela inicializada (pgvector: {'disponível' if pgvector_ok else 'não disponível - usando fallback'})")
    except Exception as e:
        print(f"[WARN] Erro ao inicializar tabela de embeddings: {e}")

    # ==========================================================================
    # REGRA DE OURO: Corrige modos de ativação inconsistentes no startup
    # Garante que dados legados ou corrompidos sejam corrigidos automaticamente
    # ==========================================================================
    try:
        from database.connection import SessionLocal
        from sistemas.gerador_pecas.services_deterministic import corrigir_modos_ativacao_inconsistentes

        db = SessionLocal()
        try:
            resultado = corrigir_modos_ativacao_inconsistentes(db, commit=True)
            if resultado["corrigidos"] > 0:
                print(f"[REGRA-DE-OURO] Corrigidos {resultado['corrigidos']} módulos com modo de ativação inconsistente")
            else:
                print("[REGRA-DE-OURO] Todos os módulos estão com modo de ativação correto")
        finally:
            db.close()
    except Exception as e:
        print(f"[WARN] Erro ao verificar modos de ativação: {e}")

    # Configura instrumentação automática de performance
    from admin.perf_instrumentation import setup_instrumentation
    setup_instrumentation(app)

    # ==========================================================================
    # Inicia BERT Watchdog Scheduler
    # Monitora jobs travados e toma ações automáticas (retry, cleanup)
    # ==========================================================================
    try:
        from utils.background_tasks import start_bert_watchdog_scheduler
        from database.connection import SessionLocal
        await start_bert_watchdog_scheduler(
            interval_minutes=5.0,  # Verifica a cada 5 minutos
            db_factory=SessionLocal
        )
        print("[WATCHDOG] BERT Watchdog scheduler iniciado (intervalo: 5 min)")
    except Exception as e:
        print(f"[WARN] Erro ao iniciar BERT Watchdog: {e}")

    yield
    # Shutdown
    print("[-] Encerrando Portal PGE-MS...")

    # Para o scheduler de tarefas
    try:
        from utils.background_tasks import stop_scheduler
        await stop_scheduler()
        print("[WATCHDOG] Scheduler parado")
    except Exception as e:
        print(f"[WARN] Erro ao parar scheduler: {e}")


# Cria a aplicação FastAPI
app = FastAPI(
    title="Portal PGE-MS",
    description="Portal unificado da Procuradoria-Geral do Estado de Mato Grosso do Sul",
    version="1.0.0",
    lifespan=lifespan
)

# ==================================================
# SECURITY: MIDDLEWARE DE HEADERS DE SEGURANÇA
# ==================================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    SECURITY: Adiciona headers de segurança HTTP em todas as respostas.

    Headers implementados:
    - X-Frame-Options: Previne clickjacking
    - X-Content-Type-Options: Previne MIME sniffing
    - X-XSS-Protection: Proteção XSS do navegador (legacy)
    - Referrer-Policy: Controla informações de referrer
    - Strict-Transport-Security: Força HTTPS (HSTS)
    - Content-Security-Policy: Controla recursos permitidos
    - Permissions-Policy: Restringe APIs do navegador
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Previne clickjacking.
        # Em desenvolvimento o frontend React roda em outra origem (Vite),
        # então não enviamos X-Frame-Options para permitir comparação visual
        # com telas legadas via iframe.
        if IS_PRODUCTION:
            # DENY bloqueia completamente, SAMEORIGIN permite visualizadores internos (PDF viewer)
            response.headers["X-Frame-Options"] = "SAMEORIGIN"

        # Previne MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Proteção XSS do navegador (legacy, mas ainda útil)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Controla informações de referrer enviadas
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Força HTTPS por 1 ano (apenas em produção)
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Content Security Policy — condicional por ambiente
        # SECURITY: Producao remove unsafe-eval e URLs localhost
        if IS_PRODUCTION:
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com data:",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https://generativelanguage.googleapis.com https://openrouter.ai",
                "frame-src 'self' blob:",
                "object-src 'self' blob:",
                "frame-ancestors 'self'",
                "form-action 'self'",
                "base-uri 'self'",
            ]
        else:
            # Desenvolvimento: CSP permissiva (unsafe-eval + localhost para inference server)
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com data:",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https://generativelanguage.googleapis.com https://openrouter.ai http://127.0.0.1:8765 http://localhost:8765",
                "frame-src 'self' blob:",
                "object-src 'self' blob:",
                "frame-ancestors 'self' http://localhost:5173 http://127.0.0.1:5173 http://localhost:5178 http://127.0.0.1:5178",
                "form-action 'self'",
                "base-uri 'self'",
            ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # Permissions Policy - restringe APIs do navegador
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"

        # Cache control para páginas HTML (não cachear por segurança)
        content_type = response.headers.get("content-type", "")
        if "text/html" in content_type:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"

        return response


# ==================================================
# SECURITY: CONFIGURAÇÃO DE CORS
# ==================================================

# SECURITY: Em produção, ALLOWED_ORIGINS DEVE ser definido explicitamente
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()

if _allowed_origins_env:
    # Parse das origens configuradas
    ALLOWED_ORIGINS = [origin.strip() for origin in _allowed_origins_env.split(",") if origin.strip()]
else:
    if IS_PRODUCTION:
        # Em produção, detecta automaticamente o domínio do Railway ou usa padrão
        ALLOWED_ORIGINS = []

        # Railway fornece o domínio público via variável de ambiente
        railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
        if railway_domain:
            ALLOWED_ORIGINS.append(f"https://{railway_domain}")

        # Adiciona domínio padrão da PGE se não configurado
        if not ALLOWED_ORIGINS:
            # Fallback para o domínio conhecido da aplicação
            ALLOWED_ORIGINS = ["https://portal-pge-production.up.railway.app"]
    else:
        # Desenvolvimento local - origens permissivas
        ALLOWED_ORIGINS = [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:3000",
            "http://localhost:5173",  # Vite dev server (React)
        ]

# TRACING: Request ID para rastreamento de requisições
# Deve ser o primeiro middleware para que o ID esteja disponível em todo o request
app.add_middleware(RequestIDMiddleware)

# SECURITY: Adiciona middleware de headers ANTES do CORS
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# SECURITY: Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# PERFORMANCE: Middleware de timing (apenas para admin quando ativado)
app.add_middleware(PerformanceMiddleware)

# METRICS: Coleta métricas de request (Prometheus-style)
app.add_middleware(MetricsMiddleware)


# ==================================================
# SECURITY: EXCEPTION HANDLERS - Sanitiza erros em produção
# ==================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    SECURITY: Handler global para exceções não tratadas.

    Em produção: retorna mensagem genérica (não vaza stack traces).
    Em desenvolvimento: retorna detalhes para debug.
    """
    # Obtém request_id para rastreamento
    request_id = get_request_id() or getattr(request.state, 'request_id', 'unknown')

    if IS_PRODUCTION:
        # SECURITY: Em produção, não expõe detalhes internos
        logging.error(f"[{request_id}] Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Erro interno do servidor. Tente novamente mais tarde.", "request_id": request_id}
        )
    else:
        # Em desenvolvimento, mostra detalhes para debug
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc),
                "type": type(exc).__name__,
                "traceback": traceback.format_exc(),
                "request_id": request_id
            }
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    SECURITY: Handler para erros de validação.

    Sanitiza mensagens de erro para não expor estrutura interna.
    """
    request_id = get_request_id() or getattr(request.state, 'request_id', 'unknown')

    if IS_PRODUCTION:
        # SECURITY: Mensagem simplificada em produção
        return JSONResponse(
            status_code=422,
            content={"detail": "Dados inválidos na requisição.", "request_id": request_id}
        )
    else:
        # Em desenvolvimento, mostra detalhes
        # Converte objetos não-serializáveis (ex: ValueError) para string
        errors = []
        for err in exc.errors():
            clean_err = {**err}
            if "ctx" in clean_err:
                clean_err["ctx"] = {
                    k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                    for k, v in clean_err["ctx"].items()
                }
            errors.append(clean_err)
        return JSONResponse(
            status_code=422,
            content={"detail": errors, "request_id": request_id}
        )

# Arquivos de logo
if os.path.exists("logo"):
    app.mount("/logo", StaticFiles(directory="logo"), name="logo")


# ==================================================
# ROTAS DO PORTAL
# ==================================================

@app.get("/")
async def root():
    """Redireciona para o dashboard ou login"""
    return RedirectResponse(url="/dashboard")


@app.get(
    "/health",
    tags=["Health"],
    summary="Health check básico",
    response_description="Status simplificado do sistema"
)
async def health_check():
    """
    Health check básico para load balancers e monitoramento.

    IMPORTANTE: Retorna sempre 200 para garantir que o deploy passe.
    Use /health/detailed para diagnóstico completo.
    """
    # Health check simples - apenas verifica se o app responde
    return {"status": "ok", "service": "portal-pge"}


@app.get(
    "/health/detailed",
    tags=["Health"],
    summary="Health check detalhado",
    response_description="Status detalhado de todos os componentes"
)
async def health_check_detailed(current_user: User = Depends(require_admin)):
    """
    Health check detalhado com status de todos os componentes.

    SECURITY: Requer autenticacao de admin para evitar exposicao de info interna.

    Verifica:
    - Banco de dados (PostgreSQL)
    - APIs externas (Gemini)
    - Circuit Breakers
    - Background Tasks
    - Variáveis de ambiente
    """
    try:
        from utils.health_check import get_health_status, HealthStatus
        health = await get_health_status(include_details=True)

        status_code = 200 if health.status in (HealthStatus.HEALTHY, HealthStatus.DEGRADED) else 503
        return JSONResponse(content=health.to_dict(), status_code=status_code)
    except Exception as e:
        return JSONResponse(
            content={"status": "unhealthy", "error": str(e)[:200]},
            status_code=503
        )


@app.get(
    "/health/ready",
    tags=["Health"],
    summary="Kubernetes readiness probe",
    response_description="Se o serviço está pronto para receber tráfego"
)
async def readiness_check():
    """
    Readiness probe para Kubernetes.

    Retorna 200 apenas se o serviço está pronto para receber tráfego.
    """
    try:
        from utils.health_check import check_database, HealthStatus
        db_health = await check_database()

        if db_health.status == HealthStatus.HEALTHY:
            return {"status": "ready"}
        else:
            return JSONResponse(
                content={"status": "not_ready", "reason": db_health.message},
                status_code=503
            )
    except Exception as e:
        return JSONResponse(
            content={"status": "not_ready", "error": str(e)[:100]},
            status_code=503
        )


@app.get(
    "/health/live",
    tags=["Health"],
    summary="Kubernetes liveness probe",
    response_description="Se o processo está vivo"
)
async def liveness_check():
    """
    Liveness probe para Kubernetes.

    Retorna 200 se o processo está vivo (sempre retorna OK se chegou aqui).
    """
    return {"alive": True}


# ==================================================
# MÉTRICAS (PROMETHEUS-STYLE)
# ==================================================

@app.get(
    "/metrics",
    tags=["Metrics"],
    summary="Métricas Prometheus",
    response_description="Métricas em formato Prometheus text"
)
async def prometheus_metrics(current_user: User = Depends(require_admin)):
    """
    Endpoint de métricas em formato Prometheus. SECURITY: Requer admin.

    Retorna métricas de:
    - Contagem de requests por endpoint e status
    - Latência (histograma)
    - Erros por tipo
    - Uptime do serviço

    Pode ser usado diretamente por Prometheus para scraping.
    """
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        content=get_metrics_text(),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )


@app.get("/metrics/json")
async def metrics_json(current_user: User = Depends(require_admin)):
    """
    Endpoint de métricas em formato JSON. SECURITY: Requer admin.

    Retorna resumo das métricas em formato legível:
    - Uptime
    - Total de requests/erros
    - Top endpoints
    - Endpoints mais lentos
    - Taxa de erro
    """
    return get_metrics_summary()


# ==================================================
# REGISTRO DE ROUTERS (BOOTSTRAP CENTRALIZADO)
# ==================================================

register_routers(app)


# ==================================================
# FRONTEND REACT SPA — Servindo build estático
# ==================================================

# Monta assets estaticos do React build (JS, CSS, imagens)
react_assets_dir = REACT_DIST_DIR / "assets"
if react_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(react_assets_dir)), name="react-assets")

# Serve arquivos estaticos na raiz do build (vite.svg, etc)
if REACT_DIST_DIR.exists():
    @app.get("/vite.svg")
    async def serve_vite_svg():
        svg_path = REACT_DIST_DIR / "vite.svg"
        if svg_path.exists():
            return FileResponse(str(svg_path), media_type="image/svg+xml")
        return HTMLResponse("Not found", status_code=404)

# Catch-all: qualquer rota nao capturada por API/rotas anteriores
# serve o index.html do React para que o React Router resolva
react_index = REACT_DIST_DIR / "index.html"
if react_index.exists():
    @app.get("/{full_path:path}")
    async def serve_react_spa(full_path: str):
        """Serve o React SPA para qualquer rota nao-API"""
        return FileResponse(
            str(react_index),
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
            }
        )
    print(f"[+] Frontend React SPA ativado (build: {REACT_DIST_DIR})")
else:
    print(f"[ERRO] React build nao encontrado em {REACT_DIST_DIR}")
    print("[ERRO] Rotas frontend retornarao 404! Verifique se dist/ esta no deploy.")


# ==================================================
# EXECUÇÃO DIRETA
# ==================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
