# admin/router_import.py
"""
Sub-router de administração - Importação de prompts e glossário.

Endpoints:
- GET /importar-prompts-producao — Página HTML para importar prompts (TEMPORÁRIO)
- POST /importar-prompts-producao — Executa importação de prompts
- GET /help/glossary — Retorna glossário de conceitos em Markdown
"""

import os
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from auth.dependencies import get_current_active_user, require_admin
from auth.models import User

from admin.repositories import (
    get_feedback_repo,
    FeedbackRepository,
)


router = APIRouter()


# ============================================
# Importar Prompts de Produção (TEMPORÁRIO)
# ============================================

@router.get("/importar-prompts-producao", response_class=HTMLResponse)
async def pagina_importar_prompts(
    current_user: User = Depends(require_admin)
):
    """
    Página HTML para importar prompts - TEMPORÁRIO.
    Acesse no navegador e clique no botão.
    """
    return """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Importar Prompts - Admin</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                </div>
                <h1 class="text-2xl font-bold text-gray-800">Importar Prompts</h1>
                <p class="text-gray-500 mt-2">Pedido de Cálculo e Prestação de Contas</p>
            </div>

            <div id="info" class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p class="text-sm text-blue-800">
                    <strong>O que será importado:</strong><br>
                    • 6 prompts (3 pedido_calculo + 3 prestacao_contas)<br>
                    • 9 configurações de IA (modelos e temperaturas)<br>
                    • O arquivo SQL será deletado após a importação
                </p>
            </div>

            <div id="resultado" class="hidden mb-6"></div>

            <button id="btnImportar" onclick="importarPrompts()"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2">
                <span id="btnTexto">Importar Prompts</span>
                <svg id="btnSpinner" class="hidden animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </button>

            <p class="text-xs text-gray-400 text-center mt-4">
                Endpoint temporário - será removido após uso
            </p>
        </div>

        <script>
            async function importarPrompts() {
                const btn = document.getElementById('btnImportar');
                const btnTexto = document.getElementById('btnTexto');
                const btnSpinner = document.getElementById('btnSpinner');
                const resultado = document.getElementById('resultado');
                const info = document.getElementById('info');

                btn.disabled = true;
                btnTexto.textContent = 'Importando...';
                btnSpinner.classList.remove('hidden');

                try {
                    const token = localStorage.getItem('access_token');
                    const response = await fetch('/admin/importar-prompts-producao', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        }
                    });

                    const data = await response.json();

                    info.classList.add('hidden');
                    resultado.classList.remove('hidden');

                    if (response.ok) {
                        resultado.className = 'bg-green-50 border border-green-200 rounded-xl p-4 mb-6';
                        resultado.innerHTML = `
                            <div class="flex items-center gap-2 text-green-800">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                </svg>
                                <strong>Sucesso!</strong>
                            </div>
                            <p class="text-sm text-green-700 mt-2">${data.message}</p>
                        `;
                        btn.classList.add('hidden');
                    } else {
                        resultado.className = 'bg-red-50 border border-red-200 rounded-xl p-4 mb-6';
                        resultado.innerHTML = `
                            <div class="flex items-center gap-2 text-red-800">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                                <strong>Erro</strong>
                            </div>
                            <p class="text-sm text-red-700 mt-2">${data.detail || 'Erro desconhecido'}</p>
                        `;
                        btn.disabled = false;
                        btnTexto.textContent = 'Tentar Novamente';
                        btnSpinner.classList.add('hidden');
                    }
                } catch (error) {
                    resultado.classList.remove('hidden');
                    resultado.className = 'bg-red-50 border border-red-200 rounded-xl p-4 mb-6';
                    resultado.innerHTML = `
                        <div class="flex items-center gap-2 text-red-800">
                            <strong>Erro de conexão</strong>
                        </div>
                        <p class="text-sm text-red-700 mt-2">${error.message}</p>
                    `;
                    btn.disabled = false;
                    btnTexto.textContent = 'Tentar Novamente';
                    btnSpinner.classList.add('hidden');
                }
            }
        </script>
    </body>
    </html>
    """


@router.post("/importar-prompts-producao")
async def importar_prompts_producao(
    current_user: User = Depends(require_admin),
    feedback_repo: FeedbackRepository = Depends(get_feedback_repo)
):
    """
    Importa os prompts de pedido_calculo e prestacao_contas do arquivo SQL.

    ENDPOINT TEMPORÁRIO - Deve ser removido após uso.
    Apenas para administradores.
    """
    script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scripts', 'prompts_producao.sql')

    if not os.path.exists(script_path):
        raise HTTPException(
            status_code=404,
            detail=f"Arquivo de prompts não encontrado. Já foi importado anteriormente?"
        )

    try:
        # Lê o conteúdo do script SQL
        with open(script_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Obtém o caminho do banco de dados da conexão atual
        db_path = feedback_repo.db.bind.url.database

        # Executa o script SQL diretamente
        conn = sqlite3.connect(db_path)
        conn.executescript(sql_content)
        conn.commit()
        conn.close()

        # Remove o arquivo SQL após execução bem-sucedida
        os.remove(script_path)

        return {
            "success": True,
            "message": "Prompts importados com sucesso! Arquivo SQL removido.",
            "arquivo_removido": script_path
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao importar prompts: {str(e)}"
        )


# ============================================
# Glossário de Conceitos (Ajuda)
# ============================================

@router.get("/help/glossary")
async def obter_glossario(
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna o conteúdo do glossário de conceitos do sistema.
    O glossário está em formato Markdown.
    """
    # Caminho do arquivo do glossário
    glossary_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'docs',
        'GLOSSARIO_CONCEITOS.md'
    )

    if not os.path.exists(glossary_path):
        raise HTTPException(
            status_code=404,
            detail="Arquivo de glossário não encontrado"
        )

    try:
        with open(glossary_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return {
            "success": True,
            "content": content,
            "format": "markdown"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao ler glossário: {str(e)}"
        )
