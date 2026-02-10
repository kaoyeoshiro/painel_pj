@echo off
chcp 65001 >nul
title Portal PGE - Dashboard V2 Preview

cd /d "%~dp0"

echo.
echo ========================================
echo    Dashboard V2 (TailAdmin) - Preview
echo ========================================
echo.

:: Verifica se node_modules existe
if not exist "frontend-react\node_modules" (
    echo [!] node_modules nao encontrado. Instalando dependencias...
    cd frontend-react
    call npm install --no-bin-links
    cd ..
    echo.
)

:: Ativa ambiente virtual Python
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

echo   Backend (API):    http://localhost:8000
echo   Frontend (React): http://localhost:5173/dashboard
echo.
echo   Pressione Ctrl+C em cada janela para encerrar
echo ========================================
echo.

:: Inicia o backend em uma janela separada
start "PGE Backend" cmd /k "cd /d "%~dp0" && call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: Aguarda o backend subir
echo Aguardando backend iniciar...
timeout /t 3 /noq >nul

:: Abre o browser direto no dashboard
start http://localhost:5173/dashboard

:: Inicia o Vite dev server (fica nesta janela)
echo Iniciando frontend React...
cd frontend-react
call npm run dev
