# admin/router.py
"""
Router de administração - Orquestrador de sub-routers.

Sub-routers:
- router_config.py: CRUD de prompts + configurações de IA + modelos de IA
- router_feedbacks.py: Dashboard, listagem, detalhes e exportação de feedbacks
- router_import.py: Importação de prompts de produção + glossário
- router_prompts.py: Gerenciamento de módulos, categorias, regras (já existente, registrado separadamente)
"""

from fastapi import APIRouter

from admin.router_config import router as config_router
from admin.router_feedbacks import router as feedbacks_router
from admin.router_import import router as import_router

router = APIRouter(prefix="/admin", tags=["Administração"])

# Inclui sub-routers (sem prefix adicional - paths preservados)
router.include_router(config_router)
router.include_router(feedbacks_router)
router.include_router(import_router)
