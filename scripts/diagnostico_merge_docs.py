# scripts/diagnostico_merge_docs.py
"""
Diagnostico: consulta TJ-MS para o processo 0000676-55.2026.8.12.0800
e mostra todos os documentos com seus atributos para verificar o filtro.
"""
import sys
import os
import asyncio
import aiohttp

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sistemas.gerador_pecas.agente_tjms import (
    consultar_processo_async,
    extrair_documentos_xml,
    agrupar_documentos_por_descricao,
    documento_permitido,
    DocumentoTJMS,
    CATEGORIAS_EXCLUIDAS,
)


NUMERO_PROCESSO = "0000676-55.2026.8.12.0800"

# Codigos tipicos de Peticao Inicial
CODIGOS_PRIMEIRO_DOC = {500, 9500, 10}


async def main():
    print(f"=== DIAGNOSTICO: Processo {NUMERO_PROCESSO} ===\n")

    async with aiohttp.ClientSession() as session:
        print("[1] Consultando TJ-MS via SOAP...")
        xml = await consultar_processo_async(session, NUMERO_PROCESSO)
        print(f"    XML recebido: {len(xml)} chars\n")

        # Salvar XML para debug
        with open("scripts/_debug_xml_processo.xml", "w", encoding="utf-8") as f:
            f.write(xml)
        print("    XML salvo em scripts/_debug_xml_processo.xml\n")

        print("[2] Extraindo documentos do XML...")
        todos_docs = extrair_documentos_xml(xml)
        print(f"    Total de documentos extraidos: {len(todos_docs)}\n")

        # Mostrar TODOS os documentos
        print("=" * 120)
        print(f"{'ID':<20} {'TIPO':<8} {'DESCRICAO':<35} {'DATA_JUNTADA':<22} {'DATA_KEY':<15} {'PRIMEIRO_DOC?'}")
        print("=" * 120)

        for d in todos_docs:
            data_key = d.data_juntada.strftime('%Y%m%d%H%M') if d.data_juntada else 'sem_data'
            is_primeiro = "SIM" if d.tipo_documento and int(d.tipo_documento) in CODIGOS_PRIMEIRO_DOC else ""
            print(f"{d.id:<20} {d.tipo_documento or 'None':<8} {(d.descricao or 'N/A')[:34]:<35} {str(d.data_juntada)[:21]:<22} {data_key:<15} {is_primeiro}")

        # Contar por tipo_documento
        print(f"\n{'=' * 60}")
        print("CONTAGEM POR TIPO DE DOCUMENTO:")
        from collections import Counter
        tipo_counter = Counter(d.tipo_documento for d in todos_docs)
        for tipo, count in tipo_counter.most_common():
            nome = (d.descricao for d in todos_docs if d.tipo_documento == tipo).__next__() if tipo else "N/A"
            is_primeiro = " [PRIMEIRO_DOC]" if tipo and int(tipo) in CODIGOS_PRIMEIRO_DOC else ""
            print(f"  Tipo {tipo:>6}: {count:>3} docs  ({nome}){is_primeiro}")

        # Agora aplicar filtro (reproduzindo logica do agente_tjms.py)
        print(f"\n{'=' * 60}")
        print("[3] SIMULANDO FILTRO (codigos_primeiro_doc fix)...\n")

        # Simula com codigos_permitidos=None (usa filtro legado)
        docs_filtrados = []
        codigos_primeiro_lote = {}

        for d in todos_docs:
            if not d.tipo_documento:
                continue

            codigo = int(d.tipo_documento)

            if not documento_permitido(codigo, None):  # None = usa filtro legado
                continue

            if codigo in CODIGOS_PRIMEIRO_DOC:
                data_key = d.data_juntada.strftime('%Y%m%d%H%M') if d.data_juntada else 'sem_data'
                if codigo in codigos_primeiro_lote:
                    if codigos_primeiro_lote[codigo] != data_key:
                        print(f"  BLOQUEADO: {d.id} tipo={d.tipo_documento} data_key={data_key} (lote existente: {codigos_primeiro_lote[codigo]})")
                        continue
                else:
                    codigos_primeiro_lote[codigo] = data_key
                    print(f"  REGISTRADO lote: codigo={codigo} data_key={data_key}")

            docs_filtrados.append(d)

        print(f"\n  Resultado filtro: {len(docs_filtrados)} docs (de {len(todos_docs)} originais)")
        print(f"  Lotes registrados: {codigos_primeiro_lote}")

        # Contar por tipo
        tipo_counter_filtrado = Counter(d.tipo_documento for d in docs_filtrados)
        for tipo, count in tipo_counter_filtrado.most_common():
            nome = next((d.descricao for d in docs_filtrados if d.tipo_documento == tipo), "N/A")
            print(f"    Tipo {tipo:>6}: {count:>3} docs  ({nome})")

        # Agora agrupar
        print(f"\n{'=' * 60}")
        print("[4] SIMULANDO AGRUPAMENTO...\n")

        docs_agrupados = agrupar_documentos_por_descricao(docs_filtrados)
        print(f"  Resultado agrupamento: {len(docs_agrupados)} documentos logicos\n")

        for d in docs_agrupados:
            n_partes = len(d.ids_agrupados) if d.ids_agrupados else 1
            print(f"  {d.id:<20} tipo={d.tipo_documento:<6} desc={d.descricao or 'N/A':<30} partes={n_partes}")
            if d.ids_agrupados and len(d.ids_agrupados) > 1:
                print(f"    IDs agrupados: {d.ids_agrupados[:5]}{'...' if len(d.ids_agrupados) > 5 else ''}")

        # Verificar se algum doc primeiro_doc foi agrupado
        print(f"\n{'=' * 60}")
        print("[5] VERIFICACAO FINAL\n")
        for d in docs_agrupados:
            if d.tipo_documento and int(d.tipo_documento) in CODIGOS_PRIMEIRO_DOC:
                n_partes = len(d.ids_agrupados) if d.ids_agrupados else 1
                print(f"  PETICAO INICIAL: {n_partes} partes agrupadas")
                if n_partes > 1:
                    print(f"  OK - Todas as {n_partes} partes serao baixadas e concatenadas")
                else:
                    print(f"  ATENCAO - Apenas 1 parte! Verificar se dados estao corretos")


if __name__ == "__main__":
    asyncio.run(main())
