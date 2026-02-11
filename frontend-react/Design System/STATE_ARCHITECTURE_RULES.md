# State Architecture Rules — Portal PGE-MS

> Regras objetivas para gerenciamento de estado no frontend React.
> Criado em 2026-02-11 como resultado da auditoria de estado.

---

## Principio Central

> **Fonte unica da verdade**: cada dado vive em exatamente UM lugar.
> - Dados do servidor → TanStack Query
> - Estado de autenticacao → Zustand (auth-store)
> - Preferencias de UI → Zustand (ui-store)
> - Estado efemero de pagina → useState/useReducer local

---

## 1. O que SEMPRE deve ficar no TanStack Query

Qualquer dado que **vem de uma API HTTP** e pode ser **cacheado, compartilhado entre componentes, ou re-fetched**.

| Tipo de dado | Exemplo | Query Key |
|--------------|---------|-----------|
| Listas/tabelas do servidor | Historico de geracoes, usuarios, categorias | `queryKeys.geradorPecas.historico()` |
| Detalhes de entidade | Detalhe de geracao, config de sistema | `queryKeys.geradorPecas.historicoDetail(id)` |
| Dados de referencia | Tipos de peca, grupos, subcategorias | `queryKeys.geradorPecas.tiposPeca()` |
| Status de servico | BERT health, status do worker | `queryKeys.extrator.bertHealth()` |
| Dados admin | Stats, configuracoes, feedbacks | `queryKeys.admin.stats()` |

**Regra**: Se dois componentes podem precisar do mesmo dado, ele DEVE estar no Query cache.

### Como fazer

```typescript
// CERTO — dado no Query cache, compartilhavel
export function useHistoricoGerador() {
  return useQuery({
    queryKey: queryKeys.geradorPecas.historico(),
    queryFn: () => geradorApi.get('/historico'),
  })
}

// ERRADO — dado em useState, nao compartilhavel
const [historico, setHistorico] = useState([])
useEffect(() => {
  geradorApi.get('/historico').then(setHistorico)
}, [])
```

---

## 2. O que SEMPRE deve ficar no Zustand

Estado **client-side** que:
- Precisa ser global (acessivel de qualquer componente na arvore)
- NAO vem de uma API (ou e resultado de uma operacao de bootstrap como auth)
- Persiste durante a sessao do usuario

| Store | Responsabilidade | Dados |
|-------|-----------------|-------|
| `auth-store` | Identidade do usuario e token JWT | `status, token, user, login(), logout()` |
| `ui-store` | Preferencias de interface | `sidebarOpen, sidebarCollapsed` |

### Excecao documentada: Auth Store faz fetch

O `auth-store.loadUser()` faz GET `/auth/me` diretamente (sem TanStack Query). Isto e **intencional**:

1. O auth precisa resolver ANTES de qualquer Query hook rodar (AuthGuard)
2. O ciclo login → token → loadUser → status precisa ser atomico no store
3. A resposta de `/auth/me` e validada com JSON Schema em runtime
4. Nao ha necessidade de cache/staleTime para dados de identidade do proprio usuario

**NAO duplicar**: NAO criar hooks Query que busquem `/auth/me`. Se precisar dos dados do usuario, use `useAuthStore(s => s.user)`.

---

## 3. O que deve ser estado local (useState)

Estado **efemero** que:
- So existe enquanto o componente esta montado
- Nao e compartilhado entre componentes
- Morre quando o usuario navega para outra pagina

| Tipo | Exemplos |
|------|----------|
| Estado de formulario | `numeroCNJ`, `tipoPeca`, `observacao`, `pdfFiles` |
| UI toggles | `showDialog`, `activeTab`, `isEditing` |
| Progresso de operacao | `progressMessage`, `agentStatuses` (durante SSE) |
| Conteudo de streaming | `streamingContent` (chunks incrementais) |
| Estado de interacao | `chatMessages`, `chatInput`, `feedbackNota` |

### Quando usar useReducer em vez de useState

Se uma pagina tem **mais de 10 useState relacionados** que formam uma maquina de estados:

```typescript
// RECOMENDADO para paginas complexas (GeradorPecas, Classificador)
type State = {
  pageState: 'idle' | 'processing' | 'resultado' | 'error'
  streamingContent: string
  agentStatuses: Record<number, AgentStatus>
  progressMessage: string
  // ...
}

type Action =
  | { type: 'START_PROCESSING' }
  | { type: 'SSE_CHUNK'; content: string }
  | { type: 'AGENT_STATUS'; agent: number; status: AgentStatus }
  | { type: 'COMPLETE'; geracaoId: number; minuta: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }
```

**Backlog**: Migrar GeradorPecasPage (~70 useState) para useReducer e candidato futuro.

---

## 4. Estado Derivado — Regras

**NUNCA armazenar** estado que pode ser calculado a partir de outro estado.

```typescript
// ERRADO — estado derivado armazenado
const [user, setUser] = useState(null)
const [isAdmin, setIsAdmin] = useState(false) // derivado de user.role

// CERTO — calcular inline ou com useMemo
const isAdmin = user?.role === 'admin'

// CERTO — ja implementado no auth-store
function deriveFromStatus(status: AuthStatus) {
  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'unknown',
  }
}
```

**Excecao pragmatica**: O auth-store armazena `isAuthenticated` e `isLoading` como campos derivados por retrocompatibilidade. Eles sao SEMPRE atualizados junto com `status` via `deriveFromStatus()`. Isto e aceitavel porque a derivacao e deterministica e acontece no mesmo `set()`.

---

## 5. Formularios, Filtros e Paginacao

| Tipo | Onde guardar | Motivo |
|------|-------------|--------|
| Campos de formulario | `useState` local | Efemero, morre ao navegar |
| Filtros de tabela/lista | `useState` local + query key | Filtro e UI, mas query key inclui filtro para cache correto |
| Paginacao | `useState` local + query key | Idem |
| Filtros persistentes (URL) | URL search params (futuro) | Permite compartilhar link com filtros |

### Pattern: Filtros que afetam Query

```typescript
const [mes, setMes] = useState('02')
const [ano, setAno] = useState('2026')

// Query key inclui filtros para cache separado por combinacao
const { data } = useQuery({
  queryKey: queryKeys.admin.users({ mes, ano }),
  queryFn: () => adminApi.get(`/users?mes=${mes}&ano=${ano}`),
})
```

---

## 6. SSE/Streaming — Politica Oficial

### Fase 1: Durante o streaming

| Item | Local | Motivo |
|------|-------|--------|
| Chunks de conteudo | `useState` ou `useRef` no componente | Atualizacao incremental, alta frequencia |
| Progresso/status | `useState` no componente | UI feedback em tempo real |
| AbortController | `useRef` | Nao causa re-render |
| EventSource ref | `useRef` | Nao causa re-render |

### Fase 2: Ao completar o streaming

| Acao | Como | Motivo |
|------|------|--------|
| Atualizar estado final | `setState` com resultado completo | Ultima versao do dado |
| Sincronizar cache | `invalidateQueries(key)` | Servidor agora tem o dado final; Query refetch atualiza cache |
| Fechar conexao | `disconnect()` ou `abortController.abort()` | Liberar recursos |

### Pattern recomendado

```typescript
// 1. Chunks em estado local
const [streamingContent, setStreamingContent] = useState('')

// 2. Ao completar, invalidar cache
const { invalidateGeradorHistorico } = useInvalidateQueries()

function handleStreamComplete(geracaoId: number, minuta: string) {
  setGeracaoId(geracaoId)
  setMinutaMarkdown(minuta)
  setPageState('resultado')
  invalidateGeradorHistorico() // sincroniza cache
}
```

### Hook useSSE (`hooks/useSSE.ts`)

Existe um hook centralizado com integracao TanStack Query. Paginas novas DEVEM usa-lo quando possivel:

```typescript
import { useSSE } from '@/hooks/useSSE'

const { isConnected, disconnect } = useSSE({
  url: '/api/endpoint-sse',
  onMessage: (chunk) => setContent(prev => prev + chunk.text),
  onComplete: () => setPageState('resultado'),
  queryClient,
  invalidateOnComplete: [queryKeys.geradorPecas.historico()],
})
```

Paginas existentes usam fetch+getReader ou EventSource diretamente. Migracao para `useSSE` e **desejavel mas nao obrigatoria** — nao quebrar o que funciona.

---

## 7. Subscricoes Zustand — Padrao

**SEMPRE** usar subscricoes seletivas para evitar re-renders desnecessarios:

```typescript
// CERTO — re-render APENAS quando user muda
const user = useAuthStore(s => s.user)

// ERRADO — re-render quando QUALQUER campo do store muda
const { user } = useAuthStore()
```

---

## 8. Invalidation — Regras

### Mutation onSuccess

Toda mutation que altera dados no servidor DEVE invalidar as queries afetadas:

```typescript
export function useExcluirGeracao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => geradorApi.delete(`/historico/${id}`),
    onSuccess: () => {
      // ESPECIFICO — so invalida historico do gerador
      queryClient.invalidateQueries({ queryKey: queryKeys.geradorPecas.historico() })
    },
  })
}
```

### Regras de invalidation

| Regra | Descricao |
|-------|-----------|
| **Especifica** | Invalidar APENAS as keys afetadas, nunca `queryClient.invalidateQueries()` sem filtro |
| **Por dominio** | Usar `queryKeys.dominio.all` quando a mutation afeta toda a lista |
| **Por entidade** | Usar `queryKeys.dominio.detail(id)` quando so uma entidade muda |
| **Dupla** | Quando mutation afeta lista E detalhe, invalidar ambos (ex: `useRestaurarVersao`) |

### NAO usar (bazuca)

```typescript
// ERRADO — invalida TUDO, incluindo dados nao relacionados
queryClient.invalidateQueries()

// ERRADO — invalida queries de outros dominios
invalidateAll()
```

### Optimistic updates

Atualmente NAO usamos optimistic updates. Para operacoes que precisem de resposta instantanea no futuro, o pattern e:

```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, (old) => /* update otimista */)
  return { previous }
},
onError: (err, _, context) => {
  queryClient.setQueryData(queryKey, context?.previous)
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey })
},
```

---

## 9. Onde colocar novos hooks

### Query hooks para dados do servidor

```
src/hooks/useQueries.ts          # Hooks centrais reutilizaveis
src/pages/<sistema>/queries.ts   # Hooks especificos de uma pagina (futuro)
```

**Regra**: Se o hook e usado por MAIS de uma pagina → `useQueries.ts`.
Se e especifico de uma pagina → pode ficar inline ou em arquivo local.

### Quando criar `features/<dominio>/`

Somente se o dominio tiver:
- 5+ hooks de query/mutation
- Tipos proprios
- Logica de negocio compartilhada entre componentes

Hoje, nenhum dominio justifica essa separacao. O `useQueries.ts` centralizado com ~450 linhas e gerenciavel.

---

## 10. Anti-Patterns — O que NAO fazer

| Anti-pattern | Consequencia | Alternativa |
|-------------|-------------|-------------|
| Guardar resposta de API no Zustand | Duplicacao de cache, stale data | Usar TanStack Query |
| Fazer fetch dentro de Zustand action | Misturar server state com client state | Usar useQuery/useMutation |
| useState para dados compartilhados | Componentes divergem | Usar Query (cache global) |
| `queryClient.invalidateQueries()` sem filtro | Todas as queries refetch | Invalidar key especifica |
| EventSource sem cleanup no unmount | Memory leak, requests orfas | useRef + close no useEffect cleanup |
| Ignorar loading/error do Query | UI incompleta | Sempre tratar `isLoading` e `error` |
| Criar novo store Zustand para dados de API | Desalinha com arquitetura | Usar Query hook |

---

## Checklist para Novos Desenvolvedores

Ao criar uma nova pagina ou feature:

- [ ] Dados do servidor? → Criar hook em `useQueries.ts` com queryKey do factory
- [ ] Mutation? → Criar hook com `onSuccess` invalidando queries afetadas
- [ ] SSE? → Usar `useSSE` hook ou fetch+getReader com invalidation ao completar
- [ ] Estado de formulario? → `useState` local
- [ ] Precisa do usuario? → `useAuthStore(s => s.user)` (seletivo)
- [ ] Precisa de UI global? → `useUiStore(s => s.campo)` (seletivo)
- [ ] Estado derivado? → Calcular inline, nao armazenar
- [ ] Filtros/paginacao? → useState local + incluir no query key
