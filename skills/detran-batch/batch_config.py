# skills/detran-batch/config.py
"""
Configuracoes centralizadas do pipeline de geracao em lote DETRAN.
"""
from pathlib import Path

# === Paths ===
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # portal-pge/
SKILL_ROOT = Path(__file__).resolve().parent                   # skills/detran-batch/
DATA_DIR = SKILL_ROOT / "data"
OUTPUT_DIR = SKILL_ROOT / "output"

# Excel fonte com processos DETRAN
EXCEL_PATH = Path(r"E:\Projetos\Datasets\DETRAN\Ações 2025\acoes_2025_por_assunto.xlsx")

# === Batch ===
DEFAULT_BATCH_SIZE = 10
MAX_CONCURRENT_WORKERS = 3
PAUSE_BETWEEN_WORKERS_S = 2.0
MAX_RETRIES = 2
RETRY_BASE_DELAY_S = 5.0

# === DETRAN ===
DETRAN_GROUP_ID = 3
DEFAULT_TIPO_PECA = "contestacao"

# === Validacao CNJ ===
TRIBUNAL_JUSTICA = "8"     # Justica Estadual
TRIBUNAL_CODIGO = "12"     # TJ-MS

# === Logging ===
LOG_FILE = OUTPUT_DIR / "batch.log"
