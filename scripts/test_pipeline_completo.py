# scripts/test_pipeline_completo.py
"""
Teste completo do pipeline para processo 0000676-55.2026.8.12.0800:
1. Consulta TJ-MS
2. Aplica filtro codigos_primeiro_doc (com fix)
3. Agrupa documentos
4. Baixa todos os documentos
5. Extrai texto de cada parte
6. Verifica se texto total eh substancial
"""
import sys
import os
import asyncio
import aiohttp
import base64
import io

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
    DocumentoTJMS,
)


NUMERO_PROCESSO = "0000676-55.2026.8.12.0800"
CODIGOS_PRIMEIRO_DOC = {500, 9500, 10}


def extrair_texto_pdf(conteudo_base64: str) -> str:
    """Extrai texto de um PDF base64."""
    try:
        import fitz  # PyMuPDF
        pdf_bytes = base64.b64decode(conteudo_base64)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        texto = ""
        for page in doc:
            texto += page.get_text()
        doc.close()
        return texto
    except Exception as e:
        return f"[ERRO: {e}]"


async def main():
    print(f"=== TESTE PIPELINE COMPLETO: {NUMERO_PROCESSO} ===\n")

    async with aiohttp.ClientSession() as session:
        # 1. Consulta
        print("[1/5] Consultando TJ-MS...")
        xml = await consultar_processo_async(session, NUMERO_PROCESSO)
        print(f"      XML: {len(xml)} chars\n")

        # 2. Extrai docs
        print("[2/5] Extraindo documentos...")
        todos_docs = extrair_documentos_xml(xml)
        print(f"      {len(todos_docs)} documentos extraidos\n")

        # 3. Filtra (reproduzindo logica do agente_tjms.py COM fix)
        print("[3/5] Aplicando filtro...")
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

        print(f"      {len(docs_filtrados)} docs apos filtro\n")

        # Contar PI
        pi_docs = [d for d in docs_filtrados if d.tipo_documento == "500"]
        print(f"      Docs tipo 500 (PI): {len(pi_docs)}")

        # 4. Agrupa
        print("\n[4/5] Agrupando documentos...")
        docs_agrupados = agrupar_documentos_por_descricao(docs_filtrados)
        print(f"      {len(docs_agrupados)} documentos logicos\n")

        # Coletar IDs para download
        ids_baixar = []
        for doc in docs_agrupados:
            if doc.ids_agrupados:
                ids_baixar.extend(doc.ids_agrupados)
            else:
                ids_baixar.append(doc.id)

        print(f"      {len(ids_baixar)} IDs para download\n")

        # Mostra IDs do PI agrupado
        for doc in docs_agrupados:
            if doc.tipo_documento == "500":
                print(f"      PI agrupado: {len(doc.ids_agrupados)} partes")
                print(f"      Primeiros 5 IDs: {doc.ids_agrupados[:5]}")
                print(f"      Ultimos 5 IDs: {doc.ids_agrupados[-5:]}")

        # 5. Download
        print(f"\n[5/5] Baixando {len(ids_baixar)} documentos...")
        conteudo_map = await baixar_documentos_paralelo(
            session=session,
            numero_processo=NUMERO_PROCESSO,
            lista_ids=ids_baixar,
            batch_size=5,
            max_paralelo=4,
            timeout=180
        )

        print(f"\n      Baixados: {len(conteudo_map)} de {len(ids_baixar)}\n")

        # Verificar quais IDs do PI foram baixados
        pi_doc = None
        for doc in docs_agrupados:
            if doc.tipo_documento == "500":
                pi_doc = doc
                break

        if pi_doc and pi_doc.ids_agrupados:
            baixados_pi = [id for id in pi_doc.ids_agrupados if id in conteudo_map]
            faltantes_pi = [id for id in pi_doc.ids_agrupados if id not in conteudo_map]
            print(f"      PI - Baixados: {len(baixados_pi)}/{len(pi_doc.ids_agrupados)}")
            if faltantes_pi:
                print(f"      PI - Faltantes: {faltantes_pi}")

            # Extrair texto de cada parte
            print(f"\n      Extraindo texto das {len(baixados_pi)} partes da PI...")
            texto_total = ""
            for i, id_parte in enumerate(pi_doc.ids_agrupados):
                if id_parte in conteudo_map:
                    texto = extrair_texto_pdf(conteudo_map[id_parte])
                    texto_total += texto
                    chars = len(texto.strip())
                    preview = texto.strip()[:80].replace('\n', ' ') if chars > 0 else "(vazio)"
                    print(f"        Parte {i+1:>2}: {chars:>6} chars | {preview}")

            print(f"\n      === TEXTO TOTAL DA PI: {len(texto_total)} chars ===")
            if len(texto_total) > 100:
                print(f"      Primeiros 200 chars: {texto_total[:200]}")
                print(f"      OK - Texto substancial extraido")
            else:
                print(f"      PROBLEMA - Texto muito curto!")
                print(f"      Conteudo: {texto_total}")
        else:
            print("      ERRO: Nao encontrou doc PI agrupado!")


if __name__ == "__main__":
    asyncio.run(main())
