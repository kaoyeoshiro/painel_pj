# Plano de Proximos Passos - Paridade Visual Portal

Data base: 09/02/2026
Atualizado: 09/02/2026 (execucao desta etapa + hardening de tela vazia em frame legado)

## Objetivo
Garantir paridade visual e comportamental com o legado em todo o portal (admins + sistemas), mantendo frontend React funcional sem copiar templates HTML gigantes para componentes React.

## Escopo desta rodada
1. Continuar a execucao dos proximos passos apos admins.
2. Cobrir os 8 sistemas solicitados com testes visuais e smoke.
3. Registrar progresso por passo neste documento.

## Status consolidado por passo

Validacao complementar executada nesta rodada:
1. Suite admin visual reexecutada para garantir ausencia de regressao.
2. Comando: `npm run test:admin-visual`
3. Resultado: `32 passed`.

### Passo 1 - Cobertura visual dos 8 sistemas no Playwright
Status: CONCLUIDO

Entregas implementadas:
1. Criado `frontend-react/e2e/portal.visual.spec.ts`.
2. Criado `frontend-react/playwright.portal-visual.config.ts`.
3. Adicionado script `test:portal-visual` em `frontend-react/package.json`.
4. Cobertura desktop + mobile para:
   - `/assistencia`
   - `/matriculas`
   - `/gerador-pecas`
   - `/pedido-calculo`
   - `/prestacao-contas`
   - `/relatorio-cumprimento`
   - `/classificador`
   - `/bert-training`
5. Reuso de baseline legado com escrita automatica de snapshots.
6. Estabilizacao do caso mobile `bert-training` (modal de boas-vindas) para evitar falso negativo.

Evidencia de execucao:
1. Comando: `npm run test:portal-visual`
2. Resultado: `16 passed` (8 desktop + 8 mobile).

---

### Passo 2 - Smoke de interacoes por sistema
Status: CONCLUIDO

Entregas implementadas:
1. Criado `frontend-react/e2e/portal.smoke.spec.ts`.
2. Criado `frontend-react/playwright.portal-smoke.config.ts`.
3. Adicionado script `test:portal-smoke` em `frontend-react/package.json`.
4. Para cada sistema: abertura da rota React, validacao de carregamento (iframe legado ou pagina nativa), validacao de conteudo nao vazio e interacao basica em elemento interativo.

Evidencia de execucao:
1. Comando: `npm run test:portal-smoke`
2. Resultado: `8 passed`.

---

### Passo 3 - Consolidacao de estabilidade do frame bridge
Status: CONCLUIDO

Entregas implementadas:
1. `main.py` com `allowed_prefixes` do `/admin/_frame-bridge` cobrindo admin + 8 sistemas.
2. Espelhos de rotas legadas dos 8 sistemas ativos em `FRONTEND_MODE=react`.
3. Guia operacional documentado em `docs/admin_ui_legacy_parity.md`, com:
   - fluxo do bridge,
   - prefixos permitidos,
   - matriz de variaveis (`FRONTEND_MODE`, `VITE_LEGACY_ADMIN_ORIGIN`, `E2E_*`),
   - politica de seguranca dev/prod (`X-Frame-Options`, `CSP frame-ancestors`),
   - checklist de diagnostico.

Evidencia de execucao/estabilidade:
1. `npm run test:admin-visual` -> `32 passed`
2. `npm run test:portal-visual` -> `16 passed`
3. `npm run test:portal-smoke` -> `8 passed`

---

### Passo 4 - Roteiro de migracao progressiva para React nativo
Status: EM ANDAMENTO

Implementacao inicial concluida:
1. Canary de migracao criado para os 8 sistemas do portal:
   - `/matriculas`
   - `/assistencia`
   - `/classificador`
   - `/pedido-calculo`
   - `/prestacao-contas`
   - `/relatorio-cumprimento`
   - `/gerador-pecas`
   - `/bert-training`
2. Rotas no `frontend-react/src/router.tsx` agora suportam:
   - ausente/default -> pagina React nativa
   - `VITE_PORTAL_NATIVE_*=0` -> fallback legado via `LegacyAdminFramePage` (rollback por sistema)
3. Ajuste de suporte nos testes para modo nativo sem iframe:
   - `frontend-react/e2e/portal.visual.spec.ts` aceita fluxo com ou sem iframe
   - `frontend-react/e2e/portal.smoke.spec.ts` aceita fluxo com ou sem iframe
4. Validacoes executadas:
   - `npm run build` -> OK
   - `CI=1 VITE_PORTAL_NATIVE_MATRICULAS=1 ... portal.visual --grep matriculas` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_ASSISTENCIA=1 ... portal.visual --grep assistencia` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_CLASSIFICADOR=1 ... portal.visual --grep classificador` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_PEDIDO_CALCULO=1 ... portal.visual --grep pedido-calculo` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_PRESTACAO_CONTAS=1 ... portal.visual --grep prestacao-contas` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_RELATORIO_CUMPRIMENTO=1 ... portal.visual --grep relatorio-cumprimento` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_GERADOR_PECAS=1 ... portal.visual --grep gerador-pecas` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_BERT_TRAINING=1 ... portal.visual --grep bert-training` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_MATRICULAS=1 VITE_PORTAL_NATIVE_ASSISTENCIA=1 ... portal.smoke --grep "assistencia|matriculas"` -> `2 passed`
   - `CI=1 VITE_PORTAL_NATIVE_CLASSIFICADOR=1 ... portal.smoke --grep classificador` -> `1 passed`
   - `CI=1 VITE_PORTAL_NATIVE_PEDIDO_CALCULO=1 ... portal.smoke --grep pedido-calculo` -> `1 passed`
   - `CI=1 VITE_PORTAL_NATIVE_PRESTACAO_CONTAS=1 ... portal.smoke --grep prestacao-contas` -> `1 passed`
   - `CI=1 VITE_PORTAL_NATIVE_RELATORIO_CUMPRIMENTO=1 ... portal.smoke --grep relatorio-cumprimento` -> `1 passed`
   - `CI=1 VITE_PORTAL_NATIVE_GERADOR_PECAS=1 ... portal.smoke --grep gerador-pecas` -> `1 passed`
   - `CI=1 VITE_PORTAL_NATIVE_BERT_TRAINING=1 ... portal.smoke --grep bert-training` -> `1 passed`
5. Bateria consolidada (todos os canaries nativos ativos simultaneamente):
   - `CI=1 ... (todas as VITE_PORTAL_NATIVE_*=1) portal.visual` -> `16 passed`
   - `CI=1 ... (todas as VITE_PORTAL_NATIVE_*=1) portal.smoke` -> `8 passed`
6. Nota operacional:
   - Executar visual e smoke em sequencia (nao em paralelo), para evitar conflito de porta `8000` entre webservers de Playwright.

Ordem proposta:
1. Matriculas
2. Assistencia
3. Classificador
4. Pedido de Calculo
5. Prestacao de Contas
6. Relatorio de Cumprimento
7. Gerador de Pecas
8. BERT Training

Regra de migracao por sistema:
1. Migrar a tela para React nativo.
2. Rodar `portal.visual` contra baseline legado.
3. Rodar `portal.smoke`.
4. Trocar rota de iframe para componente React apenas se ambos verdes.

7. Rollout implementado:
   - Sistemas do portal agora usam React nativo por padrao.
   - Fallback legado passou a ser rollback explicito por variavel (`VITE_PORTAL_NATIVE_* = 0`).
8. Validacao com novo default (sem flags):
   - `portal.visual` -> `16 passed`
   - `portal.smoke` -> `8 passed`
9. Ajustes de UX solicitados na rodada atual:
   - Shell do dashboard restaurado nos sistemas nativos (header com logo centralizado + fundo cinza da aplicacao).
   - Botao de voltar no `PageHeader` alterado para versao iconica, melhor posicionada ao lado do titulo.
   - Texto duplicado no Gerador de Pecas removido (card inicial renomeado para "Dados da Geracao").
10. Validacao apos ajustes de UX:
   - `npm run build` -> OK
   - `npm run test:portal-smoke` -> `8 passed`

Proximo item imediato:
1. Planejar remocao progressiva do fallback legado por sistema (apos janela de observacao em homolog/prod).
2. Roteiro proposto de rollout (homologacao -> producao):
   - Semana 1: monitorar `matriculas`, `assistencia`, `classificador` (fallback ativo por env em caso de incidente).
   - Semana 2: monitorar `pedido-calculo`, `prestacao-contas`, `relatorio-cumprimento`.
   - Semana 3: monitorar `gerador-pecas`, `bert-training`.
3. Criterio para remover fallback de um sistema:
   - 7 dias sem regressao funcional reportada.
   - smoke do sistema passando.
   - sem necessidade de rollback no periodo.
4. Criterio para remover `LegacyAdminFramePage` dos sistemas:
   - todos os 8 sistemas com fallback removido.
   - variaveis `VITE_PORTAL_NATIVE_*` eliminadas do deploy.

---

### Passo 5 - Criterio para remover pasta legada
Status: PENDENTE (bloqueado por dependencia atual)

So remover quando TODOS forem verdadeiros:
1. Nenhuma rota React depende de `LegacyAdminFramePage`.
2. Suites visuais admin + portal 100% verdes com baseline congelado.
3. Suites smoke admin + portal 100% verdes.
4. Plano de rollback documentado.

Conclusao atual:
1. Ainda NAO e seguro remover a pasta legada.

---

### Passo 6 - Hardening contra tela vazia no frame legado
Status: CONCLUIDO

Entregas implementadas:
1. `LegacyAdminFramePage` com estado explicito de carregamento (overlay "Carregando tela legada...").
2. Timeout de carregamento do iframe com fallback amigavel:
   - default: `15s`
   - configuravel por `VITE_LEGACY_FRAME_TIMEOUT_MS`.
3. Fallback de erro com acoes de recuperacao imediata:
   - botao `Recarregar`
   - acao `Abrir em nova aba`.
4. Objetivo: evitar tela totalmente em branco/cinza quando o legado nao responde.

Evidencia de execucao:
1. `npm run build` -> OK
2. `npm run test:portal-smoke` -> `8 passed`
3. `npm run test:admin-visual` -> `32 passed`
4. `npm run test:portal-visual` -> `16 passed`

---

### Passo 7 - Calibracao de tolerancia visual (aperto de paridade)
Status: CONCLUIDO (etapa `0.12` fechada)

Rodada executada (etapa `0.18 -> 0.12`):
1. Execucao inicial em paralelo gerou falso negativo por indisponibilidade de webserver (`ERR_CONNECTION_REFUSED`), confirmando novamente necessidade de execucao sequencial.
2. Reexecucao correta em sequencia:
   - `E2E_MAX_DIFF_RATIO=0.12 npm run test:admin-visual` -> `32 passed`
   - `E2E_MAX_DIFF_RATIO=0.12 npm run test:portal-visual` -> `15 passed / 1 failed`
3. Gap residual identificado:
   - rota: `matriculas` (mobile)
   - diff: `0.13` (43741 pixels), acima do limite `0.12`.

Leitura do resultado:
1. Admin esta apto para tolerancia mais estrita (`0.12`).
2. Portal ainda depende de ajuste visual pontual em `matriculas` mobile para fechar a etapa.

Acao imediata do proximo ciclo:
1. Ajustado `matriculas` mobile para reduzir diff visual residual:
   - simplificacao do header da pagina (sem badge de icone no titulo).
   - estado vazio da lista de arquivos alinhado ao legado (sem card/icone extra).
2. Revalidacao apos ajuste:
   - `E2E_MAX_DIFF_RATIO=0.12 npx playwright test -c playwright.portal-visual.config.ts --grep "matriculas"` -> `2 passed`.
   - `E2E_MAX_DIFF_RATIO=0.12 npm run test:portal-visual` -> `16 passed`.
   - `E2E_MAX_DIFF_RATIO=0.12 npm run test:admin-visual` -> `32 passed`.
   - `npm run test:portal-smoke` -> `8 passed`.
3. Proxima etapa passa a ser `0.08`.

---

### Passo 8 - Calibracao de tolerancia visual (etapa `0.08`)
Status: EM ANDAMENTO (parcial)

Evidencias desta rodada:
1. `E2E_MAX_DIFF_RATIO=0.08 npm run test:admin-visual` -> `32 passed`.
2. `E2E_MAX_DIFF_RATIO=0.08 npm run test:portal-visual` -> `11 passed / 5 failed`.

Falhas residuais (todas mobile):
1. `assistencia` -> diff `0.09`
2. `matriculas` -> diff `0.12`
3. `pedido-calculo` -> diff `0.11`
4. `prestacao-contas` -> diff `0.12`
5. `relatorio-cumprimento` -> diff `0.09`

Leitura do status:
1. Admin ja suporta tolerancia mais agressiva (`0.08`).
2. Portal ainda precisa de ajuste fino em 5 telas mobile para concluir etapa `0.08`.
3. Threshold operacional permanece em `0.12` ate fechamento da etapa `0.08`.

Ajustes aplicados nesta iteracao:
1. `PageHeader`: botao de voltar simplificado para icone (sem container circular), alinhado ao pedido de UX.
2. Removidos icones-badge no titulo das telas:
   - `assistencia`
   - `pedido-calculo`
   - `prestacao-contas`
   - `relatorio-cumprimento`
3. Validacao apos ajustes:
   - `E2E_MAX_DIFF_RATIO=0.08` (rotas criticas) -> permanecem as mesmas 5 falhas mobile.
   - `E2E_MAX_DIFF_RATIO=0.12 npm run test:portal-visual` -> `16 passed`.
   - `npm run test:portal-smoke` -> `8 passed`.

---

## Proximos passos (sequencia pratica)
1. Corrigir divergencias mobile nas 5 rotas pendentes do portal:
   - `assistencia`
   - `matriculas`
   - `pedido-calculo`
   - `prestacao-contas`
   - `relatorio-cumprimento`
2. Revalidar `portal.visual` com `E2E_MAX_DIFF_RATIO=0.08` ate `16 passed`.
3. Somente apos fechar `0.08`, iniciar calibracao final para `0.05`.
4. Monitorar por 7 dias os logs/feedbacks de carregamento para confirmar reducao de casos de tela vazia em admin/sistemas com fallback.
5. Reduzir gradualmente tolerancia visual (`E2E_MAX_DIFF_RATIO`) para apertar paridade:
   - etapa 1: `0.18 -> 0.12`
   - etapa 2: `0.12 -> 0.08`
   - etapa 3: `0.08 -> 0.05`
6. Para cada reducao de tolerancia:
   - rodar `admin.visual`
   - rodar `portal.visual`
   - corrigir pagina divergente ate ficar verde.
7. Encerrar rollback por sistema (remocao progressiva de `VITE_PORTAL_NATIVE_*=0`) somente apos janela sem incidentes.
8. Reavaliar remocao da pasta legada apenas quando Passos 4/5 estiverem 100% fechados.

## Arquivos criados/alterados nesta rodada
1. `frontend-react/e2e/portal.visual.spec.ts` (novo)
2. `frontend-react/e2e/portal.smoke.spec.ts` (novo)
3. `frontend-react/playwright.portal-visual.config.ts` (novo)
4. `frontend-react/playwright.portal-smoke.config.ts` (novo)
5. `frontend-react/package.json` (scripts)
6. `docs/planejamento/PLANO_PROXIMOS_PASSOS_PARIDADE_PORTAL.md` (este relatorio)
7. `frontend-react/src/pages/admin/legacy/LegacyAdminFramePage.tsx` (hardening anti-tela-vazia)
8. `frontend-react/src/pages/matriculas/MatriculasPage.tsx` (ajustes de paridade mobile no estado vazio/header)
9. `frontend-react/src/components/layout/PageHeader.tsx` (botao voltar iconico)
10. `frontend-react/src/pages/assistencia/AssistenciaPage.tsx` (ajuste de header)
11. `frontend-react/src/pages/pedido-calculo/PedidoCalculoPage.tsx` (ajuste de header)
12. `frontend-react/src/pages/prestacao-contas/PrestacaoContasPage.tsx` (ajuste de header)
13. `frontend-react/src/pages/relatorio-cumprimento/RelatorioCumprimentoPage.tsx` (ajuste de header)
