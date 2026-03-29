"""Script para ingerir uma sessao do automacao_total no sistema de revisao do portal-pge.

Uso:
    python ingerir_sessao.py <caminho_sessao> [--url URL] [--user USER] [--pass PASS]

Exemplo:
    python ingerir_sessao.py "E:\\Projetos\\Automacao_Total\\output\\sessoes\\2026-03-28_08-30"
"""

import sys
import os
import re
import json
import argparse
import logging
import requests
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def autenticar(url: str, user: str, password: str) -> str:
    """Autentica no portal-pge e retorna JWT."""
    resp = requests.post(
        f"{url}/auth/login",
        data={"username": user, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise ValueError("Token nao retornado")
    logger.info("Autenticacao OK")
    return token


def parsear_relatorio(sessao_dir: Path) -> list[dict]:
    """Parseia o relatorio_consolidado.md e extrai dados por processo."""
    relatorio_path = sessao_dir / "relatorio_consolidado.md"
    if not relatorio_path.exists():
        logger.error(f"Relatorio nao encontrado: {relatorio_path}")
        return []

    texto = relatorio_path.read_text(encoding="utf-8")
    processos = []

    # Dividir por seções "### N. NUMERO_CNJ"
    secoes = re.split(r"### \d+\.\s+", texto)

    for secao in secoes[1:]:  # pular o header
        linhas = secao.strip().split("\n")
        if not linhas:
            continue

        numero = linhas[0].strip()
        if not re.match(r"\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}", numero):
            continue

        dados = {"numero_cnj": numero}

        for linha in linhas[1:]:
            linha = linha.strip()
            if linha.startswith("- **Categoria**:"):
                dados["categoria"] = linha.split(":", 1)[1].strip()
            elif linha.startswith("- **Descricao**:"):
                dados["descricao"] = linha.split(":", 1)[1].strip()
            elif linha.startswith("- **Resultado**:"):
                dados["resultado"] = linha.split(":", 1)[1].strip()
            elif linha.startswith("- **Acao**:"):
                acao_raw = linha.split(":", 1)[1].strip()
                # Limpar parenteses: "peca_complexa (contestacao)" -> "peca_complexa"
                dados["acao"] = re.sub(r"\s*\(.*?\)", "", acao_raw).strip()
            elif linha.startswith("- **Fundamentacao**:"):
                dados["fundamentacao"] = linha.split(":", 1)[1].strip()
            elif linha.startswith("- **Urgencia**:"):
                dados["urgencia"] = linha.split(":", 1)[1].strip()
            elif linha.startswith("- **Confianca**:"):
                confianca_raw = linha.split(":", 1)[1].strip()
                # "alta (Passe 2)" -> "alta"
                dados["confianca"] = re.sub(r"\s*\(.*?\)", "", confianca_raw).strip()
            elif linha.startswith("- **CDPENDENCIA**:"):
                try:
                    dados["cdpendencia"] = int(linha.split(":", 1)[1].strip())
                except ValueError:
                    pass
            elif linha.startswith("- **Observacoes**:"):
                dados["observacoes"] = linha.split(":", 1)[1].strip()

        processos.append(dados)

    logger.info(f"Parseados {len(processos)} processos do relatorio")
    return processos


def carregar_peca(sessao_dir: Path, numero_cnj: str) -> str | None:
    """Carrega o conteudo markdown da peca gerada, se existir."""
    peca_dir = sessao_dir / numero_cnj
    peca_md = peca_dir / "peca.md"
    if peca_md.exists():
        return peca_md.read_text(encoding="utf-8")
    return None


def determinar_tipo_peca(acao: str) -> str | None:
    """Determina o tipo da peca com base na acao."""
    if acao == "peca_complexa":
        return "contestacao"
    if acao == "peca_simples":
        return "manifestacao"
    if acao == "peticao_ciencia":
        return "peticao_ciencia"
    return None


def montar_resumo_revisor(dados: dict) -> str:
    """Monta o resumo para o revisor a partir dos dados da classificacao."""
    partes = []

    partes.append(f"Processo: {dados['numero_cnj']}")
    partes.append(f"Categoria: {dados.get('categoria', 'nao informada')}")
    partes.append(f"Resultado: {dados.get('resultado', 'nao informado')}")
    partes.append("")
    partes.append(f"Descricao: {dados.get('descricao', 'sem descricao')}")

    if dados.get("fundamentacao"):
        partes.append(f"\nFundamentacao: {dados['fundamentacao']}")

    if dados.get("observacoes"):
        partes.append(f"\nObservacoes: {dados['observacoes']}")

    acao = dados.get("acao", "")
    urgencia = dados.get("urgencia", "rotina")
    confianca = dados.get("confianca", "alta")
    partes.append(f"\nAcao sugerida: {acao}")
    partes.append(f"Urgencia: {urgencia}")
    partes.append(f"Confianca: {confianca}")

    return "\n".join(partes)


def normalizar_acao(acao: str) -> str:
    """Normaliza a acao removendo sufixos como '+ oficio_ses'."""
    acao = acao.split("+")[0].strip()
    return acao


def montar_payload(dados: dict, sessao_id: str, conteudo_peca: str | None) -> dict:
    """Monta o payload para o endpoint de ingestao."""
    acao_normalizada = normalizar_acao(dados.get("acao", "analise_humana"))

    return {
        "numero_cnj": dados["numero_cnj"],
        "source_session": sessao_id,
        "categoria": dados.get("categoria", "desconhecido"),
        "resultado": dados.get("resultado", "indefinido"),
        "acao_sugerida": acao_normalizada,
        "tipo_peca": determinar_tipo_peca(acao_normalizada),
        "conteudo_peca": conteudo_peca,
        "resumo_revisor": montar_resumo_revisor(dados),
        "classificacao_data": {
            "acao_detalhada": dados.get("descricao", ""),
            "fundamentacao": dados.get("fundamentacao", ""),
            "confianca": dados.get("confianca", "alta"),
            "urgencia": dados.get("urgencia", "rotina"),
            "documentos_necessarios": [],
        },
        "cdpendencia": dados.get("cdpendencia"),
        "usuario_revisor_id": None,
    }


def ingerir(url: str, token: str, payloads: list[dict]) -> dict:
    """Envia lote de itens para o portal-pge."""
    resp = requests.post(
        f"{url}/revisao/api/ingerir-lote",
        headers={"Authorization": f"Bearer {token}"},
        json={"itens": payloads},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description="Ingerir sessao no sistema de revisao")
    parser.add_argument("sessao_dir", help="Caminho da pasta da sessao")
    parser.add_argument("--url", default="http://localhost:8000", help="URL do portal-pge")
    parser.add_argument("--user", default="admin", help="Usuario")
    parser.add_argument("--password", default="", help="Senha")
    args = parser.parse_args()

    sessao_dir = Path(args.sessao_dir)
    if not sessao_dir.exists():
        logger.error(f"Diretorio nao encontrado: {sessao_dir}")
        sys.exit(1)

    sessao_id = sessao_dir.name  # ex: "2026-03-28_08-30"
    logger.info(f"Processando sessao: {sessao_id}")
    logger.info(f"Diretorio: {sessao_dir}")

    # 1. Parsear relatorio
    processos = parsear_relatorio(sessao_dir)
    if not processos:
        logger.error("Nenhum processo encontrado")
        sys.exit(1)

    # 2. Montar payloads
    payloads = []
    for dados in processos:
        conteudo_peca = carregar_peca(sessao_dir, dados["numero_cnj"])
        payload = montar_payload(dados, sessao_id, conteudo_peca)
        payloads.append(payload)

        status = "COM PECA" if conteudo_peca else "sem peca"
        logger.info(f"  {dados['numero_cnj']} | {dados.get('acao', '?')} | {status}")

    logger.info(f"\nTotal: {len(payloads)} itens para ingerir")
    logger.info(f"  Com peca: {sum(1 for p in payloads if p['conteudo_peca'])}")
    logger.info(f"  Sem peca: {sum(1 for p in payloads if not p['conteudo_peca'])}")

    # 3. Autenticar e enviar
    if not args.password:
        args.password = input("Senha do portal-pge: ")

    token = autenticar(args.url, args.user, args.password)
    resultado = ingerir(args.url, token, payloads)

    total = resultado.get("criados", resultado.get("total", 0))
    logger.info(f"\nIngestao concluida: {total} itens inseridos")
    for item in resultado.get("itens", []):
        logger.info(f"  ID {item['id']}: {item['numero_cnj']}")


if __name__ == "__main__":
    main()
