import { useState, useEffect } from "react";

/* ═══════ PGE DESIGN TOKENS (paleta oficial) ═══════ */
const C = {
  teal900: "#294964",
  teal700: "#2d5a7b",
  teal600: "#356a8e",
  teal500: "#51A8B1",
  teal400: "#6bbcc4",
  teal200: "#b8dee3",
  teal100: "#e0f0f2",
  teal50: "#f2f9fa",
  orange600: "#e07520",
  orange500: "#F58634",
  orange400: "#f79a54",
  orange200: "#fcd4b0",
  orange100: "#fef0e4",
  orange50: "#fff8f1",
  gray600: "#6b7280",
  gray500: "#9ca3af",
  gray400: "#D2D3D5",
  gray200: "#e5e7eb",
  gray100: "#f3f4f6",
  gray50: "#f9fafb",
  white: "#ffffff",
  text900: "#1a2332",
  text700: "#334155",
  text500: "#64748b",
  text400: "#94a3b8",
};

/*
  REGRA DO LARANJA:
  O laranja (#F58634) é a cor de AÇÃO e INTERAÇÃO.
  - CTAs (botões primários, links "Acessar")
  - Hover states dos cards
  - Accent line dos cards no hover
  - Avatar / notificações
  
  O teal é a cor de IDENTIDADE e ESTRUTURA.
  - Header / marca PGE
  - Ícones em repouso
  - Backgrounds sutis
  - Seções / divisores
*/

/* ═══════ DATA ═══════ */
const MODULES = [
  { id: "assistencia", title: "Assistência Judiciária", desc: "Consulta de processos judiciais no TJ-MS com análise automática por IA.", icon: "scale" },
  { id: "matriculas", title: "Matrículas Confrontantes", desc: "Análise documental de matrículas imobiliárias com IA visual.", icon: "layers" },
  { id: "gerador", title: "Gerador de Peças", desc: "Geração automatizada de contestações, pareceres e recursos.", icon: "fileText" },
  { id: "calculo", title: "Pedido de Cálculo", desc: "Geração de pedido de cálculo para cumprimento de sentença.", icon: "calculator" },
  { id: "prestacao", title: "Prestação de Contas", desc: "Análise de prestação de contas em processos de medicamentos.", icon: "clipboard" },
  { id: "relatorio", title: "Relatório de Cumprimento", desc: "Geração de relatório inicial para cumprimento de sentença.", icon: "barChart" },
  { id: "classificador", title: "Classificador de Documentos", desc: "Classificação automática de documentos jurídicos com IA.", icon: "tag" },
  { id: "bert", title: "BERT Training", desc: "Treinamento de classificadores de texto com modelos BERT.", icon: "cpu" },
];

const ADMIN_ITEMS = [
  { icon: "users", title: "Usuários", desc: "Gerenciar acessos" },
  { icon: "terminal", title: "Prompts de IA", desc: "Configurar prompts" },
  { icon: "puzzle", title: "Prompts Modulares", desc: "Editar e versionar" },
  { icon: "thumbsUp", title: "Dashboard Feedbacks", desc: "Avaliar qualidade" },
  { icon: "clock", title: "Histórico Gerações", desc: "Prompts e resultados" },
  { icon: "bug", title: "Debug Cálculo", desc: "Logs de chamadas IA" },
  { icon: "bug", title: "Debug Prest. Contas", desc: "Logs de chamadas IA" },
  { icon: "code", title: "Formatos JSON", desc: "Categorias de resumo" },
  { icon: "variable", title: "Variáveis Extração", desc: "Perguntas e variáveis" },
  { icon: "list", title: "Tipos de Peça", desc: "Categorias por tipo" },
  { icon: "activity", title: "Logs Performance", desc: "Latência e diagnósticos" },
  { icon: "link", title: "Integração TJ-MS", desc: "Docs e sincronização" },
];

/* ═══════ ICONS ═══════ */
const IconSvg = ({ name, size = 22, color = "currentColor" }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    scale: <><path d="m3 10 3.5-3.5" /><path d="m21 10-3.5-3.5" /><path d="M12 2v4" /><path d="m3 10 4 8h0" /><path d="m21 10-4 8h0" /><path d="M7 18h10" /><path d="M12 6a1 1 0 0 0-1 1v0a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1v0a1 1 0 0 0-1-1" /><ellipse cx="7" cy="18" rx="3" ry="1" /><ellipse cx="17" cy="18" rx="3" ry="1" /></>,
    layers: <><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 12.65-8.58 4.17a2 2 0 0 1-1.66 0L2 12.65" /><path d="m22 17.65-8.58 4.17a2 2 0 0 1-1.66 0L2 17.65" /></>,
    fileText: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></>,
    calculator: <><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M8 10h8" /><path d="M8 14h8" /><path d="M8 18h8" /><path d="M8 6h8" /></>,
    clipboard: <><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
    barChart: <><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></>,
    tag: <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>,
    cpu: <><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></>,
    puzzle: <><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" /></>,
    thumbsUp: <><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    bug: <><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></>,
    code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
    variable: <><path d="M8 21s-4-3-4-9 4-9 4-9" /><path d="M16 3s4 3 4 9-4 9-4 9" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="15" y2="15" /></>,
    list: <><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></>,
    activity: <><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    chevRight: <><path d="m9 18 6-6-6-6" /></>,
    chevDown: <><path d="m6 9 6 6 6-6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  };
  return <svg {...p}>{icons[name]}</svg>;
};

/* ═══════ MODULE CARD ═══════ */
function ModuleCard({ mod, index }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative rounded-2xl border overflow-hidden cursor-pointer flex flex-col w-full"
      style={{
        background: C.white,
        borderColor: hovered ? C.orange400 : C.gray200,
        boxShadow: hovered
          ? `0 8px 32px rgba(245,134,52,0.12), 0 0 0 1px ${C.orange400}`
          : "0 1px 3px rgba(0,0,0,0.03)",
        transition: "all 0.25s ease",
      }}
    >
      {/* Top accent — sempre teal em repouso, laranja no hover */}
      <div
        className="h-1"
        style={{
          background: hovered
            ? `linear-gradient(90deg, ${C.orange500}, ${C.orange400})`
            : `linear-gradient(90deg, ${C.teal900}, ${C.teal500})`,
          opacity: hovered ? 1 : 0.4,
          transition: "all 0.25s ease",
        }}
      />

      <div className="p-4 flex flex-col flex-1">
        {/* Icon + Title row */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: hovered ? C.orange500 : C.teal100,
              color: hovered ? C.white : C.teal700,
              transition: "all 0.25s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
          >
            <IconSvg name={mod.icon} size={20} />
          </div>
          <h3 className="text-sm font-bold leading-snug" style={{ color: C.text900 }}>
            {mod.title}
          </h3>
        </div>

        {/* Desc */}
        <p className="text-xs leading-relaxed flex-1" style={{ color: C.text500 }}>
          {mod.desc}
        </p>

        {/* CTA — teal em repouso, laranja no hover */}
        <div className="flex items-center gap-1 mt-3">
          <span className="text-xs font-bold" style={{ color: hovered ? C.orange500 : C.teal600, transition: "color 0.2s" }}>Acessar</span>
          <div style={{ color: hovered ? C.orange500 : C.teal600, transition: "all 0.2s", transform: hovered ? "translateX(4px)" : "translateX(0)" }}>
            <IconSvg name="chevRight" size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════ ADMIN ITEM ═══════ */
function AdminItem({ item }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer"
      style={{
        background: hovered ? C.teal50 : "transparent",
        transition: "all 0.15s ease",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: hovered ? C.teal100 : C.gray100,
          color: hovered ? C.teal700 : C.gray500,
          transition: "all 0.15s ease",
        }}
      >
        <IconSvg name={item.icon} size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: C.text900 }}>{item.title}</p>
        <p className="text-xs truncate" style={{ color: C.text400 }}>{item.desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════ MAIN ═══════════════════ */
export default function PGEDashboard() {
  const [loaded, setLoaded] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [greeting, setGreeting] = useState("Bom dia");

  useEffect(() => {
    setLoaded(true);
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="min-h-screen" style={{ background: C.gray50 }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />

      <style>{`
        * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; box-sizing: border-box; }
        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: ${C.gray400}; border-radius: 10px; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease-out both; }
      `}</style>

      {/* ════════════ HEADER ════════════ */}
      <header style={{ background: C.teal900 }}>
        {/* Nav bar — full width background, centered content */}
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px" }}>
          <div className="flex items-center justify-between" style={{ height: 64 }}>
            {/* Logo PGE */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {/* Logo mark */}
                <div
                  className="flex items-center justify-center rounded-lg font-extrabold tracking-widest"
                  style={{
                    width: 40,
                    height: 40,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: C.white,
                    fontSize: 11,
                  }}
                >
                  PGE
                </div>
                {/* Divider + org name */}
                <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)", margin: "0 12px" }} />
                <div>
                  <p className="font-semibold" style={{ color: "rgba(255,255,255,0.95)", fontSize: 14, lineHeight: 1.2 }}>
                    Procuradoria-Geral do Estado
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                    Mato Grosso do Sul
                  </p>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-full font-bold"
                style={{
                  width: 36,
                  height: 36,
                  background: C.orange500,
                  color: C.white,
                  fontSize: 13,
                }}
              >
                A
              </div>
            </div>
          </div>
        </div>

        {/* Curve transition */}
        <div className="rounded-t-3xl" style={{ height: 20, background: C.gray50 }} />
      </header>

      {/* ════════════ CONTENT — CENTERED ════════════ */}
      <div
        className={`transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px 80px" }}
      >

        {/* Greeting — fora do header */}
        <div style={{ paddingTop: 16, paddingBottom: 28 }}>
          <p className="font-medium" style={{ color: C.text400, fontSize: 13, marginBottom: 4 }}>
            {today}
          </p>
          <h1 className="font-bold" style={{ color: C.text900, fontSize: 26, letterSpacing: "-0.02em" }}>
            {greeting}, Administrador
          </h1>
        </div>

        {/* ── Module Grid ── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: -4, alignItems: "stretch" }}>
          {MODULES.map((mod, i) => (
            <div key={mod.id} className="fade-up flex" style={{ animationDelay: `${i * 60}ms` }}>
              <ModuleCard mod={mod} index={i} />
            </div>
          ))}
        </div>

        {/* ── Admin Section ── */}
        <div className="fade-up" style={{ animationDelay: "450ms", marginTop: 48 }}>
          <button
            onClick={() => setAdminOpen(!adminOpen)}
            className="flex items-center gap-2 mb-4 cursor-pointer"
            style={{ background: "none", border: "none", padding: 0 }}
          >
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 28, height: 28, background: C.gray200, color: C.gray500 }}
            >
              <IconSvg name="settings" size={14} />
            </div>
            <span className="font-bold uppercase" style={{ fontSize: 11, letterSpacing: "0.1em", color: C.text400 }}>
              Administração
            </span>
            <div style={{
              color: C.text400,
              transform: adminOpen ? "rotate(0)" : "rotate(-90deg)",
              transition: "transform 0.2s",
            }}>
              <IconSvg name="chevDown" size={15} />
            </div>
          </button>

          {adminOpen && (
            <div
              className="rounded-2xl border grid gap-0.5"
              style={{
                background: C.white,
                borderColor: C.gray200,
                padding: 8,
                gridTemplateColumns: "repeat(4, 1fr)",
              }}
            >
              {ADMIN_ITEMS.map((item, i) => (
                <AdminItem key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
