# Security Audit Inventory - Frontend React

> Inventario de achados da auditoria de seguranca do frontend React do Portal PGE-MS.
> Data: 2026-02-11
> Escopo: XSS, auth/token, navegacao, dependencias, exposicao de dados, headers.

---

## Achados

| # | Achado | Severidade | Arquivo / Local | Risco e Cenario de Abuso | Correcao Proposta |
|---|--------|-----------|-----------------|--------------------------|-------------------|
| 1 | `useMarkdown` permite bypass de sanitizacao via `sanitize=false` | **Media** | `src/hooks/useMarkdown.ts:54-66` | Desenvolvedor pode desabilitar sanitizacao acidentalmente ao passar `{ sanitize: false }`. Se isso for feito com conteudo do backend (markdown gerado por IA ou input de usuario), permite XSS stored. | Remover a opcao `sanitize`. Sanitizacao SEMPRE ativa, sem opt-out. |
| 2 | `ALLOWED_URI_REGEXP` complexa e opaca | **Media** | `src/hooks/useMarkdown.ts:32` | A regex atual e a default do DOMPurify e permite alguns edge cases com protocolos desconhecidos. Pode ser confusa para revisores. | Substituir por allowlist explicita de protocolos (`https`, `http`, `mailto`, `tel`) via `ALLOWED_URI_REGEXP` simples e legivel. |
| 3 | Token JWT passado em query param de iframe (dev mode) | **Media** | `src/pages/admin/legacy/LegacyAdminFramePage.tsx:56-57` | Em modo dev, o token e colocado na URL como query param `?token=...`. Fica visivel no historico do browser, server logs do backend, e DevTools. | Documentar o risco, restringir ao modo dev (ja esta condicionado), nao enviar se token ausente. Mitigacao real requer bridge por postMessage. |
| 4 | Duplo redirect em 401 (race condition) | **Media** | `src/lib/api.ts:123-126` + `src/stores/auth-store.ts:101` | Quando `api.ts` recebe 401, faz `clearToken()` + `window.location.href = '/login'`. Se o auth-store tambem detecta e chama `logout()`, ha duplo redirect e possivel estado inconsistente. | Adicionar guard `_redirecting` no `api.ts` para evitar multiplos redirects simultaneos. |
| 5 | `dangerouslySetInnerHTML` disperso em 16 locais | **Baixa** | 10 paginas diferentes | Todos os usos passam por `useMarkdown()` que sanitiza via DOMPurify. O risco e baixo enquanto o hook for usado. Se alguem adicionar `dangerouslySetInnerHTML` sem hook, abre XSS. | Criar componente `SafeHtml` como ponto unico. Adicionar regra de lint para detectar uso direto de `dangerouslySetInnerHTML`. |
| 6 | `console.log` em fallback do `use-toast.ts` | **Baixa** | `src/hooks/use-toast.ts:12,15` | O fallback de toast (quando nao ha provider) faz `console.log` de titulo e descricao. Se toast exibir dados sensiveis (erro com token, dados de processo), eles aparecem no console do browser. | Substituir por `console.warn` sem dados de conteudo em producao. |
| 7 | `error.message` da API exibido ao usuario | **Baixa** | 50+ locais (pattern `error instanceof Error ? error.message`) | Mensagens de erro do servidor podem conter detalhes internos (nomes de tabela, stack parcial, etc.) que sao exibidos diretamente em toasts. | Criar helper `getUserFriendlyError(error)` que retorna mensagem generica para erros de servidor (5xx) e preserva mensagens amigaveis para 4xx. |
| 8 | `index.html` sem meta tags de seguranca | **Baixa** | `index.html` | Sem `Referrer-Policy` meta tag. Headers reais dependem do servidor, mas a meta e um fallback util. | Adicionar `<meta name="referrer" content="strict-origin-when-cross-origin" />`. |
| 9 | Token armazenado em `localStorage` | **Info** | `src/lib/api.ts:10-28` | Token JWT em `localStorage` e acessivel por qualquer script na mesma origem. Se houver XSS, atacante pode exfiltrar o token. E o padrao mais comum em SPAs, mas menos seguro que cookie httpOnly. | Documentar como risco aceito. Mitigacao real requer mudanca no backend (cookie httpOnly + CSRF token). No frontend: manter sanitizacao XSS forte como defesa primaria. |
| 10 | Token duplicado em 3 chaves de storage | **Info** | `src/lib/api.ts:11-14, 20-21, 26-28` | O token e armazenado em `access_token`, `auth_token` (localStorage) e `auth_token` (sessionStorage). Aumenta a superficie de exposicao sem beneficio. | Consolidar para uma unica chave (`access_token` em `localStorage`). Manter fallback de leitura para compatibilidade, mas gravar apenas em uma. |
| 11 | FRONTEND_STACK.md referencia feature flags legacy removidas | **Info** | `Design System/FRONTEND_STACK.md:379-390` | A secao sobre feature flags `VITE_PORTAL_NATIVE_*` referencia codigo que foi removido no commit de lazy loading. Documentacao desatualizada. | Atualizar a secao de roteamento para refletir a remocao dos iframes legados. |

---

## Resumo por Severidade

| Severidade | Quantidade | Observacao |
|-----------|-----------|-----------|
| **Alta** | 0 | Nenhuma vulnerabilidade de execucao direta encontrada |
| **Media** | 4 | Bypass de sanitizacao (latente), token em URL, race condition 401 |
| **Baixa** | 4 | Console logs, error messages, meta tags, dangerouslySetInnerHTML disperso |
| **Info** | 3 | Token em localStorage (aceito), chaves duplicadas, docs desatualizados |

---

## Nota sobre `dangerouslySetInnerHTML`

Todos os 16 usos de `dangerouslySetInnerHTML` no codebase passam obrigatoriamente por `useMarkdown()`, que aplica DOMPurify com allowlist estrita. Nenhum uso direto de HTML cru foi encontrado. A configuracao do DOMPurify:

- Bloqueia: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<svg>`, `<math>`, `<style>`
- Bloqueia atributos: `style`, `onclick`, `onerror`, `onload`, `onmouseover` (e todos `on*` nao listados)
- Bloqueia protocolos: `javascript:`, `vbscript:`, `data:` (exceto protocolos na allowlist)
- Forca em links: `target="_blank"` + `rel="noopener noreferrer"`

O risco residual e um desenvolvedor futuro usar `dangerouslySetInnerHTML` sem passar pelo hook.

---

## Nota sobre Open Redirect

Nenhum padrao de redirect via query param (`?next=`, `?redirect=`, `?returnUrl=`) foi encontrado no frontend. Os redirects sao todos hardcoded para `/login`. Risco de open redirect: **inexistente**.

---

## Nota sobre CSRF

O frontend usa token JWT via header `Authorization: Bearer`. Nao usa cookies para autenticacao, portanto CSRF nao e aplicavel ao modelo atual.
