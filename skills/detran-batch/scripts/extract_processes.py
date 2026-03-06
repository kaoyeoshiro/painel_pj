#!/usr/bin/env python3
# skills/detran-batch/scripts/extract_processes.py
"""
Etapa 1: Extrai processos do Excel DETRAN e gera fila JSON.

Entrada: acoes_2025_por_assunto.xlsx
Saida:   data/processes_queue.json

Uso:
    python skills/detran-batch/scripts/extract_processes.py
    python skills/detran-batch/scripts/extract_processes.py --limit 100
    python skills/detran-batch/scripts/extract_processes.py --preview
"""
import re
import sys
import json
import argparse
import logging
from pathlib import Path
from collections import Counter

# Adiciona skill root ao path
SCRIPT_DIR = Path(__file__).parent
SKILL_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SKILL_ROOT))

from batch_config import EXCEL_PATH, DATA_DIR, TRIBUNAL_JUSTICA, TRIBUNAL_CODIGO

logger = logging.getLogger(__name__)

_CNJ_PATTERN = re.compile(r'^\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}$')


def _is_cnj_estadual_ms(cnj: str) -> bool:
    """Verifica se CNJ e de justica estadual de MS (segmento 8, tribunal 12)."""
    match = _CNJ_PATTERN.match(cnj)
    if not match:
        return False
    justica = match.group(1)
    tribunal = match.group(2)
    return justica == TRIBUNAL_JUSTICA and tribunal == TRIBUNAL_CODIGO


def extrair_processos(excel_path: Path, limit: int | None = None) -> list[dict]:
    """Le Excel e retorna lista de processos unicos."""
    import pandas as pd

    if not excel_path.exists():
        print(f"[ERRO] Arquivo nao encontrado: {excel_path}")
        sys.exit(1)

    # Header real esta na linha 2 (row 0 = titulo, row 1 = vazia/sub-header)
    df = pd.read_excel(excel_path, header=2)
    print(f"[INFO] Excel carregado: {len(df)} linhas, colunas: {list(df.columns)}")
    print(f"[INFO] Primeiras 3 linhas:")
    print(df.head(3).to_string(index=False))
    print()

    col_cnj = df.columns[0]      # "Nº Processo"
    col_assunto = df.columns[2]   # "Assunto"

    processos = []
    for _, row in df.iterrows():
        cnj = str(row[col_cnj]).strip()
        if not cnj or cnj == "nan":
            continue
        processos.append({
            "numero_processo": cnj,
            "assunto": str(row[col_assunto]).strip(),
            "tipo_peca": "contestacao",
            "status": "pendente",
        })

    # Deduplicar por CNJ
    vistos: set[str] = set()
    unicos: list[dict] = []
    for p in processos:
        if p["numero_processo"] not in vistos:
            vistos.add(p["numero_processo"])
            unicos.append(p)

    # Filtrar CNJs que nao sao de justica estadual MS
    filtrados: list[dict] = []
    excluidos: list[dict] = []
    for p in unicos:
        cnj = p["numero_processo"]
        if _is_cnj_estadual_ms(cnj):
            filtrados.append(p)
        else:
            excluidos.append(p)
            motivo = "formato invalido" if not _CNJ_PATTERN.match(cnj) else "tribunal nao-estadual/MS"
            logger.warning(f"[FILTRO_CNJ] Excluido {cnj} — {motivo}")
            print(f"  [FILTRO] Excluido: {cnj} ({motivo})")

    if excluidos:
        print(f"[INFO] {len(excluidos)} processo(s) excluido(s) por filtro CNJ")

    if limit:
        filtrados = filtrados[:limit]

    return filtrados


def imprimir_resumo(processos: list[dict]) -> None:
    """Imprime resumo da distribuicao por assunto."""
    assuntos = Counter(p["assunto"] for p in processos)
    print(f"Total: {len(processos)} processos unicos")
    print(f"Distribuicao por assunto ({len(assuntos)} assuntos):")
    for assunto, count in assuntos.most_common(20):
        print(f"  {count:4d} | {assunto}")
    if len(assuntos) > 20:
        restantes = sum(c for _, c in assuntos.most_common()[20:])
        print(f"  {restantes:4d} | (outros {len(assuntos) - 20} assuntos)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrai processos DETRAN do Excel para JSON")
    parser.add_argument("--limit", type=int, help="Limitar quantidade de processos")
    parser.add_argument("--preview", action="store_true", help="Apenas mostra preview sem salvar")
    parser.add_argument("--excel", type=str, default=str(EXCEL_PATH), help="Caminho do Excel")
    args = parser.parse_args()

    excel_path = Path(args.excel)
    processos = extrair_processos(excel_path, args.limit)
    imprimir_resumo(processos)

    if args.preview:
        print("\n[PREVIEW] Nenhum arquivo salvo. Remova --preview para gerar o JSON.")
        return

    output_path = DATA_DIR / "processes_queue.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(processos, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[OK] Fila salva em: {output_path}")


if __name__ == "__main__":
    main()
