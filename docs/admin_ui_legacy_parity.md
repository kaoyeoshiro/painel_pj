# Paridade Visual Admin: Legado -> React

Data: 2026-02-09

## A) Mapa Completo de Rotas Admin

### Rotas React (`frontend-react`) e origem visual legado

| React Route | Renderização no React | Fonte visual real (legado) |
|---|---|---|
| `/admin/users` | `LegacyAdminFramePage` | `/admin/users` |
| `/admin/prompts` | `LegacyAdminFramePage` | `/admin/prompts-config` |
| `/admin/prompts-config` | `LegacyAdminFramePage` | `/admin/prompts-config` |
| `/admin/prompts-modulos` | `LegacyAdminFramePage` | `/admin/prompts-modulos` |
| `/admin/feedbacks` | `LegacyAdminFramePage` | `/admin/feedbacks` |
| `/admin/historico-gerador` | `LegacyAdminFramePage` | `/admin/gerador-pecas/historico` |
| `/admin/gerador-pecas/historico` | `LegacyAdminFramePage` | `/admin/gerador-pecas/historico` |
| `/admin/historico-pedido-calculo` | `LegacyAdminFramePage` | `/admin/pedido-calculo/debug` |
| `/admin/pedido-calculo/debug` | `LegacyAdminFramePage` | `/admin/pedido-calculo/debug` |
| `/admin/historico-prestacao-contas` | `LegacyAdminFramePage` | `/admin/prestacao-contas/debug` |
| `/admin/prestacao-contas/debug` | `LegacyAdminFramePage` | `/admin/prestacao-contas/debug` |
| `/admin/categorias-json` | `LegacyAdminFramePage` | `/admin/categorias-resumo-json` |
| `/admin/categorias-resumo-json` | `LegacyAdminFramePage` | `/admin/categorias-resumo-json` |
| `/admin/teste-categorias` | `LegacyAdminFramePage` | `/admin/categorias-resumo-json/teste` |
| `/admin/categorias-resumo-json/teste` | `LegacyAdminFramePage` | `/admin/categorias-resumo-json/teste` |
| `/admin/teste-ativacao` | `LegacyAdminFramePage` | `/admin/prompts-modulos/teste` |
| `/admin/prompts-modulos/teste` | `LegacyAdminFramePage` | `/admin/prompts-modulos/teste` |
| `/admin/variaveis` | `LegacyAdminFramePage` | `/admin/variaveis` |
| `/admin/modulos-tipo-peca` | `LegacyAdminFramePage` | `/admin/modulos-tipo-peca` |
| `/admin/config-pecas` | `LegacyAdminFramePage` | `/api/gerador-pecas/config/admin` |
| `/admin/performance` | `LegacyAdminFramePage` | `/admin/performance` |
| `/admin/tjms-docs` | `LegacyAdminFramePage` | `/admin/tjms-docs` |
| `/admin/tjms-docs/plano` | `LegacyAdminFramePage` | `/admin/tjms-docs/plano` |
| `/admin/restaurar-slugs` | `LegacyAdminFramePage` | `/admin/restaurar-slugs` |

Entrypoints:
- Router: `frontend-react/src/router.tsx`
- Componente de espelho: `frontend-react/src/pages/admin/legacy/LegacyAdminFramePage.tsx`
- Layout admin sem shell React adicional: `frontend-react/src/components/layout/AppLayout.tsx`

### Templates/entradas legadas descobertas

| Rota legada | Entrada |
|---|---|
| `/admin/users` | `frontend/templates/admin_users.html` |
| `/admin/prompts-config` | `frontend/templates/admin_prompts.html` |
| `/admin/prompts-modulos` | `frontend/templates/admin_prompts_modulos.html` |
| `/admin/feedbacks` | `frontend/templates/admin_feedbacks.html` |
| `/admin/gerador-pecas/historico` | `frontend/templates/admin_gerador_historico.html` |
| `/admin/pedido-calculo/debug` | `frontend/templates/admin_pedido_calculo_historico.html` |
| `/admin/prestacao-contas/debug` | `frontend/templates/admin_prestacao_contas_historico.html` |
| `/admin/categorias-resumo-json` | `frontend/templates/admin_categorias_json.html` |
| `/admin/categorias-resumo-json/teste` | `frontend/templates/admin_teste_categorias_json.html` |
| `/admin/prompts-modulos/teste` | `frontend/templates/admin_teste_ativacao_modulos.html` |
| `/admin/variaveis` | `frontend/templates/admin_variaveis.html` |
| `/admin/modulos-tipo-peca` | `frontend/templates/admin_modulos_tipo_peca.html` |
| `/api/gerador-pecas/config/admin` | `frontend/templates/admin_config_pecas.html` |
| `/admin/performance` | `frontend/templates/admin_performance.html` |
| `/admin/tjms-docs` | `frontend/templates/admin_tjms_docs.html` |
| `/admin/restaurar-slugs` | renderização standalone em `main.py` (template original referencia base ausente) |
| `/admin/tjms-docs/plano` | renderização markdown em `main.py` |

## B) Checklist de diferenças e correções

Correção estrutural aplicada em todas as páginas admin:
- O React passou a renderizar a tela legada real no `iframe` (`LegacyAdminFramePage`), em vez de uma reimplementação visual aproximada.
- O `AppLayout` não injeta mais header/sidebar do React em `/admin/*`, evitando deslocamento visual.
- No backend (`main.py`, modo `FRONTEND_MODE=react`), foram adicionadas rotas admin legadas para evitar recursão SPA e garantir que o `iframe` sempre carregue HTML legado.

Correções por página (escopo obrigatório + extras descobertas):
- Usuários: agora usa o HTML legado `/admin/users`.
- Prompts IA: `/admin/prompts` mapeado para legado `/admin/prompts-config`.
- Prompts Modulares: usa `/admin/prompts-modulos`.
- Dashboard Feedbacks: usa `/admin/feedbacks`.
- Histórico de Gerações: usa `/admin/gerador-pecas/historico`.
- Debug Pedido Cálculo: usa `/admin/pedido-calculo/debug`.
- Debug Prestação Contas: usa `/admin/prestacao-contas/debug`.
- Formatos JSON: usa `/admin/categorias-resumo-json`.
- Teste Categorias JSON: usa `/admin/categorias-resumo-json/teste`.
- Teste Ativação: usa `/admin/prompts-modulos/teste`.
- Variáveis de Extração: usa `/admin/variaveis`.
- Tipos de Peça: usa `/admin/modulos-tipo-peca`.
- Config Tipos de Peça: usa `/api/gerador-pecas/config/admin`.
- Logs de Performance: usa `/admin/performance`.
- Integração TJ-MS: usa `/admin/tjms-docs` e `/admin/tjms-docs/plano`.
- Restaurar Slugs (extra): página legada tinha dependência de `admin_base.html` ausente; foi criado fallback standalone em `main.py` para manter paridade funcional/visual.

## C) Testes Playwright visuais

Arquivos:
- `frontend-react/e2e/admin.visual.spec.ts`
- `frontend-react/playwright.admin-visual.config.ts`

Estratégia:
- Para cada rota admin, captura baseline do legado na hora da execução.
- Abre a rota React correspondente e valida screenshot (`toHaveScreenshot`) com `maxDiffPixelRatio: 0.01`.
- Cobre `desktop` e `mobile`.

Comando:
- `npm run test:admin-visual`

Resultado atual:
- `32 passed` (desktop + mobile).

## D) Camada de UI reutilizável

Componentes e camada de paridade efetivamente usados:
- `frontend-react/src/pages/admin/legacy/LegacyAdminFramePage.tsx`
- `frontend-react/src/router.tsx` (mapeamento React route -> rota legada)
- `frontend-react/src/components/layout/AppLayout.tsx` (shell admin sem interferência visual)
- `main.py` (exposição das rotas legadas no modo React + fallback de `restaurar-slugs`)

## E) Operação do Frame Bridge (Passo 3)

### Objetivo
Permitir que o React (Vite em outra origem) abra telas legadas em `iframe` com o mesmo token de autenticação durante desenvolvimento local.

### Fluxo técnico
1. `LegacyAdminFramePage` monta URL para `/admin/_frame-bridge?target=...&token=...`.
2. O endpoint `/admin/_frame-bridge` grava o token em `localStorage/sessionStorage` na origem do backend.
3. O bridge redireciona para a rota legada alvo (`target`), já autenticada na mesma origem.

Arquivos:
- `frontend-react/src/pages/admin/legacy/LegacyAdminFramePage.tsx`
- `main.py` (`/admin/_frame-bridge`)

### Prefixos permitidos no bridge
Atualmente permitidos no `allowed_prefixes`:
1. `/admin/`
2. `/api/gerador-pecas/config/admin`
3. `/assistencia`
4. `/matriculas`
5. `/gerador-pecas`
6. `/pedido-calculo`
7. `/prestacao-contas`
8. `/relatorio-cumprimento`
9. `/classificador`
10. `/bert-training`

Se `target` vier fora dessa lista, o bridge aplica fallback para `/admin/users`.

### Matriz de variáveis de ambiente

| Variável | Escopo | Valor padrão | Uso |
|---|---|---|---|
| `FRONTEND_MODE` | Backend FastAPI | `react` | Define se o backend serve SPA React (`react`) ou frontend Jinja legado (`legacy`). |
| `VITE_LEGACY_ADMIN_ORIGIN` | Frontend React (Vite) | vazio | Origem do backend legado para o iframe. Em dev, se vazio, `LegacyAdminFramePage` usa `http://127.0.0.1:8000`. |
| `VITE_PORTAL_NATIVE_MATRICULAS` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/matriculas`. |
| `VITE_PORTAL_NATIVE_ASSISTENCIA` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/assistencia`. |
| `VITE_PORTAL_NATIVE_CLASSIFICADOR` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/classificador`. |
| `VITE_PORTAL_NATIVE_PEDIDO_CALCULO` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/pedido-calculo`. |
| `VITE_PORTAL_NATIVE_PRESTACAO_CONTAS` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/prestacao-contas`. |
| `VITE_PORTAL_NATIVE_RELATORIO_CUMPRIMENTO` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/relatorio-cumprimento`. |
| `VITE_PORTAL_NATIVE_GERADOR_PECAS` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/gerador-pecas`. |
| `VITE_PORTAL_NATIVE_BERT_TRAINING` | Frontend React (Vite) | ausente (`nativo`) | Rollback pontual. Defina `0` para forçar fallback legado em `/bert-training`. |
| `E2E_BASE_URL` | Playwright | `http://127.0.0.1:5178` | Base URL dos testes no frontend React. |
| `E2E_LEGACY_BASE_URL` | Playwright | `http://127.0.0.1:8000` | Base URL do legado para baseline visual. |

### Segurança por ambiente (iframe)

Desenvolvimento:
1. `X-Frame-Options` não é enviado para permitir comparação visual cross-origin (`Vite -> backend`).
2. CSP inclui `frame-ancestors` com localhost/127.0.0.1 em portas 5173/5178.

Produção:
1. `X-Frame-Options: SAMEORIGIN`.
2. CSP mais restritiva (sem `unsafe-eval`).

Arquivo de referência:
- `main.py` (`SecurityHeadersMiddleware`)

### Checklist de diagnóstico rápido
1. Confirmar backend em `http://127.0.0.1:8000` e frontend em `http://127.0.0.1:5178`.
2. Confirmar `FRONTEND_MODE=react`.
3. Abrir rota React de admin/sistema e validar presença de `iframe[title="Tela administrativa legada"]`.
4. Se tela em branco:
   - verificar URL final do iframe (deve cair em rota legada válida),
   - verificar console do navegador para erro CSP/frame,
   - conferir se `target` do bridge está em `allowed_prefixes`.
5. Validar com Playwright:
   - `npm run test:admin-visual`
   - `npm run test:portal-visual`
   - `npm run test:portal-smoke`
6. Em CI/local, rode `portal-visual` e `portal-smoke` em sequencia (nao em paralelo) para evitar disputa da porta `8000`.

### Resultado operacional atual
1. Bridge ativo e validado para admin + 8 sistemas.
2. Sem falhas recorrentes de carregamento nos testes automatizados desta rodada.
