# scripts/diagnostico_conteudo_pdf.py
"""
Diagnostico detalhado: analisa conteudo de cada parte do PDF
para entender o que extrair_conteudo_pdf retorna.
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
    print(f"=== DIAGNOSTICO PDF: {NUMERO_PROCESSO} ===\n")

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

        # Pega PI
        pi_doc = None
        for doc in docs_agrupados:
            if doc.tipo_documento == "500":
                pi_doc = doc
                break

        if not pi_doc:
            print("ERRO: PI nao encontrada")
            return

        print(f"PI agrupada: {len(pi_doc.ids_agrupados)} partes\n")

        # Baixa apenas primeiras 3 partes para analise
        ids_amostra = pi_doc.ids_agrupados[:3]
        print(f"Baixando amostra: {ids_amostra}\n")

        conteudo_map = await baixar_documentos_paralelo(
            session=session,
            numero_processo=NUMERO_PROCESSO,
            lista_ids=ids_amostra,
            batch_size=5,
            max_paralelo=4,
            timeout=180
        )

        for i, doc_id in enumerate(ids_amostra):
            if doc_id not in conteudo_map:
                print(f"\nParte {i+1} ({doc_id}): NAO BAIXOU")
                continue

            b64 = conteudo_map[doc_id]
            pdf_bytes = base64.b64decode(b64)

            print(f"\n{'='*80}")
            print(f"PARTE {i+1} ({doc_id}) - {len(pdf_bytes)} bytes")
            print(f"{'='*80}")

            resultado = extrair_conteudo_pdf(pdf_bytes)
            print(f"  tipo: {resultado.tipo}")
            print(f"  paginas: {resultado.paginas}")

            if resultado.tipo == 'texto':
                texto = resultado.conteudo
                print(f"  texto chars: {len(texto)}")
                print(f"  texto stripped chars: {len(texto.strip())}")
                print(f"  threshold (>200): {'PASSA' if len(texto.strip()) > 200 else 'FALHA (iria para imagens)'}")
                print(f"\n  CONTEUDO COMPLETO:")
                print(f"  {'~'*70}")
                for line in texto.split('\n'):
                    stripped = line.strip()
                    if stripped:
                        print(f"  | {stripped[:100]}")
                print(f"  {'~'*70}")
            elif resultado.tipo == 'imagens':
                print(f"  imagens: {len(resultado.conteudo)}")

            # Tambem extrair texto cru (sem pymupdf4llm)
            import fitz
            with fitz.open(stream=pdf_bytes, filetype="pdf") as pdfdoc:
                for page_num in range(len(pdfdoc)):
                    page = pdfdoc[page_num]
                    texto_cru = page.get_text()
                    print(f"\n  Texto CRU pagina {page_num+1}: {len(texto_cru)} chars")
                    print(f"  Stripped: {len(texto_cru.strip())} chars")
                    for line in texto_cru.split('\n'):
                        if line.strip():
                            print(f"    > {line.strip()[:100]}")

                    # Verificar se ha imagens na pagina
                    imgs = page.get_images()
                    print(f"  Imagens na pagina: {len(imgs)}")


if __name__ == "__main__":
    asyncio.run(main())
