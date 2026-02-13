# -*- coding: utf-8 -*-
"""
Script de sincronização automática do treinamento BERT.
Monitora o log do worker e sincroniza métricas/heartbeat com o banco.
"""

import re
import time
import sys
from datetime import datetime, timezone
from pathlib import Path

# Adiciona o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import SessionLocal
from sistemas.bert_training.models import BertJob, BertWorker, BertMetric, JobStatus


def parse_epoch_line(line: str):
    """Extrai dados de uma linha de epoch completa."""
    # Formato: Epoch 15: Train Loss = 0.1234, Val Loss = 0.4035, Val Acc = 0.8744
    match = re.search(
        r"Epoch (\d+): Train Loss = ([\d.]+), Val Loss = ([\d.]+), Val Acc = ([\d.]+)",
        line
    )
    if match:
        return {
            "epoch": int(match.group(1)),
            "train_loss": float(match.group(2)),
            "val_loss": float(match.group(3)),
            "val_accuracy": float(match.group(4))
        }
    return None


def sync_metrics(db, run_id: int, log_file: Path):
    """Sincroniza métricas do arquivo de log para o banco."""
    if not log_file.exists():
        return 0

    synced = 0
    with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            data = parse_epoch_line(line)
            if data:
                # Verifica se já existe
                existing = db.query(BertMetric).filter(
                    BertMetric.run_id == run_id,
                    BertMetric.epoch == data["epoch"]
                ).first()

                if not existing:
                    metric = BertMetric(
                        run_id=run_id,
                        epoch=data["epoch"],
                        train_loss=data["train_loss"],
                        val_loss=data["val_loss"],
                        val_accuracy=data["val_accuracy"],
                        recorded_at=datetime.now(timezone.utc)
                    )
                    db.add(metric)
                    synced += 1

    db.commit()
    return synced


def update_job_epoch(db, job_id: int, log_file: Path):
    """Atualiza a epoch atual do job baseado no log."""
    if not log_file.exists():
        return

    max_epoch = 0
    with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            # Busca linhas de epoch iniciando
            match = re.search(r"[ÉE]poca (\d+)/\d+", line)
            if match:
                epoch = int(match.group(1))
                if epoch > max_epoch:
                    max_epoch = epoch

    if max_epoch > 0:
        job = db.query(BertJob).filter(BertJob.id == job_id).first()
        if job and job.current_epoch != max_epoch:
            job.current_epoch = max_epoch
            db.commit()
            return max_epoch
    return None


def update_heartbeat(db, worker_name: str):
    """Atualiza heartbeat do worker."""
    worker = db.query(BertWorker).filter(BertWorker.name == worker_name).first()
    if worker:
        worker.last_heartbeat = datetime.now(timezone.utc)
        worker.is_active = True
        db.commit()


def main():
    """Loop principal de sincronização."""
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--log-file", required=True, help="Arquivo de log do worker")
    parser.add_argument("--run-id", type=int, required=True, help="ID do run")
    parser.add_argument("--job-id", type=int, required=True, help="ID do job")
    parser.add_argument("--worker-name", default="worker-local", help="Nome do worker")
    parser.add_argument("--interval", type=int, default=30, help="Intervalo em segundos")
    args = parser.parse_args()

    log_file = Path(args.log_file)
    print(f"Sincronizando {log_file} -> run_id={args.run_id}, job_id={args.job_id}")
    print(f"Intervalo: {args.interval}s")

    while True:
        try:
            db = SessionLocal()

            # Verifica se job ainda está ativo
            job = db.query(BertJob).filter(BertJob.id == args.job_id).first()
            if not job or job.status not in [JobStatus.TRAINING, JobStatus.CLAIMED]:
                print(f"Job {args.job_id} não está mais ativo (status={job.status if job else 'None'})")
                break

            # Sincroniza métricas
            synced = sync_metrics(db, args.run_id, log_file)
            if synced > 0:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {synced} métricas sincronizadas")

            # Atualiza epoch
            new_epoch = update_job_epoch(db, args.job_id, log_file)
            if new_epoch:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Epoch atualizada: {new_epoch}")

            # Atualiza heartbeat
            update_heartbeat(db, args.worker_name)

            db.close()

        except Exception as e:
            print(f"Erro: {e}")

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
