# -*- coding: utf-8 -*-
"""
Script para sincronizar progresso do treinamento BERT com o banco.
Lê os logs do worker e atualiza o banco de dados.
"""

import re
import time
from datetime import datetime, timezone
from pathlib import Path

# Configurações
LOG_FILE = Path(r"C:\Users\kaoye\AppData\Local\Temp\claude\E--Projetos-PGE-portal-pge\tasks\b40e520.output")
JOB_ID = 3
RUN_ID = 3
TOTAL_EPOCHS = 50
POLL_INTERVAL = 15  # segundos (mais frequente para manter heartbeat ativo)


def parse_epoch_from_logs(log_content: str) -> dict:
    """Extrai informações das épocas dos logs."""
    pattern = r"Epoch (\d+): Train Loss = ([\d.]+), Val Loss = ([\d.]+), Val Acc = ([\d.]+)"
    matches = re.findall(pattern, log_content)

    epochs = {}
    for match in matches:
        epoch = int(match[0])
        epochs[epoch] = {
            'train_loss': float(match[1]),
            'val_loss': float(match[2]),
            'val_accuracy': float(match[3])
        }
    return epochs


def get_current_epoch_from_logs(log_content: str) -> int:
    """Obtém a época atual em treinamento."""
    # Procura por "Época X/50" ou "Epoch X -"
    matches = re.findall(r"[Éé]poca (\d+)/\d+|Epoch (\d+) -", log_content)
    if matches:
        last = matches[-1]
        return int(last[0] or last[1])
    return 0


def sync_to_database(epochs: dict, current_epoch: int):
    """Sincroniza dados com o banco."""
    from database.connection import engine
    from sqlalchemy import text

    with engine.connect() as conn:
        # Inserir/atualizar métricas
        for epoch, data in epochs.items():
            # Verificar se já existe
            result = conn.execute(text('''
                SELECT id FROM bert_metrics WHERE run_id = :run_id AND epoch = :epoch
            '''), {'run_id': RUN_ID, 'epoch': epoch})

            if not result.fetchone():
                conn.execute(text('''
                    INSERT INTO bert_metrics (run_id, epoch, train_loss, val_loss, val_accuracy, recorded_at)
                    VALUES (:run_id, :epoch, :train_loss, :val_loss, :val_acc, NOW())
                '''), {
                    'run_id': RUN_ID,
                    'epoch': epoch,
                    'train_loss': data['train_loss'],
                    'val_loss': data['val_loss'],
                    'val_acc': data['val_accuracy']
                })
                print(f"  + Métrica epoch {epoch}: {data['val_accuracy']:.4f}")

        # Atualizar job
        progress = (current_epoch / TOTAL_EPOCHS) * 100
        conn.execute(text('''
            UPDATE bert_jobs
            SET current_epoch = :epoch, progress_percent = :progress, status = 'training'
            WHERE id = :job_id
        '''), {'epoch': current_epoch, 'progress': progress, 'job_id': JOB_ID})

        # Atualizar heartbeat do worker
        conn.execute(text('''
            UPDATE bert_workers
            SET last_heartbeat = :now
            WHERE id = 1
        '''), {'now': datetime.now(timezone.utc)})

        conn.commit()


def main():
    print("="*60)
    print("SINCRONIZADOR DE PROGRESSO BERT")
    print("="*60)
    print(f"Log: {LOG_FILE}")
    print(f"Job ID: {JOB_ID}, Run ID: {RUN_ID}")
    print(f"Intervalo: {POLL_INTERVAL}s")
    print()

    last_epoch = 0

    while True:
        try:
            if LOG_FILE.exists():
                content = LOG_FILE.read_text(encoding='utf-8', errors='ignore')

                epochs = parse_epoch_from_logs(content)
                current_epoch = get_current_epoch_from_logs(content)

                if current_epoch > last_epoch:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Epoch {current_epoch}/{TOTAL_EPOCHS}")
                    sync_to_database(epochs, current_epoch)
                    last_epoch = current_epoch

                    # Melhor accuracy
                    if epochs:
                        best = max(epochs.values(), key=lambda x: x['val_accuracy'])
                        print(f"  Melhor: {best['val_accuracy']:.4f}")

                # Verificar se terminou
                if "Treinamento concluido" in content or current_epoch >= TOTAL_EPOCHS:
                    print("Treinamento concluído!")
                    break

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\nInterrompido pelo usuário")
            break
        except Exception as e:
            print(f"Erro: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
