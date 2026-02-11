# PGE-MS — Design System & Padrão Visual

> Este documento define o padrão visual do sistema da Procuradoria-Geral do Estado de Mato Grosso do Sul.
> Deve ser seguido em **todas** as telas, componentes e páginas do projeto.

---

## Stack

- **React 19** — biblioteca de UI
- **Vite 7** — bundler e dev server
- **TypeScript** — tipagem estrita
- **CSS inline via objetos `style`** — tokens aplicados diretamente, sem Tailwind em produção

---

## Tipografia

- **Fonte principal (UI):** `Plus Jakarta Sans` (importar do Google Fonts)
- **Fonte de documento jurídico:** `Lora` (serifada, usar apenas em visualizações de peças/documentos)
- Nunca use fontes genéricas como Inter, Roboto ou Arial

### Escala de tamanhos

| Uso                  | Tamanho     | Peso       |
|----------------------|-------------|------------|
| Título de página     | 32px        | 700 (bold) |
| Título de card       | 17px        | 700        |
| Subtítulo / label    | 15px        | 600        |
| Corpo de texto       | 15px        | 400        |
| Descrição auxiliar   | 14px        | 400        |
| Label de admin       | 14px        | 700, uppercase, tracking 0.08em |
| Header org name      | 17px        | 600        |
| Header subtítulo     | 14px        | 400        |
| Nome do usuário      | 15px        | 500        |
| Texto de documento   | 16-17px     | 400 (fonte Lora) |

---

## Paleta de Cores (tokens oficiais)

### Azul Marinho (Navy) — Identidade e Estrutura

O azul marinho é a cor **institucional**. Representa a PGE. Usar em:
- Header e marca
- Ícones em estado de repouso
- Backgrounds sutis
- Linhas divisórias e accent bars em repouso
- Links e CTAs em estado normal

```typescript
const navy = {
  950: "#22314B",  // header background, elementos de máxima ênfase
  900: "#253D52",  // hover pesado, textos sobre fundo claro
  800: "#284656",  // backgrounds secundários escuros
  700: "#2B5376",  // ícones em estado ativo
  600: "#356A8E",  // links, CTAs em repouso
  500: "#4A98A0",  // badges, destaques info
  400: "#4EA0A9",  // textos auxiliares sobre fundo escuro
  300: "#73B9C0",  // hover sutil, decoração
  200: "#A3D1D5",  // bordas suaves
  100: "#D5ECEF",  // background de ícones em repouso
  50:  "#EFF8F9",  // hover sutil em itens admin
};
```

### Laranja — Ação e Interação (usar com parcimônia)

O laranja é a cor de **ação**. Deve ser usado em **pontos estratégicos** para não poluir a interface. A regra é simples: o laranja só aparece quando o usuário **interage** com algo.

**ONDE USAR:**
- Hover de cards e botões (borda, ícone, accent line)
- Links/CTAs no estado hover (transição de teal → laranja)
- Avatar do usuário
- Badges de notificação
- Botões primários de ação destrutiva ou de destaque máximo (com moderação)

**ONDE NÃO USAR:**
- Estado de repouso de cards, links, ícones
- Backgrounds grandes
- Textos de corpo
- Múltiplos elementos laranjas visíveis ao mesmo tempo na mesma região

```typescript
const orange = {
  600: "#e07520",
  500: "#F58634",  // accent principal
  400: "#f79a54",
  200: "#fcd4b0",
  100: "#fef0e4",
  50:  "#fff8f1",
};
```

### Cinza e neutros

```typescript
const gray = {
  700: "#3C4858",  // texto pesado alternativo
  600: "#5A6578",  // texto secundário com mais legibilidade
  500: "#8D8F92",  // ícones inativos
  400: "#B3B5B7",  // bordas, placeholders
  300: "#CDCED0",  // divisores
  200: "#E2E3E5",  // bordas de cards
  100: "#F0F1F2",  // backgrounds de ícones admin
  50:  "#F7F8F9",  // background geral da página
};

const text = {
  900: "#1A2332",  // títulos principais
  700: "#2D3B4E",  // corpo de texto
  500: "#5A6578",  // texto secundário
  400: "#8D95A0",  // placeholders, labels inativos
};
```

### Status

```typescript
const status = {
  success: "#10b981",   // emerald-500
  warning: "#f59e0b",   // amber-500
  error:   "#ef4444",   // red-500
  info:    "#4A98A0",   // navy-500
};
```

---

## Layout

### Princípio central

Todo conteúdo deve ser **centralizado** com largura máxima, como um site institucional. Nunca ocupar 100% da tela.

```typescript
const layout = {
  maxWidth: 1350,          // largura máxima do conteúdo
  padding: "0 40px",       // padding lateral
  center: "0 auto",        // margin para centralizar
};
```

### Header Global (FIXO — NÃO ALTERAR)

O header global é renderizado pelo `AppLayout` e **nunca deve ser removido, substituído, duplicado ou alterado** por nenhuma página ou sistema. Ele é o mesmo em todas as telas autenticadas.

- **Full-width** — ocupa 100% da largura, fundo `navy.950`
- Background: `navy.950` (#22314B)
- Altura: 80px
- Logo PGE branco (`logo-pge-branco.png`) direto sobre fundo escuro (sem container)
- Divisor vertical `rgba(255,255,255,0.18)` + nome da instituição (17px/600) + subtítulo (14px/400)
- Avatar laranja (44px) à direita com iniciais do usuário + dropdown (Trocar Senha, Sair)
- Transição reta (20px) para o conteúdo `#F7F8F9`
- **Não incluir** saudação ou data no header — esses ficam no conteúdo principal

**REGRAS:**
1. **NUNCA** criar um segundo header nas páginas internas (proibido "double header")
2. **NUNCA** remover o header global via configuração de layout para substitui-lo por outro
3. **NUNCA** duplicar logo, nome da instituição ou botão de logout dentro das páginas
4. O logout, avatar e identidade do usuário são responsabilidade **exclusiva** do header global
5. Páginas internas de módulos usam a **Breadcrumb Bar** (seção abaixo) para navegação contextual

### Breadcrumb Bar (sub-navegação de módulos)

Nas páginas internas dos módulos (Gerador de Peças, Pedido de Cálculo, etc.), a navegação contextual é feita por uma **breadcrumb bar leve** logo abaixo do header global. Ela é visualmente **subordinada** ao header — nunca deve parecer um segundo header.

**Estrutura:**

```
header global PGE (navy, fixo — NÃO MEXER)
│
└── breadcrumb bar
    │  background: transparent (mesmo fundo gray.50 da página)
    │  border-bottom: 1px solid gray.200
    │  height: 48px
    │  max-width: 1350px, margin: 0 auto, padding: 0 40px
    │  display: flex, align-items: center, justify-content: space-between
    │
    ├── LEFT:
    │   ├── Botão voltar: ícone ← (16px)
    │   │   cor: text.400, hover: text.700, hover bg: gray.100
    │   │   padding: 6px, border-radius: 8px
    │   │
    │   ├── Separador: "›" (ChevronRight 14px) em text.400, margin: 0 8px
    │   │
    │   ├── Ícone do módulo: 28px, fundo navy.100, cor navy.700, border-radius: 8px
    │   │
    │   └── Nome do módulo: 15px, font-weight 600, cor text.900
    │
    └── RIGHT:
        └── Botões de ação contextual (ghost):
            bg transparent, text.500, hover bg gray.100
            font-size: 13px, padding: 6px 12px, border-radius: 8px
```

**Exemplo visual:**

```
┌─ header global PGE (navy, fixo) ──────────────────────────────────────┐
│  PGE | Procuradoria-Geral do Estado                   Administrador A │
└───────────────────────────────────────────────────────────────────────┘
  ← › 📄 Gerador de Peças                                   🕐 Histórico
─────────────────────────────────────────────────────────────────────────
  ┌─ conteúdo (tabs, formulário, etc) ──────────────────────────────┐
```

**O que NÃO fazer na breadcrumb bar:**
- **NÃO** usar background escuro ou colorido — tem que ser transparente/leve
- **NÃO** usar sombra — só o `border-bottom` sutil com `gray.200`
- **NÃO** duplicar logo, nome da instituição ou botão de logout
- **NÃO** usar fonte grande (max 15px weight 600)
- **NÃO** usar ícone grande (max 28px) — é breadcrumb, não hero
- **NÃO** usar `orange.500` no ícone da breadcrumb — usar `navy.100`/`navy.700`

**Aplicação:** Esta mesma estrutura deve ser usada em **todas** as páginas internas de módulos. Mudar apenas o nome, ícone e botões de ação à direita.

### Background da página

- Cor: `gray.50` (#F7F8F9)
- Nunca branco puro — o branco é reservado para cards e painéis

---

## Componentes

### Cards de módulo

- Background: branco
- Border: `gray.200`, muda para `orange.400` no hover
- Border-radius: 16px (rounded-2xl)
- Accent bar no topo: 4px, gradiente `navy.950 → navy.500` em repouso, `orange.500 → orange.400` no hover
- Sombra: sutil em repouso (`0 1px 3px rgba(0,0,0,0.03)`), elevada no hover com tom laranja (`0 8px 32px rgba(245,134,52,0.12)`)
- Layout: ícone + título na mesma linha, descrição abaixo, CTA "Acessar" no rodapé
- Ícone: fundo `navy.100` com cor `navy.700` em repouso → fundo `orange.500` com cor branca no hover
- CTA "Acessar": cor `navy.600` em repouso → `orange.500` no hover, com seta que desloca 4px para direita

### Cards de administração

- Layout: grid 4 colunas dentro de container branco com borda
- Cada item: ícone pequeno (32px) + título + descrição
- Hover: background `navy.50`, ícone muda para `navy.100` com cor `navy.700`
- Seção colapsável com toggle

### Botões

```
Primário:    bg navy.950, text white, hover navy.700, shadow-sm
Secundário:  bg transparent, border gray.200, text text.500, hover bg gray.100
Destaque:    bg orange.500, text white (usar raramente, apenas para ação principal da tela)
Ghost:       bg transparent, text text.400, hover bg gray.100
```

### Inputs e formulários

- Border: `gray.200`
- Border-radius: 12px
- Focus: ring de 2px em `navy.950` com 10% opacidade, border muda para `gray.300`
- Placeholder: `text.400`
- Texto: `text.700`, 14-15px

### Badges de status

- Border-radius: full (pill)
- Tamanho: text 12-13px, padding 8px 12px
- Variantes: sucesso (emerald), alerta (amber), erro (red), info (teal)
- Incluir dot animado quando indicar estado ativo

---

## Transições e animações

- Duração padrão: 200-250ms
- Easing: `ease` ou `cubic-bezier(0.4, 0, 0.2, 1)`
- Entrada de página: `fadeUp` (opacity 0→1, translateY 14px→0) com 500ms, stagger de 60ms entre cards
- Hover de cards: transição suave de borda, sombra, cor do ícone e accent bar
- Seta do CTA: `translateX(0) → translateX(4px)` no hover
- Ícone do card: `scale(1) → scale(1.05)` no hover
- Nunca usar animações chamativas ou bounce — manter institucional e sóbrio

---

## Ícones

- Estilo: outline/stroke (nunca filled)
- Stroke-width: 1.8
- Tamanhos: 14-16px (inline), 20-22px (cards de módulo), 24px (destaque)
- Preferir ícones do Lucide (consistência de estilo)
- Cor segue o contexto do componente (teal em repouso, laranja/branco no hover)

---

## Regras gerais

1. **Consistência > Criatividade** — toda tela nova deve parecer que faz parte do mesmo sistema
2. **Laranja com moderação** — se olhar pra tela e ver laranja em mais de 2 pontos simultaneamente (sem hover), tem laranja demais
3. **Centralizar sempre** — nunca esticar conteúdo full-width, usar max-width de 1350px
4. **Branco é para cards** — o fundo da página é `gray.50`, o branco (#fff) é reservado para containers elevados
5. **Espaçamento generoso** — preferir mais espaço entre seções do que menos
6. **Tipografia limpa** — Plus Jakarta Sans para UI, Lora apenas para documentos jurídicos
7. **Sombras sutis** — nunca sombras pesadas, preferir bordas + sombra leve
8. **Border-radius consistente** — 12px para inputs e botões, 16px para cards, full para badges
9. **Nunca usar** cores fora da paleta definida, fontes fora das especificadas, ou ícones com estilo diferente
10. **Header global é intocável** — nunca remover, substituir, duplicar ou criar "sub-headers" escuros que pareçam outro header. Páginas internas usam a breadcrumb bar (transparente, 48px, border-bottom)

---

## Exemplo de estrutura — Página de módulo (com breadcrumb bar)

```tsx
// O Header global e Sidebar são renderizados pelo AppLayout — NÃO incluir aqui.
// A página recebe apenas o espaço de conteúdo dentro do <main> do AppLayout.

export default function NomeDoModuloPage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* Breadcrumb bar — leve, subordinada ao header global */}
      <div style={{ borderBottom: "1px solid #E2E3E5" }}>
        <div style={{ maxWidth: 1350, margin: "0 auto", padding: "0 40px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Botão voltar (← ) */}
            {/* Separador (›) */}
            {/* Ícone do módulo (28px, bg navy.100, cor navy.700) */}
            {/* Nome do módulo (15px, weight 600, cor text.900) */}
          </div>
          <div>
            {/* Botões de ação contextual (ghost) */}
          </div>
        </div>
      </div>

      {/* Content — centered */}
      <div style={{ maxWidth: 1350, margin: "0 auto", padding: "32px 40px" }}>
        {/* Conteúdo do módulo */}
      </div>

    </div>
  );
}
```

## Exemplo de estrutura — Dashboard (sem breadcrumb bar)

```tsx
// O Header global e Sidebar são renderizados pelo AppLayout — NÃO incluir aqui.

export default function DashboardPage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1350, margin: "0 auto", padding: "32px 40px" }}>
        {/* Saudação + data */}
        {/* Grid de cards de módulo */}
        {/* Seção admin (se admin) */}
      </div>
    </div>
  );
}
```

---

## Referência visual

- **Dashboard**: `DashboardPageV2.tsx` — implementação de referência do design system
- **Módulo com breadcrumb bar**: `GeradorPecasPage.tsx` — exemplo de página interna com breadcrumb bar
- **Header global**: `Header.tsx` — componente fixo renderizado pelo `AppLayout`
