# sistemas/extrator_autos/models.py
"""
Modelos de banco de dados para o Extrator de Autos.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey
from database.connection import Base
from utils.timezone import get_utc_now


class ExtracaoAutos(Base):
    """
    Registro de uma extracao de autos (consulta + download de documentos).

    Armazena configuracao usada, resultados e audit trail.
    """
    __tablename__ = "extracoes_autos"

    id = Column(Integer, primary_key=True, index=True)

    # Processo(s) consultado(s)
    numero_cnj = Column(String(30), nullable=False, index=True)
    numeros_cnj_lote = Column(JSON, nullable=True)  # Para modo lote

    # Configuracao da selecao
    modo_selecao = Column(String(20), nullable=False, default="manual")  # manual | categoria | hibrido
    categorias_selecionadas = Column(JSON, nullable=True)  # IDs das CategoriaDocumento
    codigos_manuais_add = Column(JSON, nullable=True)      # Codigos adicionados manualmente
    codigos_manuais_remove = Column(JSON, nullable=True)   # Codigos removidos manualmente
    codigos_resolvidos = Column(JSON, nullable=True)        # Lista final de codigos resolvidos

    # Filtros aplicados
    filtro_anos = Column(JSON, nullable=True)
    filtro_mes = Column(Integer, nullable=True)
    buscar_todas_instancias = Column(Boolean, default=False)

    # Configuracao de saida
    modo_saida = Column(String(20), nullable=False, default="pdf_txt")  # pdf | pdf_txt | txt | xml_only
    mesclar_pdfs = Column(Boolean, default=False)
    salvar_xml_completo = Column(Boolean, default=False)

    # Resultados
    total_processos = Column(Integer, default=1)
    total_docs_encontrados = Column(Integer, default=0)
    total_docs_baixados = Column(Integer, default=0)
    total_docs_erro = Column(Integer, default=0)

    # Audit trail para resolucoes especiais (BERT, cronologico, etc)
    resolucoes_especiais = Column(JSON, nullable=True)
    # Formato: [{"doc_id": "...", "categoria": "contestacao", "metodo": "bert", "label": "...", "confidence": 0.95}]

    # Status
    status = Column(String(20), nullable=False, default="pendente")
    # pendente | consultando | baixando | concluido | erro | cancelado
    progresso_percent = Column(Integer, default=0)
    erro_mensagem = Column(Text, nullable=True)

    # Auditoria
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    concluido_em = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<ExtracaoAutos(id={self.id}, cnj='{self.numero_cnj}', status='{self.status}')>"
