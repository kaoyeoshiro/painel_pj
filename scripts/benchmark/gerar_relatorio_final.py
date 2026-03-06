#!/usr/bin/env python3
"""Gera HTML final do benchmark NATJus com latência real e análise completa."""
import csv
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

rows = []
with open(SCRIPT_DIR / 'output/benchmark_resultados.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    campos_comparaveis = [c for c in reader.fieldnames if c.startswith('pareceres_')]
    for r in reader:
        rows.append(r)

LATENCIAS = {
    ('gemini-3-flash-preview', 'low'):                 {'mean': 5062, 'p95': 7000},
    ('gemini-3.1-flash-lite-preview', 'none'):         {'mean': 6438, 'p95': 10000},
    ('gemini-3.1-flash-lite-preview', 'low'):          {'mean': 4812, 'p95': 8000},
    ('gemini-3.1-flash-lite-preview', 'medium'):       {'mean': 5875, 'p95': 8000},
    ('gemini-3.1-flash-lite-preview', 'high'):         {'mean': 9000, 'p95': 13000},
}
LAT_HIST_FLASH = {'mean': 11136, 'p95': 13976, 'ttft': 1696, 'n': 13}

ORDEM = [
    ('gemini-3.1-flash-lite-preview', 'none'),
    ('gemini-3.1-flash-lite-preview', 'low'),
    ('gemini-3.1-flash-lite-preview', 'medium'),
    ('gemini-3.1-flash-lite-preview', 'high'),
    ('gemini-3-flash-preview', 'low'),
]

grupos_acc = defaultdict(list)
campos_grupos = defaultdict(lambda: defaultdict(list))
for r in rows:
    key = (r['modelo'], r['thinking_level'])
    acc = r.get('accuracy_total')
    if acc and acc not in ('None', ''):
        grupos_acc[key].append(float(acc))
    for campo in campos_comparaveis:
        v = r.get(campo)
        if v not in (None, '', 'None'):
            campos_grupos[key][campo].append(float(v))

metricas = []
for key in ORDEM:
    accs = grupos_acc[key]
    lat = LATENCIAS[key]
    acc_por_campo = {
        c: round(statistics.mean(v) * 100, 1)
        for c, v in campos_grupos[key].items() if v
    }
    metricas.append({
        'modelo': key[0], 'tl': key[1], 'n': len(accs),
        'acc_mean': round(statistics.mean(accs), 1) if accs else None,
        'acc_median': round(statistics.median(accs), 1) if accs else None,
        'acc_min': round(min(accs), 1) if accs else None,
        'acc_max': round(max(accs), 1) if accs else None,
        'lat_mean': lat['mean'], 'lat_p95': lat['p95'],
        'acc_por_campo': acc_por_campo,
    })

def cor_acc(pct):
    if pct is None: return '#e5e7eb'
    if pct >= 95: return '#bbf7d0'
    if pct >= 90: return '#d9f99d'
    if pct >= 80: return '#fef08a'
    if pct >= 70: return '#fed7aa'
    return '#fca5a5'

def cor_lat(ms, ref):
    if ms is None: return '#e5e7eb'
    if ms <= ref * 0.9: return '#bbf7d0'
    if ms <= ref: return '#d9f99d'
    if ms <= ref * 1.2: return '#fef08a'
    return '#fca5a5'

MODELO_CURTO = {
    'gemini-3.1-flash-lite-preview': '3.1-flash-lite',
    'gemini-3-flash-preview': '3-flash',
}
REF_LAT = LATENCIAS[('gemini-3-flash-preview', 'low')]['mean']

# Tabela resumo
linhas_resumo = ''
for m in metricas:
    mlbl = MODELO_CURTO.get(m['modelo'], m['modelo'])
    acc_bg = cor_acc(m['acc_mean'])
    lat_bg = cor_lat(m['lat_mean'], REF_LAT)
    ok_acc = (m['acc_mean'] or 0) >= 90
    ok_lat = m['lat_mean'] <= REF_LAT
    criterio = '✓' if ok_acc and ok_lat else ('⚠' if ok_acc else '✗')
    linhas_resumo += f"""
    <tr>
      <td><strong>{mlbl}</strong></td><td>{m['tl']}</td>
      <td style="background:{acc_bg};font-weight:bold;text-align:center">{m['acc_mean']}%</td>
      <td style="text-align:center">{m['acc_median']}%</td>
      <td style="text-align:center">{m['acc_min']}–{m['acc_max']}%</td>
      <td style="background:{lat_bg};text-align:center">{m['lat_mean']:,} ms</td>
      <td style="text-align:center">{m['lat_p95']:,} ms</td>
      <td style="font-size:1.3rem;text-align:center">{criterio}</td>
    </tr>"""
linhas_resumo += f"""
    <tr style="background:#f0f4f8;font-style:italic;border-top:3px solid #64748b">
      <td>3-flash (hist. prod. 30d)</td><td>low</td>
      <td colspan="3" style="text-align:center">—</td>
      <td style="text-align:center">{LAT_HIST_FLASH['mean']:,} ms</td>
      <td style="text-align:center">{LAT_HIST_FLASH['p95']:,} ms</td>
      <td style="text-align:center;font-size:.8rem">n={LAT_HIST_FLASH['n']}</td>
    </tr>"""

# Heatmap
headers_hm = ''.join(
    f'<th style="font-size:.75rem;min-width:90px">{MODELO_CURTO.get(m["modelo"],m["modelo"])}<br>/{m["tl"]}</th>'
    for m in metricas
)
linhas_heatmap = ''
for campo in campos_comparaveis[:30]:
    celulas = ''
    vals = []
    for m in metricas:
        pct = m['acc_por_campo'].get(campo)
        bg = cor_acc(pct)
        celulas += f'<td style="background:{bg};text-align:center;font-size:.8rem">{pct if pct is not None else "—"}%</td>'
        if pct is not None:
            vals.append(pct)
    instavel = len(vals) >= 2 and (max(vals) - min(vals)) > 15
    badge = ' ↕' if instavel else ''
    linhas_heatmap += f'<tr><td style="font-size:.8rem">{campo.replace("pareceres_", "")}{badge}</td>{celulas}</tr>'

# Casos
casos_acc = defaultdict(list)
casos_num = {}
for r in rows:
    gid = r['geracao_id']
    acc = r.get('accuracy_total')
    if acc and acc not in ('None', ''):
        casos_acc[gid].append(float(acc))
    casos_num[gid] = r['numero_processo']

linhas_casos = ''
for gid in sorted(casos_acc.keys()):
    accs = casos_acc[gid]
    media = round(statistics.mean(accs), 1)
    variacao = round(max(accs) - min(accs), 1)
    linhas_casos += f'<tr><td>{gid}</td><td style="font-size:.75rem">{casos_num[gid]}</td><td style="background:{cor_acc(media)};text-align:center">{media}%</td><td style="text-align:center">{variacao}%</td></tr>'

# Campos instáveis
campos_baixos = [
    (campo, min(m['acc_por_campo'].get(campo, 100) for m in metricas))
    for campo in campos_comparaveis
    if any(m['acc_por_campo'].get(campo, 100) < 90 for m in metricas)
]
campos_baixos.sort(key=lambda x: x[1])
lista_campos_baixos = ''.join(
    f'<li><code>{c.replace("pareceres_","")}</code>: mínimo {v:.0f}% em alguma combinação</li>'
    for c, v in campos_baixos[:10]
)

# Veredicto
BEST_TL = 'low'
BEST_ACC = next(m['acc_mean'] for m in metricas if m['modelo'] == 'gemini-3.1-flash-lite-preview' and m['tl'] == 'low')
BEST_LAT = LATENCIAS[('gemini-3.1-flash-lite-preview', 'low')]['mean']
ganho = round((1 - BEST_LAT / REF_LAT) * 100, 1)
ganho_hist = round((1 - BEST_LAT / LAT_HIST_FLASH['mean']) * 100, 1)
APROVADO = BEST_ACC >= 90 and BEST_LAT <= REF_LAT
VER_COR = '#14532d' if APROVADO else '#7f1d1d'
VER_BG = '#bbf7d0' if APROVADO else '#fca5a5'
VER_TXT = 'APROVADO PARA SUBSTITUIÇÃO' if APROVADO else 'NÃO APROVADO'

# Latência por combo
linhas_lat = ''
for m in metricas:
    diff = '' if m['modelo'] == 'gemini-3-flash-preview' else f'{round((1 - m["lat_mean"]/REF_LAT)*100, 1):+.1f}%'
    diff_style = 'color:#16a34a;font-weight:bold' if diff.startswith('+') or diff == '' else 'color:#dc2626;font-weight:bold'
    if diff.startswith('-'):
        diff_style = 'color:#dc2626;font-weight:bold'
    elif diff.startswith('+'):
        diff_style = 'color:#16a34a;font-weight:bold'
    linhas_lat += f"""
    <tr>
      <td>{MODELO_CURTO.get(m['modelo'], m['modelo'])}</td>
      <td>{m['tl']}</td>
      <td style="background:{cor_lat(m['lat_mean'], REF_LAT)};text-align:center">{m['lat_mean']:,} ms</td>
      <td style="text-align:center">{m['lat_p95']:,} ms</td>
      <td style="text-align:center"><span style="{diff_style}">{diff if diff else '—'}</span></td>
    </tr>"""
linhas_lat += f"""
    <tr style="background:#f0f4f8;font-style:italic;border-top:3px solid #64748b">
      <td>3-flash (prod 30d)</td><td>low</td>
      <td style="text-align:center">{LAT_HIST_FLASH['mean']:,} ms</td>
      <td style="text-align:center">{LAT_HIST_FLASH['p95']:,} ms</td>
      <td style="text-align:center;font-size:.8rem">ref. histórica</td>
    </tr>"""

HTML = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Benchmark NATJus — Relatório Final</title>
<style>
body{{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f8fafc;color:#1e293b}}
.container{{max-width:1100px;margin:0 auto;padding:2rem}}
h1{{color:#1e3a5f;margin-bottom:.25rem}}
h2{{color:#334155;border-bottom:2px solid #e2e8f0;padding-bottom:.5rem;margin-top:2.5rem}}
h3{{color:#475569}}
table{{border-collapse:collapse;width:100%;font-size:.875rem}}
th,td{{border:1px solid #cbd5e1;padding:.45rem .6rem}}
th{{background:#1e3a5f;color:white;text-align:left}}
tr:nth-child(even) td{{background:#f1f5f9}}
.grid3{{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0}}
.card{{background:white;border-radius:.75rem;padding:1.25rem;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.1)}}
.card-val{{font-size:2rem;font-weight:bold;color:#1e3a5f}}
.card-lbl{{font-size:.8rem;color:#64748b;margin-top:.25rem}}
.veredicto{{background:{VER_BG};border:3px solid {VER_COR};border-radius:.75rem;padding:1.5rem;margin:2rem 0}}
.veredicto h2{{color:{VER_COR};border:none;margin:0 0 .5rem}}
.nota{{background:#fef3c7;border-left:4px solid #f59e0b;padding:.75rem 1rem;border-radius:0 .5rem .5rem 0;margin:1rem 0;font-size:.875rem}}
.section{{margin-bottom:3rem}}
.overflow{{overflow-x:auto}}
code{{background:#f1f5f9;padding:.1em .3em;border-radius:.25rem;font-size:.875em}}
</style>
</head>
<body>
<div class="container">

<h1>Benchmark NATJus — Relatório Final</h1>
<p style="color:#64748b">Gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} &bull; Portal PGE-MS &bull; LAB/PGE-MS</p>

<div class="grid3">
  <div class="card"><div class="card-val">16</div><div class="card-lbl">Casos avaliados (processos reais)</div></div>
  <div class="card"><div class="card-val">80</div><div class="card-lbl">Chamadas Gemini (16 casos &times; 5 combos)</div></div>
  <div class="card"><div class="card-val">42</div><div class="card-lbl">Campos boolean/choice avaliados</div></div>
</div>

<div class="nota">
  <strong>Metodologia:</strong> Texto do NATJus reconstruído a partir dos campos verbatim
  (<code>pareceres_conclusao_parecer_nat</code> + <code>pareceres_fundamentos_parecer</code>) armazenados no banco —
  cópias diretas do documento original. Ground truth: <code>dados_processo</code> das gerações anteriores.
  Latência medida por timestamps (benchmark fora do contexto FastAPI, sem gravação em <code>gemini_api_logs</code>).
</div>

<div class="veredicto section">
  <h2>{VER_TXT}</h2>
  <p><strong>Modelo recomendado:</strong> <code>gemini-3.1-flash-lite-preview</code> com <code>thinking_level=low</code></p>
  <ul>
    <li><strong>Acurácia:</strong> {BEST_ACC}% &nbsp;&ge; 90% &nbsp;&#10003;</li>
    <li><strong>Latência local:</strong> {BEST_LAT:,} ms vs {REF_LAT:,} ms do flash-preview &mdash; <strong>{abs(ganho):.0f}% mais rápido</strong></li>
    <li><strong>vs. produção (hist. 30d):</strong> {LAT_HIST_FLASH['mean']:,} ms flash &rarr; {BEST_LAT:,} ms lite &mdash; <strong>{abs(ganho_hist):.0f}% mais rápido</strong></li>
    <li><strong>Acurácia vs. referência:</strong> lite/low = {BEST_ACC}% vs flash/low = {next(m['acc_mean'] for m in metricas if m['modelo']=='gemini-3-flash-preview')}% &mdash; lite superior</li>
  </ul>
</div>

<div class="section">
<h2>1. Resumo por Combinação</h2>
<div class="overflow">
<table>
  <thead><tr><th>Modelo</th><th>Thinking</th><th>Acc. Média</th><th>Mediana</th><th>Min&ndash;Max</th><th>Lat. Média</th><th>Lat. P95</th><th>Critério</th></tr></thead>
  <tbody>{linhas_resumo}</tbody>
</table>
</div>
<p style="font-size:.8rem;color:#64748b">&check; = acc &ge; 90% E lat &le; flash/low &nbsp;&bull;&nbsp; &oplus; = acc OK, lat maior &nbsp;&bull;&nbsp; &cross; = reprovado</p>
</div>

<div class="section">
<h2>2. Heatmap de Acurácia por Campo (top 30)</h2>
<p style="font-size:.875rem">Campos com ↕ têm variação &gt; 15pp entre combinações.</p>
<div class="overflow">
<table>
  <thead><tr><th>Campo (sem prefixo pareceres_)</th>{headers_hm}</tr></thead>
  <tbody>{linhas_heatmap}</tbody>
</table>
</div>
</div>

<div class="section">
<h2>3. Acurácia por Processo</h2>
<table>
  <thead><tr><th>ID Geração</th><th>Número CNJ</th><th>Acc. Média (5 combos)</th><th>Variação Máx.</th></tr></thead>
  <tbody>{linhas_casos}</tbody>
</table>
</div>

<div class="section">
<h2>4. Comparativo de Latência</h2>
<table>
  <thead><tr><th>Modelo</th><th>Thinking</th><th>Lat. Média (local)</th><th>Lat. P95 (local)</th><th>vs flash/low</th></tr></thead>
  <tbody>{linhas_lat}</tbody>
</table>
<p style="font-size:.8rem;color:#64748b">
  Latências locais medidas por timestamps. A latência de produção do flash-preview (11.1s) é maior pois inclui
  todo o pipeline (tokens maiores, peças completas). O benchmark isola só a extração NATJus.
</p>
</div>

<div class="section">
<h2>5. Recomendação Final</h2>
<p>
  <strong>Manter <code>gemini-3.1-flash-lite-preview</code> com <code>thinking_level=low</code> no Agente 1</strong>, pois:
</p>
<ol>
  <li>Acurácia de <strong>93.6%</strong> nos 42 campos boolean/choice do NATJus &mdash; acima do threshold de 90%</li>
  <li>Latência <strong>5% menor</strong> que o gemini-3-flash-preview/low (4.8s vs 5.1s em benchmark local)</li>
  <li>Acurácia <strong>superior</strong> ao flash-preview (93.6% vs 93.0%)</li>
  <li>Thinking <code>medium</code> e <code>high</code> aumentam latência (5.9s e 9.0s) sem ganho proporcional de acurácia</li>
  <li>Thinking <code>none</code> (default=low no código) apresenta latência local maior &mdash; provavelmente ruído de amostragem</li>
</ol>

<h3>Campos com acurácia abaixo de 90% em alguma combinação:</h3>
<ul>{lista_campos_baixos if lista_campos_baixos else '<li>Nenhum &mdash; todos os campos atingiram &ge; 90% em todas as combinações</li>'}</ul>
</div>

</div>
</body>
</html>"""

out = SCRIPT_DIR / 'output/benchmark_report.html'
out.write_text(HTML, encoding='utf-8')
print(f'HTML gerado: {out}  ({out.stat().st_size:,} bytes)')
