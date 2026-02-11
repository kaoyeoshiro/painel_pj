# sistemas/extrator_autos/schemas.py
"""
Schemas Pydantic para validacao de requests/responses do Extrator de Autos.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator
import re


class ConsultarProcessoRequest(BaseModel):
    """Request para consultar um processo no TJ-MS."""
    numero_cnj: str = Field(..., description="Numero CNJ do processo")
    buscar_todas_instancias: bool = Field(False, description="Buscar em todas as instancias")

    @field_validator("numero_cnj")
    @classmethod
    def validar_cnj(cls, v: str) -> str:
        digitos = re.sub(r"\D", "", v)
        if len(digitos) != 20:
            raise ValueError(f"Numero CNJ deve ter 20 digitos, recebeu {len(digitos)}")
        return digitos


class ConsultarLoteRequest(BaseModel):
    """Request para consultar multiplos processos."""
    numeros_cnj: List[str] = Field(..., min_length=1, max_length=5000)
    buscar_todas_instancias: bool = False

    @field_validator("numeros_cnj")
    @classmethod
    def validar_cnjs(cls, v: List[str]) -> List[str]:
        resultado = []
        for num in v:
            digitos = re.sub(r"\D", "", num)
            if len(digitos) == 20:
                resultado.append(digitos)
        if not resultado:
            raise ValueError("Nenhum numero CNJ valido fornecido")
        return resultado


class ResolverCategoriasRequest(BaseModel):
    """Request para resolver categorias em lista de codigos."""
    categorias_ids: List[int] = Field(default_factory=list, description="IDs das CategoriaDocumento")
    codigos_manuais_add: List[int] = Field(default_factory=list, description="Codigos para adicionar")
    codigos_manuais_remove: List[int] = Field(default_factory=list, description="Codigos para remover")


class CategoriaResolvidaResponse(BaseModel):
    """Response de uma categoria resolvida."""
    categoria_id: int
    categoria_nome: str
    categoria_titulo: str
    codigos: List[int]
    metodo: str  # "codigo" | "primeiro_cronologico" | "bert"
    is_especial: bool = False
    descricao_especial: Optional[str] = None


class ResolverCategoriasResponse(BaseModel):
    """Response completa da resolucao de categorias."""
    codigos_finais: List[int]
    categorias_resolvidas: List[CategoriaResolvidaResponse]
    tem_regras_especiais: bool = False
    regras_especiais: List[Dict[str, Any]] = Field(default_factory=list)


class PreviewDocumentosRequest(BaseModel):
    """Request para preview de documentos."""
    numero_cnj: str
    codigos_resolvidos: List[int] = Field(default_factory=list)
    documento_ids: List[str] = Field(default_factory=list)
    categorias_ids: List[int] = Field(default_factory=list)
    filtro_anos: List[int] = Field(default_factory=list)
    filtro_mes: Optional[int] = None
    modo_selecao: str = "manual"  # manual | categoria | hibrido

    @field_validator("numero_cnj")
    @classmethod
    def validar_cnj(cls, v: str) -> str:
        return re.sub(r"\D", "", v)


class DocumentoPreviewResponse(BaseModel):
    """Response de um documento no preview."""
    id: str
    tipo_codigo: Optional[int] = None
    tipo_descricao: Optional[str] = None
    descricao: Optional[str] = None
    data_juntada: Optional[str] = None
    resolucao_especial: Optional[Dict[str, Any]] = None


class BaixarDocumentosRequest(BaseModel):
    """Request para iniciar download de documentos."""
    numero_cnj: str
    documento_ids: List[str] = Field(..., min_length=1)
    modo_saida: str = Field("pdf_txt", pattern="^(pdf|pdf_txt|txt|xml_only)$")
    mesclar_pdfs: bool = False
    salvar_xml_completo: bool = False
    categorias_selecionadas: List[int] = Field(default_factory=list)
    codigos_manuais_add: List[int] = Field(default_factory=list)
    codigos_manuais_remove: List[int] = Field(default_factory=list)
    modo_selecao: str = "manual"
    resolucoes_especiais: List[Dict[str, Any]] = Field(default_factory=list)

    @field_validator("numero_cnj")
    @classmethod
    def validar_cnj(cls, v: str) -> str:
        return re.sub(r"\D", "", v)

    @model_validator(mode="after")
    def normalizar_opcoes_por_formato(self) -> "BaixarDocumentosRequest":
        """xml_only implica salvar_xml; mesclar so faz sentido com PDF."""
        if self.modo_saida == "xml_only":
            self.salvar_xml_completo = True
        if self.modo_saida in ("txt", "xml_only"):
            self.mesclar_pdfs = False
        return self


class BaixarLoteRequest(BaseModel):
    """Request para download em lote."""
    numeros_cnj: List[str] = Field(..., min_length=1, max_length=5000)
    codigos_resolvidos: List[int] = Field(default_factory=list)
    categorias_ids: List[int] = Field(default_factory=list)
    codigos_manuais_add: List[int] = Field(default_factory=list)
    codigos_manuais_remove: List[int] = Field(default_factory=list)
    modo_selecao: str = "categoria"
    modo_saida: str = Field("pdf_txt", pattern="^(pdf|pdf_txt|txt|xml_only)$")
    mesclar_pdfs: bool = False
    salvar_xml_completo: bool = False
    agrupar_subpastas: bool = True
    filtro_anos: List[int] = Field(default_factory=list)
    filtro_mes: Optional[int] = None
    pausa_entre_processos: float = Field(2.0, ge=0.5, le=30.0)
    max_processos_paralelos: int = Field(3, ge=1, le=10)

    @model_validator(mode="after")
    def normalizar_opcoes_por_formato(self) -> "BaixarLoteRequest":
        """xml_only implica salvar_xml; mesclar so faz sentido com PDF."""
        if self.modo_saida == "xml_only":
            self.salvar_xml_completo = True
        if self.modo_saida in ("txt", "xml_only"):
            self.mesclar_pdfs = False
        return self


class ResumoLoteRequest(BaseModel):
    """Request para obter resumo do lote antes de baixar (sem consultar TJ-MS)."""
    numeros_cnj: List[str] = Field(..., min_length=1, max_length=5000)
    categorias_ids: List[int] = Field(default_factory=list)
    codigos_manuais_add: List[int] = Field(default_factory=list)
    codigos_manuais_remove: List[int] = Field(default_factory=list)
    modo_selecao: str = "categoria"

    @field_validator("numeros_cnj")
    @classmethod
    def validar_cnjs(cls, v: List[str]) -> List[str]:
        resultado = []
        for num in v:
            digitos = re.sub(r"\D", "", num)
            if len(digitos) == 20:
                resultado.append(digitos)
        if not resultado:
            raise ValueError("Nenhum numero CNJ valido fornecido")
        return resultado


class ClassificarBertRequest(BaseModel):
    """Request para testar classificacao BERT."""
    texto: str = Field(..., min_length=10)
    modelo: Optional[str] = None


class ClassificarBertResponse(BaseModel):
    """Response da classificacao BERT."""
    predicted_label: str
    normalized_label: str
    confidence: float
    is_contestacao: bool
    source: str  # "bert_classifier" | "erro"
    erro: Optional[str] = None
