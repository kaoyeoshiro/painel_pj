# tests/test_prestacao_diagnostico.py
"""
Script de diagnostico para testar o sistema de prestacao de contas
com um caso real.

Uso: PYTHONPATH=. python tests/test_prestacao_diagnostico.py
"""

import asyncio
import time
import sys
import os

# Adiciona o diretorio raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Fix encoding para Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()


async def testar_consulta_xml(numero_cnj: str):
    """Testa consulta XML do processo."""
    print(f"\n{'='*60}")
    print(f"1. CONSULTA XML DO PROCESSO")
    print(f"{'='*60}")

    from services.tjms import consultar_processo_async
    import aiohttp

    inicio = time.time()
    try:
        async with aiohttp.ClientSession() as session:
            xml_response = await consultar_processo_async(session, numero_cnj)
        tempo = time.time() - inicio

        print(f"[OK] XML obtido em {tempo:.2f}s")
        print(f"     Tamanho: {len(xml_response)} bytes")

        # Parse do XML
        from sistemas.prestacao_contas.xml_parser import parse_xml_processo, CODIGOS_NOTA_FISCAL, CODIGOS_DOCUMENTOS_ANEXOS
        resultado = parse_xml_processo(xml_response)

        if resultado.erro:
            print(f"[ERRO] Erro no parse: {resultado.erro}")
            return None

        print(f"     Autor: {resultado.dados_basicos.autor}")
        print(f"     Total documentos: {len(resultado.documentos)}")
        print(f"     Peticoes candidatas: {len(resultado.peticoes_candidatas)}")

        # Analisa documentos por tipo
        tipos_encontrados = {}
        notas_fiscais = []
        anexos_relevantes = []

        for doc in resultado.documentos:
            tipo = doc.tipo_codigo or "SEM_CODIGO"
            if tipo not in tipos_encontrados:
                tipos_encontrados[tipo] = {"count": 0, "descricao": doc.tipo_descricao}
            tipos_encontrados[tipo]["count"] += 1

            if str(doc.tipo_codigo) in CODIGOS_NOTA_FISCAL:
                notas_fiscais.append(doc)
            if str(doc.tipo_codigo) in CODIGOS_DOCUMENTOS_ANEXOS:
                anexos_relevantes.append(doc)

        print(f"\n     TIPOS DE DOCUMENTO ENCONTRADOS:")
        for tipo, info in sorted(tipos_encontrados.items(), key=lambda x: -x[1]["count"]):
            desc = info['descricao'][:50] if info['descricao'] else 'Sem descricao'
            print(f"        {tipo}: {info['count']}x - {desc}")

        print(f"\n     NOTAS FISCAIS (codigos {CODIGOS_NOTA_FISCAL}):")
        if notas_fiscais:
            for nf in notas_fiscais[:10]:  # Mostra ate 10
                data = nf.data_juntada.strftime('%d/%m/%Y %H:%M') if nf.data_juntada else 'Sem data'
                print(f"        - ID={nf.id} | {data} | {nf.tipo_descricao}")
        else:
            print(f"        [!!] NENHUMA NOTA FISCAL ENCONTRADA!")

        print(f"\n     ANEXOS RELEVANTES (comprovantes, recibos, alvaras): {len(anexos_relevantes)}")
        for anexo in anexos_relevantes[:10]:
            data = anexo.data_juntada.strftime('%d/%m/%Y %H:%M') if anexo.data_juntada else 'Sem data'
            desc = anexo.tipo_descricao[:40] if anexo.tipo_descricao else ''
            print(f"        - ID={anexo.id} | Codigo={anexo.tipo_codigo} | {data} | {desc}")

        return resultado, xml_response

    except Exception as e:
        tempo = time.time() - inicio
        print(f"[ERRO] Erro apos {tempo:.2f}s: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


async def testar_extrato_subconta(numero_cnj: str):
    """Testa extracao do extrato da subconta."""
    print(f"\n{'='*60}")
    print(f"2. EXTRATO DA SUBCONTA")
    print(f"{'='*60}")

    from sistemas.prestacao_contas.scrapper_subconta import extrair_extrato_subconta, StatusProcessamento

    inicio = time.time()
    try:
        resultado = await extrair_extrato_subconta(numero_cnj)
        tempo = time.time() - inicio

        print(f"     Tempo: {tempo:.2f}s")
        print(f"     Status: {resultado.status.value}")

        if resultado.status == StatusProcessamento.OK:
            print(f"[OK] Extrato obtido!")
            print(f"     Texto: {len(resultado.texto_extraido or '')} caracteres")
            if resultado.texto_extraido:
                print(f"     Preview: {resultado.texto_extraido[:200]}...")
        elif resultado.status == StatusProcessamento.SEM_SUBCONTA:
            print(f"[AVISO] Processo nao possui subconta registrada")
        else:
            print(f"[ERRO] Erro: {resultado.erro}")

        return resultado

    except Exception as e:
        tempo = time.time() - inicio
        print(f"[ERRO] Erro apos {tempo:.2f}s: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


async def testar_extrato_paralelo(numero_cnj: str, documentos: list):
    """Testa extracao paralela do extrato."""
    print(f"\n{'='*60}")
    print(f"3. EXTRACAO PARALELA (SCRAPPER + FALLBACK)")
    print(f"{'='*60}")

    from sistemas.prestacao_contas.extrato_paralelo import ExtratorParalelo, ConfigExtratoParalelo

    config = ConfigExtratoParalelo(
        scrapper_timeout=60.0,
        fallback_timeout=60.0,
    )

    inicio = time.time()
    try:
        extrator = ExtratorParalelo(config=config, correlation_id="diag")
        resultado = await extrator.extrair_paralelo(numero_cnj, documentos)
        tempo = time.time() - inicio

        print(f"     Tempo total: {tempo:.2f}s")
        print(f"     Source: {resultado.source.value}")
        print(f"     Valido: {resultado.valido}")

        metricas = resultado.metricas
        print(f"\n     METRICAS:")
        print(f"        t_scrapper: {metricas.t_scrapper:.2f}s" if metricas.t_scrapper else "        t_scrapper: N/A")
        print(f"        t_fallback: {metricas.t_fallback:.2f}s" if metricas.t_fallback else "        t_fallback: N/A")
        print(f"        t_total: {metricas.t_total:.2f}s")

        if metricas.scrapper_fail_reason:
            print(f"        scrapper_fail: {metricas.scrapper_fail_reason.value} - {metricas.scrapper_erro}")
        if metricas.fallback_fail_reason:
            print(f"        fallback_fail: {metricas.fallback_fail_reason.value} - {metricas.fallback_erro}")

        if resultado.valido:
            print(f"\n[OK] Extrato obtido via {resultado.source.value}")
            print(f"     Texto: {len(resultado.texto or '')} caracteres")
        else:
            print(f"\n[ERRO] Extrato nao obtido")
            if resultado.observacao:
                print(f"     Observacao: {resultado.observacao[:200]}")

        if resultado.imagens_fallback:
            print(f"     Imagens fallback: {len(resultado.imagens_fallback)} documentos")

        return resultado

    except Exception as e:
        tempo = time.time() - inicio
        print(f"[ERRO] Erro apos {tempo:.2f}s: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


async def testar_download_documento(numero_cnj: str, doc_id: str, doc_desc: str = ""):
    """Testa download de um documento especifico."""
    print(f"\n{'='*60}")
    print(f"4. DOWNLOAD DE DOCUMENTO (ID: {doc_id})")
    if doc_desc:
        print(f"   Tipo: {doc_desc}")
    print(f"{'='*60}")

    from services.tjms import baixar_documentos_async
    import aiohttp

    inicio = time.time()
    try:
        async with aiohttp.ClientSession() as session:
            xml_docs = await baixar_documentos_async(session, numero_cnj, [doc_id])
        tempo = time.time() - inicio

        print(f"     Tempo: {tempo:.2f}s")

        import base64
        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_docs)

        conteudo_bytes = None
        for elem in root.iter():
            if 'conteudo' in elem.tag.lower() and elem.text:
                conteudo_bytes = base64.b64decode(elem.text)
                break

        if conteudo_bytes:
            print(f"[OK] Documento baixado: {len(conteudo_bytes)} bytes")

            # Tenta extrair texto
            from services.tjms import extrair_texto_pdf
            texto = extrair_texto_pdf(conteudo_bytes)
            print(f"     Texto extraido: {len(texto)} caracteres")
            if texto and len(texto) > 100:
                preview = texto[:200].replace('\n', ' ')
                print(f"     Preview: {preview}...")
        else:
            print(f"[ERRO] Conteudo nao encontrado na resposta")

    except Exception as e:
        tempo = time.time() - inicio
        print(f"[ERRO] Erro apos {tempo:.2f}s: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


async def main():
    numero_cnj = "0853504-98.2025.8.12.0001"

    print(f"\n{'#'*60}")
    print(f"# DIAGNOSTICO: PRESTACAO DE CONTAS")
    print(f"# Processo: {numero_cnj}")
    print(f"{'#'*60}")

    # 1. Consulta XML
    resultado_xml = await testar_consulta_xml(numero_cnj)

    if resultado_xml is None:
        print("\n[ERRO] Nao foi possivel continuar sem o XML do processo")
        return

    resultado_parse, xml_response = resultado_xml

    # 2. Extrato da subconta (direto) - COMENTADO para ser mais rapido
    # await testar_extrato_subconta(numero_cnj)

    # 3. Extrato paralelo
    await testar_extrato_paralelo(numero_cnj, resultado_parse.documentos)

    # 4. Download de uma nota fiscal (se existir)
    from sistemas.prestacao_contas.xml_parser import CODIGOS_NOTA_FISCAL
    notas = [d for d in resultado_parse.documentos if str(d.tipo_codigo) in CODIGOS_NOTA_FISCAL]
    if notas:
        await testar_download_documento(numero_cnj, notas[0].id, notas[0].tipo_descricao)
    else:
        print(f"\n[AVISO] Nenhuma nota fiscal para testar download")
        # Tenta baixar qualquer anexo relevante
        from sistemas.prestacao_contas.xml_parser import CODIGOS_DOCUMENTOS_ANEXOS
        anexos = [d for d in resultado_parse.documentos if str(d.tipo_codigo) in CODIGOS_DOCUMENTOS_ANEXOS]
        if anexos:
            print(f"        Testando download de anexo alternativo...")
            await testar_download_documento(numero_cnj, anexos[0].id, anexos[0].tipo_descricao)

    print(f"\n{'#'*60}")
    print(f"# FIM DO DIAGNOSTICO")
    print(f"{'#'*60}\n")


if __name__ == "__main__":
    asyncio.run(main())
