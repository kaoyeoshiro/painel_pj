@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ============================================================
:: Portal PGE — Script de Docker (dev)
:: ============================================================
:: Uso: dar duplo clique neste arquivo ou rodar no terminal
::
:: Opcoes:
::   docker-start.bat           → Sobe tudo (build + start)
::   docker-start.bat status    → Mostra status dos containers
::   docker-start.bat logs      → Mostra logs do app
::   docker-start.bat stop      → Para tudo (mantem dados do banco)
::   docker-start.bat reset     → Para tudo E apaga dados do banco
::   docker-start.bat rebuild   → Rebuild forcado (quando mudar requirements.txt)
::   docker-start.bat test      → Roda todos os testes de validacao
:: ============================================================

cd /d "%~dp0"

if "%1"=="" goto :start
if "%1"=="start" goto :start
if "%1"=="status" goto :status
if "%1"=="logs" goto :logs
if "%1"=="stop" goto :stop
if "%1"=="reset" goto :reset
if "%1"=="rebuild" goto :rebuild
if "%1"=="test" goto :test
echo.
echo Comando desconhecido: %1
echo.
echo Opcoes: start, status, logs, stop, reset, rebuild, test
goto :fim

:: ---- SUBIR TUDO ----
:start
echo.
echo ============================================================
echo   Portal PGE — Subindo ambiente Docker (dev)
echo ============================================================
echo.

echo [1/3] Verificando Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Docker nao esta rodando!
    echo Abra o Docker Desktop e espere ele iniciar, depois rode este script de novo.
    echo.
    goto :fim
)
echo       Docker OK

echo [2/3] Construindo imagens e subindo containers...
echo       (primeira vez demora 3-5 minutos, depois e rapido)
echo.
docker compose --profile dev up --build -d
if errorlevel 1 (
    echo.
    echo ERRO ao subir containers. Veja as mensagens acima.
    goto :fim
)

echo.
echo [3/3] Aguardando app ficar pronto...
echo       (rodando migrations e iniciando servidor)
echo.

:: Espera ate 90 segundos pelo health check
set /a tentativas=0
:aguardar
set /a tentativas+=1
if !tentativas! gtr 30 (
    echo.
    echo AVISO: App demorou mais de 90s para responder.
    echo Rode "docker-start.bat logs" para ver o que esta acontecendo.
    goto :fim
)

:: Tenta acessar /health
curl -s -o nul -w "%%{http_code}" http://localhost:8000/health 2>nul | findstr "200" >nul 2>&1
if errorlevel 1 (
    echo       Tentativa !tentativas!/30 — aguardando...
    timeout /t 3 /nobreak >nul
    goto :aguardar
)

echo.
echo ============================================================
echo   SUCESSO! Portal PGE rodando em Docker.
echo ============================================================
echo.
echo   App:    http://localhost:8000
echo   Login:  admin / admin
echo   Banco:  localhost:5433 (user: postgres, pass: postgres)
echo.
echo   Hot reload ATIVO — edite seus arquivos .py normalmente.
echo   Suas mudancas aparecem automaticamente sem precisar rebuildar.
echo.
echo   Para ver logs:    docker-start.bat logs
echo   Para parar:       docker-start.bat stop
echo.
goto :fim

:: ---- STATUS ----
:status
echo.
echo === Status dos containers ===
echo.
docker compose --profile dev ps
echo.
echo === Uso de recursos ===
echo.
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>nul
goto :fim

:: ---- LOGS ----
:logs
echo.
echo === Logs do app (Ctrl+C para sair) ===
echo.
docker compose --profile dev logs -f app
goto :fim

:: ---- STOP ----
:stop
echo.
echo Parando containers (dados do banco ficam salvos)...
docker compose --profile dev down
echo.
echo Parado. Rode "docker-start.bat" para subir de novo.
goto :fim

:: ---- RESET ----
:reset
echo.
echo ATENCAO: Isso vai APAGAR todos os dados do banco de dados Docker!
echo (Seu banco PostgreSQL local nao e afetado)
echo.
set /p confirmacao=Tem certeza? (S/N):
if /i "!confirmacao!"=="S" (
    docker compose --profile dev down -v
    echo.
    echo Tudo limpo. Rode "docker-start.bat" para comecar do zero.
) else (
    echo Cancelado.
)
goto :fim

:: ---- REBUILD ----
:rebuild
echo.
echo Rebuild forcado (sem cache)...
echo (Use quando mudar requirements.txt ou Dockerfile)
echo.
docker compose --profile dev build --no-cache
echo.
echo Rebuild concluido. Subindo...
docker compose --profile dev up -d
echo.
echo Pronto. Rode "docker-start.bat test" para validar.
goto :fim

:: ---- TESTES DE VALIDACAO ----
:test
echo.
echo ============================================================
echo   Portal PGE — Validacao do Ambiente Docker
echo ============================================================
echo.

set /a passou=0
set /a falhou=0

:: Teste 1: Docker rodando?
echo [Teste 1/7] Docker esta rodando?
docker info >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — Docker nao esta rodando
    set /a falhou+=1
    echo.
    echo Nao da para continuar os testes sem o Docker.
    goto :resultado
) else (
    echo           OK
    set /a passou+=1
)

:: Teste 2: Containers estao rodando?
echo [Teste 2/7] Containers estao rodando?
docker compose --profile dev ps --format "{{.State}}" 2>nul | findstr /i "running" >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — Containers nao estao rodando
    echo           Rode "docker-start.bat" primeiro
    set /a falhou+=1
    echo.
    echo Nao da para continuar sem os containers rodando.
    goto :resultado
) else (
    echo           OK
    set /a passou+=1
)

:: Teste 3: Postgres aceitando conexao?
echo [Teste 3/7] Banco Postgres respondendo?
docker compose --profile dev exec -T db pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — Postgres nao respondeu
    set /a falhou+=1
) else (
    echo           OK
    set /a passou+=1
)

:: Teste 4: Health check
echo [Teste 4/7] /health retorna 200?
curl -s -o nul -w "%%{http_code}" http://localhost:8000/health 2>nul | findstr "200" >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — /health nao retornou 200
    set /a falhou+=1
) else (
    echo           OK
    set /a passou+=1
)

:: Teste 5: Login funciona?
echo [Teste 5/7] Login admin/admin funciona?
curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin&password=admin" 2>nul | findstr "access_token" >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — Login nao retornou token
    set /a falhou+=1
) else (
    echo           OK
    set /a passou+=1
)

:: Teste 6: Playwright disponivel?
echo [Teste 6/7] Playwright instalado no container?
docker compose --profile dev exec -T app python -c "from playwright.sync_api import sync_playwright; print('ok')" >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — Playwright nao encontrado
    set /a falhou+=1
) else (
    echo           OK
    set /a passou+=1
)

:: Teste 7: Hot reload ativo?
echo [Teste 7/7] Uvicorn com hot reload ativo?
docker compose --profile dev logs app 2>&1 | findstr /i "reload" >nul 2>&1
if errorlevel 1 (
    echo           FALHOU — Hot reload nao detectado nos logs
    set /a falhou+=1
) else (
    echo           OK
    set /a passou+=1
)

:resultado
echo.
echo ============================================================
set /a total=!passou!+!falhou!
echo   Resultado: !passou!/!total! testes passaram
if !falhou! equ 0 (
    echo   TUDO OK! Ambiente Docker funcionando perfeitamente.
) else (
    echo   !falhou! teste(s) falharam. Verifique os erros acima.
)
echo ============================================================
echo.
goto :fim

:fim
echo.
pause
