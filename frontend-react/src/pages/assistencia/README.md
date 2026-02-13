# Assistência Judiciária - React SPA

Migração completa do sistema de Assistência Judiciária de Jinja2 templates para React SPA.

## Arquivos Criados

### 1. `/src/types/assistencia.ts`
Tipos TypeScript para toda a API do sistema:
- `DadosProcesso` - Dados retornados pelo TJ-MS
- `ConsultaResponse` - Resposta da consulta
- `HistoricoItem` - Item do histórico
- `ConsultaRequest` - Request para consultar
- `FeedbackRequest` - Request para feedback
- `FeedbackResponse` - Resposta de feedback
- `DocumentRequest` - Request para gerar DOCX/PDF

### 2. `/src/pages/assistencia/AssistenciaPage.tsx`
Componente principal da página com funcionalidades completas:

#### Funcionalidades Implementadas
- ✅ Consulta de processos por número CNJ
- ✅ Exibição de relatório gerado por IA
- ✅ Histórico de consultas (últimas 10)
- ✅ Sistema de feedback (correto, parcial, incorreto, erro_ia)
- ✅ Download de relatórios (DOCX e PDF)
- ✅ Reconsulta forçada (bypass cache)
- ✅ Indicador visual de cache
- ✅ Estados de loading/erro/resultado
- ✅ Exclusão de itens do histórico
- ✅ Renderização de Markdown com `marked`

#### Estados da Aplicação
- `inicial` - Tela de boas-vindas
- `loading` - Consultando processo
- `resultado` - Exibindo resultado
- `erro` - Erro na consulta

#### Componentes shadcn/ui Utilizados
- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- `Button` - Diversos variants e sizes
- `Input` - Campo de entrada CNJ
- `Badge` - Indicadores visuais
- `ScrollArea` - Área rolável para histórico
- `Skeleton` - Loading do histórico
- Toast notifications (via `useToast`)

#### Hooks Utilizados
- `useQuery` (@tanstack/react-query) - Query com cache, loading/error/data
- `useToast` - Notificações toast
- `useState`, `useCallback`, `useMemo`, `useEffect` - React hooks padrão

### 3. `/src/pages/assistencia/__tests__/AssistenciaPage.test.tsx`
Suite de testes com 5 casos:
1. ✅ Deve renderizar sem erros
2. ✅ Deve mostrar loading enquanto busca histórico
3. ✅ Deve mostrar histórico quando API retorna sucesso
4. ✅ Deve mostrar mensagem quando não há histórico
5. ✅ Deve exibir estado inicial por padrão

## Endpoints Utilizados

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/assistencia/api/historico` | Lista histórico do usuário |
| POST | `/assistencia/api/consultar` | Consulta processo no TJ-MS |
| POST | `/assistencia/api/feedback` | Envia feedback da análise |
| GET | `/assistencia/api/feedback/{id}` | Obtém feedback existente |
| DELETE | `/assistencia/api/historico/{id}` | Remove item do histórico |
| POST | `/assistencia/api/generate-doc` | Gera DOCX ou PDF |

## Diferenças do Legacy

### Melhorias Visuais
- ✨ Design moderno com shadcn/ui
- ✨ Transições e animações suaves
- ✨ Skeleton loading no histórico
- ✨ Layout responsivo melhorado
- ✨ Feedback visual aprimorado (badges, cores)

### Melhorias Técnicas
- ✅ TypeScript completo (type-safe)
- ✅ Hooks React modernos
- ✅ Componentes reutilizáveis
- ✅ Testes automatizados
- ✅ Separação de concerns (types, components, tests)
- ✅ Renderização de Markdown com `marked` (mais robusta)

### Paridade Funcional
- ✅ 100% de paridade com template Jinja2
- ✅ Todos os endpoints integrados
- ✅ Sistema de feedback completo
- ✅ Download DOCX/PDF preservado
- ✅ Cache indicator mantido

## Como Testar

```bash
# Compilar TypeScript
node node_modules/typescript/bin/tsc --noEmit

# Rodar testes
node node_modules/vitest/vitest.mjs run src/pages/assistencia

# Dev server (se configurado)
npm run dev
```

## Próximos Passos

1. Adicionar rota no router principal (`/assistencia-judiciaria`)
2. Adicionar ao menu de navegação
3. Testar integração end-to-end com backend
4. Ajustar estilos de Markdown se necessário (prose classes)
5. Adicionar analytics/tracking se necessário

## Notas Técnicas

- O sistema usa `marked` para renderização de Markdown
- As classes `prose` do Tailwind CSS estilizam o conteúdo Markdown
- O download de documentos usa a API blob do fetch
- O feedback só pode ser enviado uma vez por consulta
- O histórico é limitado a 50 itens (API) mas exibe apenas 10 (UI)
