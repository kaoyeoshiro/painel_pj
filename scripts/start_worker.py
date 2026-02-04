# -*- coding: utf-8 -*-
"""
Script para iniciar o worker BERT.
Pode ser chamado manualmente ou via API.
"""

import sys
import json
import subprocess
from pathlib import Path

# Adiciona diretório raiz ao path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))


def start_worker_subprocess():
    """Inicia o worker como subprocesso independente."""
    token_file = ROOT_DIR / '.bert_worker_token'

    if not token_file.exists():
        print("Erro: Token do worker não encontrado. Registre um worker primeiro.")
        return False

    # Comando para iniciar o worker
    cmd = [
        sys.executable,
        '-c',
        '''
import sys
sys.path.insert(0, r'{}')
from sistemas.bert_training.worker.bert_worker import BertWorker
import json

token_data = json.loads(open(r'{}').read())
token = token_data['token']

worker = BertWorker(
    api_url='http://localhost:8000',
    token=token,
    models_dir='./bert_models',
    poll_interval=10
)

worker.run()
'''.format(str(ROOT_DIR), str(token_file))
    ]

    # Inicia como processo independente
    process = subprocess.Popen(
        cmd,
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0
    )

    print(f"Worker iniciado (PID: {process.pid})")
    return True


def main():
    """Entry point."""
    print("="*60)
    print("BERT WORKER - Iniciando...")
    print("="*60)

    # Verifica se já há um worker rodando
    # (simplificado - em produção usaria PID file)

    start_worker_subprocess()


if __name__ == "__main__":
    main()
