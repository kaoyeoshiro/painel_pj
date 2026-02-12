# PLANO DE MELHORIAS: Documentacao e Implementacao

> Gerado em 2026-02-12 a partir da analise critica dos documentos do Design System
> Priorizado por impacto: Alto > Medio > Baixo

## Sumario de Melhorias

| # | Melhoria | Tipo | Complexidade | Impacto |
|---|----------|------|--------------|---------|
| 1 | Atualizar PGE-DESIGN-SYSTEM.md | DOC | P | ALTO |
| 2 | Remover mock de useApiQuery | CODIGO | P | MEDIO |
| 3 | Remover dependencia cmdk | CODIGO | P | BAIXO |
| 4 | Investigar testes unitarios falhando | CODIGO | M | ALTO |
| 5 | Adicionar data-testid em componentes | CODIGO | M | MEDIO |
| 6 | Otimizar suite admin-supplemental | CODIGO | M | MEDIO |
| 7 | Documentar metricas Lighthouse | DOC | P | BAIXO |
| 8 | Configurar CSP no gateway | INFRA | G | ALTO |
| 9 | Migrar token para cookie httpOnly | CODIGO/BACKEND | G | ALTO |

**Legenda Complexidade:** P = Pequena (< 1h), M = Media (1-4h), G = Grande (> 4h ou depende de terceiros)

---

## Detalhamento por Item

### 1. Atualizar PGE-DESIGN-SYSTEM.md

**Tipo:** Documentacao
**Complexidade:** P (Pequena)
**Impacto:** ALTO (Evita confusao no time)

**Problema:**
O documento diz "CSS inline via objetos style" mas o projeto usa Tailwind CSS primariamente. Isso gera confusao para novos desenvolvedores.

**O que mudar na documentacao:**
- Linha 14: Trocar "CSS inline via objetos style" por "Tailwind CSS + design tokens"
- Adicionar secao sobre classes Tailwind que correspondem aos tokens
- Remover exemplos de `style={}` inline e substituir por classes Tailwind

**Arquivo:** `Design System/PGE-DESIGN-SYSTEM.md`

**Criterio de aceite:**
- Documento reflete uso real de Tailwind
- Exemplos de codigo usam classes Tailwind
- Tokens de cor mapeados para variaveis CSS/Tailwind

---

### 2. Remover mock de useApiQuery

**Tipo:** Codigo
**Complexidade:** P (Pequena)
**Impacto:** MEDIO (Limpeza de codigo morto)

**Problema:**
O hook `useApiQuery` foi removido e marcado como deprecated, mas o mock ainda existe em `src/test/setup.ts`.

**O que mudar no codigo:**
- Remover mock de `useApiQuery` em `src/test/setup.ts` (linha ~141)
- Verificar se ha outros arquivos de teste referenciando o mock

**Arquivo:** `src/test/setup.ts`

**Criterio de aceite:**
- Nenhuma referencia a `useApiQuery` em arquivos de teste
- `npm run test` continua passando

---

### 3. Remover dependencia cmdk

**Tipo:** Codigo
**Complexidade:** P (Pequena)
**Impacto:** BAIXO (Limpeza de dependencia)

**Problema:**
A dependencia `cmdk` (command palette) esta no package.json mas nenhum componente a utiliza. Tree-shaking remove do bundle, mas a dependencia pode ser removida.

**O que mudar no codigo:**
```bash
npm uninstall cmdk
```

**Opcional:** Remover `src/components/ui/command.tsx` se existir e nao for usado.

**Arquivo:** `package.json`

**Criterio de aceite:**
- `cmdk` nao aparece em package.json
- `npm run build` continua funcionando
- Nenhuma pagina quebra

---

### 4. Investigar testes unitarios falhando

**Tipo:** Codigo
**Complexidade:** M (Media)
**Impacto:** ALTO (Cobertura de testes)

**Problema:**
STATE_AUDIT_REPORT.md menciona "161 passam, 84 falham (pre-existente)". Isso indica problemas de teste nao resolvidos.

**O que mudar no codigo:**
1. Rodar `npm run test` e capturar lista de falhas
2. Categorizar falhas por tipo (harmonizacao visual, mocks desatualizados, etc.)
3. Corrigir ou marcar como skip com justificativa

**Arquivos:** Varios em `src/**/__tests__/`

**Criterio de aceite:**
- `npm run test` passa com 0 falhas ou falhas documentadas como skip
- Testes skip tem comentario explicando o motivo

---

### 5. Adicionar data-testid em componentes

**Tipo:** Codigo
**Complexidade:** M (Media)
**Impacto:** MEDIO (Melhora testes E2E)

**Problema:**
QA_ADMIN_SUPPLEMENTAL_REPORT.md menciona que varias tabs e botoes nao tem `data-testid`, dificultando selecao em testes.

**O que mudar no codigo:**
Adicionar `data-testid` nos seguintes componentes:
- Tabs de `/admin/performance` (Performance Sistema, Logs Gemini API, etc.)
- Tabs de `/admin/teste-ativacao` (Variaveis Extracao, etc.)
- Tabs de `/admin/teste-categorias` (Resultados, Visualizacao, etc.)
- Botoes de limpar filtros em varias paginas admin

**Arquivos:**
- `src/pages/admin/performance/PerformancePage.tsx`
- `src/pages/admin/teste-ativacao/TesteAtivacaoPage.tsx`
- `src/pages/admin/teste-categorias/TesteCategoriasPage.tsx`

**Criterio de aceite:**
- Tabs tem `data-testid="tab-<nome>"`
- Botoes de filtro tem `data-testid="btn-<acao>"`
- QA_ADMIN_SUPPLEMENTAL suite consegue localizar elementos

---

### 6. Otimizar suite admin-supplemental

**Tipo:** Codigo
**Complexidade:** M (Media)
**Impacto:** MEDIO (CI mais rapido)

**Problema:**
Suite `test:admin-supplemental` demora >5 minutos para executar, dificultando uso em CI.

**O que mudar no codigo:**
1. Paralelizar workers em `playwright.admin-supplemental.config.ts`
2. Reduzir timeouts e waits desnecessarios
3. Considerar dividir em suites menores

**Arquivo:** `playwright.admin-supplemental.config.ts`, `e2e/admin-supplemental/`

**Criterio de aceite:**
- Suite executa em <2 minutos
- 0 testes falhando
- Pode rodar em paralelo sem conflitos

---

### 7. Documentar metricas Lighthouse

**Tipo:** Documentacao
**Complexidade:** P (Pequena)
**Impacto:** BAIXO (Completude de metricas)

**Problema:**
PERF_BASELINE e PERF_REPORT focam em tamanho de bundle mas nao incluem metricas Core Web Vitals (LCP, FID, CLS).

**O que mudar na documentacao:**
1. Rodar Lighthouse em modo CI ou local
2. Adicionar secao "Core Web Vitals" no PERF_REPORT
3. Estabelecer budget (ex: LCP < 2.5s, CLS < 0.1)

**Arquivo:** `Design System/PERF_REPORT_FEV2026.md`

**Criterio de aceite:**
- Documento inclui metricas LCP, FID, CLS
- Budget definido para cada metrica
- Script de coleta documentado

---

### 8. Configurar CSP no gateway

**Tipo:** Infraestrutura
**Complexidade:** G (Grande, depende de ops)
**Impacto:** ALTO (Seguranca)

**Problema:**
SECURITY_AUDIT_REPORT.md recomenda Content-Security-Policy mas frontend nao controla headers.

**O que mudar (infra/nginx):**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' <api-domain>;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

**Arquivo:** Configuracao nginx/gateway (fora do frontend)

**Criterio de aceite:**
- Headers aparecem nas respostas HTTP
- Aplicacao funciona normalmente
- Nenhum recurso bloqueado por CSP

**Dependencia:** Time de infraestrutura

---

### 9. Migrar token para cookie httpOnly

**Tipo:** Codigo + Backend
**Complexidade:** G (Grande, depende de backend)
**Impacto:** ALTO (Seguranca)

**Problema:**
Token JWT em localStorage e acessivel por scripts. Se houver XSS, token pode ser exfiltrado.

**O que mudar no backend:**
1. `/auth/login` retorna token em cookie httpOnly, Secure, SameSite=Strict
2. Middleware de auth le token do cookie em vez de header Authorization
3. Adicionar protecao CSRF (double-submit cookie ou token no header)

**O que mudar no frontend:**
1. Remover `getToken()` / `setToken()` / `clearToken()`
2. Remover header `Authorization: Bearer`
3. Cookie e enviado automaticamente
4. Adicionar header CSRF se necessario

**Arquivos:**
- `src/lib/api.ts`
- `src/stores/auth-store.ts`
- Backend: `/auth/login`, middleware

**Criterio de aceite:**
- Token nao visivel em localStorage
- Token nao visivel em DevTools > Network (nao aparece em headers)
- Login/logout funcionam
- CSRF protegido

**Dependencia:** Time de backend

---

## Cronograma Sugerido

### Sprint 1 (Imediato) — CONCLUIDO
- [x] Item 1: Atualizar PGE-DESIGN-SYSTEM.md
- [x] Item 2: Remover mock de useApiQuery
- [x] Item 3: Remover dependencia cmdk

### Sprint 2 (Curto Prazo) — CONCLUIDO
- [x] Item 4: Investigar testes unitarios (84 falhas → 0 falhas, 253 testes passando)
- [x] Item 7: Documentar metricas Lighthouse (Core Web Vitals + budget + scripts)

### Sprint 3 (Medio Prazo) — CONCLUIDO
- [x] Item 5: Adicionar data-testid (PerformancePage, TesteAtivacaoPage, TesteCategoriasPage)
- [x] Item 6: Otimizar suite admin-supplemental (parallel, workers, timeouts reduzidos)

### Backlog (Depende de Terceiros)
- [ ] Item 8: Configurar CSP (infra)
- [ ] Item 9: Migrar token para cookie (backend)

---

## Acompanhamento

| Item | Responsavel | Inicio | Conclusao | Status |
|------|-------------|--------|-----------|--------|
| 1 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 2 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 3 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 4 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 5 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 6 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 7 | Claude Code | 2026-02-11 | 2026-02-11 | CONCLUIDO |
| 8 | - | - | - | PENDENTE (INFRA) |
| 9 | - | - | - | PENDENTE (BACKEND) |

Atualizar esta tabela conforme itens forem trabalhados.
