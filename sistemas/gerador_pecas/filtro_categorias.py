# sistemas/gerador_pecas/filtro_categorias.py
"""
Serviço de filtro de categorias de documentos por tipo de peça.

Gerencia quais documentos o Agente 1 deve analisar com base no tipo de peça selecionado.
"""

from typing import Optional, Set, List
from sqlalchemy.orm import Session

from sistemas.gerador_pecas.models_config_pecas import TipoPeca, CategoriaDocumento, TipoPecaGrupoCategoria


class FiltroCategoriasDocumento:
    """
    Gerencia o filtro de categorias de documentos para cada tipo de peça.
    
    Uso:
        filtro = FiltroCategoriasDocumento(db)
        
        # Para peça manual:
        codigos = filtro.get_codigos_permitidos("contestacao")
        
        # Para modo automático:
        codigos = filtro.get_todos_codigos()
        
        # Verificação:
        if filtro.documento_permitido("contestacao", 9500):
            # processar documento
    """
    
    def __init__(self, db: Session):
        """
        Args:
            db: Sessão do banco de dados
        """
        self.db = db
        self._cache_tipos: dict = {}
        self._cache_todos_codigos: Optional[Set[int]] = None
        self._carregar_cache()
    
    def _carregar_cache(self):
        """Carrega tipos de peça e categorias em cache"""
        tipos = self.db.query(TipoPeca).filter(TipoPeca.ativo == True).all()

        for tipo in tipos:
            self._cache_tipos[tipo.nome.lower()] = {
                "id": tipo.id,
                "titulo": tipo.titulo,
                "codigos": tipo.get_codigos_permitidos(),
                "codigos_primeiro_doc": tipo.get_codigos_primeiro_documento()
            }
    
    def _get_codigos_por_grupo(self, tipo_peca: str, group_id: int) -> Set[int]:
        """
        Busca codigos de documento permitidos para (tipo_peca, group_id)
        na tabela tipo_peca_grupo_categorias.
        """
        assocs = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == tipo_peca.lower(),
            TipoPecaGrupoCategoria.group_id == group_id,
        ).all()

        if not assocs:
            return set()

        codigos = set()
        cat_ids = [a.categoria_documento_id for a in assocs]
        categorias = self.db.query(CategoriaDocumento).filter(
            CategoriaDocumento.id.in_(cat_ids),
            CategoriaDocumento.ativo == True,
        ).all()
        for cat in categorias:
            codigos.update(cat.get_codigos())
        return codigos

    def _get_codigos_primeiro_doc_por_grupo(self, tipo_peca: str, group_id: int) -> Set[int]:
        """
        Busca codigos de primeiro documento para (tipo_peca, group_id).
        """
        assocs = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == tipo_peca.lower(),
            TipoPecaGrupoCategoria.group_id == group_id,
        ).all()

        if not assocs:
            return set()

        codigos = set()
        cat_ids = [a.categoria_documento_id for a in assocs]
        categorias = self.db.query(CategoriaDocumento).filter(
            CategoriaDocumento.id.in_(cat_ids),
            CategoriaDocumento.ativo == True,
            CategoriaDocumento.is_primeiro_documento == True,
        ).all()
        for cat in categorias:
            codigos.update(cat.get_codigos())
        return codigos

    def get_codigos_permitidos(self, tipo_peca: str, group_id: int | None = None) -> Set[int]:
        """
        Retorna os códigos de documento permitidos para um tipo de peça.

        Args:
            tipo_peca: Nome do tipo de peça (ex: 'contestacao')

        Returns:
            Conjunto de códigos de documento permitidos
        """
        # Se group_id informado, busca na nova tabela
        if group_id is not None:
            codigos = self._get_codigos_por_grupo(tipo_peca, group_id)
            if codigos:
                return codigos
            # Fallback: se nao tem config por grupo, usa cache antigo

        tipo_lower = tipo_peca.lower() if tipo_peca else ""

        if tipo_lower in self._cache_tipos:
            return self._cache_tipos[tipo_lower]["codigos"]

        # Busca no banco se não estiver em cache
        tipo = self.db.query(TipoPeca).filter(
            TipoPeca.nome.ilike(tipo_peca),
            TipoPeca.ativo == True
        ).first()

        if tipo:
            codigos = tipo.get_codigos_permitidos()
            self._cache_tipos[tipo_lower] = {
                "id": tipo.id,
                "titulo": tipo.titulo,
                "codigos": codigos,
                "codigos_primeiro_doc": tipo.get_codigos_primeiro_documento()
            }
            return codigos

        return set()
    
    def get_codigos_primeiro_documento(self, tipo_peca: str, group_id: int | None = None) -> Set[int]:
        """
        Retorna códigos que devem considerar apenas o primeiro documento cronológico.
        Os códigos são config-driven (definidos no admin por categoria com is_primeiro_documento=True).

        Args:
            tipo_peca: Nome do tipo de peça
            group_id: ID do grupo (opcional, para config por grupo)

        Returns:
            Conjunto de códigos de documentos que devem pegar só o primeiro
        """
        if group_id is not None:
            codigos = self._get_codigos_primeiro_doc_por_grupo(tipo_peca, group_id)
            if codigos:
                return codigos

        tipo_lower = tipo_peca.lower() if tipo_peca else ""
        
        if tipo_lower in self._cache_tipos:
            return self._cache_tipos[tipo_lower].get("codigos_primeiro_doc", set())
        
        # Busca no banco se não estiver em cache
        tipo = self.db.query(TipoPeca).filter(
            TipoPeca.nome.ilike(tipo_peca),
            TipoPeca.ativo == True
        ).first()
        
        if tipo:
            return tipo.get_codigos_primeiro_documento()
        
        return set()
    
    def get_todos_codigos(self) -> Set[int]:
        """
        Retorna todos os códigos de documento de todas as categorias ativas.
        Usado para modo automático (quando o tipo de peça não foi selecionado).
        
        Returns:
            Conjunto de todos os códigos de documento
        """
        if self._cache_todos_codigos is not None:
            return self._cache_todos_codigos
        
        categorias = self.db.query(CategoriaDocumento).filter(
            CategoriaDocumento.ativo == True
        ).all()
        
        todos_codigos = set()
        for categoria in categorias:
            todos_codigos.update(categoria.get_codigos())
        
        self._cache_todos_codigos = todos_codigos
        return todos_codigos
    
    def documento_permitido(
        self,
        tipo_peca: Optional[str],
        codigo_documento: int,
        group_id: int | None = None
    ) -> bool:
        """
        Verifica se um documento é permitido para o tipo de peça.

        Args:
            tipo_peca: Nome do tipo de peça (None = modo automático)
            codigo_documento: Código do documento TJ-MS
            group_id: ID do grupo (opcional, para config por grupo)

        Returns:
            True se o documento deve ser analisado
        """
        if tipo_peca:
            # Modo manual: usa apenas códigos do tipo de peça
            codigos = self.get_codigos_permitidos(tipo_peca, group_id=group_id)
        else:
            # Modo automático: usa todos os códigos
            codigos = self.get_todos_codigos()
        
        return codigo_documento in codigos
    
    def filtrar_documentos(
        self,
        documentos: List,
        tipo_peca: Optional[str],
        group_id: int | None = None
    ) -> List:
        """
        Filtra lista de documentos por tipo de peça.

        Aplica lógica especial para categorias marcadas como "primeiro documento"
        (is_primeiro_documento=True — códigos config-driven via admin).

        Args:
            documentos: Lista de DocumentoTJMS (deve estar ordenada cronologicamente)
            tipo_peca: Nome do tipo de peça (None = modo automático)
            group_id: ID do grupo (opcional, para config por grupo)

        Returns:
            Lista filtrada de documentos
        """
        if tipo_peca:
            codigos = self.get_codigos_permitidos(tipo_peca, group_id=group_id)
            codigos_primeiro_doc = self.get_codigos_primeiro_documento(tipo_peca, group_id=group_id)
        else:
            codigos = self.get_todos_codigos()
            codigos_primeiro_doc = set()  # No modo automático, não aplica filtro especial
        
        # Filtragem inicial por código
        docs_filtrados = []
        codigos_primeiro_doc_usados = set()  # Rastreia quais códigos especiais já foram usados
        codigos_primeiro_lote = {}  # codigo -> data_key do primeiro lote encontrado

        for doc in documentos:
            if not doc.tipo_documento:
                continue

            codigo = int(doc.tipo_documento)

            if codigo not in codigos:
                continue

            # Verifica se é código de "primeiro documento"
            # Permite múltiplas partes do mesmo lote (mesma data/hora = mesma digitalização)
            if codigo in codigos_primeiro_doc:
                data_key = doc.data_juntada.strftime('%Y%m%d%H%M') if doc.data_juntada else 'sem_data'
                if codigo in codigos_primeiro_doc_usados:
                    # Mesmo lote (mesma data/hora) = mesma digitalização, permite
                    if codigos_primeiro_lote.get(codigo) != data_key:
                        continue  # Lote diferente ou código cruzado, bloqueia
                else:
                    codigos_primeiro_lote[codigo] = data_key
                    # Marca TODOS os códigos do grupo como usados
                    # Assim o primeiro documento PI encontrado (seja 500, 9500 ou 10)
                    # impede que outros documentos de outros códigos PI sejam incluídos
                    codigos_primeiro_doc_usados.update(codigos_primeiro_doc)

            docs_filtrados.append(doc)

        return docs_filtrados
    
    def filtrar_resumos_por_tipo(
        self,
        resumos: List[dict],
        tipo_peca: str,
        group_id: int | None = None
    ) -> List[dict]:
        """
        Filtra resumos já gerados por tipo de peça.
        Usado quando o modo automático gera resumos de tudo e depois
        precisa filtrar apenas os relevantes para o tipo de peça detectado.

        Aplica lógica especial para categorias marcadas como "primeiro documento".

        Args:
            resumos: Lista de dicts com campo 'tipo_documento' (deve estar ordenada cronologicamente)
            tipo_peca: Nome do tipo de peça
            group_id: ID do grupo (opcional, para config por grupo)

        Returns:
            Lista filtrada de resumos
        """
        codigos = self.get_codigos_permitidos(tipo_peca, group_id=group_id)
        codigos_primeiro_doc = self.get_codigos_primeiro_documento(tipo_peca, group_id=group_id)
        
        resumos_filtrados = []
        codigos_primeiro_doc_usados = set()
        
        for resumo in resumos:
            tipo_doc = resumo.get("tipo_documento")
            if not tipo_doc:
                continue
            
            codigo = int(tipo_doc)
            
            if codigo not in codigos:
                continue
            
            # Verifica se é código de "primeiro documento"
            if codigo in codigos_primeiro_doc:
                # Se já pegamos um documento de QUALQUER código do grupo PI, pula
                if codigo in codigos_primeiro_doc_usados:
                    continue
                # Marca TODOS os códigos do grupo como usados
                codigos_primeiro_doc_usados.update(codigos_primeiro_doc)

            resumos_filtrados.append(resumo)

        return resumos_filtrados
    
    def get_tipos_peca_disponiveis(self) -> List[dict]:
        """
        Retorna lista de tipos de peça disponíveis para seleção.
        
        Returns:
            Lista de dicts com id, nome, titulo
        """
        tipos = self.db.query(TipoPeca).filter(
            TipoPeca.ativo == True
        ).order_by(TipoPeca.ordem, TipoPeca.titulo).all()
        
        return [
            {
                "id": tipo.id,
                "nome": tipo.nome,
                "titulo": tipo.titulo,
                "icone": tipo.icone,
                "categorias_count": len(tipo.categorias_documento)
            }
            for tipo in tipos
        ]
    
    def tem_configuracao(self) -> bool:
        """
        Verifica se há configuração de tipos de peça no banco.
        
        Returns:
            True se existem tipos de peça configurados
        """
        return len(self._cache_tipos) > 0
    
    def invalidar_cache(self):
        """Invalida o cache para recarregar do banco"""
        self._cache_tipos = {}
        self._cache_todos_codigos = None
        self._carregar_cache()


def get_filtro_categorias(db: Session) -> FiltroCategoriasDocumento:
    """Factory function para criar instância do filtro"""
    return FiltroCategoriasDocumento(db)
