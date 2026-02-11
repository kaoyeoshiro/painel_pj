# scripts/test_pipeline_final.py
"""
Teste FINAL: simula o pipeline completo do processo 0000676-55.2026.8.12.0800
com todos os fixes aplicados, incluindo download de TODOS os documentos da PI.
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
    print(f"=== TESTE FINAL PIPELINE: {NUMERO_PROCESSO} ===\n")

    async with aiohttp.ClientSession() as session:
        # 1. Consulta
        print("[1/6] Consultando TJ-MS...")
        xml = await consultar_processo_async(session, NUMERO_PROCESSO)
        todos_docs = extrair_documentos_xml(xml)
        print(f"      {len(todos_docs)} documentos\n")

        # 2. Filtro (com fix lote)
        print("[2/6] Filtrando documentos...")
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

        pi_count = sum(1 for d in docs_filtrados if d.tipo_documento == "500")
        print(f"      {len(docs_filtrados)} docs apos filtro ({pi_count} PI)")
        assert pi_count == 26, f"FALHA: Esperava 26 PI, obteve {pi_count}"
        print(f"      OK: {pi_count} partes da PI passaram no filtro\n")

        # 3. Agrupamento
        print("[3/6] Agrupando documentos...")
        docs_agrupados = agrupar_documentos_por_descricao(docs_filtrados)
        print(f"      {len(docs_agrupados)} documentos logicos\n")

        pi_doc = None
        for doc in docs_agrupados:
            if doc.tipo_documento == "500":
                pi_doc = doc
                break

        assert pi_doc is not None, "FALHA: PI nao encontrada"
        assert len(pi_doc.ids_agrupados) == 26, f"FALHA: PI deveria ter 26 partes, tem {len(pi_doc.ids_agrupados)}"
        print(f"      OK: PI agrupada com {len(pi_doc.ids_agrupados)} partes\n")

        # 4. Download de TODOS os IDs
        ids_baixar = []
        for doc in docs_agrupados:
            if doc.ids_agrupados:
                ids_baixar.extend(doc.ids_agrupados)
            else:
                ids_baixar.append(doc.id)

        print(f"[4/6] Baixando TODOS os {len(ids_baixar)} documentos...")
        conteudo_map = await baixar_documentos_paralelo(
            session=session,
            numero_processo=NUMERO_PROCESSO,
            lista_ids=ids_baixar,
            batch_size=5,
            max_paralelo=4,
            timeout=180
        )

        baixados_pi = [id for id in pi_doc.ids_agrupados if id in conteudo_map]
        print(f"\n      PI baixada: {len(baixados_pi)}/{len(pi_doc.ids_agrupados)}")
        assert len(baixados_pi) == 26, f"FALHA: Deveria baixar 26 partes PI, baixou {len(baixados_pi)}"
        print(f"      OK: Todas as 26 partes da PI baixadas\n")

        # 5. Extrair conteudo de cada parte (simula _processar_documento_async)
        print("[5/6] Extraindo conteudo de cada parte da PI...")
        textos = []
        todas_imagens = []
        tem_texto = False

        for i, conteudo_b64 in enumerate([conteudo_map[id] for id in pi_doc.ids_agrupados]):
            pdf_bytes = base64.b64decode(conteudo_b64)
            conteudo_pdf = extrair_conteudo_pdf(pdf_bytes)

            tipo = conteudo_pdf.tipo
            if tipo == 'texto' and conteudo_pdf.conteudo:
                textos.append(f"--- PARTE {i+1} ---\n{conteudo_pdf.conteudo}")
                tem_texto = True
                print(f"      Parte {i+1:>2}: TEXTO ({len(conteudo_pdf.conteudo)} chars)")
            elif tipo == 'imagens':
                todas_imagens.extend(conteudo_pdf.conteudo)
                print(f"      Parte {i+1:>2}: IMAGEM ({len(conteudo_pdf.conteudo)} imagens)")

        print(f"\n      Resultado: tem_texto={tem_texto}, textos={len(textos)}, imagens={len(todas_imagens)}")

        # 6. Verificacao final
        print(f"\n[6/6] VERIFICACAO FINAL:")

        if tem_texto:
            texto_completo = "\n\n".join(textos)
            if len(texto_completo.strip()) < 50:
                print(f"      PROBLEMA: texto muito curto ({len(texto_completo)} chars)")
            else:
                print(f"      CAMINHO: TEXTO ({len(texto_completo)} chars)")
                print(f"      O texto sera enviado para o Gemini para resumo/extracao")
        elif todas_imagens:
            imagens_enviar = todas_imagens[:15]
            print(f"      CAMINHO: IMAGENS ({len(todas_imagens)} total, {len(imagens_enviar)} serao enviadas)")
            print(f"      As imagens serao enviadas para o Gemini para resumo/extracao")
            print(f"      OK: Pipeline funcionando corretamente!")
        else:
            print(f"      FALHA: Nenhum conteudo extraido!")

        # Resumo
        print(f"\n{'='*60}")
        print(f"RESUMO:")
        print(f"  1. Filtro: 26/26 partes PI passaram              OK")
        print(f"  2. Agrupamento: 26 partes → 1 doc logico         OK")
        print(f"  3. Download: 26/26 partes baixadas                OK")
        if todas_imagens:
            print(f"  4. Extracao: {len(todas_imagens)} imagens extraidas        OK")
            print(f"  5. Pipeline: {min(len(todas_imagens), 15)} imagens → Gemini            OK")
        elif tem_texto:
            print(f"  4. Extracao: texto valido                         OK")
            print(f"  5. Pipeline: texto → Gemini                       OK")
        print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
