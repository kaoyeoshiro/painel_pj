"""
Registro de routers HTTP da API v1.

Nesta etapa, os routers continuam nos módulos legados e são incluídos
por compatibilidade de contrato (paths/métodos inalterados).
"""


def register_v1_routers(app):
    """
    Registra todos os routers atuais na API v1.

    Imports são lazy para reduzir risco de ciclo de import no startup.
    """
    # ==================================================
    # AUTENTICAÇÃO E USUÁRIOS
    # ==================================================
    from app.api.v1.routers.auth import router as auth_router
    from app.api.v1.routers.users import router as users_router

    app.include_router(auth_router)
    app.include_router(users_router)

    # ==================================================
    # ADMIN
    # ==================================================
    from app.api.v1.routers.admin import (
        dashboard_router,
        filtro_documentos_router,
        gemini_logs_router,
        performance_router,
        prompts_router,
        router as admin_router,
    )

    app.include_router(admin_router)
    app.include_router(dashboard_router)
    app.include_router(performance_router)
    app.include_router(gemini_logs_router)
    app.include_router(filtro_documentos_router, prefix="/admin/api")

    # ==================================================
    # SISTEMAS
    # ==================================================
    from app.api.v1.routers.assistencia_judiciaria import router as assistencia_router
    from app.api.v1.routers.gerador_pecas import (
        admin_router as gerador_pecas_admin_router,
        categorias_json_router,
        config_pecas_router,
        ext_deps_router,
        ext_models_router,
        ext_questions_router,
        ext_variables_router,
        get_teste_ativacao_router,
        router as gerador_pecas_router,
        teste_categorias_router,
    )
    from app.api.v1.routers.matriculas_confrontantes import router as matriculas_router

    app.include_router(assistencia_router, prefix="/assistencia/api")
    app.include_router(matriculas_router, prefix="/matriculas/api")
    app.include_router(gerador_pecas_router, prefix="/gerador-pecas/api")
    app.include_router(gerador_pecas_admin_router, prefix="/admin/api")

    # Routers admin do Gerador de Peças
    app.include_router(prompts_router, prefix="/admin/api")
    app.include_router(categorias_json_router, prefix="/admin/api")
    app.include_router(teste_categorias_router, prefix="/admin/api")

    # TEMPORÁRIO: inclusão condicional até redeploy com models_teste_ativacao.py
    teste_ativacao_router = get_teste_ativacao_router()
    if teste_ativacao_router:
        app.include_router(teste_ativacao_router, prefix="/admin/api")

    # Routers de extração splitados
    app.include_router(ext_questions_router, prefix="/admin/api/extraction")
    app.include_router(ext_models_router, prefix="/admin/api/extraction")
    app.include_router(ext_variables_router, prefix="/admin/api/extraction")
    app.include_router(ext_deps_router, prefix="/admin/api/extraction")

    # Configurações de tipos de peça/categorias
    app.include_router(config_pecas_router)

    # Pedido de cálculo
    from app.api.v1.routers.pedido_calculo import (
        admin_router as pedido_calculo_admin_router,
        router as pedido_calculo_router,
    )

    app.include_router(pedido_calculo_router, prefix="/pedido-calculo/api")
    app.include_router(pedido_calculo_admin_router)

    # Prestação de contas
    from app.api.v1.routers.prestacao_contas import (
        admin_router as prestacao_contas_admin_router,
        router as prestacao_contas_router,
    )

    app.include_router(prestacao_contas_router, prefix="/prestacao-contas/api")
    app.include_router(prestacao_contas_admin_router)

    # Relatório de cumprimento
    from app.api.v1.routers.relatorio_cumprimento import router as relatorio_cumprimento_router

    app.include_router(relatorio_cumprimento_router, prefix="/relatorio-cumprimento/api")

    # Cumprimento beta
    from app.api.v1.routers.cumprimento_beta import router as cumprimento_beta_router

    app.include_router(cumprimento_beta_router, prefix="/api")

    # Classificador de documentos
    from app.api.v1.routers.classificador_documentos import router as classificador_documentos_router

    app.include_router(classificador_documentos_router, prefix="/classificador/api")

    # BERT training e extrator de autos
    from app.api.v1.routers.bert_training import router as bert_training_router
    from app.api.v1.routers.extrator_autos import router as extrator_autos_router

    app.include_router(bert_training_router)
    app.include_router(extrator_autos_router)

    # Text normalizer
    from app.api.v1.routers.text_normalizer import router as text_normalizer_router

    app.include_router(text_normalizer_router)

    # ==================================================
    # SISTEMA DE REVISÃO DE PEÇAS
    # ==================================================
    from sistemas.revisao_pecas.router import router as revisao_router

    app.include_router(revisao_router, prefix="/revisao/api")

    # router_chat e router_documentos são registrados quando existirem (Task 5)
    try:
        from sistemas.revisao_pecas.router_chat import router as revisao_chat_router
        app.include_router(revisao_chat_router, prefix="/revisao/api")
    except ImportError:
        pass

    try:
        from sistemas.revisao_pecas.router_documentos import router as revisao_docs_router
        app.include_router(revisao_docs_router, prefix="/revisao/api")
    except ImportError:
        pass
