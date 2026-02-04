"use strict";var BertTrainingApp=(()=>{var S=Object.defineProperty;var K=Object.getOwnPropertyDescriptor;var Z=Object.getOwnPropertyNames;var Q=Object.prototype.hasOwnProperty;var X=(e,n,t,a)=>{if(n&&typeof n=="object"||typeof n=="function")for(let s of Z(n))!Q.call(e,s)&&s!==t&&S(e,s,{get:()=>n[s],enumerable:!(a=K(n,s))||a.enumerable});return e};var Y=e=>X(S({},"__esModule",{value:!0}),e);var ke={};var T="http://127.0.0.1:8765";function E(){return localStorage.getItem("access_token")||sessionStorage.getItem("access_token")}async function f(e,n={}){let t=E();if(!t)return window.location.href="/login",null;let a=await fetch(`/bert-training${e}`,{...n,headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json",...n.headers}});return a.status===401?(window.location.href="/login",null):a}var R="novo",L=[],B="all",y=null,_=null,I=!1,C=[],v=null,j=[];function D(e){R=e,document.querySelectorAll(".tab-panel").forEach(n=>{n.classList.add("hidden")}),document.querySelectorAll(".tab-btn").forEach(n=>{n.classList.remove("active")}),document.getElementById(`panel-${e}`)?.classList.remove("hidden"),document.getElementById(`tab-${e}`)?.classList.add("active"),e==="novo"&&(k(),H()),e==="acompanhar"&&(h(),pe()),e==="testar"&&(U(),Ee(),$())}async function k(){let e=await f("/api/datasets");if(!e)return;let n=await e.json(),t=document.getElementById("datasets-list");if(t){if(n.length===0){t.innerHTML='<p class="text-gray-500 text-center py-4">Nenhuma planilha enviada ainda.</p>';return}t.innerHTML=n.map(a=>`
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div class="flex items-center gap-3">
        <i class="fas fa-file-excel text-green-600"></i>
        <div>
          <p class="font-medium text-gray-800 text-sm">${d(a.filename)}</p>
          <p class="text-xs text-gray-500">${a.total_rows} exemplos | ${a.total_labels||"?"} categorias</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button onclick="viewDataset(${a.id})" class="text-blue-600 hover:text-blue-800 text-sm px-2">
          <i class="fas fa-eye"></i>
        </button>
      </div>
    </div>
  `).join("")}}async function ee(e){let n=await f(`/api/datasets/${e}`);if(!n)return;let t=await n.json(),a=`
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><strong>Arquivo:</strong> ${d(t.filename)}</div>
        <div><strong>Tipo:</strong> ${t.task_type==="text_classification"?"Classificacao de Texto":"NER"}</div>
        <div><strong>Coluna Texto:</strong> ${d(t.text_column)}</div>
        <div><strong>Coluna Label:</strong> ${d(t.label_column)}</div>
        <div><strong>Total Linhas:</strong> ${t.total_rows}</div>
        <div><strong>Total Categorias:</strong> ${t.total_labels}</div>
      </div>

      <div>
        <strong class="text-sm">Distribuicao de Categorias:</strong>
        <div class="mt-2 max-h-40 overflow-y-auto">
          ${Object.entries(t.label_distribution||{}).map(([u,c])=>`
            <div class="flex justify-between text-sm py-1 border-b">
              <span>${d(u)}</span>
              <span class="text-gray-500">${c}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `,s=document.getElementById("run-detail-title"),o=document.getElementById("run-detail-content"),i=document.getElementById("run-detail-modal");s&&(s.textContent="Detalhes do Dataset"),o&&(o.innerHTML=a),i?.classList.remove("hidden")}function te(){document.getElementById("upload-modal")?.classList.remove("hidden"),A()}function F(){document.getElementById("upload-modal")?.classList.add("hidden"),A()}function A(){document.getElementById("upload-form")?.reset(),document.getElementById("upload-preview")?.classList.add("hidden"),document.getElementById("upload-preview-content")?.classList.add("hidden"),document.getElementById("upload-validation")?.classList.add("hidden"),document.getElementById("btn-validate")?.classList.add("hidden"),document.getElementById("btn-upload")?.classList.add("hidden")}async function ne(e){let t=e.target.files?.[0];if(!t)return;document.getElementById("upload-preview")?.classList.remove("hidden"),document.getElementById("upload-preview-loading")?.classList.remove("hidden"),document.getElementById("upload-preview-content")?.classList.add("hidden");let a=new FormData;a.append("file",t);let s=E();try{let o=await fetch("/bert-training/api/datasets/preview",{method:"POST",headers:{Authorization:`Bearer ${s}`},body:a});if(!o.ok){let r=await o.json();throw new Error(r.detail||"Erro ao analisar arquivo")}let i=await o.json();document.getElementById("upload-preview-loading")?.classList.add("hidden"),document.getElementById("upload-preview-content")?.classList.remove("hidden");let u=document.getElementById("preview-info");u&&(u.innerHTML=`<strong>${d(i.filename)}</strong> - ${i.total_rows} linhas, ${i.total_columns} colunas`);let c=document.getElementById("upload-text-col"),m=document.getElementById("upload-label-col");if(c&&(c.innerHTML='<option value="">Selecione a coluna de texto...</option>'+i.columns.map(r=>`<option value="${d(r)}">${d(r)}</option>`).join("")),m&&(m.innerHTML='<option value="">Selecione a coluna de categorias...</option>'+i.columns.map(r=>`<option value="${d(r)}">${d(r)}</option>`).join("")),i.text_candidates.length>0&&c){c.value=i.text_candidates[0];let r=document.getElementById("text-col-hint");r&&(r.textContent=`Sugestao: ${i.text_candidates.join(", ")}`,r.classList.remove("hidden"))}if(i.label_candidates.length>0&&m){m.value=i.label_candidates[0];let r=document.getElementById("label-col-hint");r&&(r.textContent=`Sugestao: ${i.label_candidates.join(", ")}`,r.classList.remove("hidden"))}let l=document.getElementById("column-stats");if(l&&(l.innerHTML=i.column_stats.map(r=>`
        <div class="border-b py-2">
          <div class="flex justify-between">
            <span class="font-medium">${d(r.name)}</span>
            <span class="text-gray-500">${r.unique_values} valores unicos</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            ${r.null_count>0?`<span class="text-yellow-600">${r.null_count} nulos</span> | `:""}
            Exemplos: ${r.sample_values.slice(0,3).map(p=>d(p)).join(", ")}
          </div>
        </div>
      `).join("")),i.preview_rows&&i.preview_rows.length>0){let r=Object.keys(i.preview_rows[0]),p=document.getElementById("data-preview");p&&(p.innerHTML=`
          <table class="min-w-full text-xs">
            <thead>
              <tr class="bg-gray-100">
                ${r.map(g=>`<th class="px-2 py-1 text-left">${d(g)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${i.preview_rows.slice(0,5).map(g=>`
                <tr class="border-b">
                  ${r.map(x=>`<td class="px-2 py-1 max-w-xs truncate">${d(String(g[x]||"").substring(0,50))}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        `)}document.getElementById("btn-validate")?.classList.remove("hidden"),document.getElementById("btn-upload")?.classList.remove("hidden")}catch(o){let i=document.getElementById("upload-preview-loading");i&&(i.innerHTML=`<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>${d(o.message)}</div>`)}}async function ae(){let n=document.getElementById("upload-file")?.files?.[0];if(!n){alert("Selecione um arquivo");return}let t=document.getElementById("upload-text-col")?.value,a=document.getElementById("upload-label-col")?.value;if(!t||!a){alert("Selecione as colunas de texto e categorias");return}let s=new FormData;s.append("file",n),s.append("task_type",document.getElementById("upload-task-type")?.value||"text_classification"),s.append("text_column",t),s.append("label_column",a);let o=E(),u=await(await fetch("/bert-training/api/datasets/validate",{method:"POST",headers:{Authorization:`Bearer ${o}`},body:s})).json(),c=document.getElementById("upload-validation");c&&(c.classList.remove("hidden"),u.is_valid?c.innerHTML=`
      <div class="bg-green-50 border border-green-200 rounded p-3">
        <p class="text-green-800 font-medium"><i class="fas fa-check-circle mr-2"></i>Validacao OK!</p>
        <p class="text-sm text-green-600">${u.total_rows} linhas validas</p>
      </div>
    `:c.innerHTML=`
      <div class="bg-red-50 border border-red-200 rounded p-3">
        <p class="text-red-800 font-medium"><i class="fas fa-times-circle mr-2"></i>Problemas encontrados</p>
        <ul class="text-sm text-red-600 list-disc ml-4">
          ${u.errors.map(m=>`<li>${d(m)}</li>`).join("")}
        </ul>
      </div>
    `)}async function se(e){e.preventDefault();let t=document.getElementById("upload-file")?.files?.[0];if(!t){alert("Selecione um arquivo");return}let a=document.getElementById("upload-text-col")?.value,s=document.getElementById("upload-label-col")?.value;if(!a||!s){alert("Selecione as colunas de texto e categorias");return}let o=new FormData;o.append("file",t),o.append("task_type",document.getElementById("upload-task-type")?.value||"text_classification"),o.append("text_column",a),o.append("label_column",s);let i=E(),u=await fetch("/bert-training/api/datasets/upload",{method:"POST",headers:{Authorization:`Bearer ${i}`},body:o});if(u.ok){let c=await u.json();alert(c.is_duplicate?"Planilha ja existe!":"Planilha enviada com sucesso!"),F(),k(),H()}else{let c=await u.json();alert("Erro: "+(c.detail||"Falha no upload"))}}async function h(){let e=await f("/api/runs");if(!e)return;let n=await e.json();L=n;let t=n.filter(s=>s.status==="training").length,a=document.getElementById("badge-training");a&&(t>0?(a.textContent=String(t),a.classList.remove("hidden")):a.classList.add("hidden")),O(n)}function oe(e){B=e,document.querySelectorAll("[data-filter]").forEach(t=>{let a=t;a.classList.remove("bg-blue-100","text-blue-700"),a.classList.add("bg-gray-100","text-gray-600"),a.dataset.filter===e&&(a.classList.remove("bg-gray-100","text-gray-600"),a.classList.add("bg-blue-100","text-blue-700"))});let n=L;e!=="all"&&(n=L.filter(t=>t.status===e)),O(n)}function O(e){let n=document.getElementById("runs-list");if(n){if(e.length===0){let t=B==="all"?"Nenhum treinamento encontrado.":`Nenhum treinamento "${M(B)}".`;n.innerHTML=`<p class="text-gray-400 text-center py-8">${t}</p>`;return}n.innerHTML=e.map(t=>`
    <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors" onclick="viewRun(${t.id})">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="font-medium text-gray-900">${d(t.name)}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="inline-block status-${t.status} rounded px-2 py-0.5 text-xs font-medium">${M(t.status)}</span>
            <span class="text-xs text-gray-500">${d(t.base_model.split("/").pop()||"")}</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            ${new Date(t.created_at).toLocaleDateString("pt-BR")}
            ${t.final_accuracy?` | Precisao: ${(t.final_accuracy*100).toFixed(1)}%`:""}
          </div>
        </div>
        <div class="text-gray-400 ml-2">
          <i class="fas fa-chevron-right"></i>
        </div>
      </div>
    </div>
  `).join("")}}function M(e){return{pending:"Na fila",training:"Treinando",completed:"Concluido",failed:"Falhou",cancelled:"Cancelado"}[e]||e}async function ie(e){let n=await f(`/api/runs/${e}`);if(!n)return;let t=await n.json(),a=`
    <div class="space-y-6">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><strong>Status:</strong> <span class="status-${t.status} px-2 py-0.5 rounded">${M(t.status)}</span></div>
        <div><strong>Modelo:</strong> ${d(t.base_model)}</div>
        <div><strong>Dataset:</strong> ${d(t.dataset_filename)}</div>
        <div><strong>Seed:</strong> ${t.config_json?.seed||42}</div>
      </div>

      ${t.error_message?`
        <div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <strong>Erro:</strong> ${d(t.error_message)}
        </div>
      `:""}

      ${t.final_accuracy?`
        <div class="bg-green-50 border border-green-200 rounded p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-green-800">Metricas Finais</h4>
            <button onclick="viewEvaluation(${t.id})" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
              <i class="fas fa-chart-bar mr-1"></i> Ver Resultados Detalhados
            </button>
          </div>
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-green-600">${(t.final_accuracy*100).toFixed(1)}%</div>
              <div class="text-xs text-gray-500">Precisao</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">${((t.final_macro_f1||0)*100).toFixed(1)}%</div>
              <div class="text-xs text-gray-500">F1 Macro</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">${((t.final_weighted_f1||0)*100).toFixed(1)}%</div>
              <div class="text-xs text-gray-500">F1 Ponderado</div>
            </div>
          </div>
        </div>
      `:""}

      ${t.recent_metrics&&t.recent_metrics.length>0?`
        <div>
          <h4 class="font-medium mb-2">Progresso</h4>
          <canvas id="metrics-chart" height="200"></canvas>
        </div>
      `:""}

      <details class="border rounded-lg p-3">
        <summary class="cursor-pointer font-medium text-sm">Configuracao Completa</summary>
        <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">${d(JSON.stringify(t.config_json,null,2))}</pre>
      </details>
    </div>
  `,s=document.getElementById("run-detail-title"),o=document.getElementById("run-detail-content"),i=document.getElementById("run-detail-modal");s&&(s.textContent=t.name),o&&(o.innerHTML=a),i?.classList.remove("hidden"),t.recent_metrics&&t.recent_metrics.length>0&&re(t.recent_metrics)}function re(e){let t=document.getElementById("metrics-chart")?.getContext("2d");t&&new Chart(t,{type:"line",data:{labels:e.map(a=>`Rodada ${a.epoch}`),datasets:[{label:"Loss Treino",data:e.map(a=>a.train_loss),borderColor:"rgb(239, 68, 68)",tension:.1},{label:"Loss Validacao",data:e.map(a=>a.val_loss),borderColor:"rgb(59, 130, 246)",tension:.1},{label:"Precisao",data:e.map(a=>a.val_accuracy),borderColor:"rgb(34, 197, 94)",tension:.1,yAxisID:"y1"}]},options:{responsive:!0,scales:{y:{type:"linear",display:!0,position:"left",title:{display:!0,text:"Loss"}},y1:{type:"linear",display:!0,position:"right",title:{display:!0,text:"Precisao"},grid:{drawOnChartArea:!1}}}}})}function z(){document.getElementById("run-detail-modal")?.classList.add("hidden")}async function le(e){let n=await f(`/api/runs/${e}/evaluation`);if(!n||!n.ok){let m=await n?.json();b(m?.detail||"Erro ao carregar avalia\xE7\xE3o","error");return}let t=await n.json();z();let a=t.summary,s=t.metrics,o=`
    <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <!-- M\xE9tricas Gerais -->
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <h4 class="font-medium text-green-800 mb-3">M\xE9tricas Gerais</h4>
        <div class="grid grid-cols-4 gap-4 text-center">
          <div>
            <div class="text-2xl font-bold text-green-600">${s.accuracy?(s.accuracy*100).toFixed(1):"-"}%</div>
            <div class="text-xs text-gray-500">Accuracy</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-blue-600">${s.macro_f1?(s.macro_f1*100).toFixed(1):"-"}%</div>
            <div class="text-xs text-gray-500">F1 Macro</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-purple-600">${s.weighted_f1?(s.weighted_f1*100).toFixed(1):"-"}%</div>
            <div class="text-xs text-gray-500">F1 Weighted</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-orange-600">${s.val_loss?.toFixed(4)||"-"}</div>
            <div class="text-xs text-gray-500">Val Loss</div>
          </div>
        </div>
      </div>
  `;if(a){o+=`
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-blue-600">${a.total_samples}</div>
          <div class="text-xs text-gray-500">Total de Amostras</div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-green-600">${a.total_correct}</div>
          <div class="text-xs text-gray-500">Classifica\xE7\xF5es Corretas</div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-red-600">${a.total_errors}</div>
          <div class="text-xs text-gray-500">Erros</div>
        </div>
      </div>
    `,o+=`
      <div>
        <h4 class="font-medium text-gray-800 mb-2">M\xE9tricas por Classe</h4>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm border rounded-lg overflow-hidden">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Classe</th>
                <th class="px-3 py-2 text-center font-medium">Amostras</th>
                <th class="px-3 py-2 text-center font-medium">Corretas</th>
                <th class="px-3 py-2 text-center font-medium">Erros</th>
                <th class="px-3 py-2 text-center font-medium">Precision</th>
                <th class="px-3 py-2 text-center font-medium">Recall</th>
                <th class="px-3 py-2 text-center font-medium">F1</th>
              </tr>
            </thead>
            <tbody>
    `;let m=[...a.classes].sort((l,r)=>r.errors-l.errors);for(let l of m){let r=l.total>0?l.errors/l.total*100:0,p=r>30?"bg-red-50":r>15?"bg-yellow-50":"";o+=`
        <tr class="border-b ${p}">
          <td class="px-3 py-2 font-medium">${d(l.label)}</td>
          <td class="px-3 py-2 text-center">${l.total}</td>
          <td class="px-3 py-2 text-center text-green-600">${l.correct}</td>
          <td class="px-3 py-2 text-center ${l.errors>0?"text-red-600 font-medium":"text-gray-400"}">${l.errors}</td>
          <td class="px-3 py-2 text-center">${(l.precision*100).toFixed(1)}%</td>
          <td class="px-3 py-2 text-center">${(l.recall*100).toFixed(1)}%</td>
          <td class="px-3 py-2 text-center">${(l.f1*100).toFixed(1)}%</td>
        </tr>
      `}o+=`
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          <span class="inline-block w-3 h-3 bg-red-50 border rounded mr-1"></span> Taxa de erro > 30%
          <span class="inline-block w-3 h-3 bg-yellow-50 border rounded ml-3 mr-1"></span> Taxa de erro > 15%
        </p>
      </div>
    `}if(t.confusion_matrix&&t.summary){let m=t.summary.labels,l=t.confusion_matrix;o+=`
      <details class="border rounded-lg p-3">
        <summary class="cursor-pointer font-medium text-sm">
          <i class="fas fa-th mr-2"></i>Matriz de Confus\xE3o
        </summary>
        <div class="mt-3 overflow-x-auto">
          <table class="text-xs border">
            <thead>
              <tr>
                <th class="p-1 bg-gray-100 text-left">Real \\ Pred</th>
                ${m.map(r=>`<th class="p-1 bg-gray-100 text-center" title="${d(r)}">${d(r.substring(0,10))}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
    `;for(let r=0;r<m.length;r++){o+=`<tr><th class="p-1 bg-gray-50 text-left" title="${d(m[r])}">${d(m[r].substring(0,10))}</th>`;for(let p=0;p<m.length;p++){let g=l[r]?.[p]||0,w=r===p?g>0?"bg-green-100 text-green-800":"bg-gray-50":g>0?"bg-red-100 text-red-800":"bg-gray-50 text-gray-300";o+=`<td class="p-1 text-center ${w}">${g}</td>`}o+="</tr>"}o+=`
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          <span class="inline-block w-3 h-3 bg-green-100 border rounded mr-1"></span> Diagonal = correto
          <span class="inline-block w-3 h-3 bg-red-100 border rounded ml-3 mr-1"></span> Fora da diagonal = erro
        </p>
      </details>
    `}o+="</div>";let i=document.getElementById("run-detail-title"),u=document.getElementById("run-detail-content"),c=document.getElementById("run-detail-modal");i&&(i.textContent=`Avalia\xE7\xE3o: ${t.run_name}`),u&&(u.innerHTML=o),c?.classList.remove("hidden")}function ce(){let n=document.getElementById("training-progress-chart")?.getContext("2d");n&&(v&&v.destroy(),j=[],v=new Chart(n,{type:"line",data:{labels:[],datasets:[{label:"Train Loss",data:[],borderColor:"rgb(239, 68, 68)",backgroundColor:"rgba(239, 68, 68, 0.1)",tension:.3,yAxisID:"y",pointRadius:4,pointHoverRadius:6},{label:"Val Loss",data:[],borderColor:"rgb(249, 115, 22)",backgroundColor:"rgba(249, 115, 22, 0.1)",tension:.3,yAxisID:"y",pointRadius:4,pointHoverRadius:6},{label:"Accuracy",data:[],borderColor:"rgb(34, 197, 94)",backgroundColor:"rgba(34, 197, 94, 0.1)",tension:.3,yAxisID:"y1",pointRadius:4,pointHoverRadius:6}]},options:{responsive:!0,maintainAspectRatio:!1,interaction:{mode:"index",intersect:!1},plugins:{legend:{display:!1},tooltip:{callbacks:{label:function(t){let a=t.dataset.label||"",s=t.parsed.y;return a==="Accuracy"?`${a}: ${(s*100).toFixed(2)}%`:`${a}: ${s.toFixed(4)}`}}}},scales:{x:{title:{display:!0,text:"Epoch",font:{size:11}},ticks:{font:{size:10}}},y:{type:"linear",display:!0,position:"left",title:{display:!0,text:"Loss",font:{size:11}},ticks:{font:{size:10}},min:0},y1:{type:"linear",display:!0,position:"right",title:{display:!0,text:"Accuracy",font:{size:11}},ticks:{font:{size:10},callback:function(t){return(t*100).toFixed(0)+"%"}},min:0,max:1,grid:{drawOnChartArea:!1}}}}}))}function de(e){if(!e||e.length===0||(v||ce(),!v))return;let n=e.map(o=>`${o.epoch}`),t=e.map(o=>o.train_loss),a=e.map(o=>o.val_loss),s=e.map(o=>o.val_accuracy);v.data.labels=n,v.data.datasets[0].data=t,v.data.datasets[1].data=a,v.data.datasets[2].data=s,v.update("none")}function ue(){v&&(v.destroy(),v=null,j=[])}async function me(){try{let e=await f("/api/workers/start-local",{method:"POST"});e&&e.ok&&((await e.json()).status==="already_running"?b("Worker j\xE1 est\xE1 em execu\xE7\xE3o","info"):b("Worker local iniciado! O treinamento come\xE7ar\xE1 em breve.","success"),setTimeout(()=>h(),3e3))}catch(e){console.error("Erro ao iniciar worker:",e),b("Erro ao iniciar worker","error")}}function pe(){let e=L.filter(t=>t.status==="training"),n=L.filter(t=>t.status==="pending");e.length>0?(y=e[0].id,document.getElementById("active-training-card")?.classList.remove("hidden"),document.getElementById("pending-runs-alert")?.classList.add("hidden"),W()):n.length>0?(document.getElementById("active-training-card")?.classList.add("hidden"),y=null,ge(n.length)):(document.getElementById("active-training-card")?.classList.add("hidden"),document.getElementById("pending-runs-alert")?.classList.add("hidden"),y=null)}function ge(e){let n=document.getElementById("pending-runs-alert");if(!n){let t=document.getElementById("active-training-card")?.parentElement;if(!t)return;n=document.createElement("div"),n.id="pending-runs-alert",n.className="section-card p-4 bg-yellow-50 border-yellow-200",t.insertBefore(n,document.getElementById("active-training-card"))}n.innerHTML=`
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
          <i class="fas fa-hourglass-half text-yellow-600"></i>
        </div>
        <div>
          <h3 class="font-semibold text-yellow-800">${e} treinamento(s) na fila</h3>
          <p class="text-sm text-yellow-600">Worker n\xE3o detectado. Clique para iniciar.</p>
        </div>
      </div>
      <button onclick="startLocalWorker()" class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors">
        <i class="fas fa-play mr-2"></i>Iniciar Worker
      </button>
    </div>
  `,n.classList.remove("hidden")}async function W(){if(y)try{let e=await f(`/api/runs/${y}/progress`);if(!e||!e.ok)return;let n=await e.json();if(n.status!=="training"){fe(n);return}let t=document.getElementById("active-training-name"),a=document.getElementById("active-training-status"),s=document.getElementById("active-training-progress-label"),o=document.getElementById("active-training-progress-bar"),i=document.getElementById("active-training-time-remaining");if(t&&(t.textContent=n.run_name||"Treinamento"),n.batch_progress){let l=n.batch_progress;a&&(a.innerHTML=`
          <span>Epoch ${l.epoch} de ${n.total_epochs||"?"}</span>
          <span class="text-gray-400 mx-1">|</span>
          <span class="text-blue-600">Batch ${l.current}/${l.total}</span>
          <span class="text-gray-400 mx-1">(${l.percent.toFixed(0)}%)</span>
          ${l.epoch_remaining_label?`<span class="text-xs text-gray-500 ml-1">${l.epoch_remaining_label}</span>`:""}
        `);let r=(n.current_epoch||0)/(n.total_epochs||10)*100,p=l.percent/100*(100/(n.total_epochs||10)),g=Math.min(100,r+p);s&&(s.textContent=`${g.toFixed(0)}%`),o&&(o.style.width=`${g}%`)}else a&&(a.textContent=`Rodada ${n.current_epoch||0} de ${n.total_epochs||"?"}`),s&&(s.textContent=`${(n.progress_percent||0).toFixed(0)}%`),o&&(o.style.width=`${n.progress_percent||0}%`);if(n.estimated_remaining_label&&i&&(i.textContent=n.estimated_remaining_label),n.latest_metrics){let l=n.latest_metrics,r=document.getElementById("metric-loss"),p=document.getElementById("metric-accuracy"),g=document.getElementById("metric-f1"),x=document.getElementById("metric-epoch");r&&(r.textContent=l.val_loss?.toFixed(4)||"-");let w=n.best_metrics?.val_accuracy||l.val_accuracy;p&&(p.textContent=w?`${(w*100).toFixed(1)}%`:"-"),g&&(g.textContent=l.val_macro_f1?`${(l.val_macro_f1*100).toFixed(1)}%`:"-"),x&&(x.textContent=`${n.current_epoch||0}/${n.total_epochs||"?"}`)}let u=document.getElementById("worker-info-section");if(n.worker_info&&u){u.classList.remove("hidden");let l=document.getElementById("worker-gpu-name"),r=document.getElementById("worker-gpu-vram"),p=document.getElementById("worker-cuda-version");l&&(l.textContent=n.worker_info.gpu_name||"GPU Desconhecida"),r&&(r.textContent=n.worker_info.gpu_vram_gb?.toFixed(1)||"?"),p&&(p.textContent=n.worker_info.cuda_version||"?")}else u&&u.classList.add("hidden");n.metrics_history&&n.metrics_history.length>0&&de(n.metrics_history);let c=document.getElementById("recent-logs-container"),m=document.getElementById("logs-update-time");n.recent_logs&&n.recent_logs.length>0&&c?(c.innerHTML=n.recent_logs.map(l=>{let r=l.level==="ERROR"?"text-red-400":l.level==="WARNING"?"text-yellow-400":l.level==="INFO"?"text-green-400":"text-gray-400",p=l.timestamp?new Date(l.timestamp).toLocaleTimeString("pt-BR"):"";return`<div class="py-0.5"><span class="${r}">[${l.level}]</span> <span class="text-gray-500">${p}</span> <span class="text-gray-300">${d(l.message)}</span></div>`}).join(""),m&&(m.textContent=`Atualizado ${new Date().toLocaleTimeString("pt-BR")}`)):c&&n.status==="training"&&(c.innerHTML='<p class="text-gray-500">Aguardando logs do worker...</p>')}catch(e){console.error("Erro ao atualizar progresso:",e)}}function fe(e){let n=document.getElementById("active-training-card"),t=document.getElementById("active-training-name"),a=document.getElementById("active-training-status"),s=document.getElementById("active-training-progress-bar"),o=document.getElementById("active-training-progress-label"),i=document.getElementById("active-training-time-remaining"),u=document.getElementById("recent-logs-container"),c=e.best_metrics?.val_accuracy,m=e.best_metrics?.epoch;e.status==="completed"?(t&&(t.textContent="\u2713 Treinamento Conclu\xEDdo!"),a&&(a.innerHTML=c?`<span class="text-green-600 font-semibold">Melhor precis\xE3o: ${(c*100).toFixed(1)}% (epoch ${m})</span>`:"Conclu\xEDdo"),s&&(s.style.width="100%",s.classList.remove("bg-blue-600"),s.classList.add("bg-green-500")),o&&(o.textContent="100%"),i&&(i.textContent="Finalizado"),b(`Treinamento conclu\xEDdo! Precis\xE3o: ${c?(c*100).toFixed(1)+"%":"N/A"}`,"success")):e.status==="stopping"?(t&&(t.textContent="Finalizando..."),a&&(a.textContent="Salvando melhor modelo..."),s&&(s.classList.remove("bg-blue-600"),s.classList.add("bg-yellow-500")),i&&(i.textContent="Finalizando...")):e.status==="failed"?(t&&(t.textContent="\u2717 Treinamento Falhou"),a&&(a.innerHTML='<span class="text-red-600">Erro durante o treinamento</span>'),s&&(s.classList.remove("bg-blue-600"),s.classList.add("bg-red-500")),i&&(i.textContent=""),b("Treinamento falhou","error")):e.status==="cancelled"&&(t&&(t.textContent="Treinamento Cancelado"),a&&(a.innerHTML='<span class="text-gray-600">Cancelado pelo usu\xE1rio</span>'),s&&(s.classList.remove("bg-blue-600"),s.classList.add("bg-gray-400")),i&&(i.textContent=""));let l=n?.querySelector(".flex.gap-2");if(l&&e.status!=="stopping"&&(l.innerHTML=`
      <button onclick="loadRuns()" class="text-blue-600 hover:text-blue-800 text-sm">
        <i class="fas fa-sync-alt mr-1"></i> Atualizar Lista
      </button>
    `),u&&e.status==="completed"){let r=`
      <div class="bg-green-900/30 border border-green-700 rounded p-3 my-2">
        <div class="text-green-400 font-semibold mb-2">\u2713 Treinamento Conclu\xEDdo</div>
        <div class="text-sm text-gray-300">
          <div>Epochs: ${e.current_epoch}/${e.total_epochs}</div>
          ${c?`<div>Melhor Precis\xE3o: <span class="text-green-400 font-bold">${(c*100).toFixed(2)}%</span> (epoch ${m})</div>`:""}
        </div>
      </div>
    `;u.innerHTML=r+u.innerHTML}e.status!=="stopping"&&setTimeout(()=>{h(),y=null,ue()},2e3)}async function ve(){if(y&&confirm("Tem certeza que deseja CANCELAR o treinamento? O modelo N\xC3O ser\xE1 salvo."))try{let e=await f(`/api/runs/${y}/cancel`,{method:"POST"});e&&e.ok&&(b("Treinamento cancelado","warning"),await h())}catch(e){console.error("Erro ao cancelar:",e),b("Erro ao cancelar treinamento","error")}}async function be(){if(!(!y||!confirm(`Deseja FINALIZAR o treinamento agora?

\u2713 O modelo com MELHOR precis\xE3o ser\xE1 salvo
\u2713 O treinamento ser\xE1 marcado como conclu\xEDdo

Isso \xE9 \xFAtil quando a precis\xE3o j\xE1 estabilizou.`)))try{let n=await f(`/api/runs/${y}/stop-early`,{method:"POST"});if(n&&n.ok){let t=await n.json();b(`Finalizando... Melhor precis\xE3o: ${t.best_accuracy}% (epoch ${t.best_epoch})`,"success");let a=document.getElementById("training-status-text");a&&(a.textContent="Finalizando...")}}catch(n){console.error("Erro ao finalizar:",n),b("Erro ao solicitar finaliza\xE7\xE3o","error")}}async function H(){let e=await f("/api/datasets");if(!e)return;let n=await e.json(),t=document.getElementById("run-dataset");t&&(t.innerHTML='<option value="">Selecione uma planilha...</option>'+n.map(a=>`<option value="${a.id}">${d(a.filename)} (${a.total_rows} exemplos)</option>`).join(""),ye())}async function ye(){if(_){P(_);return}let e=await f("/api/presets");if(!e)return;_=(await e.json()).presets,_&&P(_)}function P(e){let n=document.getElementById("presets-container");if(!n)return;let t={rapido:"fa-bolt",equilibrado:"fa-balance-scale",preciso:"fa-bullseye"};n.innerHTML=e.map(s=>`
    <div class="preset-card border-2 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-all ${s.is_recommended?"border-blue-300 bg-blue-50":"border-gray-200"}"
         data-preset="${s.name}"
         onclick="selectPreset('${s.name}')">
      <div class="flex flex-col items-center text-center">
        <i class="fas ${t[s.name]||"fa-cog"} text-2xl text-blue-600 mb-2"></i>
        <h3 class="font-bold">${d(s.display_name)}</h3>
        ${s.is_recommended?'<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">Recomendado</span>':""}
        <p class="text-xs text-gray-600 mt-2">${d(s.description)}</p>
        <div class="text-xs text-gray-400 mt-2">
          ~${s.estimated_time_minutes_min}-${s.estimated_time_minutes_max} min
        </div>
      </div>
    </div>
  `).join("");let a=e.find(s=>s.is_recommended)||e[1];a&&q(a.name)}function q(e){document.querySelectorAll(".preset-card").forEach(a=>{let s=a;s.classList.remove("border-blue-500","bg-blue-100"),s.dataset.preset===e&&s.classList.add("border-blue-500","bg-blue-100")});let n=document.getElementById("selected-preset");n&&(n.value=e);let t=document.getElementById("preset-warning");t&&(e==="rapido"?(t.innerHTML=`
      <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
        <i class="fas fa-info-circle mr-2"></i>Modo rapido: ideal para testar se a planilha esta correta.
      </div>
    `,t.classList.remove("hidden")):e==="preciso"?(t.innerHTML=`
      <div class="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
        <i class="fas fa-clock mr-2"></i>Modo preciso: pode demorar varias horas.
      </div>
    `,t.classList.remove("hidden")):t.classList.add("hidden"))}async function xe(e){e.preventDefault();let n=document.getElementById("selected-preset")?.value||"",t={name:document.getElementById("run-name")?.value,description:document.getElementById("run-description")?.value||null,dataset_id:parseInt(document.getElementById("run-dataset")?.value||"0"),base_model:document.getElementById("run-model")?.value,preset_name:n},a={},s=!1,o=document.getElementById("run-epochs")?.value;o&&(a.epochs=parseInt(o),s=!0);let i=document.getElementById("run-lr")?.value;i&&(a.learning_rate=parseFloat(i),s=!0);let u=document.getElementById("run-batch")?.value;u&&(a.batch_size=parseInt(u),s=!0);let c=document.getElementById("run-maxlen")?.value;c&&(a.max_length=parseInt(c),s=!0);let m=document.getElementById("run-split")?.value;m&&(a.train_split=parseFloat(m),s=!0);let l=document.getElementById("run-patience")?.value;l&&(a.early_stopping_patience=parseInt(l),s=!0);let r=document.getElementById("run-seed")?.value;r&&r!=="42"&&(a.seed=parseInt(r),s=!0);let p=document.getElementById("run-class-weights");p&&!p.checked&&(a.use_class_weights=!1,s=!0),s&&(t.hyperparameters=a);let g=await f("/api/runs",{method:"POST",body:JSON.stringify(t)});if(g&&g.ok){let x=await g.json();alert(`Treinamento "${x.name}" iniciado!

Acompanhe na aba "Acompanhar".`),document.getElementById("new-run-form")?.reset(),D("acompanhar")}else if(g){let x=await g.json();alert("Erro: "+(x.detail||"Falha ao criar treinamento"))}}async function U(){let e=document.getElementById("worker-status-icon"),n=document.getElementById("worker-status-text");try{let t=await fetch(`${T}/health`,{method:"GET"});if(t.ok){let a=await t.json();I=!0,e?.classList.remove("bg-gray-300","bg-red-500"),e?.classList.add("bg-green-500"),n&&(n.textContent=`Conectado ao worker local ${a.cuda_available?"(GPU disponivel)":"(somente CPU)"}`),we()}else throw new Error("Worker nao respondeu")}catch{I=!1,e?.classList.remove("bg-gray-300","bg-green-500"),e?.classList.add("bg-red-500"),n&&(n.innerHTML=`
        <span>Servidor de infer\xEAncia n\xE3o conectado.</span>
        <button onclick="startInferenceServer()" class="ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded">
          Iniciar Servidor
        </button>
      `)}}async function he(){try{let e=await f("/api/workers/start-inference",{method:"POST"});e&&e.ok&&(b("Servidor de infer\xEAncia iniciando...","success"),setTimeout(()=>U(),3e3))}catch(e){console.error("Erro ao iniciar servidor de infer\xEAncia:",e),b("Erro ao iniciar servidor","error")}}async function Ee(){let e=await f("/api/models/completed");e&&(C=await e.json(),V())}async function we(){if(I)try{let e=await fetch(`${T}/models`);if(!e.ok)return;let t=(await e.json()).models||[];C.forEach(a=>{let s=t.find(o=>o.run_id===a.id);a.available_locally=!!s,s&&(a.local_path=s.name)}),V()}catch(e){console.error("Erro ao carregar modelos locais:",e)}}function V(){let e=document.getElementById("test-model-select");e&&(e.innerHTML='<option value="">Selecione um modelo...</option>'+C.map(n=>{let t=n.final_accuracy?` | ${(n.final_accuracy*100).toFixed(1)}%`:"",a=n.available_locally?" [LOCAL]":" [nao disponivel localmente]";return`<option value="${n.id}" data-local="${n.local_path||""}" ${n.available_locally?"":"disabled"}>
          ${d(n.name)}${t}${a}
        </option>`}).join(""))}function _e(e){let n=document.getElementById("test-mode-text"),t=document.getElementById("test-mode-pdf");n?.classList.toggle("border-purple-500",e==="text"),n?.classList.toggle("text-purple-600",e==="text"),n?.classList.toggle("border-transparent",e!=="text"),n?.classList.toggle("text-gray-500",e!=="text"),t?.classList.toggle("border-purple-500",e==="pdf"),t?.classList.toggle("text-purple-600",e==="pdf"),t?.classList.toggle("border-transparent",e!=="pdf"),t?.classList.toggle("text-gray-500",e!=="pdf"),document.getElementById("test-input-text")?.classList.toggle("hidden",e!=="text"),document.getElementById("test-input-pdf")?.classList.toggle("hidden",e!=="pdf")}function Le(e){let t=e.target.files?.[0];if(t){let a=document.getElementById("test-pdf-filename");a&&(a.textContent=t.name)}}async function Ie(){if(!I){alert("Worker local nao conectado. Inicie o servidor de inferencia primeiro.");return}let e=document.getElementById("test-model-select"),n=e?.value,t=e?.options[e.selectedIndex]?.dataset?.local;if(!n||!t){alert("Selecione um modelo disponivel localmente.");return}let a=document.getElementById("test-text-input")?.value.trim();if(!a){alert("Digite ou cole um texto para classificar.");return}let s=document.getElementById("btn-classify-text");s&&(s.disabled=!0,s.innerHTML='<i class="fas fa-spinner fa-spin mr-2"></i> Classificando...');try{let o=await fetch(`${T}/predict`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:t,text:a})});if(!o.ok){let u=await o.json();throw new Error(u.error||"Erro na classificacao")}let i=await o.json();N(i),G(parseInt(n),"text",a,null,i)}catch(o){alert("Erro: "+o.message)}finally{s&&(s.disabled=!1,s.innerHTML='<i class="fas fa-magic mr-2"></i> Classificar')}}async function Te(){if(!I){alert("Worker local nao conectado. Inicie o servidor de inferencia primeiro.");return}let e=document.getElementById("test-model-select"),n=e?.value,t=e?.options[e.selectedIndex]?.dataset?.local;if(!n||!t){alert("Selecione um modelo disponivel localmente.");return}let s=document.getElementById("test-pdf-input")?.files?.[0];if(!s){alert("Selecione um arquivo PDF.");return}let o=document.getElementById("btn-classify-pdf");o&&(o.disabled=!0,o.innerHTML='<i class="fas fa-spinner fa-spin mr-2"></i> Classificando...');try{let i=new FormData;i.append("model",t),i.append("file",s);let u=await fetch(`${T}/predict/pdf`,{method:"POST",body:i});if(!u.ok){let m=await u.json();throw new Error(m.error||"Erro na classificacao")}let c=await u.json();N(c),G(parseInt(n),"pdf",`[PDF: ${s.name}]`,s.name,c)}catch(i){alert("Erro: "+i.message)}finally{o&&(o.disabled=!1,o.innerHTML='<i class="fas fa-magic mr-2"></i> Classificar PDF')}}function N(e){document.getElementById("test-result")?.classList.remove("hidden");let n=document.getElementById("test-result-category"),t=document.getElementById("test-result-confidence");n&&(n.textContent=e.predicted_label),t&&(t.textContent=`${(e.confidence*100).toFixed(1)}%`)}async function G(e,n,t,a,s){let o=new FormData;o.append("run_id",String(e)),o.append("input_type",n),o.append("input_text",t.substring(0,5e3)),o.append("predicted_label",s.predicted_label),o.append("confidence",String(s.confidence)),a&&o.append("input_filename",a);let i=E();await fetch("/bert-training/api/tests",{method:"POST",headers:{Authorization:`Bearer ${i}`},body:o}),$()}async function $(){let e=await f("/api/tests?limit=20");if(!e)return;let n=await e.json(),t=document.getElementById("test-history-list");if(t){if(n.length===0){t.innerHTML='<p class="text-center py-4 text-gray-400 text-sm">Nenhum teste realizado ainda.</p>';return}t.innerHTML=n.map(a=>`
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <i class="fas ${a.input_type==="pdf"?"fa-file-pdf text-red-500":"fa-font text-blue-500"}"></i>
          <span class="font-medium text-gray-800">${d(a.predicted_label)}</span>
          <span class="text-gray-400">${(a.confidence*100).toFixed(0)}%</span>
        </div>
        <p class="text-xs text-gray-500 truncate mt-1">${d(a.input_filename||a.input_text)}</p>
      </div>
      <button onclick="deleteTest(${a.id})" class="text-red-500 hover:text-red-700 ml-2">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join("")}}async function $e(e){confirm("Deletar este teste?")&&(await f(`/api/tests/${e}`,{method:"DELETE"}),$())}async function Be(){confirm("Limpar todo o historico de testes?")&&(await f("/api/tests",{method:"DELETE"}),$())}function J(){document.getElementById("onboarding-modal")?.classList.remove("hidden")}function Me(){document.getElementById("dont-show-again")?.checked&&localStorage.setItem("bert_onboarding_done","true"),document.getElementById("onboarding-modal")?.classList.add("hidden")}function Ce(){localStorage.getItem("bert_onboarding_done")||J()}function d(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;")}function b(e,n="info"){let t=document.getElementById("toast-notification");t&&t.remove();let a={success:"bg-green-500",error:"bg-red-500",warning:"bg-yellow-500",info:"bg-blue-500"},s={success:"fa-check-circle",error:"fa-times-circle",warning:"fa-exclamation-triangle",info:"fa-info-circle"},o=document.createElement("div");o.id="toast-notification",o.className=`fixed bottom-4 right-4 ${a[n]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in`,o.innerHTML=`
    <i class="fas ${s[n]}"></i>
    <span>${d(e)}</span>
  `,document.body.appendChild(o),setTimeout(()=>{o.classList.add("opacity-0","transition-opacity","duration-300"),setTimeout(()=>o.remove(),300)},4e3)}document.addEventListener("DOMContentLoaded",async()=>{if(!E()){window.location.href="/login";return}Ce(),k(),H(),h(),document.getElementById("upload-file")?.addEventListener("change",ne),document.getElementById("upload-form")?.addEventListener("submit",se),document.getElementById("new-run-form")?.addEventListener("submit",xe),document.getElementById("test-pdf-input")?.addEventListener("change",Le),setInterval(()=>{R==="acompanhar"&&(h(),y&&W())},5e3)});window.showTab=D;window.viewDataset=ee;window.showUploadModal=te;window.closeUploadModal=F;window.validateDataset=ae;window.filterRuns=oe;window.viewRun=ie;window.viewEvaluation=le;window.closeRunDetail=z;window.cancelTraining=ve;window.stopEarly=be;window.startLocalWorker=me;window.startInferenceServer=he;window.selectPreset=q;window.setTestMode=_e;window.classifyText=Ie;window.classifyPdf=Te;window.deleteTest=$e;window.clearTestHistory=Be;window.showOnboarding=J;window.closeOnboarding=Me;return Y(ke);})();
