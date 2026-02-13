# CHECKLIST DELETE LEGADO (`frontend`)
Data da verificacao: 2026-02-12

## 1. Evidencias de dependencia (ou ausencia)
## 1.1 Dependencias diretas encontradas
- Backend ainda aponta explicitamente para legado:
  - `main.py:381` -> `Jinja2Templates(directory="frontend/templates")`
  - `main.py:384` + `main.py:385` -> mount de `frontend/static` em `/static`
- Rotas admin ainda retornam templates legados:
  - `main.py:835` ate `main.py:910` (ex.: `/admin/users`, `/admin/prompts-modulos`, `/admin/performance`, etc.)
- Rotas de sistemas ainda espelham templates estaticos legados de `sistemas/*/templates`:
  - `main.py:778` ate `main.py:831` (assistencia, matriculas, gerador-pecas, pedido-calculo, prestacao-contas, relatorio-cumprimento, classificador, bert-training)
- Template legado lido por caminho hardcoded em funcao util:
  - `main.py:677` -> `BASE_DIR / "frontend" / "templates" / "admin_restaurar_slugs.html"`

## 1.2 Inventario rapido do legado
- `frontend/templates`: 19 arquivos.
- Maiores templates:
  - `frontend/templates/admin_prompts_modulos.html` (6741 linhas)
  - `frontend/templates/admin_categorias_json.html` (3655 linhas)
  - `frontend/templates/admin_teste_categorias_json.html` (2218 linhas)
- `frontend/src/sistemas` ainda possui TS legado relevante:
  - `frontend/src/sistemas/gerador_pecas/app.ts` (2905 linhas)
  - `frontend/src/sistemas/bert_training/app.ts` (1880 linhas)
  - `frontend/src/sistemas/matriculas_confrontantes/app.ts` (1609 linhas)

## 1.3 Inventario rapido do React (alvo)
- Rotas React mapeadas em `frontend-react/src/router.tsx`:
  - 39 declaracoes de `path`.
  - 29 paginas em `lazy()`.
- Build do React funciona (`npm run build` passou).

## 1.4 Build/deploy/CI e referencias cruzadas
- Deploy/start nao cita pasta `frontend` explicitamente (apenas sobe backend):
  - `Procfile`
  - `railway.toml`
  - `nixpacks.toml`
- Referencias ainda existentes fora de runtime principal:
  - `sonar-project.properties:22` inclui `frontend/templates` em `sonar.sources`.
  - `README.md:49` ainda documenta arvore com `frontend/`.
- Workflow de seguranca foca `frontend-react` para checks de frontend:
  - `.github/workflows/security.yml` (grep de `dangerouslySetInnerHTML` em `frontend-react/src`).

## 2. Resultado do "apagao controlado"
## 2.1 Procedimento executado
- Branch criada: `audit/remove-legacy-sim`.
- Renomeacao aplicada: `frontend` -> `frontend__DISABLED`.
- Validacoes rodadas:
  - `python -c "import main; print('BACKEND_IMPORT_OK')"`
  - script com `fastapi.testclient` em rotas chave.
  - `npm run build` em `frontend-react`.
- Restauracao:
  - `frontend__DISABLED` -> `frontend` (sem delete fisico).

## 2.2 Resultado observado
- `import main` sobe, mas isso nao garante runtime funcional das rotas legadas.
- Rotas admin legadas quebram sem `frontend/templates`:
  - `/admin/users` -> 500
  - `/admin/prompts-modulos` -> 500
  - Erro: `TemplateNotFound: 'admin_users.html' not found in search path: 'frontend/templates'`
- `/static` deixa de servir assets legados; requisicao em `/static/js/main.js` cai no catch-all do React (retorno HTML), o que mascararia erro de asset em runtime.
- Build do React continua passando com legado renomeado.

## 3. Veredito
## NAO (no estado atual)
- Nao e seguro deletar `frontend` agora.
- Justificativa leiga: o backend ainda usa arquivos dessa pasta para renderizar paginas administrativas antigas; apagar hoje causaria erro em rotas reais.
- Justificativa tecnica: ha dependencia hardcoded em `frontend/templates` e `frontend/static` no runtime do `main.py`.

## 4. Passo a passo seguro para deletar (quando aprovado)
1. Remover (ou redirecionar) todas as rotas `TemplateResponse` legadas de `main.py:835` ate `main.py:910` para paginas React equivalentes.
2. Remover dependencia de `Jinja2Templates(directory="frontend/templates")` e de `app.mount("/static", StaticFiles(directory="frontend/static"), ...)`.
3. Refatorar `render_admin_restaurar_slugs_response` para fonte React (ou endpoint API + pagina React), eliminando `main.py:677`.
4. Garantir que nenhum endpoint funcional dependa de `frontend/*` por busca no repo:
   - `rg -n "frontend/templates|frontend/static|TemplateResponse\\(|/static" main.py admin sistemas`
5. Repetir apagao controlado:
   - renomear `frontend` para `frontend__DISABLED`.
   - validar status 200 em rotas portal/admin React.
   - validar ausencia de 500 em rotas que antes usavam template.
6. Somente apos sucesso completo no passo 5:
   - remover pasta `frontend`.
   - ajustar documentacao (`README`, sonar config, scripts legados).
7. Fazer rollout em 2 etapas:
   - deploy 1: remover referencias runtime mantendo pasta ainda presente (fallback).
   - deploy 2: remover pasta fisicamente.

## 5. Checklist de aprovacao para delete final
- [ ] Nenhuma rota de negocio/admin retorna `TemplateResponse` legado.
- [ ] Nenhum mount aponta para `frontend/static`.
- [ ] Smoke tests de rotas React passam sem fallback legado.
- [ ] Apagao controlado validado em ambiente de homologacao.
- [ ] Monitoramento de 24h sem erro 5xx por template/asset ausente.
