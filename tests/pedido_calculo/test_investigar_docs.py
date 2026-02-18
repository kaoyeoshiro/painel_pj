# tests/test_investigar_docs.py
"""
Investiga documentos para identificar notas fiscais.
"""

import asyncio
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()


async def investigar_documentos(numero_cnj: str):
    """Baixa e analisa documentos para identificar notas fiscais."""

    from services.tjms import consultar_processo_async, baixar_documentos_async, extrair_texto_pdf
    from sistemas.prestacao_contas.xml_parser import parse_xml_processo
    import aiohttp
    import base64
    import xml.etree.ElementTree as ET

    print(f"\n{'#'*60}")
    print(f"# INVESTIGACAO DE DOCUMENTOS")
    print(f"# Processo: {numero_cnj}")
    print(f"{'#'*60}")

    # 1. Consulta XML
    print(f"\n[1] Consultando XML...")
    async with aiohttp.ClientSession() as session:
        xml_response = await consultar_processo_async(session, numero_cnj)

    resultado = parse_xml_processo(xml_response)
    print(f"    Total documentos: {len(resultado.documentos)}")

    # 2. Agrupa por tipo
    docs_por_tipo = {}
    for doc in resultado.documentos:
        tipo = doc.tipo_codigo or "SEM_CODIGO"
        if tipo not in docs_por_tipo:
            docs_por_tipo[tipo] = []
        docs_por_tipo[tipo].append(doc)

    # 3. Tipos suspeitos de conter notas fiscais
    tipos_investigar = ["9500", "9509", "9882", "9605"]

    print(f"\n[2] Tipos a investigar: {tipos_investigar}")

    for tipo in tipos_investigar:
        if tipo not in docs_por_tipo:
            print(f"\n    Tipo {tipo}: Nenhum documento")
            continue

        docs = docs_por_tipo[tipo]
        print(f"\n{'='*60}")
        print(f"TIPO {tipo}: {docs[0].tipo_descricao} ({len(docs)} documentos)")
        print(f"{'='*60}")

        # Baixa ate 3 documentos de cada tipo
        for i, doc in enumerate(docs[:3]):
            data = doc.data_juntada.strftime('%d/%m/%Y %H:%M') if doc.data_juntada else 'Sem data'
            print(f"\n  [{i+1}] ID={doc.id} | {data}")
            print(f"      Movimento: {doc.movimento_descricao[:60] if doc.movimento_descricao else 'N/A'}")
            if doc.movimento_complemento:
                print(f"      Complemento: {doc.movimento_complemento[:100]}")

            try:
                async with aiohttp.ClientSession() as session:
                    xml_docs = await baixar_documentos_async(session, numero_cnj, [doc.id])

                root = ET.fromstring(xml_docs)
                conteudo_bytes = None
                for elem in root.iter():
                    if 'conteudo' in elem.tag.lower() and elem.text:
                        conteudo_bytes = base64.b64decode(elem.text)
                        break

                if conteudo_bytes:
                    print(f"      Tamanho: {len(conteudo_bytes)} bytes")

                    # Tenta extrair texto
                    texto = extrair_texto_pdf(conteudo_bytes)
                    print(f"      Texto: {len(texto)} caracteres")

                    if texto and len(texto) > 50:
                        # Analisa conteudo
                        texto_lower = texto.lower()

                        # Indicadores de nota fiscal
                        indicadores_nf = [
                            "nota fiscal", "nf-e", "nfe", "danfe",
                            "cupom fiscal", "cnpj", "valor total",
                            "icms", "iss", "servico prestado"
                        ]

                        # Indicadores de comprovante de pagamento
                        indicadores_comprov = [
                            "comprovante", "transferencia", "pix",
                            "deposito", "pagamento", "recibo"
                        ]

                        # Indicadores de medicamento/saude
                        indicadores_med = [
                            "medicament", "farmacia", "drogaria",
                            "receita", "mg", "ml", "comprimido"
                        ]

                        encontrados_nf = [ind for ind in indicadores_nf if ind in texto_lower]
                        encontrados_comp = [ind for ind in indicadores_comprov if ind in texto_lower]
                        encontrados_med = [ind for ind in indicadores_med if ind in texto_lower]

                        if encontrados_nf:
                            print(f"      >>> POSSIVEL NOTA FISCAL! Indicadores: {encontrados_nf}")
                        if encontrados_comp:
                            print(f"      >>> POSSIVEL COMPROVANTE! Indicadores: {encontrados_comp}")
                        if encontrados_med:
                            print(f"      >>> MENCIONA MEDICAMENTO! Indicadores: {encontrados_med}")

                        # Preview do texto
                        preview = texto[:300].replace('\n', ' ').strip()
                        print(f"      Preview: {preview}...")
                    else:
                        print(f"      [!] PDF de imagem (sem texto extraivel)")

                        # Tenta converter para imagem e mostrar info
                        try:
                            import fitz
                            pdf_doc = fitz.open(stream=conteudo_bytes, filetype="pdf")
                            print(f"      Paginas: {len(pdf_doc)}")
                            pdf_doc.close()
                        except:
                            pass
                else:
                    print(f"      [ERRO] Conteudo nao encontrado")

            except Exception as e:
                print(f"      [ERRO] {type(e).__name__}: {e}")

    print(f"\n{'#'*60}")
    print(f"# FIM DA INVESTIGACAO")
    print(f"{'#'*60}\n")


if __name__ == "__main__":
    asyncio.run(investigar_documentos("0853504-98.2025.8.12.0001"))
