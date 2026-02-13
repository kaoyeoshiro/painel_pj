"""
Lista candidatos de limpeza/legado para reduzir ruído no repositório.

Uso:
    python scripts/list_legacy_candidates.py
    python scripts/list_legacy_candidates.py --write docs/ia/CANDIDATOS_EXCLUSAO_LEGADO_AUTO.md
"""

from __future__ import annotations

import argparse
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Candidate:
    path: str
    reason: str


DEFAULT_CANDIDATES = [
    Candidate("docs/_archive/legacy_candidates/gemini_service_original.py", "backup local de refatoração"),
    Candidate("docs/_archive/legacy_candidates/temp_diff.txt", "diff temporário"),
    Candidate("docs/_archive/legacy_candidates/tmp_main_before.py", "backup temporário de main.py"),
    Candidate("docs/_archive/legacy_candidates/TEMP_main_before.py", "backup temporário de main.py"),
    Candidate("docs/refactoring", "pasta histórica (inglês) em migração para docs/refatoracao"),
    Candidate("docs/decisoes", "pasta histórica em migração para docs/decisions"),
]


def count_references(repo_root: Path, target_path: Path) -> int:
    """
    Conta referências ao basename do arquivo/pasta no repo.
    """
    name = target_path.name
    cmd = ["rg", "-n", "--glob", "!.git/**", name, str(repo_root)]
    try:
        completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return -1

    if completed.returncode not in (0, 1):
        return -1

    lines = [line for line in completed.stdout.splitlines() if line.strip()]
    filtered = [line for line in lines if str(target_path).replace("\\", "/") not in line.replace("\\", "/")]
    return len(filtered)


def build_report(repo_root: Path) -> str:
    rows: list[str] = []
    for cand in DEFAULT_CANDIDATES:
        path = repo_root / cand.path
        exists = path.exists()
        refs = count_references(repo_root, path) if exists else 0
        status = "candidato-forte" if exists and refs == 0 else "revisar"
        rows.append(
            f"| `{cand.path}` | {'sim' if exists else 'nao'} | {refs} | {status} | {cand.reason} |"
        )

    report = [
        "# Candidatos de Limpeza (automático)",
        "",
        "| Caminho | Existe | Referencias (aprox) | Status | Motivo |",
        "|---|---:|---:|---|---|",
        *rows,
        "",
        "Legenda:",
        "- `candidato-forte`: sem referências detectadas por basename.",
        "- `revisar`: possui referências ou exige validação manual.",
    ]
    return "\n".join(report) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Lista candidatos de limpeza/legado.")
    parser.add_argument("--write", help="Arquivo markdown de saída")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    report = build_report(repo_root)

    if args.write:
        output = Path(args.write)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(report, encoding="utf-8")
        print(f"Relatorio escrito em: {output}")
        return

    print(report)


if __name__ == "__main__":
    main()

