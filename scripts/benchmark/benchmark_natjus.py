#!/usr/bin/env python3
# scripts/benchmark/benchmark_natjus.py
"""
Benchmark NATJus — Passo 2: Comparação de Modelos Gemini.

Para cada caso do cache (gerado pelo Passo 1) × combinação de modelo/thinking_level,
executa a extração JSON do parecer NATJus e compara contra o ground truth.

Saída:
    scripts/benchmark/output/benchmark_resultados.csv
    scripts/benchmark/output/benchmark_report.html

Uso:
    python scripts/benchmark/benchmark_natjus.py
    python scripts/benchmark/benchmark_natjus.py --limit 10 --dry-run
    python scripts/benchmark/benchmark_natjus.py --casos data/casos_natjus.json --output output/

Autor: LAB/PGE-MS
"""

import os
import sys
import json
import csv
import asyncio
import argparse
import logging
import statistics
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# Adiciona raiz do projeto ao path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

# Workaround: evita executar services/__init__.py e services/text_normalizer/__init__.py
# que têm dependência incompatível com Python 3.13 (wrapt via slowapi/limits).
# Injetamos stubs para que os subpacotes úteis (gemini_service, tjms, agente_tjms) funcionem.
import types as _types
if "services" not in sys.modules:
    _stub = _types.ModuleType("services")
    _stub.__path__ = [str(PROJECT_ROOT / "services")]
    _stub.__package__ = "services"
    sys.modules["services"] = _stub

if "services.text_normalizer" not in sys.modules:
    _tn_mod = _types.ModuleType("services.text_normalizer")
    # Stub mínimo: normalize(text) retorna objeto com .text
    _tn_mod.text_normalizer = _types.SimpleNamespace(
        normalize=lambda t: _types.SimpleNamespace(text=t or "")
    )
    sys.modules["services.text_normalizer"] = _tn_mod

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# =========================
# Combinações a testar
# =========================
COMBINACOES: list[dict] = [
    {"modelo": "gemini-3.1-flash-lite-preview", "thinking_level": None},
    {"modelo": "gemini-3.1-flash-lite-preview", "thinking_level": "low"},
    {"modelo": "gemini-3.1-flash-lite-preview", "thinking_level": "medium"},
    {"modelo": "gemini-3.1-flash-lite-preview", "thinking_level": "high"},
    {"modelo": "gemini-3-flash-preview",         "thinking_level": "low"},
]

NOME_CATEGORIA_NATJUS = "pareceres"


# =========================
# Banco de dados
# =========================
def conectar_banco():
    """Cria engine e sessão."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL não definida no .env")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    return engine, Session()


def buscar_schema_natjus(db) -> tuple[str, str, list[str]]:
    """
    Busca schema JSON e instruções da categoria NATJus.

    Retorna (formato_json_str, instrucoes, campos_comparaveis).
    """
    from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON

    categoria = db.query(CategoriaResumoJSON).filter(
        CategoriaResumoJSON.nome == NOME_CATEGORIA_NATJUS
    ).first()

    if not categoria:
        raise RuntimeError(f"Categoria '{NOME_CATEGORIA_NATJUS}' não encontrada")

    schema = json.loads(categoria.formato_json)

    # Auto-detecta campos boolean/choice
    campos_comparaveis = [
        campo for campo, meta in schema.items()
        if isinstance(meta, dict) and meta.get("type") in ("boolean", "choice")
    ]

    logger.info(f"Schema NATJus: {len(schema)} campos, "
                f"{len(campos_comparaveis)} comparáveis (bool/choice)")

    return categoria.formato_json, categoria.instrucoes_extracao or "", campos_comparaveis


def buscar_latencia_historica_flash(engine) -> dict:
    """
    Busca latência histórica do gemini-3-flash-preview no banco de logs.

    Retorna dict com mean, p95, ttft_mean ou None se sem dados.
    """
    from sqlalchemy import text

    sql = text("""
        SELECT
            AVG(time_total_ms)                                                AS mean_total,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY time_total_ms)      AS p95_total,
            AVG(time_ttft_ms)                                                 AS mean_ttft
        FROM gemini_api_logs
        WHERE model = 'gemini-3-flash-preview'
          AND sistema = 'gerador_pecas'
          AND thinking_level = 'low'
          AND success = true
          AND created_at > NOW() - INTERVAL '30 days'
    """)

    with engine.connect() as conn:
        row = conn.execute(sql).fetchone()

    if not row or row[0] is None:
        logger.warning("Sem dados históricos de latência para gemini-3-flash-preview")
        return {}

    return {
        "mean_total_ms": round(float(row[0]), 0),
        "p95_total_ms": round(float(row[1]), 0),
        "mean_ttft_ms": round(float(row[2]), 0) if row[2] else None,
    }


# =========================
# Extração com LLM
# =========================
async def extrair_natjus(
    session,
    texto: str,
    imagens_base64: Optional[list[str]],
    formato_json: str,
    instrucoes: str,
    modelo: str,
    thinking_level: Optional[str],
) -> tuple[dict, Optional[str]]:
    """
    Chama o LLM para extrair campos NATJus do documento.

    Retorna (json_normalizado, erro_str).
    """
    from sistemas.gerador_pecas.agente_tjms import chamar_llm_async, chamar_llm_com_imagens_async
    from sistemas.gerador_pecas.extrator_resumo_json import parsear_resposta_json, normalizar_json_com_schema

    prompt = (
        f"{instrucoes}\n\n"
        f"Schema esperado:\n{formato_json}\n\n"
        f"Documento:\n{texto or '[sem texto — ver imagem]'}"
    )

    # Ajusta thinking_level: None → "low" (sem thinking explícito usa default)
    tl_param = thinking_level if thinking_level is not None else "low"

    try:
        if imagens_base64:
            resposta = await chamar_llm_com_imagens_async(
                session=session,
                prompt=prompt,
                imagens_base64=imagens_base64,
                modelo=modelo,
                thinking_level=tl_param,
            )
        else:
            resposta = await chamar_llm_async(
                session=session,
                prompt=prompt,
                modelo=modelo,
                thinking_level=tl_param,
            )
    except Exception as e:
        return {}, str(e)

    json_extraido, erro = parsear_resposta_json(resposta)
    if erro:
        return {}, erro

    json_normalizado = normalizar_json_com_schema(json_extraido, formato_json)
    return json_normalizado, None


def buscar_log_latencia(db, modelo: str, thinking_level: Optional[str], ts_inicio: datetime) -> dict:
    """Busca o log de latência mais recente da chamada Gemini."""
    from admin.models_gemini_logs import GeminiApiLog

    # thinking_level None → stored as "low" (default usado)
    tl_busca = thinking_level if thinking_level is not None else "low"

    log = (
        db.query(GeminiApiLog)
        .filter(
            GeminiApiLog.model == modelo,
            GeminiApiLog.created_at >= ts_inicio,
        )
        .order_by(GeminiApiLog.created_at.desc())
        .first()
    )

    if not log:
        return {}

    return {
        "latencia_total_ms": log.time_total_ms,
        "latencia_ttft_ms": log.time_ttft_ms,
        "tokens_resposta": log.response_tokens,
    }


# =========================
# Benchmark principal
# =========================
async def rodar_benchmark(
    casos: list[dict],
    formato_json: str,
    instrucoes: str,
    campos_comparaveis: list[str],
    db,
    dry_run: bool,
) -> list[dict]:
    """
    Itera sobre casos × combinações e coleta resultados.

    No dry_run, imprime preview sem chamar o LLM.
    """
    import aiohttp

    if dry_run:
        logger.info("=== DRY RUN — sem chamadas Gemini ===")
        logger.info(f"Campos comparáveis detectados ({len(campos_comparaveis)}):")
        for c in campos_comparaveis:
            logger.info(f"  - {c}")
        logger.info(f"\nPrimeiro ground_truth (preview):")
        gt = casos[0]["ground_truth"]
        for k, v in gt.items():
            if k in campos_comparaveis:
                logger.info(f"  {k}: {v}")
        return []

    resultados = []
    total_chamadas = len(casos) * len(COMBINACOES)
    chamada_num = 0

    async with aiohttp.ClientSession() as session:
        for caso in casos:
            geracao_id = caso["geracao_id"]
            numero_processo = caso["numero_processo"]
            ground_truth = caso["ground_truth"]
            doc = caso["documento"]

            texto = doc.get("texto_extraido")
            imagens = doc.get("conteudo_base64")

            for combo in COMBINACOES:
                modelo = combo["modelo"]
                thinking_level = combo["thinking_level"]
                chamada_num += 1
                tl_label = thinking_level or "none"

                logger.info(
                    f"[{chamada_num}/{total_chamadas}] "
                    f"geracao={geracao_id} | {modelo} | tl={tl_label}"
                )

                ts_inicio = datetime.now(timezone.utc)

                json_extraido, erro = await extrair_natjus(
                    session=session,
                    texto=texto,
                    imagens_base64=imagens,
                    formato_json=formato_json,
                    instrucoes=instrucoes,
                    modelo=modelo,
                    thinking_level=thinking_level,
                )

                # Busca latência no banco
                latencia = buscar_log_latencia(db, modelo, thinking_level, ts_inicio)

                # Calcula acurácia por campo
                campos_match = {}
                total_match = 0
                total_comparaveis = 0

                for campo in campos_comparaveis:
                    gt_val = ground_truth.get(campo)
                    ex_val = json_extraido.get(campo)

                    if gt_val is None:
                        continue  # campo ausente no ground_truth → skip

                    total_comparaveis += 1
                    match = gt_val == ex_val
                    campos_match[campo] = 1 if match else 0
                    if match:
                        total_match += 1

                accuracy = (
                    round(total_match / total_comparaveis * 100, 1)
                    if total_comparaveis > 0 else None
                )

                resultados.append({
                    "geracao_id": geracao_id,
                    "numero_processo": numero_processo,
                    "modelo": modelo,
                    "thinking_level": tl_label,
                    "accuracy_total": accuracy,
                    "campos_match": campos_match,
                    "latencia_total_ms": latencia.get("latencia_total_ms"),
                    "latencia_ttft_ms": latencia.get("latencia_ttft_ms"),
                    "tokens_resposta": latencia.get("tokens_resposta"),
                    "erro": erro,
                })

                status = f"acc={accuracy}%" if accuracy is not None else f"ERRO: {erro}"
                lat_str = f" lat={latencia.get('latencia_total_ms', '?')}ms"
                logger.info(f"  → {status}{lat_str}")

    return resultados


# =========================
# Exportação CSV
# =========================
def exportar_csv(resultados: list[dict], output_dir: Path, campos_comparaveis: list[str]) -> Path:
    """Gera CSV com uma linha por (geracao_id, modelo, thinking_level)."""
    caminho = output_dir / "benchmark_resultados.csv"

    colunas_base = [
        "geracao_id", "numero_processo", "modelo", "thinking_level",
        "accuracy_total", "latencia_total_ms", "latencia_ttft_ms",
        "tokens_resposta", "erro",
    ]
    colunas = colunas_base + campos_comparaveis

    with open(caminho, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=colunas, extrasaction="ignore")
        writer.writeheader()
        for r in resultados:
            row = {k: r.get(k) for k in colunas_base}
            campos_match = r.get("campos_match", {})
            for campo in campos_comparaveis:
                row[campo] = campos_match.get(campo)
            writer.writerow(row)

    logger.info(f"CSV salvo: {caminho}")
    return caminho


# =========================
# Métricas por combinação
# =========================
def calcular_metricas(resultados: list[dict], campos_comparaveis: list[str]) -> list[dict]:
    """Agrupa e calcula métricas por (modelo, thinking_level)."""
    from collections import defaultdict

    grupos: dict[tuple, list] = defaultdict(list)
    for r in resultados:
        chave = (r["modelo"], r["thinking_level"])
        grupos[chave].append(r)

    metricas = []
    for (modelo, tl), grupo in grupos.items():
        acc_vals = [r["accuracy_total"] for r in grupo if r["accuracy_total"] is not None]
        lat_vals = [r["latencia_total_ms"] for r in grupo if r["latencia_total_ms"] is not None]
        ttft_vals = [r["latencia_ttft_ms"] for r in grupo if r["latencia_ttft_ms"] is not None]
        tokens_vals = [r["tokens_resposta"] for r in grupo if r["tokens_resposta"] is not None]
        erros = sum(1 for r in grupo if r["erro"])

        # Acurácia por campo
        acc_por_campo = {}
        for campo in campos_comparaveis:
            vals = [r["campos_match"].get(campo) for r in grupo if campo in r.get("campos_match", {})]
            if vals:
                acc_por_campo[campo] = round(statistics.mean(vals) * 100, 1)

        metricas.append({
            "modelo": modelo,
            "thinking_level": tl,
            "n_casos": len(grupo),
            "n_erros": erros,
            "accuracy_mean": round(statistics.mean(acc_vals), 1) if acc_vals else None,
            "lat_mean_ms": round(statistics.mean(lat_vals), 0) if lat_vals else None,
            "lat_p95_ms": round(sorted(lat_vals)[int(len(lat_vals) * 0.95)], 0) if lat_vals else None,
            "ttft_mean_ms": round(statistics.mean(ttft_vals), 0) if ttft_vals else None,
            "tokens_mean": round(statistics.mean(tokens_vals), 0) if tokens_vals else None,
            "acc_por_campo": acc_por_campo,
        })

    return sorted(metricas, key=lambda x: (x["modelo"], x["thinking_level"]))


# =========================
# Geração de HTML
# =========================
def cor_acuracia(pct: Optional[float]) -> str:
    """Retorna cor de fundo para célula de acurácia."""
    if pct is None:
        return "#e5e7eb"
    if pct >= 95:
        return "#bbf7d0"
    if pct >= 90:
        return "#d9f99d"
    if pct >= 80:
        return "#fef08a"
    if pct >= 70:
        return "#fed7aa"
    return "#fca5a5"


def cor_match(val: Optional[int]) -> str:
    """Verde para match=1, vermelho para mismatch=0."""
    if val is None:
        return "#e5e7eb"
    return "#bbf7d0" if val == 1 else "#fca5a5"


def gerar_html(
    metricas: list[dict],
    resultados: list[dict],
    campos_comparaveis: list[str],
    latencia_historica: dict,
    n_casos: int,
    output_dir: Path,
) -> Path:
    """Gera relatório HTML standalone."""
    caminho = output_dir / "benchmark_report.html"

    combinacoes_labels = [
        f"{m['modelo'].replace('gemini-', '').replace('-preview', '')} / {m['thinking_level']}"
        for m in metricas
    ]

    # --- Tabela Resumo ---
    linhas_resumo = []
    for m in metricas:
        tl = m["thinking_level"]
        acc_bg = cor_acuracia(m["accuracy_mean"])
        linhas_resumo.append(f"""
        <tr>
          <td>{m['modelo']}</td>
          <td>{tl}</td>
          <td style="background:{acc_bg};font-weight:bold">{m['accuracy_mean']}%</td>
          <td>{m['lat_mean_ms'] or '—'} ms</td>
          <td>{m['lat_p95_ms'] or '—'} ms</td>
          <td>{m['ttft_mean_ms'] or '—'} ms</td>
          <td>{m['tokens_mean'] or '—'}</td>
          <td>{m['n_erros']}/{m['n_casos']}</td>
        </tr>""")

    # --- Heatmap por Campo ---
    linhas_heatmap = []
    for campo in campos_comparaveis:
        celulas = ""
        for m in metricas:
            pct = m["acc_por_campo"].get(campo)
            bg = cor_acuracia(pct)
            celulas += f'<td style="background:{bg}">{pct if pct is not None else "—"}%</td>'
        linhas_heatmap.append(f"<tr><td>{campo}</td>{celulas}</tr>")

    # --- Tabela de Latência ---
    hist = latencia_historica
    hist_row = ""
    if hist:
        hist_row = f"""
        <tr style="background:#f3f4f6;font-style:italic">
          <td>gemini-3-flash-preview</td>
          <td>low (histórico 30d)</td>
          <td>—</td>
          <td>{hist.get('mean_total_ms', '—')} ms</td>
          <td>{hist.get('p95_total_ms', '—')} ms</td>
          <td>{hist.get('mean_ttft_ms', '—')} ms</td>
        </tr>"""

    linhas_latencia = []
    for m in metricas:
        linhas_latencia.append(f"""
        <tr>
          <td>{m['modelo']}</td>
          <td>{m['thinking_level']}</td>
          <td>{m['accuracy_mean']}%</td>
          <td>{m['lat_mean_ms'] or '—'} ms</td>
          <td>{m['lat_p95_ms'] or '—'} ms</td>
          <td>{m['ttft_mean_ms'] or '—'} ms</td>
        </tr>""")

    # Headers heatmap
    headers_heatmap = "".join(
        f"<th>{lb}</th>" for lb in combinacoes_labels
    )

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Benchmark NATJus — Comparação de Modelos Gemini</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 2rem; background: #f9fafb; color: #111; }}
  h1 {{ color: #1e3a5f; }}
  h2 {{ color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: .4rem; margin-top: 2rem; }}
  table {{ border-collapse: collapse; width: 100%; font-size: .85rem; }}
  th, td {{ border: 1px solid #d1d5db; padding: .45rem .6rem; text-align: left; }}
  th {{ background: #1e3a5f; color: white; }}
  tr:nth-child(even) td {{ background: #f0f4f8; }}
  .meta {{ background: #e0f2fe; border-radius: .5rem; padding: 1rem; margin-bottom: 1.5rem; }}
  .criterio {{ background: #fef3c7; border-radius: .5rem; padding: .75rem 1rem; margin-top: 1rem; }}
  .section {{ margin-bottom: 2.5rem; }}
  .badge-ok {{ background: #bbf7d0; color: #065f46; padding: .2rem .5rem; border-radius: 9999px; font-size:.8rem; }}
  .badge-warn {{ background: #fef08a; color: #78350f; padding: .2rem .5rem; border-radius: 9999px; font-size:.8rem; }}
  .badge-fail {{ background: #fca5a5; color: #7f1d1d; padding: .2rem .5rem; border-radius: 9999px; font-size:.8rem; }}
</style>
</head>
<body>
<h1>Benchmark NATJus — Comparação de Modelos Gemini</h1>
<div class="meta">
  <strong>Data:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}<br>
  <strong>Casos:</strong> {n_casos}<br>
  <strong>Combinações:</strong> {len(metricas)}<br>
  <strong>Categoria:</strong> pareceres (NATJus/NAT/CATES)<br>
  <strong>Campos avaliados:</strong> {len(campos_comparaveis)} (boolean/choice)<br>
  <strong>Fonte da verdade:</strong> campo <code>dados_processo</code> das geracoes_pecas
</div>

<div class="criterio">
  <strong>Critério de sucesso:</strong>
  Accuracy ≥ 90% em qualquer thinking level E latência menor que gemini-3-flash-preview/low.
</div>

<div class="section">
<h2>1. Resumo por Combinação</h2>
<table>
  <thead>
    <tr>
      <th>Modelo</th><th>Thinking</th><th>Accuracy</th>
      <th>Lat. Média</th><th>Lat. P95</th><th>TTFT Médio</th>
      <th>Tokens Médio</th><th>Erros</th>
    </tr>
  </thead>
  <tbody>
    {"".join(linhas_resumo)}
  </tbody>
</table>
</div>

<div class="section">
<h2>2. Heatmap de Acurácia por Campo</h2>
<p>Verde ≥ 95% | Amarelo-limão ≥ 90% | Amarelo ≥ 80% | Laranja ≥ 70% | Vermelho &lt; 70%</p>
<div style="overflow-x:auto">
<table>
  <thead>
    <tr>
      <th>Campo</th>
      {headers_heatmap}
    </tr>
  </thead>
  <tbody>
    {"".join(linhas_heatmap)}
  </tbody>
</table>
</div>
</div>

<div class="section">
<h2>3. Comparativo de Latência</h2>
<table>
  <thead>
    <tr>
      <th>Modelo</th><th>Thinking</th><th>Accuracy</th>
      <th>Lat. Média</th><th>Lat. P95</th><th>TTFT Médio</th>
    </tr>
  </thead>
  <tbody>
    {"".join(linhas_latencia)}
    {hist_row}
  </tbody>
</table>
</div>

<div class="section">
<h2>4. Campos Avaliados</h2>
<p>Campos boolean/choice detectados automaticamente do schema NATJus:</p>
<ul>
{"".join(f'<li><code>{c}</code></li>' for c in campos_comparaveis)}
</ul>
</div>

</body>
</html>"""

    with open(caminho, "w", encoding="utf-8") as f:
        f.write(html)

    logger.info(f"HTML salvo: {caminho}")
    return caminho


# =========================
# Main
# =========================
async def main_async(args) -> None:
    casos_path = SCRIPT_DIR / args.casos
    if not casos_path.exists():
        logger.error(f"Cache não encontrado: {casos_path}")
        logger.error("Execute primeiro: python benchmark_natjus_coleta.py")
        sys.exit(1)

    with open(casos_path, encoding="utf-8") as f:
        cache = json.load(f)

    todos_casos = cache.get("casos", [])
    if not todos_casos:
        logger.error("Cache vazio. Execute novamente o Passo 1.")
        sys.exit(1)

    # Filtra casos sem texto E sem imagem
    casos_validos = [
        c for c in todos_casos
        if c.get("documento", {}).get("texto_extraido")
        or c.get("documento", {}).get("conteudo_base64")
    ]

    if args.limit:
        casos_validos = casos_validos[: args.limit]

    logger.info(f"Casos a usar: {len(casos_validos)} "
                f"(de {len(todos_casos)} no cache, limite={args.limit})")

    _, db = conectar_banco()
    engine, _ = conectar_banco()

    try:
        formato_json, instrucoes, campos_comparaveis = buscar_schema_natjus(db)
        latencia_historica = buscar_latencia_historica_flash(engine)

        if args.dry_run:
            await rodar_benchmark(casos_validos, formato_json, instrucoes,
                                   campos_comparaveis, db, dry_run=True)
            logger.info("Dry-run concluído.")
            return

        resultados = await rodar_benchmark(
            casos_validos, formato_json, instrucoes, campos_comparaveis, db, dry_run=False
        )

        if not resultados:
            logger.warning("Nenhum resultado gerado.")
            return

        output_dir = SCRIPT_DIR / args.output
        output_dir.mkdir(parents=True, exist_ok=True)

        exportar_csv(resultados, output_dir, campos_comparaveis)

        metricas = calcular_metricas(resultados, campos_comparaveis)

        html_path = gerar_html(
            metricas=metricas,
            resultados=resultados,
            campos_comparaveis=campos_comparaveis,
            latencia_historica=latencia_historica,
            n_casos=len(casos_validos),
            output_dir=output_dir,
        )

        logger.info("\n=== SUMÁRIO FINAL ===")
        for m in metricas:
            criterio = "✓ OK" if (m["accuracy_mean"] or 0) >= 90 else "✗ ABAIXO"
            logger.info(
                f"  {m['modelo']} / {m['thinking_level']}: "
                f"acc={m['accuracy_mean']}% {criterio} | "
                f"lat={m['lat_mean_ms']}ms"
            )

        logger.info(f"\nRelatório: {html_path}")

    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark NATJus: compara modelos Gemini na extração de pareceres"
    )
    parser.add_argument(
        "--casos",
        default="data/casos_natjus.json",
        help="Caminho do cache (relativo a scripts/benchmark/)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Usa subconjunto dos casos (para testes rápidos)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Valida cache e imprime preview sem chamar Gemini",
    )
    parser.add_argument(
        "--output",
        default="output",
        help="Diretório de saída relativo a scripts/benchmark/",
    )
    args = parser.parse_args()

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
