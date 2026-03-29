import{j as e,L as s}from"./vendor-tanstack-mcI_os3D.js";import{B as o}from"./BreadcrumbBar-D48Gwsjz.js";import{C as r}from"./ContentArea-O1vjW71b.js";import{c as t,f as a,a6 as n}from"./index-ohMlKOjR.js";import{T as c}from"./triangle-alert-Bzj6gBWh.js";import{C as i}from"./circle-check-big-BUMQPlXz.js";import{N as l}from"./network-Cywas5Ai.js";import"./vendor-radix-DtmYFaO8.js";import"./vendor-recharts-BsHuGj5-.js";const d=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],m=t("external-link",d);function v(){return e.jsxs(e.Fragment,{children:[e.jsx(o,{title:"Documentacao Integracao TJ-MS",icon:e.jsx(n,{className:"w-3.5 h-3.5"}),actions:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:"text-xs",style:{color:a.text500},children:"Atualizado: 24/01/2026"}),e.jsxs(s,{to:"/admin/tjms-docs/plano",className:"hover:underline text-sm flex items-center gap-1",style:{color:a.navy600},children:[e.jsx(m,{className:"h-3.5 w-3.5"}),"Ver Plano Completo"]})]})}),e.jsxs(r,{className:"space-y-6",children:[e.jsx("div",{className:"bg-amber-50 border border-amber-200 rounded-xl p-4",children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx(c,{className:"h-5 w-5 text-amber-500 mt-0.5"}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-amber-800",children:"Importante: Sincronizacao Backend/Frontend"}),e.jsx("p",{className:"text-amber-700 text-sm mt-1",children:"Quando alterar qualquer arquivo listado abaixo no backend, verifique se ha impacto no frontend correspondente. Mudancas na estrutura de dados SOAP ou nos parsers XML podem quebrar a UI."})]})]})}),e.jsx("div",{className:"bg-green-50 border border-green-200 rounded-xl p-4",children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx(i,{className:"h-5 w-5 text-green-500 mt-0.5"}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-green-800",children:"Migracao Concluida (24/01/2026)"}),e.jsxs("p",{className:"text-green-700 text-sm mt-1",children:["Todos os sistemas foram migrados para usar o cliente TJMS unificado em ",e.jsx("code",{className:"bg-green-100 px-1 rounded",children:"services/tjms/"}),". A configuracao de credenciais e URLs esta centralizada em um unico local."]})]})]})}),e.jsxs("div",{className:"bg-white rounded-2xl shadow-sm p-6",style:{border:`1px solid ${a.gray200}`},children:[e.jsxs("h2",{className:"text-xl font-bold mb-4 flex items-center gap-2",style:{color:a.text900},children:[e.jsx(l,{className:"h-5 w-5",style:{color:a.navy600}}),"Arquitetura Unificada de Integracao"]}),e.jsx("div",{className:"bg-slate-800 text-slate-200 rounded-lg p-4 overflow-x-auto font-mono text-[13px] leading-relaxed",children:e.jsx("pre",{children:`CLIENTE UNIFICADO (services/tjms/):

services/tjms/
  __init__.py         --> Exports publicos (todos os modulos)
  config.py           --> TJMSConfig, get_config(), reload_config()
  models.py           --> ProcessoTJMS, DocumentoTJMS, Parte, Movimento, etc
  client.py           --> TJMSClient (async context manager principal)
  parsers.py          --> XMLParserTJMS para respostas SOAP
  adapters.py         --> Wrappers de compatibilidade (DocumentDownloader, etc)
  constants.py        --> TipoDocumentoTJMS, CodigoMovimento, helpers

TODOS OS SISTEMAS USAM services/tjms:
- Assistencia Judiciaria --> TJMSClient (async)
- Classificador Docs     --> TJMSClient via services_tjms.py
- Relatorio Cumprimento  --> DocumentDownloader adapter
- Prestacao de Contas    --> consultar_processo_async, baixar_documentos_async
- Pedido de Calculo      --> DocumentDownloader adapter
- Gerador de Pecas       --> get_config (configuracao centralizada)

PROXIES:
- Fly.io (SOAP): tjms-proxy.fly.dev
- Local (Playwright/Subconta): ngrok`})})]})]})]})}export{v as TjmsDocsPage};
