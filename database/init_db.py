# database/init_db.py
"""
Inicializacao do banco de dados: conexao + seeds.

NOTA: Criacao de tabelas e migrations sao responsabilidade do Alembic.
Este modulo cuida apenas de:
1. Aguardar conexao com o banco (wait_for_db)
2. Criar usuario admin inicial (seed_admin)
3. Criar dados de seed (prompts, grupos, modulos, categorias)

Fase 0.5 do plano de refatoracao backend (Feb 2026).
"""

import time
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import text
from database.connection import engine, SessionLocal
from auth.models import User
from auth.security import get_password_hash
from config import ADMIN_USERNAME, ADMIN_PASSWORD

# Models usados pelos seeds (NAO para create_all — isso e do Alembic)
from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON
from admin.models import PromptConfig
from admin.models_prompts import PromptModulo, PromptModuloHistorico
from admin.models_prompt_groups import PromptGroup


def wait_for_db(max_retries=10, delay=3):
    """Aguarda o banco de dados ficar disponível"""
    for attempt in range(max_retries):
        try:
            # Tenta conectar
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("[OK] Conexao com banco de dados estabelecida!")
            return True
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"[...] Aguardando banco de dados... tentativa {attempt + 1}/{max_retries}")
                time.sleep(delay)
            else:
                print(f"[ERRO] Nao foi possivel conectar ao banco apos {max_retries} tentativas")
                raise e
    return False


# REMOVIDO: create_tables() — Alembic é a fonte de verdade para schema.
# Tabelas são criadas via: alembic upgrade head (Procfile, CI)
# Ver: migrations/versions/ para todas as migrations.


# REMOVIDO: run_migrations() — ~1500 linhas de ALTER TABLE/CREATE TABLE manuais.
# Todas as alteracoes de schema agora sao gerenciadas via Alembic.
# Ver: migrations/versions/ para historico de mudancas.
# Seed data (migrate_per_group_prompts, seed_prompt_groups) movidos para init_database().


def seed_admin():
    """Cria o usuário administrador inicial se não existir"""
    db = SessionLocal()
    try:
        # Verifica se já existe um admin
        existing_admin = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        
        if not existing_admin:
            admin = User(
                username=ADMIN_USERNAME,
                full_name="Administrador",
                email=None,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                role="admin",
                must_change_password=True,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print(f"[OK] Usuário admin '{ADMIN_USERNAME}' criado com sucesso!")
            print(f"   Senha inicial: {ADMIN_PASSWORD}")
            print(f"   [WARN]  Altere a senha no primeiro acesso!")
        else:
            print(f"[INFO]  Usuário admin '{ADMIN_USERNAME}' já existe.")
    finally:
        db.close()


def seed_prompts():
    """Cria os prompts padrão se não existirem"""
    from admin.seed_prompts import seed_all_defaults
    
    db = SessionLocal()
    try:
        # Verifica se já existem prompts
        existing = db.query(PromptConfig).count()
        
        if existing == 0:
            seed_all_defaults(db)
            print("[OK] Prompts e configurações de IA padrão criados!")
        else:
            print(f"[INFO]  {existing} prompt(s) já existem no banco.")
    finally:
        db.close()


def seed_prompt_groups(db: Session):
    """Cria grupos padrao e garante vinculacoes basicas."""
    import re

    # Fast-path: se todos os grupos já existem, pula a maior parte do trabalho
    existing_groups = db.query(PromptGroup).filter(
        PromptGroup.slug.in_(["ps", "pp", "detran"])
    ).count()
    if existing_groups == 3:
        # Grupos já existem, verifica apenas se há módulos sem grupo
        modulos_sem_grupo = db.query(PromptModulo).filter(
            PromptModulo.tipo == "conteudo",
            PromptModulo.group_id.is_(None)
        ).count()
        if modulos_sem_grupo == 0:
            # Tudo ok, nada a fazer
            return

    def slugify(valor: str) -> str:
        if not valor:
            return ""
        slug = re.sub(r"[^a-z0-9]+", "_", valor.strip().lower())
        slug = slug.strip("_")
        return slug or "geral"

    grupos_padrao = [
        {"name": "PS", "slug": "ps", "order": 1},
        {"name": "PP", "slug": "pp", "order": 2},
        {"name": "DETRAN", "slug": "detran", "order": 3},
    ]

    grupos = {}
    for info in grupos_padrao:
        grupo = db.query(PromptGroup).filter(PromptGroup.slug == info["slug"]).first()
        if not grupo:
            grupo = PromptGroup(
                name=info["name"],
                slug=info["slug"],
                active=True,
                order=info["order"]
            )
            db.add(grupo)
            db.flush()
        grupos[info["slug"]] = grupo

    db.commit()

    grupo_ps = grupos.get("ps")
    if not grupo_ps:
        return

    # Vincula prompts de conteudo existentes ao grupo PS
    modulos_sem_grupo = db.query(PromptModulo).filter(
        PromptModulo.tipo == "conteudo",
        PromptModulo.group_id.is_(None)
    ).all()
    for modulo in modulos_sem_grupo:
        modulo.group_id = grupo_ps.id

    # Garante grupo nos historicos antigos
    db.query(PromptModuloHistorico).filter(
        PromptModuloHistorico.group_id.is_(None)
    ).update({PromptModuloHistorico.group_id: grupo_ps.id}, synchronize_session=False)

    # NOTA: Subgrupos foram removidos da logica de seed.
    # Categorias (Preliminar, Merito, Eventualidade) sao usadas diretamente no campo 'categoria'
    # dos modulos e nao devem ser duplicadas como subgrupos.
    # A funcionalidade de subgrupo foi descontinuada para evitar confusao conceitual.

    # Garante grupos permitidos e grupo padrao para usuarios
    usuarios = db.query(User).all()
    for usuario in usuarios:
        if not usuario.default_group_id:
            usuario.default_group_id = grupo_ps.id
        if grupo_ps not in usuario.allowed_groups:
            usuario.allowed_groups.append(grupo_ps)

    db.commit()


def seed_prompt_modulos():
    """Cria os módulos de prompt do gerador de peças se não existirem"""
    from admin.seed_prompts import PROMPT_SYSTEM_GERADOR_PECAS
    
    db = SessionLocal()
    try:
        # Verifica se já existem módulos BASE
        existing_base = db.query(PromptModulo).filter(
            PromptModulo.tipo == "base"
        ).count()
        
        if existing_base == 0:
            # Cria o módulo BASE principal com o prompt do sistema
            modulo_base = PromptModulo(
                tipo="base",
                categoria=None,
                subcategoria=None,
                nome="system_prompt",
                titulo="Prompt de Sistema - Gerador de Peças",
                conteudo=PROMPT_SYSTEM_GERADOR_PECAS,
                palavras_chave=[],
                tags=["base", "sistema", "gerador"],
                ativo=True,
                ordem=0,
                versao=1
            )
            db.add(modulo_base)
            
            # Cria módulos de PEÇA para cada tipo
            tipos_peca = [
                {
                    "categoria": "contestacao",
                    "nome": "contestacao",
                    "titulo": "Contestação",
                    "conteudo": """## ESTRUTURA DA CONTESTAÇÃO

1. **ENDEREÇAMENTO** - Juízo competente
2. **QUALIFICAÇÃO** - Identificação do Estado como réu
3. **PRELIMINARES** (se houver):
   - Ilegitimidade passiva
   - Incompetência
   - Litispendência/Coisa julgada
   - Prescrição/Decadência
4. **MÉRITO**:
   - Impugnação específica dos fatos
   - Fundamentação jurídica
   - Jurisprudência aplicável
5. **PEDIDOS**:
   - Acolhimento das preliminares (se houver)
   - Improcedência dos pedidos
   - Condenação em honorários

Use linguagem formal, técnico-jurídica, com parágrafos justificados e citações em recuo."""
                },
                {
                    "categoria": "recurso_apelacao",
                    "nome": "recurso_apelacao",
                    "titulo": "Recurso de Apelação",
                    "conteudo": """## ESTRUTURA DO RECURSO DE APELAÇÃO

1. **ENDEREÇAMENTO** - Tribunal de Justiça de MS
2. **TEMPESTIVIDADE** - Demonstrar prazo
3. **PREPARO** - Isenção do Estado
4. **RAZÕES RECURSAIS**:
   - Síntese da sentença
   - Preliminares (nulidades, cerceamento)
   - Mérito recursal
   - Error in procedendo / Error in judicando
5. **PEDIDOS**:
   - Conhecimento e provimento
   - Reforma da sentença
   - Inversão dos ônus sucumbenciais

Demonstre o error in judicando ou procedendo de forma clara e objetiva."""
                },
                {
                    "categoria": "contrarrazoes",
                    "nome": "contrarrazoes",
                    "titulo": "Contrarrazões de Recurso",
                    "conteudo": """## ESTRUTURA DAS CONTRARRAZÕES

1. **ENDEREÇAMENTO** - Tribunal competente
2. **SÍNTESE DO RECURSO** - Resumo das razões do apelante
3. **PRELIMINARES DE INADMISSIBILIDADE** (se houver):
   - Intempestividade
   - Irregularidade formal
   - Falta de interesse recursal
4. **MÉRITO**:
   - Refutação ponto a ponto
   - Manutenção da sentença
   - Jurisprudência favorável
5. **PEDIDOS**:
   - Não conhecimento (preliminares)
   - Desprovimento
   - Majoração de honorários

Rebata cada argumento do recurso de forma sistemática."""
                },
                {
                    "categoria": "parecer",
                    "nome": "parecer",
                    "titulo": "Parecer Jurídico",
                    "conteudo": """## ESTRUTURA DO PARECER JURÍDICO

1. **EMENTA** - Síntese da consulta e conclusão
2. **RELATÓRIO** - Fatos e documentos analisados
3. **FUNDAMENTAÇÃO**:
   - Análise legal
   - Doutrina aplicável
   - Jurisprudência pertinente
   - Aspectos técnicos (se houver NAT)
4. **CONCLUSÃO**:
   - Resposta objetiva à consulta
   - Recomendações práticas
   - Encaminhamentos sugeridos

Seja objetivo e fundamente cada conclusão com base legal."""
                }
            ]
            
            for tipo_peca in tipos_peca:
                modulo = PromptModulo(
                    tipo="peca",
                    categoria=None,  # Prompts de peça não usam categoria
                    subcategoria=None,
                    nome=tipo_peca["nome"],  # Nome é o identificador único
                    titulo=tipo_peca["titulo"],
                    conteudo=tipo_peca["conteudo"],
                    palavras_chave=[tipo_peca["nome"]],
                    tags=["peca", tipo_peca["nome"]],
                    ativo=True,
                    ordem=0,
                    versao=1
                )
                db.add(modulo)
            
            db.commit()
            print("[OK] Módulos de prompt do gerador de peças criados!")
        else:
            print(f"[INFO]  {existing_base} módulo(s) BASE já existem no banco.")

        # Verifica se já existe a configuração de critérios de relevância
        from admin.models import ConfiguracaoIA
        existing_criterios = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "gerador_pecas",
            ConfiguracaoIA.chave == "prompt_criterios_relevancia"
        ).first()

        if not existing_criterios:
            # Cria a configuração de critérios de relevância para extração de resumos
            criterios_relevancia_conteudo = """Se o documento for meramente administrativo (procuração, AR de citação, comprovante de pagamento,
documento pessoal, certidão de publicação, protocolo, etc), retorne apenas:
```json
{"irrelevante": true, "motivo": "breve descrição do motivo"}
```

IMPORTANTE: Os seguintes tipos de documento SÃO RELEVANTES e devem ser resumidos normalmente:
- Emails, ofícios e comunicações que contenham informações sobre o caso
- Documentos sobre transferência hospitalar, notificações médicas, comunicados sobre tratamento
- Relatórios, laudos, pareceres técnicos
- Qualquer documento que contenha informações factuais sobre o processo"""

            config_criterios = ConfiguracaoIA(
                sistema="gerador_pecas",
                chave="prompt_criterios_relevancia",
                valor=criterios_relevancia_conteudo,
                tipo_valor="string",
                descricao="Critérios para determinar se um documento é relevante ou não na extração de resumos"
            )
            db.add(config_criterios)
            db.commit()
            print("[OK] Configuracao de criterios de relevancia criada!")
        else:
            print("[INFO] Configuracao de criterios de relevancia ja existe.")

        # Verifica/cria configuracoes do modo 2o grau (competencia=999)
        configs_segundo_grau = [
            {
                "chave": "competencia_999_last_peticoes_limit",
                "valor": "10",
                "tipo_valor": "number",
                "descricao": "Limite de peticoes recentes no modo 2o grau (1-50)"
            },
            {
                "chave": "competencia_999_last_recursos_limit",
                "valor": "10",
                "tipo_valor": "number",
                "descricao": "Limite de recursos recentes no modo 2o grau (1-50)"
            }
        ]

        for config_data in configs_segundo_grau:
            existing = db.query(ConfiguracaoIA).filter(
                ConfiguracaoIA.sistema == "gerador_pecas",
                ConfiguracaoIA.chave == config_data["chave"]
            ).first()

            if not existing:
                config = ConfiguracaoIA(
                    sistema="gerador_pecas",
                    chave=config_data["chave"],
                    valor=config_data["valor"],
                    tipo_valor=config_data["tipo_valor"],
                    descricao=config_data["descricao"]
                )
                db.add(config)
                print(f"[OK] Configuracao {config_data['chave']} criada!")

        # Verifica/cria lista inicial de codigos ignorados na extracao JSON
        existing_codigos_ignorados = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "gerador_pecas",
            ConfiguracaoIA.chave == "codigos_ignorar_extracao_json"
        ).first()

        if not existing_codigos_ignorados:
            # Codigos de documento TJ-MS que nao devem ter resumo JSON extraido
            # (documentos administrativos, internos, sem relevancia processual)
            import json
            codigos_iniciais = [2, 5, 7, 10, 13, 53, 192, 8433, 8449, 8450, 8494, 8500, 9508, 9614, 9999]
            config_codigos = ConfiguracaoIA(
                sistema="gerador_pecas",
                chave="codigos_ignorar_extracao_json",
                valor=json.dumps(codigos_iniciais),
                tipo_valor="json",
                descricao="Lista de codigos de documento TJ-MS a ignorar na extracao de JSON"
            )
            db.add(config_codigos)
            print(f"[OK] Configuracao codigos_ignorar_extracao_json criada com {len(codigos_iniciais)} codigos!")

        # Verifica/cria flag de deteccao automatica de tipo de peca
        existing_auto_detect = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "gerador_pecas",
            ConfiguracaoIA.chave == "enable_auto_piece_detection"
        ).first()

        if not existing_auto_detect:
            # Flag desabilitada por padrao - requer selecao manual do tipo de peca
            config_auto_detect = ConfiguracaoIA(
                sistema="gerador_pecas",
                chave="enable_auto_piece_detection",
                valor="false",
                tipo_valor="boolean",
                descricao="Habilita deteccao automatica do tipo de peca pela IA (false = obriga selecao manual)"
            )
            db.add(config_auto_detect)
            print("[OK] Configuracao enable_auto_piece_detection criada (desabilitada por padrao)!")

        db.commit()

    finally:
        db.close()


def seed_categorias_resumo_json():
    """Cria as categorias de formato de resumo JSON padrão"""
    from admin.models_prompt_groups import PromptGroup

    db = SessionLocal()
    try:
        # Busca grupo PS para associar categorias
        grupo_ps = db.query(PromptGroup).filter(PromptGroup.slug == "ps").first()
        if not grupo_ps:
            print("[WARN] Grupo PS não encontrado, pulando seed de categorias resumo JSON")
            return
        ps_group_id = grupo_ps.id

        # Verifica se já existem categorias
        existing = db.query(CategoriaResumoJSON).count()

        if existing == 0:
            # Formato JSON residual (padrão para todos os documentos)
            formato_residual = '''{
  "tipo_documento": "string - tipo identificado do documento",
  "partes": {
    "autor": "string ou null",
    "reu": "string ou null"
  },
  "pedido_objeto": "string - o que está sendo requerido ou discutido",
  "diagnostico_cid": "string ou null - diagnóstico/CID se mencionado",
  "tratamento_solicitado": {
    "tipo": "medicamento | cirurgia | procedimento | outro | null",
    "descricao": "string - descrição do tratamento",
    "medicamento": {
      "nome_comercial": "string ou null",
      "principio_ativo": "string ou null",
      "posologia": "string ou null",
      "incorporado_sus": "boolean ou null",
      "componente_sus": "string ou null - Básico/Estratégico/Especializado"
    },
    "cirurgia": {
      "procedimento": "string ou null",
      "urgente": "boolean ou null",
      "responsabilidade": "string ou null"
    }
  },
  "argumentos_principais": ["string - lista de argumentos apresentados"],
  "decisao_dispositivo": "string ou null - o que foi decidido, prazos, multas",
  "processo_origem": "string ou null - número CNJ do processo de origem (se Agravo)",
  "pontos_relevantes": ["string - outros pontos importantes"],
  "irrelevante": false
}'''
            
            instrucoes_residual = """Este é o formato padrão para todos os documentos.
Preencha TODOS os campos aplicáveis. Use null para campos não encontrados no documento.
Para campos de lista (argumentos_principais, pontos_relevantes), use array vazio [] se não houver conteúdo.
O campo "irrelevante" deve ser true apenas se o documento for meramente administrativo (procuração, AR, etc)."""
            
            categoria_residual = CategoriaResumoJSON(
                nome="residual",
                titulo="Formato Padrão (Residual)",
                descricao="Formato JSON padrão aplicado a todos os documentos que não pertencem a uma categoria específica.",
                codigos_documento=[],
                formato_json=formato_residual,
                instrucoes_extracao=instrucoes_residual,
                is_residual=True,
                ativo=True,
                ordem=999,
                group_id=ps_group_id,
            )
            db.add(categoria_residual)
            
            # Categoria para Petições
            formato_peticoes = '''{
  "tipo_documento": "string - Petição Inicial | Petição Intermediária | Contestação | etc",
  "partes": {
    "autor": "string",
    "reu": "string",
    "advogado_autor": "string ou null",
    "procurador_reu": "string ou null"
  },
  "valor_causa": "string ou null",
  "pedidos": [
    {
      "tipo": "principal | subsidiario | tutela_urgencia",
      "descricao": "string - descrição do pedido"
    }
  ],
  "fundamentos_juridicos": ["string - dispositivos legais citados"],
  "narrativa_fatos": "string - resumo da narrativa fática",
  "tutela_urgencia": {
    "requerida": "boolean",
    "tipo": "liminar | antecipacao_tutela | null",
    "fundamento_urgencia": "string ou null - periculum in mora alegado"
  },
  "provas_indicadas": ["string - provas documentais mencionadas"],
  "diagnostico_cid": "string ou null",
  "tratamento_solicitado": {
    "tipo": "medicamento | cirurgia | procedimento | outro | null",
    "descricao": "string ou null",
    "medicamento": {
      "nome_comercial": "string ou null",
      "principio_ativo": "string ou null",
      "posologia": "string ou null"
    }
  },
  "irrelevante": false
}'''
            
            categoria_peticoes = CategoriaResumoJSON(
                nome="peticoes",
                titulo="Petições",
                descricao="Formato para petições iniciais, intermediárias e contestações.",
                codigos_documento=[500, 510, 9500, 8320],  # Petição Inicial, Petição Intermediária, Petição, Contestação
                formato_json=formato_peticoes,
                instrucoes_extracao="Extraia TODOS os pedidos formulados, separando por tipo (principal, subsidiário, tutela de urgência). Liste todos os fundamentos jurídicos citados.",
                is_residual=False,
                ativo=True,
                ordem=1,
                group_id=ps_group_id,
            )
            db.add(categoria_peticoes)
            
            # Categoria para Decisões Judiciais
            formato_decisoes = '''{
  "tipo_documento": "string - Sentença | Decisão Interlocutória | Despacho | Acórdão",
  "juiz_relator": "string ou null",
  "data_decisao": "string ou null - data da decisão",
  "dispositivo": {
    "resultado": "procedente | improcedente | parcialmente_procedente | deferido | indeferido | outro",
    "descricao": "string - descrição do que foi decidido"
  },
  "fundamentacao_resumo": "string - principais razões de decidir",
  "obrigacoes_impostas": [
    {
      "obrigado": "string - quem deve cumprir",
      "obrigacao": "string - o que deve fazer",
      "prazo": "string ou null",
      "multa": "string ou null - astreintes se houver"
    }
  ],
  "honorarios": {
    "fixados": "boolean",
    "percentual_valor": "string ou null"
  },
  "recurso_cabivel": "string ou null",
  "transitou_julgado": "boolean ou null",
  "irrelevante": false
}'''
            
            categoria_decisoes = CategoriaResumoJSON(
                nome="decisoes",
                titulo="Decisões Judiciais",
                descricao="Formato para sentenças, decisões interlocutórias, despachos e acórdãos.",
                codigos_documento=[8, 6, 15, 137, 34, 44],  # Sentença, Despacho, Decisões Interlocutórias, etc
                formato_json=formato_decisoes,
                instrucoes_extracao="Identifique claramente o DISPOSITIVO da decisão (procedente/improcedente/etc). Liste TODAS as obrigações impostas com prazos e multas.",
                is_residual=False,
                ativo=True,
                ordem=2,
                group_id=ps_group_id,
            )
            db.add(categoria_decisoes)
            
            # Categoria para Recursos
            formato_recursos = '''{
  "tipo_documento": "string - Recurso de Apelação | Contrarrazões | Agravo de Instrumento | Embargos",
  "recorrente": "string",
  "recorrido": "string",
  "decisao_recorrida": "string - qual decisão está sendo impugnada",
  "teses_recursais": [
    {
      "tipo": "preliminar | merito",
      "argumento": "string - descrição do argumento"
    }
  ],
  "pedido_recursal": "string - o que pede (reforma, anulação, etc)",
  "processo_origem": "string ou null - número CNJ do processo de origem (para Agravo)",
  "efeito_suspensivo": {
    "requerido": "boolean",
    "fundamento": "string ou null"
  },
  "irrelevante": false
}'''
            
            categoria_recursos = CategoriaResumoJSON(
                nome="recursos",
                titulo="Recursos",
                descricao="Formato para recursos de apelação, contrarrazões, agravos e embargos.",
                codigos_documento=[8335, 8305],  # Recurso de Apelação, Contrarrazões de Apelação
                formato_json=formato_recursos,
                instrucoes_extracao="Liste TODAS as teses recursais separando preliminares de mérito. Para Agravo de Instrumento, SEMPRE identifique o processo de origem.",
                is_residual=False,
                ativo=True,
                ordem=3,
                group_id=ps_group_id,
            )
            db.add(categoria_recursos)
            
            # Categoria para Pareceres Técnicos (NAT/CATES)
            formato_pareceres = '''{
  "tipo_documento": "string - Parecer do NAT | Parecer do CATES | Laudo Pericial | Parecer do MP",
  "orgao_emissor": "string",
  "data_parecer": "string ou null",
  "objeto_consulta": "string - qual foi a pergunta/demanda",
  "medicamento_procedimento_analisado": {
    "nome": "string",
    "principio_ativo": "string ou null",
    "indicacao_solicitada": "string ou null"
  },
  "analise_incorporacao_sus": {
    "incorporado": "boolean ou null",
    "componente": "string ou null - Básico/Estratégico/Especializado",
    "para_quais_indicacoes": "string ou null",
    "caso_enquadra": "boolean ou null - o caso do autor se enquadra?"
  },
  "alternativas_terapeuticas": ["string - alternativas disponíveis no SUS"],
  "evidencia_cientifica": "string ou null - análise de eficácia/segurança",
  "conclusao": "string - conclusão/recomendação do parecer",
  "ressalvas": ["string - ressalvas ou condicionantes"],
  "irrelevante": false
}'''
            
            categoria_pareceres = CategoriaResumoJSON(
                nome="pareceres",
                titulo="Pareceres Técnicos",
                descricao="Formato para pareceres do NAT, CATES, NATJus, laudos periciais e pareceres do MP.",
                codigos_documento=[8369, 8333, 30],  # Laudo Pericial, Manifestação do MP, Peças do MP
                formato_json=formato_pareceres,
                instrucoes_extracao="TRANSCREVA a conclusão do parecer. Identifique claramente se o medicamento/procedimento está incorporado ao SUS e para quais indicações.",
                is_residual=False,
                ativo=True,
                ordem=4,
                group_id=ps_group_id,
            )
            db.add(categoria_pareceres)
            
            db.commit()
            print("[OK] Categorias de formato de resumo JSON criadas!")
        else:
            print(f"[INFO]  {existing} categoria(s) de resumo JSON já existem no banco.")
    finally:
        db.close()


_DB_INITIALIZED = False  # Cache em memória

def migrate_per_group_prompts(db: Session):
    """
    Migracao: cada grupo passa a ter seus proprios prompts base e peca.

    1. Vincula modulos base/peca existentes (group_id=NULL) ao grupo PS
    2. Duplica modulos base/peca do PS para PP e DETRAN (se ainda nao existem)
    3. Troca UniqueConstraint para (tipo, nome, group_id)
    """
    from sqlalchemy import inspect as sa_inspect, text

    # Rollback defensivo — limpa transacao suja de migracoes anteriores
    try:
        db.rollback()
    except Exception:
        pass

    inspector = sa_inspect(engine)

    # --- 1. Vincular modulos base/peca existentes (sem grupo) ao PS ---
    grupo_ps = db.query(PromptGroup).filter(PromptGroup.slug == "ps").first()
    if not grupo_ps:
        print("[WARN] Migracao per-group prompts: grupo PS nao encontrado, pulando")
        return

    modulos_sem_grupo = db.query(PromptModulo).filter(
        PromptModulo.tipo.in_(["base", "peca"]),
        PromptModulo.group_id.is_(None)
    ).all()

    if modulos_sem_grupo:
        for modulo in modulos_sem_grupo:
            modulo.group_id = grupo_ps.id
        db.commit()
        print(f"[OK] Migracao: {len(modulos_sem_grupo)} modulos base/peca vinculados ao PS")

    # --- 2. Duplicar modulos base/peca do PS para PP e DETRAN ---
    modulos_ps = db.query(PromptModulo).filter(
        PromptModulo.tipo.in_(["base", "peca"]),
        PromptModulo.group_id == grupo_ps.id
    ).all()

    for slug in ["pp", "detran"]:
        grupo = db.query(PromptGroup).filter(PromptGroup.slug == slug).first()
        if not grupo:
            continue

        # Verifica se o grupo ja tem modulos base/peca proprios
        existentes = db.query(PromptModulo).filter(
            PromptModulo.tipo.in_(["base", "peca"]),
            PromptModulo.group_id == grupo.id
        ).count()

        if existentes > 0:
            continue  # Ja foi migrado anteriormente

        # Duplica cada modulo do PS para o grupo
        for m_ps in modulos_ps:
            novo = PromptModulo(
                tipo=m_ps.tipo,
                categoria=m_ps.categoria,
                subcategoria=m_ps.subcategoria,
                group_id=grupo.id,
                subgroup_id=m_ps.subgroup_id,
                nome=m_ps.nome,
                titulo=m_ps.titulo,
                condicao_ativacao=m_ps.condicao_ativacao,
                conteudo=m_ps.conteudo,
                modo_ativacao=m_ps.modo_ativacao,
                palavras_chave=m_ps.palavras_chave,
                tags=m_ps.tags,
                ativo=m_ps.ativo,
                ordem=m_ps.ordem,
                versao=1,
            )
            db.add(novo)

        db.commit()
        print(f"[OK] Migracao: {len(modulos_ps)} modulos base/peca duplicados para {slug.upper()}")

    # --- 3. Trocar UniqueConstraint ---
    try:
        constraints = inspector.get_unique_constraints('prompt_modulos')
        constraint_names = {c['name'] for c in constraints}

        if 'uq_prompt_modulo' in constraint_names:
            db.execute(text("ALTER TABLE prompt_modulos DROP CONSTRAINT uq_prompt_modulo"))
            db.commit()
            print("[OK] Migracao: constraint uq_prompt_modulo removida")

        if 'uq_prompt_modulo_group' not in constraint_names:
            db.execute(text(
                "ALTER TABLE prompt_modulos ADD CONSTRAINT uq_prompt_modulo_group "
                "UNIQUE (tipo, nome, group_id)"
            ))
            db.commit()
            print("[OK] Migracao: constraint uq_prompt_modulo_group criada")
    except Exception as e:
        db.rollback()
        print(f"[WARN] Migracao constraint: {e}")


def init_database():
    """Inicializa o banco de dados: aguarda conexao e roda seeds.

    NOTA: Criacao de tabelas e migrations sao feitas pelo Alembic
    ANTES do app iniciar (via Procfile: alembic upgrade head).
    Esta funcao cuida apenas de seeds (dados iniciais idempotentes).
    """
    global _DB_INITIALIZED

    if _DB_INITIALIZED:
        return

    print("[*] Inicializando banco de dados...")

    # Aguarda banco ficar acessivel
    wait_for_db()

    # Seeds (todos idempotentes — verificam antes de inserir)
    seed_admin()
    seed_prompts()

    # Data migration + seed de grupos (idempotentes)
    db = SessionLocal()
    try:
        migrate_per_group_prompts(db)
        seed_prompt_groups(db)
    finally:
        db.close()

    seed_prompt_modulos()
    seed_categorias_resumo_json()

    _DB_INITIALIZED = True
    print("[OK] Banco de dados inicializado!")


if __name__ == "__main__":
    init_database()
