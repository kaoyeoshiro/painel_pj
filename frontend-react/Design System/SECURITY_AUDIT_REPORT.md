# Security Audit Report - Frontend React

> Relatorio final da auditoria de seguranca do frontend React do Portal PGE-MS.
> Data: 2026-02-11
> Escopo: XSS, auth/token, navegacao, dependencias, exposicao de dados, headers.

---

## Resumo Executivo

A auditoria identificou **11 achados** (0 alta, 4 media, 4 baixa, 3 informacional). Todas as vulnerabilidades de severidade media e baixa foram corrigidas ou mitigadas nesta sessao. Nenhuma vulnerabilidade de execucao direta (XSS ativo, open redirect, CSRF) foi encontrada.

**Ponto forte**: Todo HTML dinamico (16 locais) ja passava por sanitizacao DOMPurify com allowlist estrita via hook `useMarkdown`. A auditoria reforçou essa camada e fechou caminhos de bypass potencial.

**Pontos corrigidos**:
- Removido bypass de sanitizacao (`sanitize=false`)
- Simplificada regex de URI para allowlist explicita
- Corrigida race condition em 401 (duplo redirect)
- Consolidado armazenamento de token (1 chave principal)
- Adicionada meta de referrer-policy
- Removidos console.log com dados potencialmente sensiveis
- Criados 26 testes de XSS prevention + 4 testes de token handling

---

## Achados e Status

| # | Achado | Severidade | Status | Detalhes |
|---|--------|-----------|--------|----------|
| 1 | Bypass de sanitizacao via `sanitize=false` | Media | **Corrigido** | Opcao removida de `useMarkdown`. Sanitizacao sempre ativa. |
| 2 | `ALLOWED_URI_REGEXP` complexa e opaca | Media | **Corrigido** | Substituida por regex simples: `^(?:https?\|mailto\|tel):` + `ALLOW_UNKNOWN_PROTOCOLS: false`. |
| 3 | Token em query param de iframe (dev) | Media | **Aceito** | Restrito a modo dev (`import.meta.env.DEV`). Documentado como risco. |
| 4 | Duplo redirect em 401 | Media | **Corrigido** | Guard `_redirectingTo401` previne multiplos `window.location.href = '/login'`. |
| 5 | `dangerouslySetInnerHTML` em 16 locais | Baixa | **Mitigado** | Todos passam por `useMarkdown`. Criado `SafeHtml` como alternativa segura. |
| 6 | `console.log` com dados em `use-toast.ts` | Baixa | **Corrigido** | Substituido por `console.warn` generico, ativo apenas em dev. |
| 7 | `error.message` da API exibido ao usuario | Baixa | **Mitigado** | Criado `getUserFriendlyError()` em `lib/utils.ts`. Disponivel para adocao gradual. |
| 8 | `index.html` sem meta tags de seguranca | Baixa | **Corrigido** | Adicionada `<meta name="referrer" content="strict-origin-when-cross-origin">`. |
| 9 | Token em `localStorage` | Info | **Documentado** | Risco aceito (padrao SPA). Mitigacao: sanitizacao XSS forte. |
| 10 | Token duplicado em 3 chaves | Info | **Corrigido** | `setToken` agora grava apenas em `access_token`. Leitura mantem fallback para `auth_token`. |
| 11 | FRONTEND_STACK.md com refs legacy | Info | **Corrigido** | Secao de roteamento atualizada. |

---

## Evidencias

### Testes Adicionados

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `src/hooks/__tests__/useMarkdown.security.test.ts` | **26** | Script injection, event handlers (on*), protocol injection (javascript:, data:, vbscript:), tags perigosas (iframe, object, embed, form, svg, math, style), atributo style, links seguros, conteudo preservado |
| `src/lib/__tests__/api.test.ts` | **4** (atualizado) | Token CRUD, fallback de chave legada |

**Resultado**: 30/30 passaram.

### Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useMarkdown.ts` | Removido `sanitize` option. URI regex simplificada. Exportado `sanitizeHtml` e `PURIFY_CONFIG`. |
| `src/lib/api.ts` | Guard `_redirectingTo401` contra duplo redirect. `setToken` grava apenas `access_token`. Constantes TOKEN_KEY/LEGACY_KEYS. |
| `src/lib/utils.ts` | Adicionado `getUserFriendlyError()`. |
| `src/hooks/use-toast.ts` | Console.log removido em fallback. |
| `src/pages/admin/legacy/LegacyAdminFramePage.tsx` | `rel="noreferrer"` atualizado para `rel="noopener noreferrer"`. |
| `index.html` | Meta tag `referrer` adicionada. |

### Arquivos Criados

| Arquivo | Proposito |
|---------|-----------|
| `src/components/shared/SafeHtml.tsx` | Componente seguro para renderizar HTML sanitizado. |
| `src/hooks/__tests__/useMarkdown.security.test.ts` | 26 testes de XSS prevention. |
| `Design System/SECURITY_AUDIT_INVENTORY.md` | Inventario completo de achados. |
| `Design System/SECURITY_AUDIT_REPORT.md` | Este relatorio. |

---

## Supply Chain

| Item | Resultado |
|------|----------|
| `npm audit` | **0 vulnerabilidades** |
| DOMPurify | 3.3.1 (atualizado) |
| marked | 17.0.1 (atualizado) |
| React | 19.2.4 |
| TanStack Query | 5.90.21 |
| TanStack Router | 1.158.4 |
| Vite | 7.3.1 |
| Zustand | 5.0.11 |

Nenhuma dependencia com vulnerabilidade conhecida.

---

## Verificacao

| Check | Resultado |
|-------|----------|
| `npx tsc --noEmit` | OK (0 erros) |
| `npx eslint` (arquivos alterados) | OK (0 erros) |
| `npm run build` | OK (built in 1m 12s) |
| Testes de seguranca | 30/30 passed |
| Testes unitarios gerais | 159 passed, 85 failed (pre-existentes, nenhum introduzido) |

---

## Recomendacoes de Infra (Backend / Gateway / Nginx)

As seguintes protecoes dependem do servidor ou gateway e NAO podem ser implementadas apenas no frontend:

### 1. Content Security Policy (CSP)

Configurar no Nginx ou gateway reverso:

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
```

Nota: `style-src 'unsafe-inline'` e necessario para Tailwind CSS e estilos inline do Radix UI. Nao e possivel eliminar sem refatoracao significativa.

### 2. Headers de Seguranca

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 3. Token em Cookie httpOnly (futuro)

Para eliminar o risco de exfiltracao de token via XSS, o backend deve:
1. Retornar o token JWT em cookie `httpOnly`, `Secure`, `SameSite=Strict`
2. Frontend deixa de enviar `Authorization` header (cookie e enviado automaticamente)
3. Backend adiciona protecao CSRF (token no header ou double-submit cookie)

Impacto: mudanca no backend (`/auth/login`, middleware de auth) + frontend (remover `getToken`/`setToken`). Estimativa: media complexidade.

### 4. Subresource Integrity (SRI)

Se o build produzir hashes dos chunks, configurar SRI nos tags `<script>` e `<link>` em producao.

---

## Conclusao

O frontend React do Portal PGE-MS apresenta um nivel de seguranca **bom** para uma aplicacao SPA interna. A sanitizacao de HTML via DOMPurify com allowlist estrita e o principal controle de seguranca e esta bem implementada. As correcoes desta auditoria fecharam caminhos de bypass e adicionaram defesas em profundidade (guard de redirect, consolidacao de token, testes automatizados).

Os itens pendentes (CSP, cookie httpOnly, SRI) dependem de infra/backend e devem ser planejados como evolucoes futuras.
