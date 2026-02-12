# migrations/env.py
"""
Configuracao do ambiente Alembic para migrations.

Este arquivo importa todos os modelos do projeto para que
o autogenerate funcione corretamente.

IMPORTANTE: Os imports NAO usam try/except - se um model falhar,
a migration DEVE falhar explicitamente para evitar deteccao incorreta.

Autor: LAB/PGE-MS
Atualizado: 2026-02-11 (Fase 0.1 — refatoracao backend)
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Adiciona o diretorio raiz ao path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Carrega variaveis de ambiente do .env
from dotenv import load_dotenv
load_dotenv()

# Importa a configuracao do banco de dados
from config import DATABASE_URL

# Importa o Base de onde todos os models herdam
from database.connection import Base

# ==================================================
# IMPORTA TODOS OS MODELS PARA AUTOGENERATE
# ==================================================
# REGRA: NAO usar try/except - imports devem falhar
# explicitamente se houver problema estrutural no codigo.
# Isso garante que o Alembic detecte todas as tabelas.

# ============ AUTH ============
from auth.models import User

# ============ ADMIN ============
from admin.models import PromptConfig, ConfiguracaoIA
from admin.models_gemini_logs import GeminiApiLog
from admin.models_performance import AdminSettings, PerformanceLog, RouteSystemMap
from admin.models_request_perf import RequestPerfLog
from admin.models_prompt_groups import (
    PromptGroup,
    PromptSubgroup,
    PromptSubcategoria,
    CategoriaOrdem,
)
from admin.models_prompts import (
    PromptModulo,
    PromptModuloHistorico,
    ModuloTipoPeca,
    RegraDeterministicaTipoPeca,
)

# ============ SISTEMAS — GERADOR DE PECAS ============
from sistemas.gerador_pecas.models import GeracaoPeca, VersaoPeca, FeedbackPeca
from sistemas.gerador_pecas.models_config_pecas import (
    CategoriaDocumento,
    TipoPeca,
    tipo_peca_categorias,
)
from sistemas.gerador_pecas.models_resumo_json import (
    CategoriaResumoJSON,
    CategoriaResumoJSONHistorico,
)
from sistemas.gerador_pecas.models_extraction import (
    ExtractionQuestion,
    ExtractionModel,
    ExtractionVariable,
    PromptVariableUsage,
    PromptActivationLog,
)
from sistemas.gerador_pecas.models_teste_categorias import (
    TesteDocumento,
    TesteObservacao,
)
from sistemas.gerador_pecas.models_teste_ativacao import CenarioTesteAtivacao

# ============ SISTEMAS — MATRICULAS CONFRONTANTES ============
from sistemas.matriculas_confrontantes.models import (
    Analise,
    Registro,
    LogSistema,
    FeedbackMatricula,
    GrupoAnalise,
    ArquivoUpload,
)

# ============ SISTEMAS — ASSISTENCIA JUDICIARIA ============
from sistemas.assistencia_judiciaria.models import (
    ConsultaProcesso,
    FeedbackAnalise,
)

# ============ SISTEMAS — PEDIDO DE CALCULO ============
from sistemas.pedido_calculo.models import (
    GeracaoPedidoCalculo,
    FeedbackPedidoCalculo,
    LogChamadaIA,
)

# ============ SISTEMAS — PRESTACAO DE CONTAS ============
from sistemas.prestacao_contas.models import (
    GeracaoAnalise,
    LogChamadaIAPrestacao,
    FeedbackPrestacao,
)

# ============ SISTEMAS — RELATORIO DE CUMPRIMENTO ============
from sistemas.relatorio_cumprimento.models import (
    GeracaoRelatorioCumprimento,
    LogChamadaIARelatorioCumprimento,
    FeedbackRelatorioCumprimento,
)

# ============ SISTEMAS — CLASSIFICADOR DE DOCUMENTOS ============
from sistemas.classificador_documentos.models import (
    ProjetoClassificacao,
    CodigoDocumentoProjeto,
    ExecucaoClassificacao,
    ResultadoClassificacao,
    PromptClassificacao,
    LogClassificacaoIA,
)

# ============ SISTEMAS — BERT TRAINING ============
from sistemas.bert_training.models import (
    BertDataset,
    BertRun,
    BertJob,
    BertMetric,
    BertLog,
    BertTestHistory,
    BertWorker,
)

# ============ SISTEMAS — CUMPRIMENTO BETA ============
from sistemas.cumprimento_beta.models import (
    SessaoCumprimentoBeta,
    DocumentoBeta,
    JSONResumoBeta,
    ConsolidacaoBeta,
    ConversaBeta,
    PecaGeradaBeta,
)

# ============ SISTEMAS — EXTRATOR DE AUTOS ============
from sistemas.extrator_autos.models import ExtracaoAutos


# ==================================================
# CONFIGURACAO DO ALEMBIC
# ==================================================

# Objeto de configuracao do Alembic (do alembic.ini)
config = context.config

# Configura logging do arquivo ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata dos models para autogenerate
target_metadata = Base.metadata

# Substitui sqlalchemy.url com a URL do .env
config.set_main_option("sqlalchemy.url", DATABASE_URL)


def run_migrations_offline() -> None:
    """
    Executa migrations em modo 'offline'.

    Gera SQL puro sem conexao com o banco.
    Util para revisar as mudancas antes de aplicar.

    Uso: alembic upgrade head --sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Executa migrations em modo 'online'.

    Conecta ao banco e aplica as mudancas diretamente.

    Uso: alembic upgrade head
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
