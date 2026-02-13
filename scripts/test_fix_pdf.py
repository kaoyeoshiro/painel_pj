# scripts/test_fix_pdf.py
"""
Testa se extrair_conteudo_pdf agora retorna imagens para PDFs escaneados
que têm apenas watermark como texto.
"""
import sys
import os
import asyncio
import aiohttp
import base64

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sistemas.gerador_pecas.agente_tjms import (
    consultar_processo_async,
    baixar_documentos_paralelo,
    extrair_documentos_xml,
    agrupar_documentos_por_descricao,
    documento_permitido,
    extrair_conteudo_pdf,
    DocumentoTJMS,
)


NUMERO_PROCESSO = "0000676-55.2026.8.12.0800"
CODIGOS_PRIMEIRO_DOC = {500, 9500, 10}


async def main():
    print(f"=== TESTE FIX PDF: {NUMERO_PROCESSO} ===\n")

    async with aiohttp.ClientSession() as session:
        xml = await consultar_processo_async(session, NUMERO_PROCESSO)
        todos_docs = extrair_documentos_xml(xml)

        # Filtra e agrupa
        docs_filtrados = []
        codigos_primeiro_lote = {}
        for d in todos_docs:
            if not d.tipo_documento:
                continue
            codigo = int(d.tipo_documento)
            if not documento_permitido(codigo, None):
                continue
            if codigo in CODIGOS_PRIMEIRO_DOC:
                data_key = d.data_juntada.strftime('%Y%m%d%H%M') if d.data_juntada else 'sem_data'
                if codigo in codigos_primeiro_lote:
                    if codigos_primeiro_lote[codigo] != data_key:
                        continue
                else:
                    codigos_primeiro_lote[codigo] = data_key
            docs_filtrados.append(d)

        docs_agrupados = agrupar_documentos_por_descricao(docs_filtrados)

        pi_doc = None
        for doc in docs_agrupados:
            if doc.tipo_documento == "500":
                pi_doc = doc
                break

        if not pi_doc:
            print("ERRO: PI nao encontrada")
            return

        # Baixar 3 partes para testar
        ids_amostra = pi_doc.ids_agrupados[:3]
        print(f"Baixando {len(ids_amostra)} partes da PI...\n")

        conteudo_map = await baixar_documentos_paralelo(
            session=session,
            numero_processo=NUMERO_PROCESSO,
            lista_ids=ids_amostra,
            batch_size=5,
            max_paralelo=4,
            timeout=180
        )

        # Testar extrair_conteudo_pdf com fix
        for i, doc_id in enumerate(ids_amostra):
            if doc_id not in conteudo_map:
                print(f"Parte {i+1}: NAO BAIXOU")
                continue

            pdf_bytes = base64.b64decode(conteudo_map[doc_id])
            resultado = extrair_conteudo_pdf(pdf_bytes)

            print(f"Parte {i+1} ({doc_id}):")
            print(f"  tipo: {resultado.tipo}")
            print(f"  paginas: {resultado.paginas}")

            if resultado.tipo == 'texto':
                print(f"  texto chars: {len(resultado.conteudo)}")
                print(f"  PROBLEMA: deveria ser 'imagens' para PDF escaneado!")
            elif resultado.tipo == 'imagens':
                print(f"  imagens: {len(resultado.conteudo)}")
                print(f"  OK: Detectado como PDF escaneado!")
            print()

        # Agora simular o processamento de documento agrupado
        print("=" * 60)
        print("SIMULANDO PROCESSAMENTO AGRUPADO (como _processar_documento_async):\n")

        textos = []
        todas_imagens = []
        tem_texto = False

        for i, doc_id in enumerate(ids_amostra):
            if doc_id not in conteudo_map:
                continue

            pdf_bytes = base64.b64decode(conteudo_map[doc_id])
            conteudo_pdf = extrair_conteudo_pdf(pdf_bytes)

            if conteudo_pdf.tipo == 'texto' and conteudo_pdf.conteudo:
                textos.append(f"--- PARTE {i+1} ---\n{conteudo_pdf.conteudo}")
                tem_texto = True
            elif conteudo_pdf.tipo == 'imagens':
                todas_imagens.extend(conteudo_pdf.conteudo)

        print(f"tem_texto: {tem_texto}")
        print(f"textos: {len(textos)} partes")
        print(f"todas_imagens: {len(todas_imagens)} imagens")

        if tem_texto:
            texto_completo = "\n\n".join(textos)
            print(f"texto_completo chars: {len(texto_completo)}")
            print(f"\n>>> CAMINHO: TEXTO (pode ser problema se texto eh watermark)")
        elif todas_imagens:
            print(f"\n>>> CAMINHO: IMAGENS ({len(todas_imagens)} imagens)")
            print(f">>> OK - Pipeline vai enviar imagens para Gemini!")
        else:
            print(f"\n>>> CAMINHO: NENHUM (erro)")


if __name__ == "__main__":
    asyncio.run(main())
