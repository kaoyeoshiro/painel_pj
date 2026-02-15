"""
Inicializacao do banco de dados para Docker.

Problema: As migrations do Alembic foram criadas depois que o banco ja existia
(via create_all). A primeira migration assume que tabelas como 'users' ja existem.
Para banco novo (Docker), precisamos criar todas as tabelas primeiro e marcar
o Alembic como up-to-date.

Fluxo:
  1. Banco virgem → create_all + stamp head → tudo criado de uma vez
  2. Banco existente sem alembic → stamp + upgrade head (mesmo que pre_deploy.py)
  3. Banco existente com alembic → upgrade head (caso normal)

Uso: python scripts/docker_init_db.py
"""
import os
import sys
import time

# Garante que o diretorio raiz esta no path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text, inspect


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERRO: DATABASE_URL nao definida")
        sys.exit(1)

    # Railway usa postgres:// mas SQLAlchemy exige postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    # Aguarda banco ficar acessivel (Docker pode demorar a subir)
    engine = create_engine(url)
    for attempt in range(15):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[OK] Banco acessivel (tentativa {attempt + 1})")
            break
        except Exception:
            if attempt < 14:
                print(f"[...] Aguardando banco... tentativa {attempt + 1}/15")
                time.sleep(2)
            else:
                print("[ERRO] Banco nao ficou acessivel em 30s")
                sys.exit(1)

    with engine.connect() as conn:
        insp = inspect(conn)
        tables = set(insp.get_table_names())
        has_users = "users" in tables
        has_alembic = "alembic_version" in tables

        if has_alembic:
            # Banco ja tem alembic — fluxo normal
            row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            if row:
                print(f"[OK] Banco ja gerenciado pelo Alembic (versao: {row[0]})")
                print("[->] Rode: alembic upgrade head")
                return
            # Tabela existe mas vazia — refaz stamp
            if has_users:
                print("[WARN] alembic_version vazia mas banco tem tabelas")

        if has_users:
            # Banco existente sem alembic — delega para pre_deploy.py
            print("[INFO] Banco existente sem alembic — delegando para pre_deploy.py")
            print("[->] Rode: python scripts/pre_deploy.py && alembic upgrade head")
            return

        # === BANCO VIRGEM — cria tudo via create_all ===
        print("[INFO] Banco virgem detectado — criando tabelas via create_all...")

    # Importa models e Base (fora do bloco with para nao manter conexao aberta)
    # Os imports carregam todos os models no metadata do Base
    from database.connection import Base

    # Importa todos os models (mesmo imports do migrations/env.py)
    from auth.models import User  # noqa: F401
    from admin.models import PromptConfig, ConfiguracaoIA  # noqa: F401
    from admin.models_gemini_logs import GeminiApiLog  # noqa: F401
    from admin.models_performance import AdminSettings, PerformanceLog, RouteSystemMap  # noqa: F401
    from admin.models_request_perf import RequestPerfLog  # noqa: F401
    from admin.models_prompt_groups import PromptGroup, PromptSubgroup, PromptSubcategoria, CategoriaOrdem  # noqa: F401
    from admin.models_prompts import PromptModulo, PromptModuloHistorico, ModuloTipoPeca, RegraDeterministicaTipoPeca  # noqa: F401
    from sistemas.gerador_pecas.models import GeracaoPeca, VersaoPeca, FeedbackPeca  # noqa: F401
    from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento, TipoPeca  # noqa: F401
    from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON, CategoriaResumoJSONHistorico  # noqa: F401
    from sistemas.gerador_pecas.models_extraction import ExtractionQuestion, ExtractionModel, ExtractionVariable, PromptVariableUsage, PromptActivationLog  # noqa: F401
    from sistemas.gerador_pecas.models_teste_categorias import TesteDocumento, TesteObservacao  # noqa: F401
    from sistemas.gerador_pecas.models_teste_ativacao import CenarioTesteAtivacao  # noqa: F401
    from sistemas.matriculas_confrontantes.models import Analise, Registro, LogSistema, FeedbackMatricula, GrupoAnalise, ArquivoUpload  # noqa: F401
    from sistemas.assistencia_judiciaria.models import ConsultaProcesso, FeedbackAnalise  # noqa: F401
    from sistemas.pedido_calculo.models import GeracaoPedidoCalculo, FeedbackPedidoCalculo, LogChamadaIA  # noqa: F401
    from sistemas.prestacao_contas.models import GeracaoAnalise, LogChamadaIAPrestacao, FeedbackPrestacao  # noqa: F401
    from sistemas.relatorio_cumprimento.models import GeracaoRelatorioCumprimento, LogChamadaIARelatorioCumprimento, FeedbackRelatorioCumprimento  # noqa: F401
    from sistemas.classificador_documentos.models import ProjetoClassificacao, CodigoDocumentoProjeto, ExecucaoClassificacao, ResultadoClassificacao, PromptClassificacao, LogClassificacaoIA  # noqa: F401
    from sistemas.bert_training.models import BertDataset, BertRun, BertJob, BertMetric, BertLog, BertTestHistory, BertWorker  # noqa: F401
    from sistemas.cumprimento_beta.models import SessaoCumprimentoBeta, DocumentoBeta, JSONResumoBeta, ConsolidacaoBeta, ConversaBeta, PecaGeradaBeta  # noqa: F401
    from sistemas.extrator_autos.models import ExtracaoAutos  # noqa: F401

    # Cria todas as tabelas (checkfirst=True = idempotente)
    Base.metadata.create_all(engine, checkfirst=True)

    with engine.connect() as conn:
        insp = inspect(conn)
        tables_after = set(insp.get_table_names())
        print(f"[OK] {len(tables_after)} tabelas criadas via create_all")

    # Marca Alembic como up-to-date (head) — pega a ultima revisao
    import subprocess
    result = subprocess.run(
        ["alembic", "heads"],
        capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__))
    )
    head_rev = result.stdout.strip().split()[0] if result.stdout.strip() else None

    if head_rev:
        subprocess.run(
            ["alembic", "stamp", head_rev],
            cwd=os.path.dirname(os.path.dirname(__file__))
        )
        print(f"[OK] Alembic stampado em {head_rev} (head)")
    else:
        print("[WARN] Nao foi possivel determinar head do Alembic")

    print("[OK] Banco inicializado para Docker!")


if __name__ == "__main__":
    main()
