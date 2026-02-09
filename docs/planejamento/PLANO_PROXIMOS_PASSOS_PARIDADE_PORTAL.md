# Plano de Proximos Passos - Paridade Visual Portal

Data base: 09/02/2026
Atualizado: 09/02/2026 (execucao desta etapa)

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
4. Para cada sistema: abertura da rota React, validacao do iframe legado carregado, validacao de conteudo nao vazio e interacao basica em elemento interativo.

Evidencia de execucao:
1. Comando: `npm run test:portal-smoke`
2. Resultado: `8 passed`.

---

### Passo 3 - Consolidacao de estabilidade do frame bridge
Status: EM ANDAMENTO (parcialmente concluido)

Ja concluido:
1. `main.py` com `allowed_prefixes` do `/admin/_frame-bridge` cobrindo admin + 8 sistemas.
2. Espelhos de rotas legadas dos 8 sistemas ativos em `FRONTEND_MODE=react`.

Pendente para fechar o passo:
1. Documentar operacao/diagnostico de iframe em um guia curto (ex.: `docs/admin_ui_legacy_parity.md`).
2. Registrar matriz de variaveis de ambiente e exemplos:
   - `FRONTEND_MODE`
   - `VITE_LEGACY_ADMIN_ORIGIN`
3. Revisao final de headers/politica de iframe por ambiente (dev/prod).

Critrio de aceite para fechar:
1. Sem erro recorrente de carregamento de iframe em execucao local padrao.

---

### Passo 4 - Roteiro de migracao progressiva para React nativo
Status: PENDENTE (planejado)

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

## Arquivos criados/alterados nesta rodada
1. `frontend-react/e2e/portal.visual.spec.ts` (novo)
2. `frontend-react/e2e/portal.smoke.spec.ts` (novo)
3. `frontend-react/playwright.portal-visual.config.ts` (novo)
4. `frontend-react/playwright.portal-smoke.config.ts` (novo)
5. `frontend-react/package.json` (scripts)
6. `docs/planejamento/PLANO_PROXIMOS_PASSOS_PARIDADE_PORTAL.md` (este relatorio)
