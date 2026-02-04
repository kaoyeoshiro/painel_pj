/**
 * BERT Training - Frontend Application
 * Portal PGE-MS
 *
 * Migrado de JavaScript para TypeScript
 */

export {};

// ============================================
// Types
// ============================================

interface Dataset {
  id: number;
  filename: string;
  task_type: 'text_classification' | 'ner';
  text_column: string;
  label_column: string;
  total_rows: number;
  total_labels: number;
  label_distribution?: Record<string, number>;
}

interface PreviewData {
  filename: string;
  total_rows: number;
  total_columns: number;
  columns: string[];
  text_candidates: string[];
  label_candidates: string[];
  column_stats: ColumnStats[];
  preview_rows: Record<string, unknown>[];
}

interface ColumnStats {
  name: string;
  unique_values: number;
  null_count: number;
  sample_values: string[];
}

interface Run {
  id: number;
  name: string;
  description?: string;
  status: RunStatus;
  base_model: string;
  dataset_filename: string;
  config_json?: RunConfig;
  error_message?: string;
  final_accuracy?: number;
  final_macro_f1?: number;
  final_weighted_f1?: number;
  recent_metrics?: Metric[];
  created_at: string;
}

type RunStatus = 'pending' | 'training' | 'completed' | 'failed' | 'cancelled';

interface RunConfig {
  seed?: number;
  epochs?: number;
  learning_rate?: number;
  batch_size?: number;
  max_length?: number;
  train_split?: number;
  early_stopping_patience?: number;
  use_class_weights?: boolean;
}

interface Metric {
  epoch: number;
  train_loss: number;
  val_loss: number;
  val_accuracy: number;
  val_macro_f1?: number;
}

interface WorkerInfo {
  name: string;
  gpu_name: string;
  gpu_vram_gb: number;
  cuda_version: string;
  is_active: boolean;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
}

interface BestMetric {
  epoch: number;
  val_accuracy: number;
  val_loss?: number;
}

interface MetricHistory {
  epoch: number;
  train_loss: number | null;
  val_loss: number | null;
  val_accuracy: number | null;
}

interface BatchProgress {
  current: number;
  total: number;
  percent: number;
  epoch: number;
  epoch_remaining_seconds?: number;
  epoch_remaining_label?: string;
}

interface TrainingProgress {
  run_name: string;
  current_epoch: number;
  total_epochs: number;
  progress_percent: number;
  estimated_remaining_label?: string;
  latest_metrics?: Metric;
  best_metrics?: BestMetric;
  worker_info?: WorkerInfo;
  recent_logs?: LogEntry[];
  status?: string;
  metrics_history?: MetricHistory[];
  batch_progress?: BatchProgress;
}

interface Preset {
  name: string;
  display_name: string;
  description: string;
  is_recommended: boolean;
  estimated_time_minutes_min: number;
  estimated_time_minutes_max: number;
}

interface CompletedModel {
  id: number;
  name: string;
  final_accuracy?: number;
  available_locally?: boolean;
  local_path?: string;
}

interface LocalModel {
  run_id: number;
  name: string;
}

interface TestResult {
  predicted_label: string;
  confidence: number;
}

interface TestHistoryItem {
  id: number;
  input_type: 'text' | 'pdf';
  input_text: string;
  input_filename?: string;
  predicted_label: string;
  confidence: number;
}

interface ClassStat {
  label: string;
  total: number;
  correct: number;
  errors: number;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

interface EvaluationSummary {
  total_samples: number;
  total_correct: number;
  total_errors: number;
  classes: ClassStat[];
  labels: string[];
}

interface EvaluationResult {
  run_id: number;
  run_name: string;
  epoch: number;
  metrics: {
    accuracy: number | null;
    macro_f1: number | null;
    weighted_f1: number | null;
    train_loss: number | null;
    val_loss: number | null;
  };
  classification_report: Record<string, Record<string, number>>;
  confusion_matrix: number[][];
  summary?: EvaluationSummary;
}

// Extensão do Chart.js
declare const Chart: {
  new (ctx: CanvasRenderingContext2D, config: unknown): unknown;
};

// ============================================
// Config
// ============================================

const WORKER_URL = 'http://127.0.0.1:8765';

// ============================================
// Auth
// ============================================

function getToken(): string | null {
  return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
}

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<Response | null> {
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    return null;
  }

  const response = await fetch(`/bert-training${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    window.location.href = '/login';
    return null;
  }

  return response;
}

// ============================================
// State
// ============================================

let currentTab = 'novo';
let allRuns: Run[] = [];
let currentFilter = 'all';
let activeTrainingRunId: number | null = null;
let presetsCache: Preset[] | null = null;
let workerConnected = false;
let completedModels: CompletedModel[] = [];
let trainingChart: any = null;
let trainingChartData: { epoch: number; trainLoss: number; valLoss: number; accuracy: number }[] = [];

// Declare Chart.js global
declare const Chart: any;

// ============================================
// Tabs
// ============================================

function showTab(tabName: string): void {
  currentTab = tabName;

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.add('hidden');
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  document.getElementById(`panel-${tabName}`)?.classList.remove('hidden');
  document.getElementById(`tab-${tabName}`)?.classList.add('active');

  if (tabName === 'novo') {
    loadDatasets();
    loadDatasetsForSelect();
  }
  if (tabName === 'acompanhar') {
    loadRuns();
    checkActiveTraining();
  }
  if (tabName === 'testar') {
    checkWorkerConnection();
    loadCompletedModels();
    loadTestHistory();
  }
}

// ============================================
// Datasets
// ============================================

async function loadDatasets(): Promise<void> {
  const response = await apiCall('/api/datasets');
  if (!response) return;

  const datasets: Dataset[] = await response.json();
  const container = document.getElementById('datasets-list');
  if (!container) return;

  if (datasets.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma planilha enviada ainda.</p>';
    return;
  }

  container.innerHTML = datasets
    .map(
      (d) => `
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div class="flex items-center gap-3">
        <i class="fas fa-file-excel text-green-600"></i>
        <div>
          <p class="font-medium text-gray-800 text-sm">${escapeHtml(d.filename)}</p>
          <p class="text-xs text-gray-500">${d.total_rows} exemplos | ${d.total_labels || '?'} categorias</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button onclick="viewDataset(${d.id})" class="text-blue-600 hover:text-blue-800 text-sm px-2">
          <i class="fas fa-eye"></i>
        </button>
      </div>
    </div>
  `
    )
    .join('');
}

async function viewDataset(id: number): Promise<void> {
  const response = await apiCall(`/api/datasets/${id}`);
  if (!response) return;

  const dataset: Dataset = await response.json();

  const content = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><strong>Arquivo:</strong> ${escapeHtml(dataset.filename)}</div>
        <div><strong>Tipo:</strong> ${dataset.task_type === 'text_classification' ? 'Classificacao de Texto' : 'NER'}</div>
        <div><strong>Coluna Texto:</strong> ${escapeHtml(dataset.text_column)}</div>
        <div><strong>Coluna Label:</strong> ${escapeHtml(dataset.label_column)}</div>
        <div><strong>Total Linhas:</strong> ${dataset.total_rows}</div>
        <div><strong>Total Categorias:</strong> ${dataset.total_labels}</div>
      </div>

      <div>
        <strong class="text-sm">Distribuicao de Categorias:</strong>
        <div class="mt-2 max-h-40 overflow-y-auto">
          ${Object.entries(dataset.label_distribution || {})
            .map(
              ([label, count]) => `
            <div class="flex justify-between text-sm py-1 border-b">
              <span>${escapeHtml(label)}</span>
              <span class="text-gray-500">${count}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;

  const titleEl = document.getElementById('run-detail-title');
  const contentEl = document.getElementById('run-detail-content');
  const modalEl = document.getElementById('run-detail-modal');

  if (titleEl) titleEl.textContent = 'Detalhes do Dataset';
  if (contentEl) contentEl.innerHTML = content;
  modalEl?.classList.remove('hidden');
}

// ============================================
// Upload
// ============================================

function showUploadModal(): void {
  document.getElementById('upload-modal')?.classList.remove('hidden');
  resetUploadModal();
}

function closeUploadModal(): void {
  document.getElementById('upload-modal')?.classList.add('hidden');
  resetUploadModal();
}

function resetUploadModal(): void {
  const form = document.getElementById('upload-form') as HTMLFormElement | null;
  form?.reset();
  document.getElementById('upload-preview')?.classList.add('hidden');
  document.getElementById('upload-preview-content')?.classList.add('hidden');
  document.getElementById('upload-validation')?.classList.add('hidden');
  document.getElementById('btn-validate')?.classList.add('hidden');
  document.getElementById('btn-upload')?.classList.add('hidden');
  // Reset preview state
}

async function handleFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  document.getElementById('upload-preview')?.classList.remove('hidden');
  document.getElementById('upload-preview-loading')?.classList.remove('hidden');
  document.getElementById('upload-preview-content')?.classList.add('hidden');

  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  try {
    const response = await fetch('/bert-training/api/datasets/preview', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao analisar arquivo');
    }

    const data: PreviewData = await response.json();
    // Preview data stored for potential future use

    document.getElementById('upload-preview-loading')?.classList.add('hidden');
    document.getElementById('upload-preview-content')?.classList.remove('hidden');

    const previewInfo = document.getElementById('preview-info');
    if (previewInfo) {
      previewInfo.innerHTML = `<strong>${escapeHtml(data.filename)}</strong> - ${data.total_rows} linhas, ${data.total_columns} colunas`;
    }

    const textSelect = document.getElementById('upload-text-col') as HTMLSelectElement | null;
    const labelSelect = document.getElementById('upload-label-col') as HTMLSelectElement | null;

    if (textSelect) {
      textSelect.innerHTML =
        '<option value="">Selecione a coluna de texto...</option>' +
        data.columns.map((col) => `<option value="${escapeHtml(col)}">${escapeHtml(col)}</option>`).join('');
    }

    if (labelSelect) {
      labelSelect.innerHTML =
        '<option value="">Selecione a coluna de categorias...</option>' +
        data.columns.map((col) => `<option value="${escapeHtml(col)}">${escapeHtml(col)}</option>`).join('');
    }

    if (data.text_candidates.length > 0 && textSelect) {
      textSelect.value = data.text_candidates[0];
      const hint = document.getElementById('text-col-hint');
      if (hint) {
        hint.textContent = `Sugestao: ${data.text_candidates.join(', ')}`;
        hint.classList.remove('hidden');
      }
    }

    if (data.label_candidates.length > 0 && labelSelect) {
      labelSelect.value = data.label_candidates[0];
      const hint = document.getElementById('label-col-hint');
      if (hint) {
        hint.textContent = `Sugestao: ${data.label_candidates.join(', ')}`;
        hint.classList.remove('hidden');
      }
    }

    const columnStatsEl = document.getElementById('column-stats');
    if (columnStatsEl) {
      columnStatsEl.innerHTML = data.column_stats
        .map(
          (col) => `
        <div class="border-b py-2">
          <div class="flex justify-between">
            <span class="font-medium">${escapeHtml(col.name)}</span>
            <span class="text-gray-500">${col.unique_values} valores unicos</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            ${col.null_count > 0 ? `<span class="text-yellow-600">${col.null_count} nulos</span> | ` : ''}
            Exemplos: ${col.sample_values
              .slice(0, 3)
              .map((v) => escapeHtml(v))
              .join(', ')}
          </div>
        </div>
      `
        )
        .join('');
    }

    if (data.preview_rows && data.preview_rows.length > 0) {
      const headers = Object.keys(data.preview_rows[0]);
      const dataPreviewEl = document.getElementById('data-preview');
      if (dataPreviewEl) {
        dataPreviewEl.innerHTML = `
          <table class="min-w-full text-xs">
            <thead>
              <tr class="bg-gray-100">
                ${headers.map((h) => `<th class="px-2 py-1 text-left">${escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.preview_rows
                .slice(0, 5)
                .map(
                  (row) => `
                <tr class="border-b">
                  ${headers.map((h) => `<td class="px-2 py-1 max-w-xs truncate">${escapeHtml(String(row[h] || '').substring(0, 50))}</td>`).join('')}
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `;
      }
    }

    document.getElementById('btn-validate')?.classList.remove('hidden');
    document.getElementById('btn-upload')?.classList.remove('hidden');
  } catch (error) {
    const loadingEl = document.getElementById('upload-preview-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>${escapeHtml((error as Error).message)}</div>`;
    }
  }
}

async function validateDataset(): Promise<void> {
  const fileInput = document.getElementById('upload-file') as HTMLInputElement | null;
  const file = fileInput?.files?.[0];
  if (!file) {
    alert('Selecione um arquivo');
    return;
  }

  const textCol = (document.getElementById('upload-text-col') as HTMLSelectElement | null)?.value;
  const labelCol = (document.getElementById('upload-label-col') as HTMLSelectElement | null)?.value;
  if (!textCol || !labelCol) {
    alert('Selecione as colunas de texto e categorias');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('task_type', (document.getElementById('upload-task-type') as HTMLSelectElement | null)?.value || 'text_classification');
  formData.append('text_column', textCol);
  formData.append('label_column', labelCol);

  const token = getToken();
  const response = await fetch('/bert-training/api/datasets/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const result = await response.json();
  const validationDiv = document.getElementById('upload-validation');
  if (!validationDiv) return;

  validationDiv.classList.remove('hidden');

  if (result.is_valid) {
    validationDiv.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded p-3">
        <p class="text-green-800 font-medium"><i class="fas fa-check-circle mr-2"></i>Validacao OK!</p>
        <p class="text-sm text-green-600">${result.total_rows} linhas validas</p>
      </div>
    `;
  } else {
    validationDiv.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded p-3">
        <p class="text-red-800 font-medium"><i class="fas fa-times-circle mr-2"></i>Problemas encontrados</p>
        <ul class="text-sm text-red-600 list-disc ml-4">
          ${(result.errors as string[]).map((e: string) => `<li>${escapeHtml(e)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
}

async function handleUploadSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const fileInput = document.getElementById('upload-file') as HTMLInputElement | null;
  const file = fileInput?.files?.[0];
  if (!file) {
    alert('Selecione um arquivo');
    return;
  }

  const textCol = (document.getElementById('upload-text-col') as HTMLSelectElement | null)?.value;
  const labelCol = (document.getElementById('upload-label-col') as HTMLSelectElement | null)?.value;
  if (!textCol || !labelCol) {
    alert('Selecione as colunas de texto e categorias');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('task_type', (document.getElementById('upload-task-type') as HTMLSelectElement | null)?.value || 'text_classification');
  formData.append('text_column', textCol);
  formData.append('label_column', labelCol);

  const token = getToken();
  const response = await fetch('/bert-training/api/datasets/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (response.ok) {
    const result = await response.json();
    alert(result.is_duplicate ? 'Planilha ja existe!' : 'Planilha enviada com sucesso!');
    closeUploadModal();
    loadDatasets();
    loadDatasetsForSelect();
  } else {
    const error = await response.json();
    alert('Erro: ' + (error.detail || 'Falha no upload'));
  }
}

// ============================================
// Runs
// ============================================

async function loadRuns(): Promise<void> {
  const response = await apiCall('/api/runs');
  if (!response) return;

  const runs: Run[] = await response.json();
  allRuns = runs;

  const trainingCount = runs.filter((r) => r.status === 'training').length;
  const badge = document.getElementById('badge-training');
  if (badge) {
    if (trainingCount > 0) {
      badge.textContent = String(trainingCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  renderRunsList(runs);
}

function filterRuns(status: string): void {
  currentFilter = status;

  document.querySelectorAll('[data-filter]').forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.remove('bg-blue-100', 'text-blue-700');
    el.classList.add('bg-gray-100', 'text-gray-600');
    if (el.dataset.filter === status) {
      el.classList.remove('bg-gray-100', 'text-gray-600');
      el.classList.add('bg-blue-100', 'text-blue-700');
    }
  });

  let filteredRuns = allRuns;
  if (status !== 'all') {
    filteredRuns = allRuns.filter((r) => r.status === status);
  }

  renderRunsList(filteredRuns);
}

function renderRunsList(runs: Run[]): void {
  const container = document.getElementById('runs-list');
  if (!container) return;

  if (runs.length === 0) {
    const emptyMsg = currentFilter === 'all' ? 'Nenhum treinamento encontrado.' : `Nenhum treinamento "${formatStatus(currentFilter)}".`;
    container.innerHTML = `<p class="text-gray-400 text-center py-8">${emptyMsg}</p>`;
    return;
  }

  container.innerHTML = runs
    .map(
      (r) => `
    <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors" onclick="viewRun(${r.id})">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="font-medium text-gray-900">${escapeHtml(r.name)}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="inline-block status-${r.status} rounded px-2 py-0.5 text-xs font-medium">${formatStatus(r.status)}</span>
            <span class="text-xs text-gray-500">${escapeHtml(r.base_model.split('/').pop() || '')}</span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            ${new Date(r.created_at).toLocaleDateString('pt-BR')}
            ${r.final_accuracy ? ` | Precisao: ${(r.final_accuracy * 100).toFixed(1)}%` : ''}
          </div>
        </div>
        <div class="text-gray-400 ml-2">
          <i class="fas fa-chevron-right"></i>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Na fila',
    training: 'Treinando',
    completed: 'Concluido',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  };
  return statusMap[status] || status;
}

async function viewRun(id: number): Promise<void> {
  const response = await apiCall(`/api/runs/${id}`);
  if (!response) return;

  const run: Run = await response.json();

  const content = `
    <div class="space-y-6">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><strong>Status:</strong> <span class="status-${run.status} px-2 py-0.5 rounded">${formatStatus(run.status)}</span></div>
        <div><strong>Modelo:</strong> ${escapeHtml(run.base_model)}</div>
        <div><strong>Dataset:</strong> ${escapeHtml(run.dataset_filename)}</div>
        <div><strong>Seed:</strong> ${run.config_json?.seed || 42}</div>
      </div>

      ${
        run.error_message
          ? `
        <div class="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <strong>Erro:</strong> ${escapeHtml(run.error_message)}
        </div>
      `
          : ''
      }

      ${
        run.final_accuracy
          ? `
        <div class="bg-green-50 border border-green-200 rounded p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-green-800">Metricas Finais</h4>
            <button onclick="viewEvaluation(${run.id})" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
              <i class="fas fa-chart-bar mr-1"></i> Ver Resultados Detalhados
            </button>
          </div>
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-green-600">${(run.final_accuracy * 100).toFixed(1)}%</div>
              <div class="text-xs text-gray-500">Precisao</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">${((run.final_macro_f1 || 0) * 100).toFixed(1)}%</div>
              <div class="text-xs text-gray-500">F1 Macro</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">${((run.final_weighted_f1 || 0) * 100).toFixed(1)}%</div>
              <div class="text-xs text-gray-500">F1 Ponderado</div>
            </div>
          </div>
        </div>
      `
          : ''
      }

      ${
        run.recent_metrics && run.recent_metrics.length > 0
          ? `
        <div>
          <h4 class="font-medium mb-2">Progresso</h4>
          <canvas id="metrics-chart" height="200"></canvas>
        </div>
      `
          : ''
      }

      <details class="border rounded-lg p-3">
        <summary class="cursor-pointer font-medium text-sm">Configuracao Completa</summary>
        <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">${escapeHtml(JSON.stringify(run.config_json, null, 2))}</pre>
      </details>
    </div>
  `;

  const titleEl = document.getElementById('run-detail-title');
  const contentEl = document.getElementById('run-detail-content');
  const modalEl = document.getElementById('run-detail-modal');

  if (titleEl) titleEl.textContent = run.name;
  if (contentEl) contentEl.innerHTML = content;
  modalEl?.classList.remove('hidden');

  if (run.recent_metrics && run.recent_metrics.length > 0) {
    renderMetricsChart(run.recent_metrics);
  }
}

function renderMetricsChart(metrics: Metric[]): void {
  const canvas = document.getElementById('metrics-chart') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: metrics.map((m) => `Rodada ${m.epoch}`),
      datasets: [
        {
          label: 'Loss Treino',
          data: metrics.map((m) => m.train_loss),
          borderColor: 'rgb(239, 68, 68)',
          tension: 0.1,
        },
        {
          label: 'Loss Validacao',
          data: metrics.map((m) => m.val_loss),
          borderColor: 'rgb(59, 130, 246)',
          tension: 0.1,
        },
        {
          label: 'Precisao',
          data: metrics.map((m) => m.val_accuracy),
          borderColor: 'rgb(34, 197, 94)',
          tension: 0.1,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Loss' } },
        y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Precisao' }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

function closeRunDetail(): void {
  document.getElementById('run-detail-modal')?.classList.add('hidden');
}

async function viewEvaluation(runId: number): Promise<void> {
  const response = await apiCall(`/api/runs/${runId}/evaluation`);
  if (!response || !response.ok) {
    const error = await response?.json();
    showToast(error?.detail || 'Erro ao carregar avaliação', 'error');
    return;
  }

  const evaluation: EvaluationResult = await response.json();

  // Fecha modal anterior
  closeRunDetail();

  // Monta conteúdo da avaliação
  const summary = evaluation.summary;
  const metrics = evaluation.metrics;

  let content = `
    <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <!-- Métricas Gerais -->
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <h4 class="font-medium text-green-800 mb-3">Métricas Gerais</h4>
        <div class="grid grid-cols-4 gap-4 text-center">
          <div>
            <div class="text-2xl font-bold text-green-600">${metrics.accuracy ? (metrics.accuracy * 100).toFixed(1) : '-'}%</div>
            <div class="text-xs text-gray-500">Accuracy</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-blue-600">${metrics.macro_f1 ? (metrics.macro_f1 * 100).toFixed(1) : '-'}%</div>
            <div class="text-xs text-gray-500">F1 Macro</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-purple-600">${metrics.weighted_f1 ? (metrics.weighted_f1 * 100).toFixed(1) : '-'}%</div>
            <div class="text-xs text-gray-500">F1 Weighted</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-orange-600">${metrics.val_loss?.toFixed(4) || '-'}</div>
            <div class="text-xs text-gray-500">Val Loss</div>
          </div>
        </div>
      </div>
  `;

  // Resumo de acertos/erros
  if (summary) {
    content += `
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-blue-600">${summary.total_samples}</div>
          <div class="text-xs text-gray-500">Total de Amostras</div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-green-600">${summary.total_correct}</div>
          <div class="text-xs text-gray-500">Classificações Corretas</div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-red-600">${summary.total_errors}</div>
          <div class="text-xs text-gray-500">Erros</div>
        </div>
      </div>
    `;

    // Tabela de métricas por classe
    content += `
      <div>
        <h4 class="font-medium text-gray-800 mb-2">Métricas por Classe</h4>
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
    `;

    // Ordena classes por número de erros (decrescente) para destacar as problemáticas
    const sortedClasses = [...summary.classes].sort((a, b) => b.errors - a.errors);

    for (const cls of sortedClasses) {
      const errorRate = cls.total > 0 ? (cls.errors / cls.total) * 100 : 0;
      const rowClass = errorRate > 30 ? 'bg-red-50' : errorRate > 15 ? 'bg-yellow-50' : '';

      content += `
        <tr class="border-b ${rowClass}">
          <td class="px-3 py-2 font-medium">${escapeHtml(cls.label)}</td>
          <td class="px-3 py-2 text-center">${cls.total}</td>
          <td class="px-3 py-2 text-center text-green-600">${cls.correct}</td>
          <td class="px-3 py-2 text-center ${cls.errors > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}">${cls.errors}</td>
          <td class="px-3 py-2 text-center">${(cls.precision * 100).toFixed(1)}%</td>
          <td class="px-3 py-2 text-center">${(cls.recall * 100).toFixed(1)}%</td>
          <td class="px-3 py-2 text-center">${(cls.f1 * 100).toFixed(1)}%</td>
        </tr>
      `;
    }

    content += `
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          <span class="inline-block w-3 h-3 bg-red-50 border rounded mr-1"></span> Taxa de erro > 30%
          <span class="inline-block w-3 h-3 bg-yellow-50 border rounded ml-3 mr-1"></span> Taxa de erro > 15%
        </p>
      </div>
    `;
  }

  // Matriz de Confusão (versão simplificada/visual)
  if (evaluation.confusion_matrix && evaluation.summary) {
    const labels = evaluation.summary.labels;
    const cm = evaluation.confusion_matrix;

    content += `
      <details class="border rounded-lg p-3">
        <summary class="cursor-pointer font-medium text-sm">
          <i class="fas fa-th mr-2"></i>Matriz de Confusão
        </summary>
        <div class="mt-3 overflow-x-auto">
          <table class="text-xs border">
            <thead>
              <tr>
                <th class="p-1 bg-gray-100 text-left">Real \\ Pred</th>
                ${labels.map((l) => `<th class="p-1 bg-gray-100 text-center" title="${escapeHtml(l)}">${escapeHtml(l.substring(0, 10))}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
    `;

    for (let i = 0; i < labels.length; i++) {
      content += `<tr><th class="p-1 bg-gray-50 text-left" title="${escapeHtml(labels[i])}">${escapeHtml(labels[i].substring(0, 10))}</th>`;
      for (let j = 0; j < labels.length; j++) {
        const value = cm[i]?.[j] || 0;
        const isCorrect = i === j;
        const cellClass = isCorrect
          ? value > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-50'
          : value > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-50 text-gray-300';
        content += `<td class="p-1 text-center ${cellClass}">${value}</td>`;
      }
      content += '</tr>';
    }

    content += `
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          <span class="inline-block w-3 h-3 bg-green-100 border rounded mr-1"></span> Diagonal = correto
          <span class="inline-block w-3 h-3 bg-red-100 border rounded ml-3 mr-1"></span> Fora da diagonal = erro
        </p>
      </details>
    `;
  }

  content += '</div>';

  // Exibe modal
  const titleEl = document.getElementById('run-detail-title');
  const contentEl = document.getElementById('run-detail-content');
  const modalEl = document.getElementById('run-detail-modal');

  if (titleEl) titleEl.textContent = `Avaliação: ${evaluation.run_name}`;
  if (contentEl) contentEl.innerHTML = content;
  modalEl?.classList.remove('hidden');
}

// ============================================
// Training Progress Chart (Real-time)
// ============================================

function initTrainingChart(): void {
  const canvas = document.getElementById('training-progress-chart') as HTMLCanvasElement | null;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  // Destroi chart anterior se existir
  if (trainingChart) {
    trainingChart.destroy();
  }

  trainingChartData = [];

  trainingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Train Loss',
          data: [],
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.3,
          yAxisID: 'y',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Val Loss',
          data: [],
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          tension: 0.3,
          yAxisID: 'y',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Accuracy',
          data: [],
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.3,
          yAxisID: 'y1',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false, // Legenda já está no HTML
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (label === 'Accuracy') {
                return `${label}: ${(value * 100).toFixed(2)}%`;
              }
              return `${label}: ${value.toFixed(4)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Epoch',
            font: { size: 11 },
          },
          ticks: { font: { size: 10 } },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Loss',
            font: { size: 11 },
          },
          ticks: { font: { size: 10 } },
          min: 0,
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Accuracy',
            font: { size: 11 },
          },
          ticks: {
            font: { size: 10 },
            callback: function (value: number) {
              return (value * 100).toFixed(0) + '%';
            },
          },
          min: 0,
          max: 1,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });
}

function updateTrainingChart(metricsHistory: MetricHistory[]): void {
  if (!metricsHistory || metricsHistory.length === 0) return;

  // Inicializa chart se não existir
  if (!trainingChart) {
    initTrainingChart();
  }

  if (!trainingChart) return;

  // Atualiza dados do gráfico
  const labels = metricsHistory.map((m) => `${m.epoch}`);
  const trainLoss = metricsHistory.map((m) => m.train_loss);
  const valLoss = metricsHistory.map((m) => m.val_loss);
  const accuracy = metricsHistory.map((m) => m.val_accuracy);

  trainingChart.data.labels = labels;
  trainingChart.data.datasets[0].data = trainLoss;
  trainingChart.data.datasets[1].data = valLoss;
  trainingChart.data.datasets[2].data = accuracy;

  trainingChart.update('none'); // 'none' para atualização sem animação (mais rápido)
}

function destroyTrainingChart(): void {
  if (trainingChart) {
    trainingChart.destroy();
    trainingChart = null;
    trainingChartData = [];
  }
}

// ============================================
// Active Training
// ============================================

async function startLocalWorker(): Promise<void> {
  try {
    const response = await apiCall('/api/workers/start-local', { method: 'POST' });
    if (response && response.ok) {
      const data = await response.json();
      if (data.status === 'already_running') {
        showToast('Worker já está em execução', 'info');
      } else {
        showToast('Worker local iniciado! O treinamento começará em breve.', 'success');
      }
      // Atualiza após alguns segundos
      setTimeout(() => loadRuns(), 3000);
    }
  } catch (e) {
    console.error('Erro ao iniciar worker:', e);
    showToast('Erro ao iniciar worker', 'error');
  }
}

function checkActiveTraining(): void {
  const trainingRuns = allRuns.filter((r) => r.status === 'training');
  const pendingRuns = allRuns.filter((r) => r.status === 'pending');

  if (trainingRuns.length > 0) {
    activeTrainingRunId = trainingRuns[0].id;
    document.getElementById('active-training-card')?.classList.remove('hidden');
    document.getElementById('pending-runs-alert')?.classList.add('hidden');
    updateActiveTrainingStatus();
  } else if (pendingRuns.length > 0) {
    // Há runs na fila mas nenhum treinando - worker pode não estar rodando
    document.getElementById('active-training-card')?.classList.add('hidden');
    activeTrainingRunId = null;
    showPendingRunsAlert(pendingRuns.length);
  } else {
    document.getElementById('active-training-card')?.classList.add('hidden');
    document.getElementById('pending-runs-alert')?.classList.add('hidden');
    activeTrainingRunId = null;
  }
}

function showPendingRunsAlert(count: number): void {
  let alertEl = document.getElementById('pending-runs-alert');
  if (!alertEl) {
    // Cria o alerta se não existir
    const container = document.getElementById('active-training-card')?.parentElement;
    if (!container) return;

    alertEl = document.createElement('div');
    alertEl.id = 'pending-runs-alert';
    alertEl.className = 'section-card p-4 bg-yellow-50 border-yellow-200';
    container.insertBefore(alertEl, document.getElementById('active-training-card'));
  }

  alertEl.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
          <i class="fas fa-hourglass-half text-yellow-600"></i>
        </div>
        <div>
          <h3 class="font-semibold text-yellow-800">${count} treinamento(s) na fila</h3>
          <p class="text-sm text-yellow-600">Worker não detectado. Clique para iniciar.</p>
        </div>
      </div>
      <button onclick="startLocalWorker()" class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors">
        <i class="fas fa-play mr-2"></i>Iniciar Worker
      </button>
    </div>
  `;
  alertEl.classList.remove('hidden');
}

async function updateActiveTrainingStatus(): Promise<void> {
  if (!activeTrainingRunId) return;

  try {
    const response = await apiCall(`/api/runs/${activeTrainingRunId}/progress`);
    if (!response || !response.ok) return;

    const progress: TrainingProgress = await response.json();

    // Detecta mudança de status (completed, failed, cancelled, stopping)
    if (progress.status !== 'training') {
      handleTrainingEnded(progress);
      return;
    }

    const nameEl = document.getElementById('active-training-name');
    const statusEl = document.getElementById('active-training-status');
    const progressLabelEl = document.getElementById('active-training-progress-label');
    const progressBarEl = document.getElementById('active-training-progress-bar') as HTMLElement | null;
    const timeEl = document.getElementById('active-training-time-remaining');

    if (nameEl) nameEl.textContent = progress.run_name || 'Treinamento';

    // Atualiza status com progresso intra-epoch se disponível
    if (progress.batch_progress) {
      const bp = progress.batch_progress;
      if (statusEl) {
        statusEl.innerHTML = `
          <span>Epoch ${bp.epoch} de ${progress.total_epochs || '?'}</span>
          <span class="text-gray-400 mx-1">|</span>
          <span class="text-blue-600">Batch ${bp.current}/${bp.total}</span>
          <span class="text-gray-400 mx-1">(${bp.percent.toFixed(0)}%)</span>
          ${bp.epoch_remaining_label ? `<span class="text-xs text-gray-500 ml-1">${bp.epoch_remaining_label}</span>` : ''}
        `;
      }
      // Progresso visual combina epoch + batch
      const epochProgress = ((progress.current_epoch || 0) / (progress.total_epochs || 10)) * 100;
      const batchContribution = (bp.percent / 100) * (100 / (progress.total_epochs || 10));
      const combinedProgress = Math.min(100, epochProgress + batchContribution);
      if (progressLabelEl) progressLabelEl.textContent = `${combinedProgress.toFixed(0)}%`;
      if (progressBarEl) progressBarEl.style.width = `${combinedProgress}%`;
    } else {
      if (statusEl) statusEl.textContent = `Rodada ${progress.current_epoch || 0} de ${progress.total_epochs || '?'}`;
      if (progressLabelEl) progressLabelEl.textContent = `${(progress.progress_percent || 0).toFixed(0)}%`;
      if (progressBarEl) progressBarEl.style.width = `${progress.progress_percent || 0}%`;
    }

    if (progress.estimated_remaining_label && timeEl) {
      timeEl.textContent = progress.estimated_remaining_label;
    }

    if (progress.latest_metrics) {
      const m = progress.latest_metrics;
      const lossEl = document.getElementById('metric-loss');
      const accEl = document.getElementById('metric-accuracy');
      const f1El = document.getElementById('metric-f1');
      const epochEl = document.getElementById('metric-epoch');

      if (lossEl) lossEl.textContent = m.val_loss?.toFixed(4) || '-';
      // Usa best_metrics para precisão (melhor alcançada), com fallback para latest
      const bestAcc = progress.best_metrics?.val_accuracy || m.val_accuracy;
      if (accEl) accEl.textContent = bestAcc ? `${(bestAcc * 100).toFixed(1)}%` : '-';
      if (f1El) f1El.textContent = m.val_macro_f1 ? `${(m.val_macro_f1 * 100).toFixed(1)}%` : '-';
      if (epochEl) epochEl.textContent = `${progress.current_epoch || 0}/${progress.total_epochs || '?'}`;
    }

    // Atualiza info do Worker/GPU
    const workerSection = document.getElementById('worker-info-section');
    if (progress.worker_info && workerSection) {
      workerSection.classList.remove('hidden');
      const gpuName = document.getElementById('worker-gpu-name');
      const gpuVram = document.getElementById('worker-gpu-vram');
      const cudaVer = document.getElementById('worker-cuda-version');
      if (gpuName) gpuName.textContent = progress.worker_info.gpu_name || 'GPU Desconhecida';
      if (gpuVram) gpuVram.textContent = progress.worker_info.gpu_vram_gb?.toFixed(1) || '?';
      if (cudaVer) cudaVer.textContent = progress.worker_info.cuda_version || '?';
    } else if (workerSection) {
      workerSection.classList.add('hidden');
    }

    // Atualiza gráfico de progresso em tempo real
    if (progress.metrics_history && progress.metrics_history.length > 0) {
      updateTrainingChart(progress.metrics_history);
    }

    // Atualiza logs recentes
    const logsContainer = document.getElementById('recent-logs-container');
    const logsTimeEl = document.getElementById('logs-update-time');
    if (progress.recent_logs && progress.recent_logs.length > 0 && logsContainer) {
      logsContainer.innerHTML = progress.recent_logs.map((log: LogEntry) => {
        const levelColor = log.level === 'ERROR' ? 'text-red-400' :
                          log.level === 'WARNING' ? 'text-yellow-400' :
                          log.level === 'INFO' ? 'text-green-400' : 'text-gray-400';
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : '';
        return `<div class="py-0.5"><span class="${levelColor}">[${log.level}]</span> <span class="text-gray-500">${time}</span> <span class="text-gray-300">${escapeHtml(log.message)}</span></div>`;
      }).join('');
      if (logsTimeEl) logsTimeEl.textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR')}`;
    } else if (logsContainer && progress.status === 'training') {
      logsContainer.innerHTML = '<p class="text-gray-500">Aguardando logs do worker...</p>';
    }
  } catch (e) {
    console.error('Erro ao atualizar progresso:', e);
  }
}

function handleTrainingEnded(progress: TrainingProgress): void {
  const card = document.getElementById('active-training-card');
  const nameEl = document.getElementById('active-training-name');
  const statusEl = document.getElementById('active-training-status');
  const progressBarEl = document.getElementById('active-training-progress-bar') as HTMLElement | null;
  const progressLabelEl = document.getElementById('active-training-progress-label');
  const timeEl = document.getElementById('active-training-time-remaining');
  const logsContainer = document.getElementById('recent-logs-container');

  const bestAcc = progress.best_metrics?.val_accuracy;
  const bestEpoch = progress.best_metrics?.epoch;

  // Atualiza UI baseado no status
  if (progress.status === 'completed') {
    if (nameEl) nameEl.textContent = '✓ Treinamento Concluído!';
    if (statusEl) {
      statusEl.innerHTML = bestAcc
        ? `<span class="text-green-600 font-semibold">Melhor precisão: ${(bestAcc * 100).toFixed(1)}% (epoch ${bestEpoch})</span>`
        : 'Concluído';
    }
    if (progressBarEl) {
      progressBarEl.style.width = '100%';
      progressBarEl.classList.remove('bg-blue-600');
      progressBarEl.classList.add('bg-green-500');
    }
    if (progressLabelEl) progressLabelEl.textContent = '100%';
    if (timeEl) timeEl.textContent = 'Finalizado';
    showToast(`Treinamento concluído! Precisão: ${bestAcc ? (bestAcc * 100).toFixed(1) + '%' : 'N/A'}`, 'success');
  } else if (progress.status === 'stopping') {
    if (nameEl) nameEl.textContent = 'Finalizando...';
    if (statusEl) statusEl.textContent = 'Salvando melhor modelo...';
    if (progressBarEl) {
      progressBarEl.classList.remove('bg-blue-600');
      progressBarEl.classList.add('bg-yellow-500');
    }
    if (timeEl) timeEl.textContent = 'Finalizando...';
  } else if (progress.status === 'failed') {
    if (nameEl) nameEl.textContent = '✗ Treinamento Falhou';
    if (statusEl) statusEl.innerHTML = '<span class="text-red-600">Erro durante o treinamento</span>';
    if (progressBarEl) {
      progressBarEl.classList.remove('bg-blue-600');
      progressBarEl.classList.add('bg-red-500');
    }
    if (timeEl) timeEl.textContent = '';
    showToast('Treinamento falhou', 'error');
  } else if (progress.status === 'cancelled') {
    if (nameEl) nameEl.textContent = 'Treinamento Cancelado';
    if (statusEl) statusEl.innerHTML = '<span class="text-gray-600">Cancelado pelo usuário</span>';
    if (progressBarEl) {
      progressBarEl.classList.remove('bg-blue-600');
      progressBarEl.classList.add('bg-gray-400');
    }
    if (timeEl) timeEl.textContent = '';
  }

  // Esconde botões de ação
  const buttonsContainer = card?.querySelector('.flex.gap-2');
  if (buttonsContainer && progress.status !== 'stopping') {
    buttonsContainer.innerHTML = `
      <button onclick="loadRuns()" class="text-blue-600 hover:text-blue-800 text-sm">
        <i class="fas fa-sync-alt mr-1"></i> Atualizar Lista
      </button>
    `;
  }

  // Mostra resumo final nos logs
  if (logsContainer && progress.status === 'completed') {
    const summaryHtml = `
      <div class="bg-green-900/30 border border-green-700 rounded p-3 my-2">
        <div class="text-green-400 font-semibold mb-2">✓ Treinamento Concluído</div>
        <div class="text-sm text-gray-300">
          <div>Epochs: ${progress.current_epoch}/${progress.total_epochs}</div>
          ${bestAcc ? `<div>Melhor Precisão: <span class="text-green-400 font-bold">${(bestAcc * 100).toFixed(2)}%</span> (epoch ${bestEpoch})</div>` : ''}
        </div>
      </div>
    `;
    logsContainer.innerHTML = summaryHtml + logsContainer.innerHTML;
  }

  // Recarrega lista após 2 segundos (para status não-stopping)
  if (progress.status !== 'stopping') {
    setTimeout(() => {
      loadRuns();
      activeTrainingRunId = null;
      destroyTrainingChart();
    }, 2000);
  }
}

async function cancelTraining(): Promise<void> {
  if (!activeTrainingRunId) return;
  if (!confirm('Tem certeza que deseja CANCELAR o treinamento? O modelo NÃO será salvo.')) return;

  try {
    const response = await apiCall(`/api/runs/${activeTrainingRunId}/cancel`, { method: 'POST' });
    if (response && response.ok) {
      showToast('Treinamento cancelado', 'warning');
      await loadRuns();
    }
  } catch (e) {
    console.error('Erro ao cancelar:', e);
    showToast('Erro ao cancelar treinamento', 'error');
  }
}

async function stopEarly(): Promise<void> {
  if (!activeTrainingRunId) return;

  const msg =
    'Deseja FINALIZAR o treinamento agora?\n\n' +
    '✓ O modelo com MELHOR precisão será salvo\n' +
    '✓ O treinamento será marcado como concluído\n\n' +
    'Isso é útil quando a precisão já estabilizou.';

  if (!confirm(msg)) return;

  try {
    const response = await apiCall(`/api/runs/${activeTrainingRunId}/stop-early`, { method: 'POST' });
    if (response && response.ok) {
      const data = await response.json();
      showToast(
        `Finalizando... Melhor precisão: ${data.best_accuracy}% (epoch ${data.best_epoch})`,
        'success'
      );
      // Atualiza status imediatamente
      const statusEl = document.getElementById('training-status-text');
      if (statusEl) statusEl.textContent = 'Finalizando...';
    }
  } catch (e) {
    console.error('Erro ao finalizar:', e);
    showToast('Erro ao solicitar finalização', 'error');
  }
}

// ============================================
// New Run
// ============================================

async function loadDatasetsForSelect(): Promise<void> {
  const response = await apiCall('/api/datasets');
  if (!response) return;

  const datasets: Dataset[] = await response.json();
  const select = document.getElementById('run-dataset') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML =
    '<option value="">Selecione uma planilha...</option>' +
    datasets.map((d) => `<option value="${d.id}">${escapeHtml(d.filename)} (${d.total_rows} exemplos)</option>`).join('');

  loadPresets();
}

async function loadPresets(): Promise<void> {
  if (presetsCache) {
    renderPresets(presetsCache);
    return;
  }

  const response = await apiCall('/api/presets');
  if (!response) return;

  const data = await response.json();
  presetsCache = data.presets;
  if (presetsCache) {
    renderPresets(presetsCache);
  }
}

function renderPresets(presets: Preset[]): void {
  const container = document.getElementById('presets-container');
  if (!container) return;

  const icons: Record<string, string> = {
    rapido: 'fa-bolt',
    equilibrado: 'fa-balance-scale',
    preciso: 'fa-bullseye',
  };

  container.innerHTML = presets
    .map(
      (p) => `
    <div class="preset-card border-2 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-all ${p.is_recommended ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}"
         data-preset="${p.name}"
         onclick="selectPreset('${p.name}')">
      <div class="flex flex-col items-center text-center">
        <i class="fas ${icons[p.name] || 'fa-cog'} text-2xl text-blue-600 mb-2"></i>
        <h3 class="font-bold">${escapeHtml(p.display_name)}</h3>
        ${p.is_recommended ? '<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">Recomendado</span>' : ''}
        <p class="text-xs text-gray-600 mt-2">${escapeHtml(p.description)}</p>
        <div class="text-xs text-gray-400 mt-2">
          ~${p.estimated_time_minutes_min}-${p.estimated_time_minutes_max} min
        </div>
      </div>
    </div>
  `
    )
    .join('');

  const recommended = presets.find((p) => p.is_recommended) || presets[1];
  if (recommended) selectPreset(recommended.name);
}

function selectPreset(presetName: string): void {
  document.querySelectorAll('.preset-card').forEach((card) => {
    const el = card as HTMLElement;
    el.classList.remove('border-blue-500', 'bg-blue-100');
    if (el.dataset.preset === presetName) {
      el.classList.add('border-blue-500', 'bg-blue-100');
    }
  });

  const hiddenInput = document.getElementById('selected-preset') as HTMLInputElement | null;
  if (hiddenInput) hiddenInput.value = presetName;

  const warningDiv = document.getElementById('preset-warning');
  if (!warningDiv) return;

  if (presetName === 'rapido') {
    warningDiv.innerHTML = `
      <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
        <i class="fas fa-info-circle mr-2"></i>Modo rapido: ideal para testar se a planilha esta correta.
      </div>
    `;
    warningDiv.classList.remove('hidden');
  } else if (presetName === 'preciso') {
    warningDiv.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
        <i class="fas fa-clock mr-2"></i>Modo preciso: pode demorar varias horas.
      </div>
    `;
    warningDiv.classList.remove('hidden');
  } else {
    warningDiv.classList.add('hidden');
  }
}

async function handleNewRunSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const presetName = (document.getElementById('selected-preset') as HTMLInputElement | null)?.value || '';

  const data: Record<string, unknown> = {
    name: (document.getElementById('run-name') as HTMLInputElement | null)?.value,
    description: (document.getElementById('run-description') as HTMLTextAreaElement | null)?.value || null,
    dataset_id: parseInt((document.getElementById('run-dataset') as HTMLSelectElement | null)?.value || '0'),
    base_model: (document.getElementById('run-model') as HTMLSelectElement | null)?.value,
    preset_name: presetName,
  };

  const hyperparameters: RunConfig = {};
  let hasOverrides = false;

  const epochsVal = (document.getElementById('run-epochs') as HTMLInputElement | null)?.value;
  if (epochsVal) {
    hyperparameters.epochs = parseInt(epochsVal);
    hasOverrides = true;
  }

  const lrVal = (document.getElementById('run-lr') as HTMLInputElement | null)?.value;
  if (lrVal) {
    hyperparameters.learning_rate = parseFloat(lrVal);
    hasOverrides = true;
  }

  const batchVal = (document.getElementById('run-batch') as HTMLInputElement | null)?.value;
  if (batchVal) {
    hyperparameters.batch_size = parseInt(batchVal);
    hasOverrides = true;
  }

  const maxlenVal = (document.getElementById('run-maxlen') as HTMLInputElement | null)?.value;
  if (maxlenVal) {
    hyperparameters.max_length = parseInt(maxlenVal);
    hasOverrides = true;
  }

  const splitVal = (document.getElementById('run-split') as HTMLInputElement | null)?.value;
  if (splitVal) {
    hyperparameters.train_split = parseFloat(splitVal);
    hasOverrides = true;
  }

  const patienceVal = (document.getElementById('run-patience') as HTMLInputElement | null)?.value;
  if (patienceVal) {
    hyperparameters.early_stopping_patience = parseInt(patienceVal);
    hasOverrides = true;
  }

  const seedVal = (document.getElementById('run-seed') as HTMLInputElement | null)?.value;
  if (seedVal && seedVal !== '42') {
    hyperparameters.seed = parseInt(seedVal);
    hasOverrides = true;
  }

  const classWeightsEl = document.getElementById('run-class-weights') as HTMLInputElement | null;
  if (classWeightsEl && !classWeightsEl.checked) {
    hyperparameters.use_class_weights = false;
    hasOverrides = true;
  }

  if (hasOverrides) {
    data.hyperparameters = hyperparameters;
  }

  const response = await apiCall('/api/runs', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (response && response.ok) {
    const result = await response.json();
    alert(`Treinamento "${result.name}" iniciado!\n\nAcompanhe na aba "Acompanhar".`);
    const form = document.getElementById('new-run-form') as HTMLFormElement | null;
    form?.reset();
    showTab('acompanhar');
  } else if (response) {
    const error = await response.json();
    alert('Erro: ' + (error.detail || 'Falha ao criar treinamento'));
  }
}

// ============================================
// Test Models
// ============================================

async function checkWorkerConnection(): Promise<void> {
  const statusIcon = document.getElementById('worker-status-icon');
  const statusText = document.getElementById('worker-status-text');

  try {
    const response = await fetch(`${WORKER_URL}/health`, { method: 'GET' });
    if (response.ok) {
      const data = await response.json();
      workerConnected = true;
      statusIcon?.classList.remove('bg-gray-300', 'bg-red-500');
      statusIcon?.classList.add('bg-green-500');
      if (statusText) {
        statusText.textContent = `Conectado ao worker local ${data.cuda_available ? '(GPU disponivel)' : '(somente CPU)'}`;
      }
      loadLocalModels();
    } else {
      throw new Error('Worker nao respondeu');
    }
  } catch {
    workerConnected = false;
    statusIcon?.classList.remove('bg-gray-300', 'bg-green-500');
    statusIcon?.classList.add('bg-red-500');
    if (statusText) {
      statusText.innerHTML = `
        <span>Servidor de inferência não conectado.</span>
        <button onclick="startInferenceServer()" class="ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded">
          Iniciar Servidor
        </button>
      `;
    }
  }
}

async function startInferenceServer(): Promise<void> {
  try {
    const response = await apiCall('/api/workers/start-inference', { method: 'POST' });
    if (response && response.ok) {
      showToast('Servidor de inferência iniciando...', 'success');
      // Aguarda um pouco e tenta conectar novamente
      setTimeout(() => checkWorkerConnection(), 3000);
    }
  } catch (e) {
    console.error('Erro ao iniciar servidor de inferência:', e);
    showToast('Erro ao iniciar servidor', 'error');
  }
}

async function loadCompletedModels(): Promise<void> {
  const response = await apiCall('/api/models/completed');
  if (!response) return;

  completedModels = await response.json();
  updateModelSelect();
}

async function loadLocalModels(): Promise<void> {
  if (!workerConnected) return;

  try {
    const response = await fetch(`${WORKER_URL}/models`);
    if (!response.ok) return;

    const data = await response.json();
    const localModels: LocalModel[] = data.models || [];

    completedModels.forEach((model) => {
      const local = localModels.find((l) => l.run_id === model.id);
      model.available_locally = !!local;
      if (local) {
        model.local_path = local.name;
      }
    });

    updateModelSelect();
  } catch (e) {
    console.error('Erro ao carregar modelos locais:', e);
  }
}

function updateModelSelect(): void {
  const select = document.getElementById('test-model-select') as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML =
    '<option value="">Selecione um modelo...</option>' +
    completedModels
      .map((m) => {
        const accuracy = m.final_accuracy ? ` | ${(m.final_accuracy * 100).toFixed(1)}%` : '';
        const local = m.available_locally ? ' [LOCAL]' : ' [nao disponivel localmente]';
        return `<option value="${m.id}" data-local="${m.local_path || ''}" ${!m.available_locally ? 'disabled' : ''}>
          ${escapeHtml(m.name)}${accuracy}${local}
        </option>`;
      })
      .join('');
}

function setTestMode(mode: 'text' | 'pdf'): void {
  // Test mode updated to: mode

  const textBtn = document.getElementById('test-mode-text');
  const pdfBtn = document.getElementById('test-mode-pdf');

  textBtn?.classList.toggle('border-purple-500', mode === 'text');
  textBtn?.classList.toggle('text-purple-600', mode === 'text');
  textBtn?.classList.toggle('border-transparent', mode !== 'text');
  textBtn?.classList.toggle('text-gray-500', mode !== 'text');

  pdfBtn?.classList.toggle('border-purple-500', mode === 'pdf');
  pdfBtn?.classList.toggle('text-purple-600', mode === 'pdf');
  pdfBtn?.classList.toggle('border-transparent', mode !== 'pdf');
  pdfBtn?.classList.toggle('text-gray-500', mode !== 'pdf');

  document.getElementById('test-input-text')?.classList.toggle('hidden', mode !== 'text');
  document.getElementById('test-input-pdf')?.classList.toggle('hidden', mode !== 'pdf');
}

function handlePdfInputChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const filenameEl = document.getElementById('test-pdf-filename');
    if (filenameEl) filenameEl.textContent = file.name;
  }
}

async function classifyText(): Promise<void> {
  if (!workerConnected) {
    alert('Worker local nao conectado. Inicie o servidor de inferencia primeiro.');
    return;
  }

  const select = document.getElementById('test-model-select') as HTMLSelectElement | null;
  const modelId = select?.value;
  const localPath = select?.options[select.selectedIndex]?.dataset?.local;

  if (!modelId || !localPath) {
    alert('Selecione um modelo disponivel localmente.');
    return;
  }

  const text = (document.getElementById('test-text-input') as HTMLTextAreaElement | null)?.value.trim();
  if (!text) {
    alert('Digite ou cole um texto para classificar.');
    return;
  }

  const btn = document.getElementById('btn-classify-text') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Classificando...';
  }

  try {
    const response = await fetch(`${WORKER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: localPath, text: text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro na classificacao');
    }

    const result: TestResult = await response.json();
    showTestResult(result);
    saveTestHistory(parseInt(modelId), 'text', text, null, result);
  } catch (e) {
    alert('Erro: ' + (e as Error).message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic mr-2"></i> Classificar';
    }
  }
}

async function classifyPdf(): Promise<void> {
  if (!workerConnected) {
    alert('Worker local nao conectado. Inicie o servidor de inferencia primeiro.');
    return;
  }

  const select = document.getElementById('test-model-select') as HTMLSelectElement | null;
  const modelId = select?.value;
  const localPath = select?.options[select.selectedIndex]?.dataset?.local;

  if (!modelId || !localPath) {
    alert('Selecione um modelo disponivel localmente.');
    return;
  }

  const fileInput = document.getElementById('test-pdf-input') as HTMLInputElement | null;
  const file = fileInput?.files?.[0];
  if (!file) {
    alert('Selecione um arquivo PDF.');
    return;
  }

  const btn = document.getElementById('btn-classify-pdf') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Classificando...';
  }

  try {
    const formData = new FormData();
    formData.append('model', localPath);
    formData.append('file', file);

    const response = await fetch(`${WORKER_URL}/predict/pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro na classificacao');
    }

    const result: TestResult = await response.json();
    showTestResult(result);
    saveTestHistory(parseInt(modelId), 'pdf', `[PDF: ${file.name}]`, file.name, result);
  } catch (e) {
    alert('Erro: ' + (e as Error).message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic mr-2"></i> Classificar PDF';
    }
  }
}

function showTestResult(result: TestResult): void {
  document.getElementById('test-result')?.classList.remove('hidden');
  const categoryEl = document.getElementById('test-result-category');
  const confidenceEl = document.getElementById('test-result-confidence');
  if (categoryEl) categoryEl.textContent = result.predicted_label;
  if (confidenceEl) confidenceEl.textContent = `${(result.confidence * 100).toFixed(1)}%`;
}

async function saveTestHistory(runId: number, inputType: 'text' | 'pdf', inputText: string, filename: string | null, result: TestResult): Promise<void> {
  const formData = new FormData();
  formData.append('run_id', String(runId));
  formData.append('input_type', inputType);
  formData.append('input_text', inputText.substring(0, 5000));
  formData.append('predicted_label', result.predicted_label);
  formData.append('confidence', String(result.confidence));
  if (filename) formData.append('input_filename', filename);

  const token = getToken();
  await fetch('/bert-training/api/tests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  loadTestHistory();
}

async function loadTestHistory(): Promise<void> {
  const response = await apiCall('/api/tests?limit=20');
  if (!response) return;

  const tests: TestHistoryItem[] = await response.json();
  const container = document.getElementById('test-history-list');
  if (!container) return;

  if (tests.length === 0) {
    container.innerHTML = '<p class="text-center py-4 text-gray-400 text-sm">Nenhum teste realizado ainda.</p>';
    return;
  }

  container.innerHTML = tests
    .map(
      (t) => `
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <i class="fas ${t.input_type === 'pdf' ? 'fa-file-pdf text-red-500' : 'fa-font text-blue-500'}"></i>
          <span class="font-medium text-gray-800">${escapeHtml(t.predicted_label)}</span>
          <span class="text-gray-400">${(t.confidence * 100).toFixed(0)}%</span>
        </div>
        <p class="text-xs text-gray-500 truncate mt-1">${escapeHtml(t.input_filename || t.input_text)}</p>
      </div>
      <button onclick="deleteTest(${t.id})" class="text-red-500 hover:text-red-700 ml-2">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `
    )
    .join('');
}

async function deleteTest(id: number): Promise<void> {
  if (!confirm('Deletar este teste?')) return;
  await apiCall(`/api/tests/${id}`, { method: 'DELETE' });
  loadTestHistory();
}

async function clearTestHistory(): Promise<void> {
  if (!confirm('Limpar todo o historico de testes?')) return;
  await apiCall('/api/tests', { method: 'DELETE' });
  loadTestHistory();
}

// ============================================
// Onboarding
// ============================================

function showOnboarding(): void {
  document.getElementById('onboarding-modal')?.classList.remove('hidden');
}

function closeOnboarding(): void {
  const dontShowAgain = (document.getElementById('dont-show-again') as HTMLInputElement | null)?.checked;
  if (dontShowAgain) {
    localStorage.setItem('bert_onboarding_done', 'true');
  }
  document.getElementById('onboarding-modal')?.classList.add('hidden');
}

function checkOnboarding(): void {
  const onboardingDone = localStorage.getItem('bert_onboarding_done');
  if (!onboardingDone) {
    showOnboarding();
  }
}

// ============================================
// Utilities
// ============================================

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
  // Remove toast anterior se existir
  const existingToast = document.getElementById('toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  const colors: Record<string, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
  };

  const icons: Record<string, string> = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
  };

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in`;
  toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);

  // Remove após 4 segundos
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================
// Init
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    return;
  }

  checkOnboarding();

  loadDatasets();
  loadDatasetsForSelect();
  loadRuns();

  // Event listeners
  document.getElementById('upload-file')?.addEventListener('change', handleFileChange);
  document.getElementById('upload-form')?.addEventListener('submit', handleUploadSubmit);
  document.getElementById('new-run-form')?.addEventListener('submit', handleNewRunSubmit);
  document.getElementById('test-pdf-input')?.addEventListener('change', handlePdfInputChange);

  // Polling mais frequente (5s) para melhor feedback durante treinamento
  setInterval(() => {
    if (currentTab === 'acompanhar') {
      loadRuns();
      if (activeTrainingRunId) {
        updateActiveTrainingStatus();
      }
    }
  }, 5000);
});

// ============================================
// Global Exports
// ============================================

declare global {
  interface Window {
    showTab: typeof showTab;
    viewDataset: typeof viewDataset;
    showUploadModal: typeof showUploadModal;
    closeUploadModal: typeof closeUploadModal;
    validateDataset: typeof validateDataset;
    filterRuns: typeof filterRuns;
    viewRun: typeof viewRun;
    viewEvaluation: typeof viewEvaluation;
    closeRunDetail: typeof closeRunDetail;
    cancelTraining: typeof cancelTraining;
    stopEarly: typeof stopEarly;
    startLocalWorker: typeof startLocalWorker;
    startInferenceServer: typeof startInferenceServer;
    selectPreset: typeof selectPreset;
    setTestMode: typeof setTestMode;
    classifyText: typeof classifyText;
    classifyPdf: typeof classifyPdf;
    deleteTest: typeof deleteTest;
    clearTestHistory: typeof clearTestHistory;
    showOnboarding: typeof showOnboarding;
    closeOnboarding: typeof closeOnboarding;
  }
}

window.showTab = showTab;
window.viewDataset = viewDataset;
window.showUploadModal = showUploadModal;
window.closeUploadModal = closeUploadModal;
window.validateDataset = validateDataset;
window.filterRuns = filterRuns;
window.viewRun = viewRun;
window.viewEvaluation = viewEvaluation;
window.closeRunDetail = closeRunDetail;
window.cancelTraining = cancelTraining;
window.stopEarly = stopEarly;
window.startLocalWorker = startLocalWorker;
window.startInferenceServer = startInferenceServer;
window.selectPreset = selectPreset;
window.setTestMode = setTestMode;
window.classifyText = classifyText;
window.classifyPdf = classifyPdf;
window.deleteTest = deleteTest;
window.clearTestHistory = clearTestHistory;
window.showOnboarding = showOnboarding;
window.closeOnboarding = closeOnboarding;
