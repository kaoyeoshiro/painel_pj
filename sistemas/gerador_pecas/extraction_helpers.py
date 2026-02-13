# sistemas/gerador_pecas/extraction_helpers.py
"""
Funcoes auxiliares para o sistema de extracao de variaveis.

Extraidas de router_extraction.py (Fase 5a do plano de refatoracao).
Usadas por endpoints de perguntas, modelos e variaveis.
"""

import re
import logging
import unicodedata
from typing import List, Dict, Optional
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import or_

from .models_extraction import ExtractionQuestion, ExtractionVariable
from utils.timezone import get_utc_now

logger = logging.getLogger(__name__)


# ============================================================================
# SLUG HELPERS
# ============================================================================

def _slugify(texto: str) -> str:
    """
    Converte texto em slug válido para variável.

    Exemplo: "O parecer analisou medicamento?" -> "o_parecer_analisou_medicamento"
    """
    # Remove acentos
    texto = unicodedata.normalize('NFKD', texto)
    texto = texto.encode('ascii', 'ignore').decode('ascii')

    # Converte para minúsculas
    texto = texto.lower()

    # Remove caracteres especiais, mantém apenas letras, números e espaços
    texto = re.sub(r'[^a-z0-9\s]', '', texto)

    # Substitui espaços por underscores
    texto = re.sub(r'\s+', '_', texto.strip())

    # Remove underscores múltiplos
    texto = re.sub(r'_+', '_', texto)

    # Limita tamanho
    return texto[:100]


def _get_unique_slug(db: Session, base_slug: str, exclude_question_id: int = None) -> str:
    """
    Garante que o slug seja único entre variáveis ATIVAS, adicionando sufixo se necessário.

    IMPORTANTE: Variáveis inativas NÃO bloqueiam o slug.
    Se existir variável inativa com o mesmo slug, ela será reutilizada/reativada
    pela função ensure_variable_for_question, não aqui.

    Args:
        db: Sessão do banco
        base_slug: Slug base
        exclude_question_id: ID da pergunta a excluir da verificação (para updates)

    Returns:
        Slug único (entre variáveis ativas)
    """
    slug = base_slug
    contador = 1

    while True:
        # CORREÇÃO: Filtra apenas variáveis ATIVAS
        query = db.query(ExtractionVariable).filter(
            ExtractionVariable.slug == slug,
            ExtractionVariable.ativo == True  # Ignora variáveis inativas!
        )

        # Se for update, exclui a variável da própria pergunta
        if exclude_question_id:
            query = query.filter(
                or_(
                    ExtractionVariable.source_question_id != exclude_question_id,
                    ExtractionVariable.source_question_id.is_(None)
                )
            )

        existente = query.first()

        if not existente:
            # Log quando adiciona sufixo
            if contador > 1:
                logger.info(
                    f"Slug único gerado: base='{base_slug}' -> final='{slug}' "
                    f"(conflito com variável ativa existente)"
                )
            return slug

        contador += 1
        slug = f"{base_slug}_{contador}"


def _aplicar_namespace(slug: str, namespace: str) -> str:
    """
    Aplica namespace ao slug se ainda não tiver.

    Args:
        slug: Slug base da variável
        namespace: Prefixo do namespace

    Returns:
        Slug com namespace aplicado
    """
    if not namespace:
        return slug
    # Se já tem o namespace, retorna como está
    if slug.startswith(f"{namespace}_"):
        return slug
    # Aplica o namespace
    return f"{namespace}_{slug}"


def _remover_namespace(slug: str, namespace: str) -> str:
    """
    Remove namespace do slug para obter o nome base.

    Args:
        slug: Slug completo da variável
        namespace: Prefixo do namespace

    Returns:
        Slug sem namespace (nome base)
    """
    if not namespace:
        return slug
    prefixo = f"{namespace}_"
    if slug.startswith(prefixo):
        return slug[len(prefixo):]
    return slug


# ============================================================================
# VARIABLE MANAGEMENT
# ============================================================================

def ensure_variable_for_question(
    db: Session,
    pergunta: ExtractionQuestion,
    categoria: "CategoriaResumoJSON",
    criar_sem_tipo: bool = True
) -> Optional[ExtractionVariable]:
    """
    Garante que existe uma variável correspondente à pergunta.

    IMPORTANTE: Esta função PRESERVA variáveis existentes vinculadas à pergunta.
    O slug da variável SEMPRE inclui o prefixo/namespace da categoria.
    O nome_variavel_sugerido da pergunta armazena o SLUG COMPLETO (com prefixo).

    Esta função:
    1. Verifica se a pergunta tem os campos mínimos (texto, slug)
    2. Se já existe variável vinculada, PRESERVA o slug e sincroniza com pergunta
    3. Se não existe, cria nova variável (aplicando prefixo da categoria ao slug)

    COMPORTAMENTO ATUALIZADO (v3):
    - O prefixo da categoria é SEMPRE aplicado ao slug da variável
    - O nome_variavel_sugerido da pergunta armazena o slug COMPLETO (com prefixo)
    - Isso garante consistência entre banco de dados e JSON

    Args:
        db: Sessão do banco de dados
        pergunta: Pergunta de extração
        categoria: Categoria da pergunta
        criar_sem_tipo: Se True, cria variável mesmo sem tipo definido (usa "text" como default)

    Returns:
        ExtractionVariable existente/criada ou None se pergunta incompleta
    """
    # Verifica campos mínimos
    if not pergunta.pergunta or not pergunta.pergunta.strip():
        return None

    # Se não tem slug definido, não cria variável (precisa pelo menos do slug)
    if not pergunta.nome_variavel_sugerido or not pergunta.nome_variavel_sugerido.strip():
        return None

    # Se não tem tipo definido e criar_sem_tipo=False, não cria
    # Se criar_sem_tipo=True (default), usa "text" como tipo padrão
    tipo_variavel = pergunta.tipo_sugerido.strip().lower() if pergunta.tipo_sugerido and pergunta.tipo_sugerido.strip() else "text"

    # Obtém o namespace da categoria
    namespace = categoria.namespace if categoria else ""

    # Verifica se já existe variável vinculada a esta pergunta
    variavel_existente = db.query(ExtractionVariable).filter(
        ExtractionVariable.source_question_id == pergunta.id
    ).first() if pergunta.id else None

    if variavel_existente:
        # PRESERVA variável existente - NÃO altera o slug!
        # IMPORTANTE: Nao sobrescrever nome_variavel_sugerido da pergunta aqui!
        # A renomeacao de slug eh tratada no endpoint PUT /perguntas/{id}
        # Aqui apenas logamos se houver divergencia (nao sobrescrevemos)
        if pergunta.nome_variavel_sugerido and pergunta.nome_variavel_sugerido != variavel_existente.slug:
            logger.warning(
                f"Pergunta {pergunta.id}: slug divergente detectado - "
                f"pergunta='{pergunta.nome_variavel_sugerido}', variavel='{variavel_existente.slug}'. "
                f"Use o endpoint PUT /perguntas/{pergunta.id} para renomear."
            )

        # Atualiza apenas campos não-identificadores da variável (tipo, opções, dependências)
        variavel_existente.tipo = tipo_variavel
        variavel_existente.opcoes = pergunta.opcoes_sugeridas
        variavel_existente.categoria_id = categoria.id

        # Atualiza dependências (aplicando namespace ao depends_on)
        if pergunta.depends_on_variable:
            depends_on_com_namespace = _aplicar_namespace(pergunta.depends_on_variable, namespace)
            variavel_existente.is_conditional = True
            variavel_existente.depends_on_variable = depends_on_com_namespace
            variavel_existente.dependency_config = {
                "operator": pergunta.dependency_operator or "equals",
                "value": pergunta.dependency_value
            } if pergunta.dependency_operator else None
        else:
            variavel_existente.is_conditional = False
            variavel_existente.depends_on_variable = None
            variavel_existente.dependency_config = None

        variavel_existente.atualizado_em = get_utc_now()

        logger.info(f"Variável preservada: {variavel_existente.slug} (pergunta_id={pergunta.id})")
        return variavel_existente

    # Não existe variável vinculada - determina o slug para criar nova
    if pergunta.nome_variavel_sugerido and pergunta.nome_variavel_sugerido.strip():
        slug_informado = pergunta.nome_variavel_sugerido.strip()
        # Remove namespace se já tiver (para evitar duplicação)
        slug_base = _remover_namespace(slug_informado, namespace)
    else:
        # Gera slug a partir do texto da pergunta
        slug_base = _slugify(pergunta.pergunta)
        if not slug_base:
            slug_base = f"variavel_{pergunta.id or 'nova'}"

    # APLICA O NAMESPACE/PREFIXO DA CATEGORIA AO SLUG
    slug_final = _aplicar_namespace(slug_base, namespace)

    # Verifica se existe variável com o mesmo slug
    # IMPORTANTE: Variáveis INATIVAS podem ser reativadas/reutilizadas
    variavel_mesmo_slug = db.query(ExtractionVariable).filter(
        ExtractionVariable.slug == slug_final
    ).first()

    if variavel_mesmo_slug:
        # Já existe variável com esse slug
        if not variavel_mesmo_slug.ativo:
            # CORREÇÃO BUG 1: Variável INATIVA - REATIVAR e vincular à pergunta
            # Não criar sufixo _2, _3 por causa de variável inativa!
            variavel_mesmo_slug.ativo = True
            variavel_mesmo_slug.source_question_id = pergunta.id
            variavel_mesmo_slug.categoria_id = categoria.id
            variavel_mesmo_slug.label = pergunta.pergunta[:200] if pergunta.pergunta else slug_base
            variavel_mesmo_slug.tipo = tipo_variavel
            variavel_mesmo_slug.descricao = pergunta.descricao or variavel_mesmo_slug.descricao
            variavel_mesmo_slug.opcoes = pergunta.opcoes_sugeridas or variavel_mesmo_slug.opcoes
            variavel_mesmo_slug.atualizado_em = get_utc_now()

            # Atualiza dependências
            if pergunta.depends_on_variable:
                depends_on_final = _aplicar_namespace(pergunta.depends_on_variable, namespace)
                variavel_mesmo_slug.is_conditional = True
                variavel_mesmo_slug.depends_on_variable = depends_on_final
                variavel_mesmo_slug.dependency_config = {
                    "operator": pergunta.dependency_operator or "equals",
                    "value": pergunta.dependency_value
                } if pergunta.dependency_operator else None
            else:
                variavel_mesmo_slug.is_conditional = False
                variavel_mesmo_slug.depends_on_variable = None
                variavel_mesmo_slug.dependency_config = None

            # Atualiza nome_variavel_sugerido da pergunta com slug COMPLETO
            pergunta.nome_variavel_sugerido = slug_final

            logger.info(
                f"Variável REATIVADA e vinculada: {variavel_mesmo_slug.slug} "
                f"(id={variavel_mesmo_slug.id}, pergunta_id={pergunta.id}) - "
                f"evitado sufixo _2 por reutilização de variável inativa"
            )
            return variavel_mesmo_slug

        elif variavel_mesmo_slug.source_question_id is None:
            # Variável ATIVA manual sem pergunta vinculada - vincula a esta pergunta
            variavel_mesmo_slug.source_question_id = pergunta.id
            variavel_mesmo_slug.categoria_id = categoria.id
            variavel_mesmo_slug.label = pergunta.pergunta[:200] if pergunta.pergunta else slug_base
            variavel_mesmo_slug.tipo = tipo_variavel
            variavel_mesmo_slug.descricao = pergunta.descricao or variavel_mesmo_slug.descricao
            variavel_mesmo_slug.opcoes = pergunta.opcoes_sugeridas or variavel_mesmo_slug.opcoes
            variavel_mesmo_slug.atualizado_em = get_utc_now()

            # Atualiza nome_variavel_sugerido da pergunta com slug COMPLETO
            pergunta.nome_variavel_sugerido = slug_final

            logger.info(f"Variável existente vinculada: {variavel_mesmo_slug.slug} (pergunta_id={pergunta.id})")
            return variavel_mesmo_slug

        else:
            # Variável ATIVA já vinculada a outra pergunta - usa sufixo
            slug_unico = _get_unique_slug(db, slug_final, exclude_question_id=pergunta.id)
            logger.info(
                f"Slug com sufixo necessário: '{slug_final}' -> '{slug_unico}' "
                f"(conflito com variável ativa id={variavel_mesmo_slug.id}, "
                f"vinculada a pergunta_id={variavel_mesmo_slug.source_question_id})"
            )
            slug_final = slug_unico

    # Aplica namespace ao depends_on se existir
    depends_on_final = None
    if pergunta.depends_on_variable:
        depends_on_final = _aplicar_namespace(pergunta.depends_on_variable, namespace)

    # Cria nova variável com slug COMPLETO (incluindo prefixo)
    variavel = ExtractionVariable(
        slug=slug_final,
        label=pergunta.pergunta[:200] if pergunta.pergunta else slug_base,
        descricao=pergunta.descricao,
        tipo=tipo_variavel,
        categoria_id=categoria.id,
        opcoes=pergunta.opcoes_sugeridas,
        source_question_id=pergunta.id,
        is_conditional=bool(pergunta.depends_on_variable),
        depends_on_variable=depends_on_final,
        dependency_config={
            "operator": pergunta.dependency_operator or "equals",
            "value": pergunta.dependency_value
        } if pergunta.depends_on_variable and pergunta.dependency_operator else None,
        ativo=True
    )

    db.add(variavel)
    db.flush()  # Para obter o ID

    # Atualiza nome_variavel_sugerido da pergunta com slug COMPLETO (incluindo prefixo)
    pergunta.nome_variavel_sugerido = slug_final

    logger.info(f"Variável criada: {variavel.slug} (id={variavel.id}, pergunta_id={pergunta.id}, namespace={namespace})")

    return variavel


# ============================================================================
# DEPENDENCY HIERARCHY
# ============================================================================

def _garantir_hierarquia_dependencias(
    ordem: List[Dict],
    perguntas_originais: List
) -> List[Dict]:
    """
    Correção determinística da ordem para garantir que dependentes
    fiquem imediatamente abaixo de suas âncoras.

    REGRAS:
    1. Cada pergunta condicional deve estar IMEDIATAMENTE após sua âncora
    2. Se a âncora tem múltiplos dependentes, eles ficam todos logo abaixo da âncora
    3. Se um dependente tem sub-dependentes, a árvore é mantida (pai -> filho -> neto)
    4. A ordem relativa entre perguntas não-relacionadas é preservada da sugestão da IA
    5. Perguntas que dependem de outras só são adicionadas DEPOIS de suas âncoras

    Args:
        ordem: Lista de {"id": int, "pergunta": str} na ordem sugerida pela IA
        perguntas_originais: Lista de perguntas com informações de dependência

    Returns:
        Lista corrigida mantendo hierarquia
    """
    if not ordem or not perguntas_originais:
        return ordem

    # Cria mapeamentos
    id_para_pergunta = {p.id: p for p in perguntas_originais}
    id_para_ordem_item = {item["id"]: item for item in ordem}

    # Cria grafo de dependências
    slug_para_id = {}
    id_para_slug = {}
    id_depende_de_slug = {}  # id -> slug_ancora
    dependentes_de = {}  # slug_ancora -> [ids_dependentes]

    for p in perguntas_originais:
        if p.nome_variavel_sugerido:
            slug_para_id[p.nome_variavel_sugerido] = p.id
            id_para_slug[p.id] = p.nome_variavel_sugerido

        if p.depends_on_variable:
            ancora_slug = p.depends_on_variable
            id_depende_de_slug[p.id] = ancora_slug
            if ancora_slug not in dependentes_de:
                dependentes_de[ancora_slug] = []
            dependentes_de[ancora_slug].append(p.id)

    # Se não há dependências, retorna ordem original
    if not dependentes_de:
        return ordem

    # Identifica raízes (perguntas sem dependência) - estas podem ser processadas livremente
    ids_raiz = set()
    for p in perguntas_originais:
        if not p.depends_on_variable:
            ids_raiz.add(p.id)

    # Função auxiliar para coletar toda a árvore de dependentes em ordem DFS
    def coletar_arvore_dfs(pergunta_id: int, visitados: set) -> List[int]:
        """Coleta a pergunta e todos seus dependentes em ordem DFS."""
        if pergunta_id in visitados:
            return []

        resultado = [pergunta_id]
        visitados.add(pergunta_id)

        # Se esta pergunta tem dependentes, adiciona-os recursivamente
        slug = id_para_slug.get(pergunta_id)
        if slug and slug in dependentes_de:
            # Ordena dependentes pela ordem original da IA para preservar sugestão
            dependentes = dependentes_de[slug]
            dependentes_com_idx = []
            for dep_id in dependentes:
                if dep_id not in visitados:
                    idx_ordem = 9999
                    if dep_id in id_para_ordem_item:
                        try:
                            idx_ordem = [i for i, item in enumerate(ordem) if item["id"] == dep_id][0]
                        except (IndexError, ValueError):
                            pass
                    dependentes_com_idx.append((idx_ordem, dep_id))

            dependentes_com_idx.sort(key=lambda x: x[0])

            for _, dep_id in dependentes_com_idx:
                resultado.extend(coletar_arvore_dfs(dep_id, visitados))

        return resultado

    # Constrói ordem corrigida processando na ordem da IA, mas respeitando hierarquia
    ids_processados = set()
    ordem_corrigida = []

    for item in ordem:
        pergunta_id = item["id"]

        if pergunta_id in ids_processados:
            continue

        # Se esta pergunta depende de outra que ainda não foi processada, pula
        # (será adicionada quando sua âncora for processada)
        ancora_slug = id_depende_de_slug.get(pergunta_id)
        if ancora_slug:
            ancora_id = slug_para_id.get(ancora_slug)
            if ancora_id and ancora_id not in ids_processados:
                # Âncora ainda não processada - esta pergunta será adicionada depois
                continue

        # Processa esta pergunta e toda sua árvore de dependentes
        arvore = coletar_arvore_dfs(pergunta_id, ids_processados)

        for pid in arvore:
            if pid in id_para_ordem_item:
                ordem_corrigida.append(id_para_ordem_item[pid])
            else:
                pergunta = id_para_pergunta.get(pid)
                if pergunta:
                    ordem_corrigida.append({
                        "id": pid,
                        "pergunta": pergunta.pergunta
                    })

    # Adiciona quaisquer perguntas que ficaram de fora
    for item in ordem:
        if item["id"] not in ids_processados:
            ordem_corrigida.append(item)
            ids_processados.add(item["id"])

    logger.info(f"Hierarquia de dependências corrigida: {len(ordem)} -> {len(ordem_corrigida)} perguntas")

    return ordem_corrigida


# ============================================================================
# DEPENDENCY GROUPING
# ============================================================================

def _agrupar_por_dependencias_algoritmo(perguntas: List[ExtractionQuestion]) -> tuple:
    """
    Algoritmo determinístico para agrupar perguntas por dependências.

    Regras:
    1) Para cada pergunta "mãe", coloca imediatamente abaixo dela todas as perguntas que dependem dela (filhos)
    2) Se houver dependência em múltiplos níveis (netos), mantém a hierarquia
    3) Mantém ordem relativa original (entre mães e entre filhos de mesma mãe)
    4) Para múltiplas dependências, usa o pai que aparece primeiro na ordem atual
    5) Detecta ciclos e mantém ordem atual das envolvidas

    Returns:
        tuple: (lista_ordenada, lista_ciclos)
    """
    if not perguntas:
        return [], []

    # Cria mapa de slug -> pergunta (para encontrar pais)
    slug_to_pergunta = {}
    for p in perguntas:
        if p.nome_variavel_sugerido:
            slug = p.nome_variavel_sugerido.strip().lower()
            if slug and slug not in slug_to_pergunta:
                slug_to_pergunta[slug] = p

    # Cria mapa de id -> pergunta para acesso rápido
    id_to_pergunta = {p.id: p for p in perguntas}

    # Cria mapa de id -> filhos (perguntas que dependem desta)
    filhos_map = {p.id: [] for p in perguntas}

    # Para cada pergunta, identifica seu pai
    pai_map = {}  # id_pergunta -> id_pai
    for p in perguntas:
        if p.depends_on_variable:
            slug_pai = p.depends_on_variable.strip().lower()
            pai = slug_to_pergunta.get(slug_pai)
            if pai and pai.id != p.id:  # Evita auto-referência
                pai_map[p.id] = pai.id
                filhos_map[pai.id].append(p)

    # Detecta ciclos usando DFS
    ciclos = []
    visitados = set()
    em_pilha = set()

    def detecta_ciclo(pergunta_id: int, caminho: list) -> bool:
        """Detecta ciclos no grafo de dependências"""
        if pergunta_id in em_pilha:
            # Encontrou ciclo
            idx = caminho.index(pergunta_id)
            ciclo_ids = caminho[idx:]
            ciclo_nomes = [id_to_pergunta[pid].pergunta[:50] for pid in ciclo_ids if pid in id_to_pergunta]
            ciclos.append(f"Ciclo detectado: {' → '.join(ciclo_nomes)}")
            return True

        if pergunta_id in visitados:
            return False

        visitados.add(pergunta_id)
        em_pilha.add(pergunta_id)
        caminho.append(pergunta_id)

        for filho in filhos_map.get(pergunta_id, []):
            detecta_ciclo(filho.id, caminho)

        caminho.pop()
        em_pilha.remove(pergunta_id)
        return False

    # Verifica ciclos para todas as perguntas
    for p in perguntas:
        if p.id not in visitados:
            detecta_ciclo(p.id, [])

    # Identifica raízes (perguntas sem pai válido ou cujo pai não existe)
    raizes = []
    for p in perguntas:
        if p.id not in pai_map:
            raizes.append(p)

    # Ordena filhos de cada pai pela ordem original
    for pai_id in filhos_map:
        filhos_map[pai_id].sort(key=lambda x: (x.ordem or 0, x.id))

    # Coleta subárvore recursivamente (DFS)
    resultado = []
    processados = set()

    def coletar_subarvore(pergunta: ExtractionQuestion, nivel: int = 0):
        """Coleta pergunta e seus descendentes em ordem DFS"""
        if pergunta.id in processados:
            return

        processados.add(pergunta.id)
        resultado.append({
            "pergunta": pergunta,
            "nivel": nivel
        })

        # Coleta filhos em ordem original
        for filho in filhos_map.get(pergunta.id, []):
            coletar_subarvore(filho, nivel + 1)

    # Processa raízes em ordem original
    raizes.sort(key=lambda x: (x.ordem or 0, x.id))
    for raiz in raizes:
        coletar_subarvore(raiz)

    # Adiciona perguntas órfãs (não processadas - podem estar em ciclos ou ter pai inexistente)
    for p in perguntas:
        if p.id not in processados:
            resultado.append({
                "pergunta": p,
                "nivel": 0
            })

    return resultado, ciclos
