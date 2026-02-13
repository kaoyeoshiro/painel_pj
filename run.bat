@echo off
chcp 65001 >nul
title Portal PGE-MS - Dev Server (Backend + Vite)
cd /d "%~dp0"

echo.
echo ========================================
echo    Portal PGE-MS - Dev Server
echo    Backend (uvicorn) + Frontend (Vite)
echo ========================================
echo.

:: Verifica node_modules
if not exist "frontend-react\node_modules" (
    echo [!] node_modules nao encontrado. Instalando dependencias...
    cd frontend-react
    call npm install
    cd ..
    echo.
)

:: Ativa ambiente virtual Python
call .venv\Scripts\activate.bat

:: Limpa cache Python
echo Limpando cache Python...
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" 2>nul
del /s /q *.pyc 2>nul >nul
echo Cache limpo!
echo.

echo   Frontend (Vite):  http://localhost:5173  ^<-- acesse aqui
echo   Backend (API):    http://localhost:8000
echo   API Docs:         http://localhost:8000/docs
echo.
echo   O Vite faz proxy das chamadas de API para o backend.
echo   Alteracoes no React aparecem instantaneamente (HMR).
echo.
echo   Pressione Ctrl+C em cada janela para encerrar
echo ========================================
echo.

:: Inicia o backend em uma janela separada
start "PGE Backend" cmd /k "cd /d "%~dp0" && call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: Aguarda o backend subir
echo Aguardando backend iniciar...
timeout /t 3 /nobreak >nul

:: Inicia o Vite dev server (fica nesta janela)
echo Iniciando frontend React (Vite)...
cd frontend-react
call npm run dev
