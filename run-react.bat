@echo off
chcp 65001 >nul
title Portal PGE-MS - React Dev

cd /d "%~dp0"

echo.
echo ========================================
echo    Portal PGE-MS - React Dev
echo ========================================
echo.

:: Verifica se node_modules existe
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

echo   Backend (API):    http://localhost:8000
echo   Frontend (React): http://localhost:5173  ^<-- acesse aqui
echo   API Docs:         http://localhost:8000/docs
echo.
echo   Pressione Ctrl+C em cada janela para encerrar
echo ========================================
echo.

:: Inicia o backend em uma janela separada
start "PGE Backend" cmd /k "cd /d "%~dp0" && call .venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: Aguarda o backend subir
echo Aguardando backend iniciar...
timeout /t 3 /noq >nul

:: Inicia o Vite dev server (fica nesta janela)
echo Iniciando frontend React...
cd frontend-react
call npm run dev
