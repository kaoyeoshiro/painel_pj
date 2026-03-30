"""Configuracao do Bridge SAJ — lida do .env ou variaveis de ambiente."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Carrega .env da raiz do BD_PGE.NET (onde ja estao as credenciais)
_BD_PGE_ENV = Path(r"E:\Projetos\BD_PGE.NET\.env")
if _BD_PGE_ENV.exists():
    load_dotenv(_BD_PGE_ENV)

# Tambem carrega .env local se existir
_LOCAL_ENV = Path(__file__).parent / ".env"
if _LOCAL_ENV.exists():
    load_dotenv(_LOCAL_ENV, override=True)

# Oracle SAJ
ORACLE_HOST = os.getenv("DB_ORACLE_HOST", "10.2.12.215")
ORACLE_PORT = int(os.getenv("DB_ORACLE_PORT", "1521"))
ORACLE_SID = os.getenv("DB_ORACLE_SID", "SPJMS")
ORACLE_USER = os.getenv("DB_ORACLE_USER", "")
ORACLE_PASSWORD = os.getenv("DB_ORACLE_PASSWORD", "")
INSTANT_CLIENT_DIR = os.getenv("INSTANT_CLIENT_DIR", r"C:\oracle\instantclient_21_20")

# SSH Tunnel
SSH_HOST = os.getenv("RDP_HOST", "10.21.9.206")
SSH_PORT = int(os.getenv("SSH_PORT", "22"))
SSH_USER = os.getenv("RDP_USER", "")
SSH_PASSWORD = os.getenv("RDP_PASSWORD", "")

# VPN
VPN_NAME = os.getenv("VPN_NAME", "VPN-PGE")

# Seguranca
API_KEY = os.getenv("BRIDGE_API_KEY", "pge-saj-bridge-2026")

# Bridge
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "8081"))
