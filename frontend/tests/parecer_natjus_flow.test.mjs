import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const APP_BUNDLE_PATH = path.resolve(ROOT_DIR, "sistemas/gerador_pecas/templates/app.js");

function mockResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function buildBaseHtml() {
  return `<!DOCTYPE html>
  <html>
    <body>
      <form id="form-processo"></form>
      <select id="tipo-peca"><option value="">auto</option><option value="contestacao">contestacao</option></select>
      <textarea id="observacao-usuario"></textarea>
      <select id="grupo-principal"><option value="1">Grupo 1</option></select>
      <div id="grupo-container"></div>
      <p id="grupo-hint"></p>
      <div id="subcategoria-container"></div>
      <div id="subcategoria-opcoes"></div>
      <p id="subcategoria-hint"></p>
      <input id="numero-cnj" value="0804330-09.2024.8.12.0017" />
      <button id="btn-gerar"></button>
      <div id="modal-progresso" class="hidden"></div>
      <div id="progresso-mensagem"></div>
      <div id="progresso-barra"></div>
      <div id="agente1-status"><div id="agente1-icon"></div><span id="agente1-badge"></span></div>
      <div id="agente2-status"><div id="agente2-icon"></div><span id="agente2-badge"></span></div>
      <div id="agente3-status"><div id="agente3-icon"></div><span id="agente3-badge"></span></div>
      <div id="modal-pergunta" class="hidden"></div>
      <div id="pergunta-texto"></div>
      <div id="opcoes-container"></div>
      <input id="resposta-usuario" />
      <button id="btn-cancelar-pergunta"></button>
      <button id="btn-enviar-resposta"></button>
      <button id="btn-enviar-chat"></button>
      <textarea id="chat-input"></textarea>
      <button id="btn-copiar-minuta"></button>
      <button id="btn-pular-feedback"></button>
      <button id="btn-enviar-feedback"></button>
      <div id="toast-erro" class="hidden"></div>
      <div id="erro-mensagem"></div>
      <div id="toast" class="hidden"></div>
      <i id="toast-icon"></i>
      <span id="toast-message"></span>
      <div id="modal-editor" class="hidden"></div>
      <div id="modal-feedback" class="hidden"></div>
      <div id="painel-versoes" class="hidden"></div>
      <div id="versao-detalhe" class="hidden"></div>
      <div id="versoes-count" class="hidden"></div>
      <div id="editor-tipo-peca"></div>
      <div id="editor-cnj"></div>
      <div id="minuta-content"></div>
      <div id="minuta-status"></div>
      <div id="chat-messages"></div>
      <div id="painel-historico" class="hidden translate-x-full"></div>
      <div id="historico-lista"></div>
      <div id="lista-arquivos"></div>
      <div id="arquivos-lista"></div>
      <button id="btn-modo-cnj"></button>
      <button id="btn-modo-pdf"></button>
      <div id="modo-cnj"></div>
      <div id="modo-pdf" class="hidden"></div>
      <input id="input-pdfs" />
      <div id="dropzone-pdf"></div>
      <div id="modal-subcategoria" class="hidden"></div>
      <form id="form-subcategoria"></form>
      <input id="subcategoria-nome" />
      <input id="subcategoria-slug" />
      <textarea id="subcategoria-descricao"></textarea>
      <div id="lista-subcategorias-modal"></div>
    </body>
  </html>`;
}

async function createHarness(customFetch) {
  const dom = new JSDOM(buildBaseHtml(), {
    url: "http://localhost",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const fetchCalls = [];

  const baseFetch = async (url, options = {}) => {
    const requestUrl = String(url);
    fetchCalls.push({ url: requestUrl, options });
    if (requestUrl === "/auth/me") {
      return mockResponse(200, { role: "admin" });
    }
    if (requestUrl.includes("/gerador-pecas/api/tipos-peca")) {
      return mockResponse(200, {
        tipos: [{ valor: "contestacao", label: "Contestacao" }],
        permite_auto: true,
      });
    }
    if (requestUrl.includes("/gerador-pecas/api/grupos-disponiveis")) {
      return mockResponse(200, {
        grupos: [{ id: 1, nome: "Grupo 1" }],
        requires_selection: false,
        default_group_id: 1,
      });
    }
    if (requestUrl.includes("/gerador-pecas/api/historico")) {
      return mockResponse(200, []);
    }
    return mockResponse(200, {});
  };

  window.fetch = customFetch
    ? async (url, options = {}) => {
        const requestUrl = String(url);
        fetchCalls.push({ url: requestUrl, options });
        return customFetch(url, options);
      }
    : baseFetch;
  window.localStorage.setItem("access_token", "token");
  window.marked = {
    setOptions() {},
    parse(text) {
      return text;
    },
  };
  window.alert = () => {};
  window.confirm = () => true;
  window.curadoria = {
    async iniciarModoSemiAutomatico() {},
  };

  const script = readFileSync(APP_BUNDLE_PATH, "utf-8");
  vm.runInContext(script, dom.getInternalVMContext());
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    dom,
    window,
    app: window.app,
    fetchCalls,
  };
}

function createParecerEvent(overrides = {}) {
  return {
    tipo: "parecer_natjus_ausente",
    titulo: "Parecer NATJus não encontrado",
    mensagem:
      "Não foi encontrado parecer NATJus no processo. Ele é essencial para a geração adequada desta peça.",
    instrucao: "Anexe o parecer em PDF para prosseguir.",
    tipo_peca: "contestacao",
    modo_atual: "automatico",
    parecer_document_codes: [207, 8451],
    ...overrides,
  };
}

function createContext(overrides = {}) {
  return {
    numero_cnj: "08043300920248120017",
    tipo_peca: "contestacao",
    group_id: 1,
    subcategoria_ids: [],
    modo: "automatico",
    ...overrides,
  };
}

test("abre o modal NATJus quando recebe evento de parecer ausente", async () => {
  const { window, app } = await createHarness();

  app.processarEventoStream(createParecerEvent(), createContext());

  const modal = window.document.getElementById("modal-parecer-natjus");
  const warning = window.document.getElementById("parecer-natjus-warning");
  const overlay = modal?.querySelector('[aria-hidden="true"]');
  assert.ok(modal);
  assert.equal(modal.classList.contains("hidden"), false);
  assert.equal(modal.classList.contains("bg-slate-950"), false);
  assert.equal(window.document.body.style.backgroundColor, "");
  assert.equal((window.document.body.getAttribute("style") || "").includes("background"), false);
  assert.ok(overlay);
  assert.match(overlay.className, /bg-black\/50/);
  assert.match(overlay.className, /backdrop-blur-sm/);
  assert.match(warning.textContent || "", /obrigatoriamente no modo semi-automático/i);
});

test("continuar sem parecer no modo automatico força semi-automatico", async () => {
  const { window, app } = await createHarness();

  let semiArgs = null;
  let toastMessage = "";
  app.iniciarModoSemiAutomatico = async (args) => {
    semiArgs = args;
  };
  app.showToast = (message) => {
    toastMessage = message;
  };
  window.confirm = () => true;

  app.abrirModalParecerNatjus(createParecerEvent(), createContext({ modo: "automatico" }));
  window.document.getElementById("btn-parecer-natjus-continuar").click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(semiArgs);
  assert.equal(semiArgs.options.parecer_user_choice_when_missing, "continue_without");
  assert.equal(semiArgs.options.parecer_forced_to_semi_auto, true);
  assert.match(toastMessage, /semi-automático ativado/i);
});

test("continuar sem parecer no modo semi-automatico não força nova troca de modo", async () => {
  const { window, app } = await createHarness();

  let semiArgs = null;
  app.iniciarModoSemiAutomatico = async (args) => {
    semiArgs = args;
  };
  window.confirm = () => true;

  app.abrirModalParecerNatjus(
    createParecerEvent({ modo_atual: "semi_automatico" }),
    createContext({ modo: "semi_automatico" })
  );
  window.document.getElementById("btn-parecer-natjus-continuar").click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(semiArgs);
  assert.equal(semiArgs.options.parecer_user_choice_when_missing, "continue_without");
  assert.equal(semiArgs.options.parecer_forced_to_semi_auto, false);
});

test("anexar PDF retoma o fluxo no modo original com parecer_upload_id", async () => {
  const { app } = await createHarness();

  let payloadReenvio = null;
  app.enviarProcessamentoStreamCNJ = async (payload) => {
    payloadReenvio = payload;
  };
  app.uploadParecerNatjusArquivo = async () => ({
    upload_id: "upload-123",
    filename: "parecer.pdf",
    size_bytes: 1234,
    numero_cnj: "08043300920248120017",
    tipo_peca: "contestacao",
  });
  app.mostrarLoading = () => {};
  app.resetarStatusAgentes = () => {};

  app.abrirModalParecerNatjus(createParecerEvent(), createContext({ modo: "automatico" }));
  await app.acaoAnexarParecerNatjus();

  assert.ok(payloadReenvio);
  assert.equal(payloadReenvio.parecer_upload_id, "upload-123");
  assert.equal(payloadReenvio.parecer_user_choice_when_missing, "uploaded");
  assert.equal(payloadReenvio.parecer_forced_to_semi_auto, false);
});

test("upload inválido (não PDF) é bloqueado com mensagem clara", async () => {
  const { window, app, fetchCalls } = await createHarness();

  app.abrirModalParecerNatjus(createParecerEvent(), createContext({ modo: "automatico" }));
  const input = window.document.getElementById("parecer-natjus-upload-input");
  const arquivoInvalido = new window.File(["conteudo"], "arquivo.txt", {
    type: "text/plain",
  });
  Object.defineProperty(input, "files", {
    value: [arquivoInvalido],
    configurable: true,
  });

  const chamadasAntes = fetchCalls.length;
  await app.acaoAnexarParecerNatjus();
  const chamadasDepois = fetchCalls.length;

  const status = window.document.getElementById("parecer-natjus-upload-status");
  assert.match(status.textContent || "", /arquivo inválido|apenas pdf/i);
  assert.equal(chamadasDepois, chamadasAntes);
});
