# Plano de Execucao — React SPA (Portal PGE-MS)

> **Stack escolhida:** React + Vite + shadcn/ui + Tanstack Router + Zustand
>
> **Para quem e este documento:** Voce (Kaoye) vai copiar e colar os prompts
> no Claude Code. Cada prompt e uma tarefa isolada, com verificacao ao final.
>
> **Pre-requisito:** Ter o Claude Code aberto na pasta `E:\Projetos\PGE\portal-pge`.
>
> **Estrategia:** Strangler Fig Pattern — o frontend React cresce ao lado do
> legado (Jinja2), sistema por sistema, ate substituir tudo. Em nenhum momento
> o portal fica fora do ar.

---

## Indice

- [FASE 0 — Git + Projeto React](#fase-0--git--projeto-react)
- [FASE 1 — Infraestrutura React](#fase-1--infraestrutura-react)
- [FASE 2 — Design System (shadcn/ui)](#fase-2--design-system-shadcnui)
- [FASE 3 — Layout Shell + Auth](#fase-3--layout-shell--auth)
- [FASE 4 — Hooks Reutilizaveis](#fase-4--hooks-reutilizaveis)
- [FASE 5 — Paginas Simples](#fase-5--paginas-simples)
- [FASE 6 — Sistemas Medios](#fase-6--sistemas-medios)
- [FASE 7 — Sistemas Complexos](#fase-7--sistemas-complexos)
- [FASE 8 — Admin Pages](#fase-8--admin-pages)
- [FASE 9 — Cutover Final](#fase-9--cutover-final)
- [Apendice A — Mapa de Rotas](#apendice-a--mapa-de-rotas)
- [Apendice B — Glossario React para Leigos](#apendice-b--glossario-react-para-leigos)
- [Apendice C — Emergencia](#apendice-c--emergencia)

---

## Convencoes

- 📋 **PROMPT** = copie e cole no Claude Code
- ✅ **TESTE** = como verificar se funcionou
- 💾 **COMMIT** = salvar progresso
- ⚠️ **ATENCAO** = cuidado especial
- 📖 **EXPLICACAO** = o que aquele passo faz
- 🌐 **NAVEGADOR** = verifique visualmente na pagina

---

## FASE 0 — Git + Projeto React

### 📖 O que e esta fase?

Criamos uma branch separada e um projeto React DENTRO do repositorio
existente. O React vai viver na pasta `frontend-react/` ao lado do
frontend legado (`frontend/`). Os dois coexistem.

---

### Passo 0.1 — Criar branch

📋 **PROMPT:**
```
Verifique o git status. Se houver mudancas pendentes, liste para mim.
Depois, crie uma branch chamada "feat/react-spa" a partir da main e mude para ela.
Confirme com "git branch" que estamos nela.
```

---

### Passo 0.2 — Criar projeto Vite + React + TypeScript

📋 **PROMPT:**
```
Crie um novo projeto React com Vite DENTRO deste repositorio.

Use o seguinte comando na raiz do projeto (E:\Projetos\PGE\portal-pge):
  npm create vite@latest frontend-react -- --template react-ts

Depois de criar, entre na pasta frontend-react/ e:
1. Rode "npm install"
2. Confirme que funciona com "npm run dev" (e depois pare)
3. Me mostre a estrutura de pastas criada

NAO altere nada no frontend/ existente (legado).
```

✅ **TESTE:** O Vite deve abrir em http://localhost:5173 com a pagina padrao do React.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): scaffold projeto React + Vite + TypeScript"
```

---

### Passo 0.3 — Instalar dependencias do stack

📋 **PROMPT:**
```
Dentro da pasta frontend-react/, instale as seguintes dependencias:

Dependencias de producao:
  npm install @tanstack/react-router zustand marked dompurify
  npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
  npm install @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-select
  npm install @radix-ui/react-checkbox @radix-ui/react-switch
  npm install @radix-ui/react-tooltip @radix-ui/react-popover
  npm install class-variance-authority clsx tailwind-merge lucide-react
  npm install cmdk

Dependencias de desenvolvimento:
  npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer
  npm install -D @types/dompurify @types/marked
  npm install -D vitest @testing-library/react @testing-library/jest-dom
  npm install -D @testing-library/user-event jsdom
  npm install -D @tanstack/router-devtools

Depois de instalar, confirme que nao houve erros.
Me mostre o package.json final.
```

📖 **EXPLICACAO:**
- `@tanstack/react-router` = roteamento tipo-seguro (substitui React Router)
- `zustand` = gerenciamento de estado simples (~1KB, sem boilerplate)
- `@radix-ui/*` = primitivos de UI acessiveis (base do shadcn/ui)
- `class-variance-authority` + `clsx` + `tailwind-merge` = utilidades do shadcn/ui
- `lucide-react` = icones (substitui Font Awesome)
- `vitest` + `@testing-library/*` = testes unitarios
- `cmdk` = command palette (busca rapida, opcional mas poderoso)

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): instalar dependencias do stack React"
```

---

## FASE 1 — Infraestrutura React

### 📖 O que e esta fase?

Configuramos Tailwind, shadcn/ui, a estrutura de pastas e o proxy
para o backend FastAPI.

---

### Passo 1.1 — Configurar Tailwind CSS

📋 **PROMPT:**
```
Configure o Tailwind CSS no projeto frontend-react/.

1. Crie o arquivo frontend-react/tailwind.config.ts com:
   - O tema customizado do Portal PGE (cores primary, pge, accent)
   - Aqui estao as cores exatas que usamos (confira o login.html):
     primary: { 50: '#f0f9ff', 100: '#e0f2fe', 500: '#0ea5e9',
                600: '#0284c7', 700: '#0369a1', 800: '#075985' }
     pge: { blue: '#1e3a5f', orange: '#e67e22' }
   - Content apontando para: ./src/**/*.{ts,tsx}
   - As extensoes necessarias para o shadcn/ui (borderRadius, keyframes, animation)

2. Crie frontend-react/src/index.css com as diretivas do Tailwind:
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   Adicione tambem as CSS variables que o shadcn/ui precisa (background,
   foreground, card, popover, primary, etc.) — use as cores do PGE.

3. Atualize o vite.config.ts para usar o plugin @tailwindcss/vite se disponivel,
   ou configure postcss.

4. Apague os arquivos CSS padrao do Vite (App.css, index.css antigo).

Comentarios em portugues.
```

✅ **TESTE:**
```
Rode "npm run dev" no frontend-react/.
A pagina deve carregar com Tailwind funcionando.
Teste: adicione uma <div className="bg-primary-600 text-white p-4">Teste</div>
no App.tsx e veja se aparece azul.
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): configurar Tailwind CSS com tema PGE"
```

---

### Passo 1.2 — Configurar shadcn/ui

📋 **PROMPT:**
```
Configure o shadcn/ui no projeto frontend-react/.

1. Crie o arquivo frontend-react/components.json (configuracao do shadcn/ui):
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "default",
     "rsc": false,
     "tsx": true,
     "tailwind": {
       "config": "tailwind.config.ts",
       "css": "src/index.css",
       "baseColor": "slate",
       "cssVariables": true
     },
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils",
       "ui": "@/components/ui",
       "hooks": "@/hooks",
       "lib": "@/lib"
     }
   }

2. Crie o arquivo frontend-react/src/lib/utils.ts com a funcao cn():
   import { type ClassValue, clsx } from "clsx"
   import { twMerge } from "tailwind-merge"
   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
   }

3. Configure os path aliases no tsconfig.json:
   "@/*" → "./src/*"

4. Configure os path aliases no vite.config.ts (resolve.alias).

5. Instale os seguintes componentes shadcn/ui executando os comandos
   (ou crie os arquivos manualmente seguindo a documentacao):
   - button
   - card
   - dialog (modal)
   - input
   - label
   - table
   - badge
   - toast / sonner
   - tabs
   - select
   - dropdown-menu
   - command (cmdk)
   - separator
   - skeleton (loading)
   - textarea
   - form (react-hook-form + zod)
   - alert
   - sheet (sidebar drawer)
   - scroll-area
   - tooltip

   Para cada um, crie o arquivo em frontend-react/src/components/ui/
   seguindo a documentacao do shadcn/ui (https://ui.shadcn.com/docs/components/).
   Se nao conseguir usar o CLI do shadcn, crie manualmente copiando o codigo
   da documentacao oficial.

Comentarios em portugues onde fizer sentido.
```

⚠️ **ATENCAO:** Este passo e o mais longo da Fase 1. Pode levar varias
iteracoes com o Claude Code. Se ele nao conseguir instalar via CLI,
peca para criar os arquivos manualmente.

✅ **TESTE:**
```
Rode "npm run dev". No App.tsx, importe e renderize um botao:
  import { Button } from "@/components/ui/button"
  <Button variant="default">Clique aqui</Button>
Deve aparecer estilizado.
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): configurar shadcn/ui com componentes base"
```

---

### Passo 1.3 — Configurar proxy para o backend FastAPI

📋 **PROMPT:**
```
Configure o Vite para fazer proxy das chamadas API para o backend FastAPI.

No frontend-react/vite.config.ts, adicione:

server: {
  port: 5173,
  proxy: {
    '/auth': 'http://localhost:8000',
    '/users': 'http://localhost:8000',
    '/admin': 'http://localhost:8000',
    '/api': 'http://localhost:8000',
    '/assistencia/api': 'http://localhost:8000',
    '/matriculas/api': 'http://localhost:8000',
    '/gerador-pecas/api': 'http://localhost:8000',
    '/pedido-calculo/api': 'http://localhost:8000',
    '/prestacao-contas/api': 'http://localhost:8000',
    '/relatorio-cumprimento/api': 'http://localhost:8000',
    '/cumprimento-beta': 'http://localhost:8000',
    '/classificador/api': 'http://localhost:8000',
    '/bert-training/api': 'http://localhost:8000',
    '/extrator-autos/api': 'http://localhost:8000',
    '/gerador-pecas-admin': 'http://localhost:8000',
    '/pedido-calculo-admin': 'http://localhost:8000',
    '/logo': 'http://localhost:8000',
    '/static': 'http://localhost:8000',
    '/health': 'http://localhost:8000',
  }
}

Isso faz com que o React em desenvolvimento encaminhe chamadas API
para o FastAPI rodando na porta 8000. Sem isso, daria erro de CORS.

Comentarios em portugues.
```

✅ **TESTE:**
```
1. Inicie o FastAPI: uvicorn main:app --reload (porta 8000)
2. Inicie o React: npm run dev (porta 5173)
3. No console do navegador em localhost:5173, rode:
   fetch('/auth/me').then(r => r.json()).then(console.log)
   Deve retornar 401 (nao autenticado) — isso e CORRETO, significa que
   o proxy esta funcionando (a request chegou ao FastAPI).
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): configurar proxy Vite para FastAPI"
```

---

### Passo 1.4 — Estrutura de pastas

📋 **PROMPT:**
```
Organize a estrutura de pastas do frontend-react/src/ da seguinte forma:

frontend-react/src/
├── components/
│   ├── ui/              # Componentes shadcn/ui (ja criados)
│   ├── layout/          # Shell, Header, Sidebar (criaremos depois)
│   └── shared/          # Componentes customizados reutilizaveis
├── hooks/               # Custom hooks (useAuth, useSSE, etc.)
├── lib/
│   ├── utils.ts         # cn() ja existe
│   ├── api.ts           # Cliente API tipado
│   └── constants.ts     # Constantes (rotas, configs)
├── pages/               # Uma pasta por sistema/pagina
│   ├── login/
│   ├── dashboard/
│   ├── gerador-pecas/
│   ├── extrator-autos/
│   ├── classificador/
│   ├── pedido-calculo/
│   ├── prestacao-contas/
│   ├── relatorio-cumprimento/
│   ├── cumprimento-beta/
│   ├── assistencia/
│   ├── matriculas/
│   ├── bert-training/
│   └── admin/
│       ├── users/
│       ├── prompts/
│       ├── prompts-modulos/
│       ├── feedbacks/
│       ├── performance/
│       ├── variaveis/
│       ├── categorias-json/
│       ├── historico-gerador/
│       ├── historico-pedido-calculo/
│       ├── historico-prestacao-contas/
│       ├── modulos-tipo-peca/
│       ├── config-pecas/
│       ├── teste-ativacao/
│       ├── teste-categorias/
│       ├── tjms-docs/
│       └── restaurar-slugs/
├── stores/              # Zustand stores
│   ├── auth-store.ts
│   └── ui-store.ts
├── types/               # Tipos TypeScript globais
│   ├── api.ts
│   └── models.ts
├── routes/              # Definicao de rotas (Tanstack Router)
│   └── __root.tsx
├── index.css
└── main.tsx

Crie as pastas e arquivos placeholder (index.ts vazio) onde necessario.
NAO precisa implementar nada ainda — so a estrutura.

Comentarios em portugues.
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): estrutura de pastas do projeto"
```

---

### Passo 1.5 — Configurar Tanstack Router

📋 **PROMPT:**
```
Configure o Tanstack Router no projeto frontend-react/.

Consulte a documentacao mais recente do @tanstack/react-router para verificar
a API correta (a API pode ter mudado em versoes recentes).

1. Crie frontend-react/src/routes/__root.tsx com o layout raiz:
   - Importa Outlet do Tanstack Router
   - Renderiza <Outlet /> (onde as paginas filhas aparecem)

2. Crie o arquivo de rotas principal (routeTree ou router config):
   - Use file-based routing OU route tree manual — o que for mais simples.
   - Defina as seguintes rotas (por enquanto so placeholder):

   Rotas publicas (sem autenticacao):
   /login

   Rotas autenticadas:
   /                      → redirect para /dashboard
   /dashboard
   /gerador-pecas
   /extrator-autos
   /classificador
   /pedido-calculo
   /prestacao-contas
   /relatorio-cumprimento
   /cumprimento-beta
   /assistencia
   /matriculas
   /bert-training

   Rotas admin:
   /admin/users
   /admin/prompts
   /admin/prompts-modulos
   /admin/feedbacks
   /admin/performance
   /admin/variaveis
   /admin/categorias-json
   /admin/historico-gerador
   /admin/historico-pedido-calculo
   /admin/historico-prestacao-contas
   /admin/modulos-tipo-peca
   /admin/config-pecas
   /admin/teste-ativacao
   /admin/teste-categorias
   /admin/tjms-docs
   /admin/restaurar-slugs

3. Cada rota deve ter um componente placeholder simples que mostra o nome da
   pagina (ex: <h1>Gerador de Pecas</h1> <p>Em construcao...</p>).

4. Atualize main.tsx para usar o RouterProvider.

5. Adicione o Tanstack Router DevTools (so em desenvolvimento).

Use tipagem TypeScript completa.
Comentarios em portugues.
```

✅ **TESTE:**
```
Rode "npm run dev".
Navegue entre as rotas digitando na barra de endereco:
- http://localhost:5173/login → mostra "Login"
- http://localhost:5173/dashboard → mostra "Dashboard"
- http://localhost:5173/gerador-pecas → mostra "Gerador de Pecas"
- http://localhost:5173/admin/users → mostra "Admin Users"
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): configurar Tanstack Router com todas as rotas"
```

---

### Passo 1.6 — Configurar Vitest

📋 **PROMPT:**
```
Configure o Vitest para testes no frontend-react/.

1. Crie ou atualize frontend-react/vitest.config.ts:
   - Usa jsdom como environment
   - Resolve os path aliases (@/)
   - Setup file para @testing-library/jest-dom

2. Crie frontend-react/src/test/setup.ts:
   - Importa @testing-library/jest-dom

3. Adicione os scripts no package.json:
   "test": "vitest run",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"

4. Crie um teste simples de exemplo:
   frontend-react/src/lib/__tests__/utils.test.ts
   - Testa a funcao cn()

5. Rode o teste e confirme que passa.

Comentarios em portugues.
```

✅ **TESTE:** `npm test` deve rodar e passar.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): configurar Vitest + Testing Library"
```

---

## FASE 2 — Design System (shadcn/ui)

### 📖 O que e esta fase?

Personalizamos os componentes shadcn/ui para o visual do Portal PGE.
Ao final, teremos um design system completo que TODOS os sistemas vao usar.

---

### Passo 2.1 — Tema e cores PGE

📋 **PROMPT:**
```
Personalize o tema do shadcn/ui para o Portal PGE.

1. Atualize as CSS variables em frontend-react/src/index.css para usar
   as cores do PGE:
   - Primary: azul PGE (#0284c7 / sky-600)
   - PGE Blue: #1e3a5f (para header e elementos institucionais)
   - PGE Orange: #e67e22 (para destaques e CTAs)
   - Background: branco / gray-50
   - Muted: gray-100 / gray-200
   - Destructive: red-500 (para erros e acoes perigosas)

2. Crie um componente de preview em
   frontend-react/src/pages/dev/design-system.tsx que mostra:
   - Todos os botoes (default, destructive, outline, secondary, ghost, link)
   - Cards
   - Inputs e formularios
   - Tabela de exemplo
   - Modais/Dialogos
   - Toasts
   - Tabs
   - Badges
   - Loading skeletons

3. Adicione a rota /dev/design-system no router (so para desenvolvimento).

Isso serve como referencia visual durante toda a migracao.
Comentarios em portugues.
```

✅ **TESTE:**
```
Rode "npm run dev" e acesse http://localhost:5173/dev/design-system.
Verifique que todos os componentes aparecem com o visual do PGE.
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): tema PGE + pagina de preview do design system"
```

---

## FASE 3 — Layout Shell + Auth

### 📖 O que e esta fase?

Criamos o "esqueleto" da aplicacao: header, sidebar de navegacao,
e todo o fluxo de autenticacao. Ao final, voce podera fazer login
e ver o dashboard.

---

### Passo 3.1 — Cliente API tipado

📋 **PROMPT:**
```
Crie o cliente API tipado em frontend-react/src/lib/api.ts.

Reaproveite a LOGICA do frontend/src/shared/api.ts existente, mas em
estilo React moderno:

1. Constante API_BASE = '' (vazio, porque o proxy do Vite resolve).

2. Funcao getToken(): string | null
   - Busca de localStorage.getItem('access_token')

3. Funcao async apiRequest<T>(endpoint, options):
   - Adiciona header Authorization: Bearer <token>
   - Trata 401 → limpa token e redireciona para /login
   - Retorna tipado como T
   - Suporta: json, blob, text como responseType

4. Funcao createApiClient(baseUrl):
   - Retorna objeto com .get<T>(), .post<T>(), .put<T>(), .delete<T>(), .blob()
   - Cada metodo ja adiciona o baseUrl como prefixo

5. Clientes pre-configurados para cada sistema:
   export const authApi = createApiClient('/auth')
   export const adminApi = createApiClient('/admin/api')
   export const geradorApi = createApiClient('/gerador-pecas/api')
   export const classificadorApi = createApiClient('/classificador/api')
   export const extratorApi = createApiClient('/extrator-autos/api')
   export const pedidoCalculoApi = createApiClient('/pedido-calculo/api')
   export const prestacaoContasApi = createApiClient('/prestacao-contas/api')
   export const relatorioCumprimentoApi = createApiClient('/relatorio-cumprimento/api')
   export const cumprimentoBetaApi = createApiClient('/cumprimento-beta/api')
   export const assistenciaApi = createApiClient('/assistencia/api')
   export const matriculasApi = createApiClient('/matriculas/api')
   export const bertApi = createApiClient('/bert-training/api')

IMPORTANTE: Use a chave 'access_token' no localStorage (NAO 'token').
Tipagem TypeScript completa. Comentarios em portugues.
```

✅ **TESTE:** Escreva um teste em `src/lib/__tests__/api.test.ts` que verifica
que `getToken()` retorna null quando nao ha token.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): cliente API tipado com suporte a todos os sistemas"
```

---

### Passo 3.2 — Auth store (Zustand)

📋 **PROMPT:**
```
Crie o store de autenticacao com Zustand em frontend-react/src/stores/auth-store.ts.

1. Interface AuthState:
   - token: string | null
   - user: { id: number, username: string, nome: string, is_admin: boolean } | null
   - isAuthenticated: boolean
   - isLoading: boolean

2. Acoes:
   - login(username, password): faz POST em /auth/token com FormData
     (content-type application/x-www-form-urlencoded — confira como o
     login.html faz hoje). Salva token no localStorage e no store.
   - logout(): limpa token do localStorage e do store, redireciona para /login
   - loadUser(): faz GET em /auth/me com o token, preenche user no store
   - checkAuth(): verifica se tem token valido, se nao redireciona para /login
   - initialize(): chamada no inicio do app — tenta carregar user do token existente

3. O store deve persistir APENAS o token no localStorage (nao o user).
   O user e carregado fresh do servidor ao inicializar.

Use a API client do passo anterior (authApi).
Tipagem TypeScript completa. Comentarios em portugues.
```

✅ **TESTE:** Escreva testes para o auth store.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): auth store com Zustand"
```

---

### Passo 3.3 — Layout Shell (Header + Sidebar + Content)

📋 **PROMPT:**
```
Crie o layout principal da aplicacao.

1. frontend-react/src/components/layout/Header.tsx:
   - Logo PGE a esquerda (imagem de /logo/logo-pge.png)
   - Titulo "Portal PGE-MS" (ou so o logo)
   - A direita: nome do usuario + dropdown com "Trocar Senha" e "Sair"
   - Use shadcn/ui DropdownMenu para o menu do usuario
   - Mobile: hamburger menu para abrir sidebar

2. frontend-react/src/components/layout/Sidebar.tsx:
   - Lista de sistemas com icones (use Lucide React):
     - Dashboard (LayoutDashboard)
     - Gerador de Pecas (FileText)
     - Extrator de Autos (FolderSearch)
     - Classificador (Tags)
     - Pedido de Calculo (Calculator)
     - Prestacao de Contas (ClipboardList)
     - Relatorio de Cumprimento (FileCheck)
     - Cumprimento Beta (FlaskConical)
     - Assistencia Judiciaria (Scale)
     - Matriculas Confrontantes (Map)
     - BERT Training (Brain)
   - Secao "Administracao" (so se user.is_admin):
     - Usuarios, Prompts, Modulos, Feedbacks, Performance, etc.
   - Item ativo destacado baseado na rota atual
   - Colapsavel em telas pequenas
   - Use shadcn/ui Sheet para sidebar mobile

3. frontend-react/src/components/layout/AppLayout.tsx:
   - Componente que monta: Header + Sidebar + area de conteudo
   - Area de conteudo renderiza {children} (o Outlet do router)
   - Responsivo: sidebar fixa em desktop, drawer em mobile

4. frontend-react/src/components/layout/AuthGuard.tsx:
   - Componente que verifica se o usuario esta autenticado
   - Se nao, redireciona para /login
   - Se sim, renderiza {children}
   - Mostra loading (Skeleton) enquanto verifica

Confira o dashboard.html do frontend legado para referencia do visual.
Use componentes shadcn/ui e Tailwind para tudo.
Comentarios em portugues.
```

✅ **TESTE:**
```
Rode "npm run dev". O layout deve aparecer, mas sem dados (nao fez login).
Se redirecionar para /login, esta correto (AuthGuard funcionando).
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): layout shell com Header + Sidebar + AuthGuard"
```

---

### Passo 3.4 — Pagina de Login

📋 **PROMPT:**
```
Crie a pagina de login em frontend-react/src/pages/login/LoginPage.tsx.

1. Layout centralizado (sem sidebar, sem header — so o formulario).
2. Logo PGE no topo.
3. Formulario com:
   - Input de usuario (com icone de usuario)
   - Input de senha (com icone de cadeado, toggle para mostrar/esconder)
   - Botao "Entrar" com loading state
   - Mensagem de erro se login falhar
4. Usa o auth store (useAuthStore) para chamar login().
5. Apos login bem-sucedido, redireciona para /dashboard.
6. Se usuario ja esta logado, redireciona direto para /dashboard.

Use shadcn/ui Card, Input, Button, Label.
O visual deve ser SIMILAR ao login.html atual (limpo, profissional).
Comentarios em portugues.
```

✅ **TESTE:**
```
🌐 NAVEGADOR:
1. Inicie o FastAPI (uvicorn main:app --reload)
2. Inicie o React (npm run dev)
3. Acesse http://localhost:5173/login
4. Tente fazer login com suas credenciais
5. Deve redirecionar para /dashboard apos sucesso
6. Tente com credenciais erradas — deve mostrar erro
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): pagina de login funcional"
```

---

### Passo 3.5 — Dashboard

📋 **PROMPT:**
```
Crie a pagina de dashboard em frontend-react/src/pages/dashboard/DashboardPage.tsx.

1. Saudacao: "Bem-vindo(a), {nome do usuario}"
2. Grid de cards — um card por sistema:
   - Cada card tem: icone, nome do sistema, descricao curta
   - Ao clicar, navega para a rota do sistema
   - Use shadcn/ui Card
   - Grid responsivo: 1 coluna mobile, 2 tablet, 3 desktop
3. Se admin, mostra secao separada "Administracao" com cards dos paineis admin.
4. Carrega dados do usuario do auth store.

Confira o dashboard.html para referencia do conteudo dos cards.
Comentarios em portugues.
```

✅ **TESTE:**
```
🌐 Faca login e verifique o dashboard.
Clique em cada card — deve navegar para a rota (pagina placeholder).
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): pagina de dashboard com cards dos sistemas"
```

---

### Passo 3.6 — Pagina de troca de senha

📋 **PROMPT:**
```
Crie frontend-react/src/pages/change-password/ChangePasswordPage.tsx.

1. Formulario com: senha atual, nova senha, confirmar nova senha.
2. Validacao: nova senha deve ter 8+ caracteres, nao pode ser igual a atual.
3. Botao "Alterar Senha" com loading state.
4. Toast de sucesso/erro apos tentativa.
5. Redireciona para dashboard apos sucesso.

Confira o endpoint usado pelo change_password.html atual.
Use shadcn/ui components. Comentarios em portugues.
```

✅ **TESTE:** Teste trocar a senha.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): pagina de troca de senha"
```

---

## FASE 4 — Hooks Reutilizaveis

### 📖 O que e esta fase?

Criamos custom hooks que encapsulam logica complexa. Cada hook e
reutilizavel em qualquer pagina. Isso e o equivalente aos "componentes
compartilhados" do plano incremental, mas com a elegancia do React.

---

### Passo 4.1 — Hook useSSE (Server-Sent Events)

📋 **PROMPT:**
```
Crie o custom hook useSSE em frontend-react/src/hooks/useSSE.ts.

Este e um dos hooks MAIS IMPORTANTES do portal, porque o streaming
de respostas da IA usa SSE.

1. Interface SSEOptions<T>:
   - url: string
   - token?: string (default: pega do auth store)
   - onMessage: (data: T) => void
   - onError?: (error: Event) => void
   - onComplete?: () => void
   - enabled?: boolean (default: true — permite controlar quando conectar)
   - reconnect?: boolean (default: false)
   - maxRetries?: number (default: 3)

2. O hook retorna:
   - isConnected: boolean
   - isLoading: boolean (true antes da primeira mensagem)
   - error: string | null
   - connect: () => void (conecta manualmente)
   - disconnect: () => void (desconecta)

3. Comportamento:
   - Cria EventSource com URL + ?token=<token>
   - Parseia cada message como JSON e chama onMessage
   - Trata reconexao com backoff exponencial
   - CLEANUP automatico no unmount (fecha a conexao)
   - Se o componente desmontar, NAO tenta reconectar

4. Escreva testes unitarios para o hook:
   - Testa que conecta ao montar
   - Testa que desconecta ao desmontar
   - Testa que chama onMessage com dados parseados

Confira como o SSE e usado em sistemas/gerador_pecas/templates/app.js
para entender o padrao (token via query param, JSON messages).

Tipagem TypeScript completa. Comentarios em portugues.
```

✅ **TESTE:** `npm test` — testes do hook devem passar.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): hook useSSE para streaming Server-Sent Events"
```

---

### Passo 4.2 — Hook usePagination

📋 **PROMPT:**
```
Crie o hook usePagination em frontend-react/src/hooks/usePagination.ts.

1. Interface:
   - data: T[] (todos os dados)
   - pageSize: number (default: 20)

2. Retorna:
   - currentPage: number
   - totalPages: number
   - paginatedData: T[] (so os itens da pagina atual)
   - goToPage: (page: number) => void
   - nextPage: () => void
   - prevPage: () => void
   - hasNextPage: boolean
   - hasPrevPage: boolean

3. Escreva testes.

Tipagem generica. Comentarios em portugues.
```

✅ **TESTE:** Testes devem passar.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): hook usePagination"
```

---

### Passo 4.3 — Hook useApiQuery (fetch + loading + error)

📋 **PROMPT:**
```
Crie o hook useApiQuery em frontend-react/src/hooks/useApiQuery.ts.

Hook generico para chamadas API com estado de loading/error/data.

1. Parametros:
   - queryFn: () => Promise<T> (a funcao que faz o fetch)
   - options: { enabled?: boolean, refetchInterval?: number, onSuccess?, onError? }

2. Retorna:
   - data: T | null
   - isLoading: boolean
   - error: string | null
   - refetch: () => void

3. Comportamento:
   - Executa queryFn ao montar (se enabled=true)
   - Mostra loading enquanto espera
   - Salva erro se falhar
   - refetchInterval: se definido, re-executa periodicamente
   - Cancela fetch se componente desmontar

4. Escreva testes.

Tipagem generica. Comentarios em portugues.
```

📖 **EXPLICACAO:** Isso e uma versao simplificada do React Query / Tanstack Query.
Se preferir, pode instalar `@tanstack/react-query` no lugar, mas o hook customizado
e mais simples para comecar.

✅ **TESTE:** Testes devem passar.

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): hook useApiQuery para chamadas API com estado"
```

---

### Passo 4.4 — Hook useMarkdown

📋 **PROMPT:**
```
Crie o hook useMarkdown em frontend-react/src/hooks/useMarkdown.ts.

Varios sistemas renderizam Markdown (gerador de pecas, relatorio de cumprimento, etc.).

1. Parametros:
   - text: string (markdown)
   - options?: { sanitize?: boolean (default: true) }

2. Retorna:
   - html: string (HTML renderizado e sanitizado)

3. Usa:
   - marked para parsear markdown
   - DOMPurify para sanitizar o HTML resultante

4. Escreva testes.

Comentarios em portugues.
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): hook useMarkdown com sanitizacao"
```

---

## FASE 5 — Paginas Simples

### 📖 O que e esta fase?

Migramos os sistemas mais simples para React. Cada sistema vira uma
pagina React que consome a API existente (nao muda nada no backend).

A partir daqui, o processo e repetitivo. Cada prompt segue o mesmo padrao.

---

### Passo 5.1 — Assistencia Judiciaria

📋 **PROMPT:**
```
Migre o sistema Assistencia Judiciaria para React.

1. Leia o template legado: sistemas/assistencia_judiciaria/templates/index.html
   e o TypeScript: frontend/src/sistemas/assistencia_judiciaria/app.ts
   Entenda o que o sistema faz e quais endpoints API usa.

2. Crie frontend-react/src/pages/assistencia/AssistenciaPage.tsx:
   - Reproduza TODA a funcionalidade do template legado
   - Use componentes shadcn/ui (Card, Button, Input, Table, Dialog, etc.)
   - Use os hooks criados (useApiQuery, usePagination, useMarkdown se aplicavel)
   - Use o apiClient correto (assistenciaApi)
   - Tipagem TypeScript para os dados da API

3. Crie tipos em frontend-react/src/types/assistencia.ts se necessario.

4. Escreva pelo menos 3 testes:
   - Teste que a pagina renderiza sem erros
   - Teste que mostra loading enquanto carrega dados
   - Teste que mostra dados quando API retorna sucesso

O visual deve ser MELHOR que o legado (use shadcn/ui), mas a
funcionalidade deve ser IDENTICA.
Comentarios em portugues.
```

✅ **TESTE:**
```
1. npm test — testes passam
2. 🌐 Faca login e acesse /assistencia
3. Compare visualmente com o legado (http://localhost:8000/assistencia/)
4. Teste TODAS as funcionalidades (criar, editar, listar, etc.)
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): pagina Assistencia Judiciaria"
```

---

### Passo 5.2 — Template generico para sistemas

A partir daqui, use este prompt ajustando o nome do sistema:

📋 **PROMPT GENERICO:**
```
Migre o sistema [NOME_DO_SISTEMA] para React.

1. Leia o template legado:
   - HTML: sistemas/[pasta]/templates/index.html
   - TypeScript (se existir): frontend/src/sistemas/[pasta]/app.ts

2. Entenda: quais endpoints API usa, que dados mostra, que acoes o usuario faz.

3. Crie frontend-react/src/pages/[rota]/[NomeSistema]Page.tsx:
   - Reproduza TODA a funcionalidade
   - Use shadcn/ui, hooks do projeto, apiClient correto
   - Tipagem TypeScript

4. Crie tipos em frontend-react/src/types/[sistema].ts se necessario.

5. Escreva testes (minimo 3: renderiza, loading, dados).

[SE USA MARKDOWN]: Use o hook useMarkdown.
[SE USA SSE]: Use o hook useSSE.
[SE USA CHART.JS]: Instale recharts (npm install recharts) e use no lugar
   do Chart.js — e a lib de graficos mais popular no React.

Funcionalidade IDENTICA, visual MELHOR. Comentarios em portugues.
```

### Ordem de migracao dos sistemas (do mais simples ao mais complexo):

| # | Sistema | Pasta | Linhas | Tem SSE? | Tem Graficos? |
|---|---------|-------|--------|----------|---------------|
| 1 | Assistencia Judiciaria | assistencia | 313 | Nao | Nao |
| 2 | Matriculas Confrontantes | matriculas | 286 | Nao | Nao |
| 3 | Cumprimento Beta | cumprimento-beta | 119 | Nao | Nao |
| 4 | Pedido de Calculo | pedido-calculo | 559 | Nao | Nao |
| 5 | Relatorio de Cumprimento | relatorio-cumprimento | 568 | Sim | Nao |
| 6 | Prestacao de Contas | prestacao-contas | 2.178 | Sim | Nao |
| 7 | BERT Training | bert-training | 1.303 | Nao | Sim (Chart.js→recharts) |
| 8 | Gerador de Pecas | gerador-pecas | 961+2.585+1.196 | Sim | Nao |
| 9 | Extrator de Autos | extrator-autos | 2.683 | Sim | Nao |
| 10 | Classificador | classificador | 3.953 | Sim | Nao |

⚠️ **Para cada sistema migrado, faca um commit separado.**

⚠️ **Sistemas 8-10 sao complexos.** Cada um merece uma sessao inteira.
Para esses, adicione ao prompt:

```
ATENCAO: Este e um sistema complexo. Antes de codar:
1. Liste TODOS os endpoints API que ele usa
2. Liste TODAS as funcionalidades
3. Me mostre o plano antes de implementar
```

---

## FASE 6 — Sistemas Medios

(Cobertos pelo prompt generico acima — sistemas 4-7)

Apos migrar os sistemas 4-7:

💾 **COMMIT DE CHECKPOINT:**
```
Me mostre o progresso:
- Quantos sistemas foram migrados para React?
- Quantos testes existem e passam?
- Quais sistemas faltam?
```

---

## FASE 7 — Sistemas Complexos

### Passo 7.1 — Gerador de Pecas (o principal)

📋 **PROMPT:**
```
Migre o Gerador de Pecas para React. Este e o sistema PRINCIPAL do portal.

ANTES DE CODAR, faca o seguinte:
1. Leia COMPLETAMENTE:
   - sistemas/gerador_pecas/templates/index.html
   - frontend/src/sistemas/gerador_pecas/app.ts (2.585 linhas)
   - sistemas/gerador_pecas/templates/curadoria.js (1.196 linhas)
2. Liste TODOS os endpoints API usados.
3. Mapeie TODOS os estados da UI (tela inicial, loading, streaming,
   resultado, erro, curadoria/preview, curadoria/edicao, etc.).
4. Me mostre esse mapeamento ANTES de implementar.

NAO implemente ainda — so me mostre o mapa de funcionalidades.
```

Apos ver o mapa, use o proximo prompt:

📋 **PROMPT (implementacao):**
```
Agora implemente o Gerador de Pecas em React.

Com base no mapeamento que voce fez, crie:

1. frontend-react/src/pages/gerador-pecas/GeradorPecasPage.tsx
   - Componente principal com a maquina de estados da UI

2. Subcomponentes (divida o sistema em partes):
   - components/ProcessoInput.tsx — input do numero CNJ + botao gerar
   - components/TipoPecaSelect.tsx — selecao do tipo de peca
   - components/StreamingOutput.tsx — area de texto que recebe SSE em tempo real
   - components/ResultadoFinal.tsx — resultado final com botoes de download
   - components/CuradoriaPreview.tsx — preview dos modulos sugeridos
   - components/CuradoriaEditor.tsx — edicao: confirmar/remover/adicionar modulos
   - components/HistoricoGeracoes.tsx — lista de geracoes anteriores

3. Use:
   - useSSE para o streaming
   - Zustand store local para estado do gerador
   - shadcn/ui para todos os componentes visuais
   - useMarkdown para renderizar o resultado

4. Escreva testes para cada subcomponente.

Funcionalidade IDENTICA ao legado. O modo curadoria (semi-automatico)
deve funcionar exatamente como hoje, incluindo tags [HUMAN_VALIDATED].

Comentarios em portugues.
```

✅ **TESTE EXTENSIVO:**
```
🌐 Teste no navegador:
1. Digitar numero CNJ e gerar peca (modo automatico)
2. Verificar streaming SSE (texto aparece em tempo real)
3. Download do resultado (DOCX/PDF)
4. Modo curadoria: preview → editar modulos → gerar
5. Historico de geracoes
6. Tratamento de erro (processo inexistente)
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): pagina Gerador de Pecas completa"
```

---

### Passo 7.2 — Extrator de Autos

📋 **PROMPT:**
```
[Mesmo padrao: mapeamento primeiro, implementacao depois]

Migre o Extrator de Autos. Sistema complexo com:
- Upload de lista de processos (CNJ)
- Selecao de categorias de documentos
- Download paralelo com barra de progresso
- Integracao BERT para classificacao
- Modo lote (multiplos processos simultaneos)

ANTES DE CODAR:
1. Leia: sistemas/extrator_autos/templates/index.html (2.683 linhas)
2. Liste todos os endpoints API.
3. Mapeie todas as funcionalidades.
4. Me mostre o mapa ANTES de implementar.
```

💾 **COMMIT:** `"feat(frontend-react): pagina Extrator de Autos completa"`

---

### Passo 7.3 — Classificador de Documentos

📋 **PROMPT:**
```
[Mesmo padrao: mapeamento primeiro, implementacao depois]

Migre o Classificador de Documentos. Sistema complexo com:
- Upload multiplo de arquivos (drag & drop, ate 2000 arquivos)
- Preview de PDF via PDF.js (use react-pdf ou @react-pdf-viewer/core no React)
- Streaming SSE de classificacao
- Tabela de resultados
- Exportacao CSV/Excel/JSON

ANTES DE CODAR:
1. Leia: sistemas/classificador_documentos/templates/index.html (3.953 linhas)
2. Liste todos os endpoints API.
3. Mapeie todas as funcionalidades.
4. Me mostre o mapa ANTES de implementar.
```

💾 **COMMIT:** `"feat(frontend-react): pagina Classificador de Documentos completa"`

---

## FASE 8 — Admin Pages

### 📖 O que e esta fase?

As paginas admin sao tabelas, formularios e dashboards. shadcn/ui
resolve a maioria: DataTable, Form, Dialog, Tabs.

---

### Passo 8.0 — DataTable reutilizavel

📋 **PROMPT:**
```
Crie um componente DataTable reutilizavel baseado no shadcn/ui.

frontend-react/src/components/shared/DataTable.tsx

1. Props:
   - columns: definicao de colunas com header, accessor, render, sortable
   - data: T[]
   - isLoading: boolean
   - searchable: boolean (filtra por texto)
   - pageSize: number (paginacao)
   - onRowClick?: (row: T) => void
   - emptyMessage: string (default: "Nenhum resultado encontrado")

2. Funcionalidades:
   - Paginacao integrada (usa usePagination)
   - Ordenacao ao clicar no header
   - Busca/filtro
   - Loading skeleton enquanto carrega
   - Estado vazio bonito

3. Use shadcn/ui Table como base.

4. Escreva testes.

Este componente vai ser usado em TODAS as paginas admin.
Comentarios em portugues.
```

💾 **COMMIT:**
```
Faca commit: "feat(frontend-react): componente DataTable reutilizavel"
```

---

### Passo 8.1 — Prompt generico para admins

📋 **PROMPT GENERICO PARA ADMIN:**
```
Migre a pagina admin [NOME] para React.

1. Leia o template legado: frontend/templates/[admin_nome].html
2. Entenda: endpoints API, dados exibidos, acoes disponiveis.

3. Crie frontend-react/src/pages/admin/[nome]/[Nome]Page.tsx:
   - Use DataTable para tabelas
   - Use shadcn/ui Dialog para modais (criar/editar)
   - Use shadcn/ui Form com react-hook-form + zod para formularios
   - Use shadcn/ui Tabs se houver abas
   - Use recharts se houver graficos
   - Tipagem TypeScript completa

4. Escreva testes (minimo 3).

Funcionalidade IDENTICA, visual MELHOR. Comentarios em portugues.
```

### Ordem de migracao dos admin (do mais simples ao mais complexo):

| # | Admin Page | Linhas | Notas |
|---|-----------|--------|-------|
| 1 | restaurar-slugs | 163 | Utilitario simples |
| 2 | pedido-calculo-historico | 660 | Tabela + modal detalhes |
| 3 | modulos-tipo-peca | 772 | Tabela + form |
| 4 | prestacao-contas-historico | 870 | Tabela + modal |
| 5 | tjms-docs | 892 | Documentacao |
| 6 | users | 917 | CRUD usuarios |
| 7 | config-pecas | 974 | Config tipos de peca |
| 8 | historico-gerador | 981 | Tabela + modal |
| 9 | teste-ativacao | 1.303 | Teste de regras |
| 10 | performance | 1.663 | Graficos (recharts) |
| 11 | prompts | 1.858 | Editor de prompts |
| 12 | variaveis | 1.900 | CRUD variaveis |
| 13 | feedbacks | 1.979 | Dashboard complexo |
| 14 | teste-categorias | 2.509 | Teste de categorias |
| 15 | categorias-json | 4.188 | Editor JSON + drag&drop |
| 16 | prompts-modulos | 7.654 | Editor complexo 🐉 |

⚠️ **Para o #16 (prompts-modulos), use o mesmo padrao dos sistemas complexos:**
mapeamento completo primeiro, implementacao depois, com subcomponentes.

---

## FASE 9 — Cutover Final

### 📖 O que e esta fase?

Tudo esta migrado para React. Agora vamos:
1. Integrar o React no FastAPI (servir o build do React)
2. Remover os templates legados
3. Fazer merge

---

### Passo 9.1 — Build de producao

📋 **PROMPT:**
```
Configure o build de producao do React.

1. Atualize frontend-react/vite.config.ts:
   - base: '/' (ou o path correto em producao)
   - build.outDir: '../frontend-react-dist' (ou dist/)

2. Rode "npm run build" em frontend-react/.

3. Verifique que a pasta dist/ foi gerada com:
   - index.html
   - assets/ (JS e CSS minificados)

4. Me mostre o tamanho total do build (em KB).
```

---

### Passo 9.2 — Servir React pelo FastAPI

📋 **PROMPT:**
```
Configure o FastAPI para servir o build do React em producao.

1. No main.py, adicione uma rota catch-all que serve o index.html do React
   para qualquer rota que nao seja API:

   O conceito: todas as rotas que comecam com /api, /auth, /admin/api,
   etc. continuam no FastAPI. Qualquer outra rota serve o index.html do React
   (e o React Router resolve do lado do cliente).

2. Monte a pasta de assets estaticos do React build.

3. Mantenha as rotas API existentes INALTERADAS.

4. NAO remova os templates legados ainda — so adicione o servimento do React.

5. Use uma feature flag ou variavel de ambiente (FRONTEND_MODE=react|legacy)
   para alternar entre os dois frontends em producao.

Comentarios em portugues.
```

✅ **TESTE:**
```
1. Rode "npm run build" no frontend-react/
2. Inicie o FastAPI com FRONTEND_MODE=react
3. Acesse http://localhost:8000/ — deve mostrar o React
4. Teste login, dashboard, e pelo menos 3 sistemas
5. Alterne para FRONTEND_MODE=legacy — deve mostrar os templates antigos
```

💾 **COMMIT:**
```
Faca commit: "feat: servir React SPA pelo FastAPI com feature flag"
```

---

### Passo 9.3 — Teste completo

📋 **PROMPT:**
```
Faca uma verificacao completa:

1. Build React: npm run build (sem erros)
2. Testes React: npm test (todos passam)
3. Testes Python: pytest (todos passam)
4. Com FRONTEND_MODE=react, acesse CADA sistema e verifique funcionalidade.
5. Me mostre um relatorio:
   - Total de paginas React criadas
   - Total de componentes
   - Total de testes
   - Total de linhas de codigo React
   - Tamanho do build final
   - Comparacao com o frontend legado (linhas removidas vs criadas)
```

---

### Passo 9.4 — Remover frontend legado

⚠️ **SO FACA ISSO QUANDO TUDO ESTIVER TESTADO E FUNCIONANDO.**

📋 **PROMPT:**
```
Remova o frontend legado:

1. Delete a pasta frontend/templates/ (templates Jinja2 antigos)
2. Delete a pasta frontend/src/ (TypeScript antigo)
3. Delete frontend/static/js/ (JS compilado antigo)
4. Delete frontend/package.json e frontend/node_modules/ (build antigo)
5. Remova as rotas TemplateResponse do main.py
6. Remova as rotas safe_serve_static dos sistemas no main.py
7. Remova a feature flag FRONTEND_MODE (React e o unico frontend agora)
8. Remova o import de Jinja2Templates do main.py

NAO remova as rotas API — so as rotas que servem HTML.

Me mostre o diff antes de confirmar.
```

💾 **COMMIT:**
```
Faca commit: "chore: remover frontend Jinja2 legado"
```

---

### Passo 9.5 — Merge

📋 **PROMPT:**
```
Me mostre o resumo completo da branch feat/react-spa:
- Total de commits
- Arquivos criados vs removidos
- Linhas adicionadas vs removidas
- Build passando? Testes passando?

NAO faca merge — me mostre para aprovar.
```

📋 **PROMPT (apos aprovar):**
```
Faca merge da branch feat/react-spa na main (--no-ff).
Mensagem: "Migrar frontend para React SPA (Vite + shadcn/ui + Tanstack Router)"
NAO faca push — me mostre o resultado.
```

---

## Apendice A — Mapa de Rotas

### Rotas API do Backend (NAO mudam)

| API Prefix | Sistema | Arquivo |
|-----------|---------|---------|
| `/auth` | Autenticacao | auth/router.py |
| `/users` | Usuarios | users/router.py |
| `/admin/api` | Admin geral | admin/router.py |
| `/assistencia/api` | Assistencia Judiciaria | sistemas/assistencia_judiciaria/router.py |
| `/matriculas/api` | Matriculas Confrontantes | sistemas/matriculas_confrontantes/router.py |
| `/gerador-pecas/api` | Gerador de Pecas | sistemas/gerador_pecas/router.py |
| `/gerador-pecas-admin` | Gerador Admin | sistemas/gerador_pecas/router_admin.py |
| `/api/gerador-pecas/config` | Config Pecas | sistemas/gerador_pecas/router_config_pecas.py |
| `/pedido-calculo/api` | Pedido de Calculo | sistemas/pedido_calculo/router.py |
| `/pedido-calculo-admin` | Pedido Calculo Admin | sistemas/pedido_calculo/router_admin.py |
| `/prestacao-contas/api` | Prestacao de Contas | sistemas/prestacao_contas/router.py |
| `/admin/api/prestacao-admin` | Prestacao Admin | sistemas/prestacao_contas/router_admin.py |
| `/relatorio-cumprimento/api` | Relatorio Cumprimento | sistemas/relatorio_cumprimento/router.py |
| `/cumprimento-beta` | Cumprimento Beta | sistemas/cumprimento_beta/router.py |
| `/classificador/api` | Classificador | sistemas/classificador_documentos/router.py |
| `/bert-training/api` | BERT Training | sistemas/bert_training/router.py |
| `/extrator-autos/api` | Extrator de Autos | sistemas/extrator_autos/router.py |

### Rotas React (Frontend)

| Rota React | Pagina |
|-----------|--------|
| `/login` | LoginPage |
| `/dashboard` | DashboardPage |
| `/change-password` | ChangePasswordPage |
| `/gerador-pecas` | GeradorPecasPage |
| `/extrator-autos` | ExtratorAutosPage |
| `/classificador` | ClassificadorPage |
| `/pedido-calculo` | PedidoCalculoPage |
| `/prestacao-contas` | PrestacaoContasPage |
| `/relatorio-cumprimento` | RelatorioCumprimentoPage |
| `/cumprimento-beta` | CumprimentoBetaPage |
| `/assistencia` | AssistenciaPage |
| `/matriculas` | MatriculasPage |
| `/bert-training` | BertTrainingPage |
| `/admin/users` | AdminUsersPage |
| `/admin/prompts` | AdminPromptsPage |
| `/admin/prompts-modulos` | AdminPromptsModulosPage |
| `/admin/feedbacks` | AdminFeedbacksPage |
| `/admin/performance` | AdminPerformancePage |
| `/admin/variaveis` | AdminVariaveisPage |
| `/admin/categorias-json` | AdminCategoriasJsonPage |
| `/admin/historico-gerador` | AdminHistoricoGeradorPage |
| `/admin/historico-pedido-calculo` | AdminHistoricoPCPage |
| `/admin/historico-prestacao-contas` | AdminHistoricoPrestacaoPage |
| `/admin/modulos-tipo-peca` | AdminModulosTipoPecaPage |
| `/admin/config-pecas` | AdminConfigPecasPage |
| `/admin/teste-ativacao` | AdminTesteAtivacaoPage |
| `/admin/teste-categorias` | AdminTesteCategoriasPage |
| `/admin/tjms-docs` | AdminTjmsDocsPage |
| `/admin/restaurar-slugs` | AdminRestaurarSlugsPage |

---

## Apendice B — Glossario React para Leigos

| Termo | O que significa |
|-------|-----------------|
| **React** | Biblioteca para construir interfaces. Tudo e feito em "componentes" reutilizaveis. |
| **Componente** | Um pedaco da pagina (botao, formulario, tabela). Pode ser reutilizado em qualquer lugar. |
| **JSX / TSX** | Sintaxe que mistura HTML com JavaScript/TypeScript. Parece HTML mas e codigo. |
| **Hook** | Funcao que encapsula logica reutilizavel (ex: `useSSE` gerencia conexao SSE). |
| **useState** | Hook basico que guarda um valor e atualiza a tela quando muda. |
| **useEffect** | Hook que executa codigo quando algo muda (ex: carregar dados ao abrir pagina). |
| **Vite** | Ferramenta de build ultra-rapida. Roda o servidor de desenvolvimento e compila para producao. |
| **shadcn/ui** | Colecao de componentes bonitos e acessiveis. NAO e uma lib — sao arquivos que voce copia para o projeto. |
| **Tanstack Router** | Biblioteca de rotas tipo-segura. Define qual componente aparece para qual URL. |
| **Zustand** | Gerenciador de estado minimalista (~1KB). Substitui Redux com menos boilerplate. |
| **Radix UI** | Primitivos de UI acessiveis (a base do shadcn/ui). Cuida de ARIA, focus trap, etc. |
| **Lucide** | Biblioteca de icones open-source. Substitui Font Awesome com icones SVG. |
| **Proxy** | Configuracao do Vite que encaminha chamadas API para o FastAPI. So funciona em dev. |
| **Build** | Processo de compilar o React para HTML+JS+CSS otimizados para producao. |
| **SPA** | Single Page Application — um unico HTML que troca conteudo via JavaScript. |
| **Strangler Fig** | Padrao de migracao: o novo sistema cresce ao lado do antigo ate substitui-lo. |
| **Feature Flag** | Variavel que liga/desliga uma funcionalidade. Usada para alternar entre frontends. |
| **Store** | Objeto que guarda estado compartilhado entre componentes (ex: dados do usuario). |
| **recharts** | Biblioteca de graficos para React. Substitui Chart.js. |
| **Vitest** | Framework de testes (tipo pytest, mas para JavaScript). Rapido e compativel com Vite. |
| **Testing Library** | Lib de testes que simula interacao do usuario (clicar, digitar, etc.). |
| **cmdk** | Componente de busca rapida (tipo Ctrl+K). Permite buscar sistemas e acoes. |

---

## Apendice C — Emergencia

### "O React nao inicia (npm run dev)"
```
cd frontend-react
npm install
npm run dev
```
Se der erro, cole o erro no Claude Code.

### "O proxy nao funciona (erro de CORS)"
Verifique que o FastAPI esta rodando em localhost:8000.
Verifique o vite.config.ts (secao proxy).

### "Um componente shadcn/ui nao funciona"
Verifique que o arquivo existe em src/components/ui/.
Verifique os imports.

### "Quero voltar ao frontend legado"
O legado continua funcionando em http://localhost:8000 (FastAPI).
O React e http://localhost:5173 (Vite). Sao independentes.

### "Quero desfazer tudo"
```bash
git checkout main
git branch -D feat/react-spa
```
Isso apaga toda a branch React. O projeto volta ao estado original.

### "Posso trabalhar em paralelo (legado + React)?"
Sim! Durante toda a migracao:
- http://localhost:8000 = frontend legado (sempre funciona)
- http://localhost:5173 = React (vai crescendo aos poucos)
Os dois usam o MESMO backend e MESMO banco de dados.

---

## Apendice D — Estimativas de Tempo

| Fase | O que | Tempo estimado |
|------|-------|----------------|
| 0 | Git + Projeto React | 30 min |
| 1 | Infraestrutura (Tailwind, shadcn, Router, Vitest) | 2-3 horas |
| 2 | Design System (tema PGE) | 1-2 horas |
| 3 | Layout Shell + Auth + Login + Dashboard | 2-3 horas |
| 4 | Hooks reutilizaveis (SSE, pagination, API, markdown) | 2-3 horas |
| 5 | Sistemas simples (4 sistemas) | 1-2 dias |
| 6 | Sistemas medios (3 sistemas) | 2-3 dias |
| 7 | Sistemas complexos (3 sistemas) | 3-5 dias |
| 8 | Admin pages (16 paginas) | 5-8 dias |
| 9 | Cutover final | 1 dia |
| **TOTAL** | | **3-5 semanas** |

⚠️ Essas estimativas assumem ~4h/dia de trabalho com Claude Code.
