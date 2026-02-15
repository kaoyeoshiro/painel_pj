@echo off
REM =============================================================================
REM Portal PGE - Script para rodar analise SonarQube
REM =============================================================================
REM Uso: scripts\run-sonarqube.bat [start|scan|stop|status|setup|coverage]
REM =============================================================================

setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0..
set COMPOSE_FILE=%~dp0devops\docker-compose.sonarqube.yml
set SONAR_URL=http://localhost:9000
set SCANNER_VERSION=6.2.1.4610

if "%1"=="" goto help
if "%1"=="start" goto start
if "%1"=="scan" goto scan
if "%1"=="stop" goto stop
if "%1"=="status" goto status
if "%1"=="setup" goto setup
if "%1"=="coverage" goto coverage
goto help

:start
echo.
echo [1/2] Iniciando SonarQube via Docker...
docker compose -f "%COMPOSE_FILE%" up -d
if errorlevel 1 (
    echo ERRO: Falha ao iniciar containers. Docker Desktop esta rodando?
    exit /b 1
)

echo.
echo [2/2] Aguardando SonarQube ficar pronto...
echo     Isso pode levar 1-2 minutos na primeira vez...
:wait_loop
timeout /t 5 /nobreak >nul
curl -s -o nul -w "%%{http_code}" %SONAR_URL%/api/system/status 2>nul | findstr "200" >nul
if errorlevel 1 (
    echo     Ainda iniciando...
    goto wait_loop
)

echo.
echo ============================================
echo  SonarQube rodando em: %SONAR_URL%
echo  Login inicial: admin / admin
echo ============================================
echo.
echo Proximo passo:
echo   1. Acesse %SONAR_URL%
echo   2. Troque a senha padrao
echo   3. Gere um token em: My Account ^> Security ^> Generate Token
echo   4. Rode: scripts\run-sonarqube.bat scan SEU_TOKEN (gera coverage + analise)
echo      Ou: scripts\run-sonarqube.bat scan SEU_TOKEN --skip-coverage
echo.
goto end

:scan
if "%2"=="" (
    echo ERRO: Token nao informado.
    echo Uso: scripts\run-sonarqube.bat scan SEU_TOKEN [--skip-coverage]
    echo.
    echo Para gerar um token:
    echo   1. Acesse %SONAR_URL%
    echo   2. Va em: My Account ^> Security ^> Generate Tokens
    echo   3. Crie um token do tipo "Project Analysis"
    exit /b 1
)
set SONAR_TOKEN=%2

REM Verificar flag --skip-coverage
set SKIP_COVERAGE=0
if "%3"=="--skip-coverage" set SKIP_COVERAGE=1

REM --- Etapa 1: Coverage (a menos que --skip-coverage) ---
if %SKIP_COVERAGE%==1 (
    echo.
    echo [info] Coverage pulado (--skip-coverage).
) else (
    echo.
    echo === Gerando cobertura antes do scan ===
    echo.
    echo [1/2] Cobertura Python (pytest)...
    cd /d "%PROJECT_DIR%"
    python -m pytest --cov=. --cov-report=xml:coverage.xml -q --tb=no 2>nul
    if errorlevel 1 (
        echo AVISO: Alguns testes falharam, mas o relatorio de cobertura foi gerado.
    )
    if exist coverage.xml (
        echo     coverage.xml gerado com sucesso.
    ) else (
        echo     AVISO: coverage.xml nao foi gerado. Instale pytest-cov: pip install pytest-cov
    )
    echo.
    echo [2/2] Cobertura TypeScript (vitest)...
    cd /d "%PROJECT_DIR%\frontend-react"
    call npx vitest run --coverage 2>nul
    if exist coverage\lcov.info (
        echo     coverage/lcov.info gerado com sucesso.
    ) else (
        echo     AVISO: lcov.info nao foi gerado. Verifique vitest coverage config.
    )
    cd /d "%PROJECT_DIR%"
    echo.
    echo === Cobertura concluida ===
    echo.
)

REM --- Etapa 2: Verificar sonar-scanner ---
echo.
echo [scan 1/3] Verificando sonar-scanner...
where sonar-scanner >nul 2>nul
if errorlevel 1 (
    echo sonar-scanner nao encontrado no PATH.
    echo.
    echo Instalando via download direto...
    if not exist "%PROJECT_DIR%\.sonar-scanner" (
        echo Baixando sonar-scanner %SCANNER_VERSION%...
        curl -L -o "%PROJECT_DIR%\sonar-scanner.zip" "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-%SCANNER_VERSION%-windows-x64.zip"
        if errorlevel 1 (
            echo ERRO: Falha no download. Instale manualmente:
            echo   https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/
            exit /b 1
        )
        echo Extraindo...
        powershell -Command "Expand-Archive -Path '%PROJECT_DIR%\sonar-scanner.zip' -DestinationPath '%PROJECT_DIR%\.sonar-scanner' -Force"
        del "%PROJECT_DIR%\sonar-scanner.zip"
    )
    REM Encontrar o executavel dentro da pasta extraida
    for /d %%i in ("%PROJECT_DIR%\.sonar-scanner\sonar-scanner-*") do set SCANNER_BIN=%%i\bin\sonar-scanner.bat
    if not defined SCANNER_BIN (
        echo ERRO: sonar-scanner nao encontrado apos extracao.
        exit /b 1
    )
) else (
    set SCANNER_BIN=sonar-scanner
)

REM --- Etapa 3: Verificar SonarQube ---
echo.
echo [scan 2/3] Verificando SonarQube em %SONAR_URL%...
curl -s -o nul -w "%%{http_code}" %SONAR_URL%/api/system/status 2>nul | findstr "200" >nul
if errorlevel 1 (
    echo ERRO: SonarQube nao esta respondendo em %SONAR_URL%
    echo Rode primeiro: scripts\run-sonarqube.bat start
    exit /b 1
)

REM --- Etapa 4: Executar scan ---
echo.
echo [scan 3/3] Executando analise do projeto...
echo ============================================
cd /d "%PROJECT_DIR%"
"%SCANNER_BIN%" -Dsonar.token=%SONAR_TOKEN%
if errorlevel 1 (
    echo.
    echo ERRO na analise. Verifique os logs acima.
    exit /b 1
)

echo.
echo ============================================
echo  Analise concluida!
echo  Resultados em: %SONAR_URL%/dashboard?id=portal-pge
echo ============================================
goto end

:coverage
echo.
echo Gerando relatorios de cobertura para o SonarQube...
echo.

echo [1/2] Cobertura Python (pytest)...
cd /d "%PROJECT_DIR%"
python -m pytest --cov=. --cov-report=xml:coverage.xml -q --tb=no 2>nul
if errorlevel 1 (
    echo AVISO: Alguns testes falharam, mas o relatorio de cobertura foi gerado.
)
if exist coverage.xml (
    echo     coverage.xml gerado com sucesso.
) else (
    echo     AVISO: coverage.xml nao foi gerado. Instale pytest-cov: pip install pytest-cov
)

echo.
echo [2/2] Cobertura TypeScript (vitest)...
cd /d "%PROJECT_DIR%\frontend-react"
call npx vitest run --coverage 2>nul
if exist coverage\lcov.info (
    echo     coverage/lcov.info gerado com sucesso.
) else (
    echo     AVISO: lcov.info nao foi gerado. Verifique vitest coverage config.
)

cd /d "%PROJECT_DIR%"
echo.
echo Cobertura pronta. Rode 'scripts\run-sonarqube.bat scan SEU_TOKEN' para enviar.
goto end

:stop
echo.
echo Parando SonarQube...
docker compose -f "%COMPOSE_FILE%" down
echo SonarQube parado.
goto end

:status
echo.
echo === Containers ===
docker compose -f "%COMPOSE_FILE%" ps
echo.
echo === Status SonarQube ===
curl -s %SONAR_URL%/api/system/status 2>nul || echo SonarQube nao esta respondendo.
goto end

:setup
echo.
echo === Configuracao Completa do SonarQube ===
echo.
echo Pre-requisitos:
echo   - Docker Desktop rodando
echo   - ~2GB de RAM livre para o SonarQube
echo   - Python com pytest-cov (pip install pytest-cov)
echo   - Node.js com vitest (cd frontend-react ^&^& npm install)
echo.
echo Passos:
echo   1. scripts\run-sonarqube.bat start     (inicia o servidor)
echo   2. Acesse http://localhost:9000         (login: admin/admin)
echo   3. Troque a senha                       (obrigatorio no primeiro acesso)
echo   4. Gere um token de projeto             (My Account ^> Security ^> Generate Tokens)
echo   5. scripts\run-sonarqube.bat scan TOKEN (gera coverage + executa analise)
echo   6. Veja resultados em http://localhost:9000/dashboard?id=portal-pge
echo.
echo Comandos disponiveis:
echo   start    - Inicia SonarQube via Docker
echo   scan     - Gera coverage e executa analise (requer token)
echo   scan TOKEN --skip-coverage - Executa analise sem gerar coverage
echo   coverage - Gera relatorios de cobertura avulso (pytest + vitest)
echo   stop     - Para o SonarQube
echo   status   - Verifica status dos containers
echo   setup    - Mostra este guia
goto end

:help
echo.
echo Uso: scripts\run-sonarqube.bat [comando]
echo.
echo Comandos:
echo   setup    - Guia completo de configuracao
echo   start    - Inicia SonarQube (Docker)
echo   scan     - Gera coverage + executa analise (requer token)
echo   coverage - Gera relatorios de cobertura (avulso, sem scan)
echo   stop     - Para SonarQube
echo   status   - Verifica status
echo.
echo Exemplo rapido:
echo   scripts\run-sonarqube.bat start
echo   scripts\run-sonarqube.bat scan squ_abc123def456
echo   scripts\run-sonarqube.bat scan squ_abc123def456 --skip-coverage
echo.
goto end

:end
endlocal
