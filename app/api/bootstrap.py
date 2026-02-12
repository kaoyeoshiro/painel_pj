"""
Bootstrap da aplicação - registro centralizado de routers.

Centraliza todos os app.include_router() que antes estavam espalhados
no main.py, mantendo a ordem e prefixos originais.

IMPORTANTE: Imports de routers são lazy (dentro da função) para evitar
ciclos de import que podem quebrar a aplicação durante o startup.
"""


def register_routers(app):
    """
    Registra todos os routers da aplicação.

    Centraliza os includes que antes estavam espalhados no main.py.
    Mantém a ordem original para preservar precedência de rotas.

    Args:
        app: Instância do FastAPI
    """
    # ==================================================
    # ROUTERS DE AUTENTICAÇÃO E USUÁRIOS
    # ==================================================
    from auth.router import router as auth_router
    from users.router import router as users_router

    app.include_router(auth_router)
    app.include_router(users_router)

    # ==================================================
    # ROUTER DE ADMINISTRAÇÃO
    # ==================================================
    from admin.router import router as admin_router
    from admin.dashboard_router import router as dashboard_router
    from admin.router_performance import router as performance_router
    from admin.router_gemini_logs import router as gemini_logs_router

    app.include_router(admin_router)
    app.include_router(dashboard_router)
    app.include_router(performance_router)
    app.include_router(gemini_logs_router)

    # ==================================================
    # ROUTERS DOS SISTEMAS
    # ==================================================
    from sistemas.assistencia_judiciaria.router import router as assistencia_router
    from sistemas.matriculas_confrontantes.router import router as matriculas_router
    from sistemas.gerador_pecas.router import router as gerador_pecas_router
    from sistemas.gerador_pecas.router_admin import router as gerador_pecas_admin_router

    app.include_router(assistencia_router, prefix="/assistencia/api")
    app.include_router(matriculas_router, prefix="/matriculas/api")
    app.include_router(gerador_pecas_router, prefix="/gerador-pecas/api")
    app.include_router(gerador_pecas_admin_router, prefix="/admin/api")

    # Router de Prompts Modulares (admin)
    from admin.router_prompts import router as prompts_modulos_router
    app.include_router(prompts_modulos_router, prefix="/admin/api")

    # Router de Categorias de Formato JSON (admin)
    from sistemas.gerador_pecas.router_categorias_json import router as categorias_json_router
    app.include_router(categorias_json_router, prefix="/admin/api")

    # Router de Teste de Categorias JSON (admin)
    from sistemas.gerador_pecas.router_teste_categorias import router as teste_categorias_router
    app.include_router(teste_categorias_router, prefix="/admin/api")

    # Router de Teste de Ativacao de Modulos (admin)
    # TEMPORÁRIO: inclusão condicional até redeploy com arquivo models_teste_ativacao.py
    try:
        from sistemas.gerador_pecas.router_teste_ativacao import router as teste_ativacao_router
        app.include_router(teste_ativacao_router, prefix="/admin/api")
    except ImportError:
        pass  # Router não disponível neste ambiente

    # Routers de Extração (splitados de router_extraction.py)
    from sistemas.gerador_pecas.router_ext_questions import router as ext_questions_router
    from sistemas.gerador_pecas.router_ext_models import router as ext_models_router
    from sistemas.gerador_pecas.router_ext_variables import router as ext_variables_router
    from sistemas.gerador_pecas.router_ext_deps import router as ext_deps_router

    app.include_router(ext_questions_router, prefix="/admin/api/extraction")
    app.include_router(ext_models_router, prefix="/admin/api/extraction")
    app.include_router(ext_variables_router, prefix="/admin/api/extraction")
    app.include_router(ext_deps_router, prefix="/admin/api/extraction")

    # Router de Configuração de Tipos de Peça e Categorias de Documentos (admin)
    from sistemas.gerador_pecas.router_config_pecas import router as config_pecas_router
    app.include_router(config_pecas_router)

    # Router de Pedido de Cálculo
    from sistemas.pedido_calculo.router import router as pedido_calculo_router
    from sistemas.pedido_calculo.router_admin import router as pedido_calculo_admin_router

    app.include_router(pedido_calculo_router, prefix="/pedido-calculo/api")
    app.include_router(pedido_calculo_admin_router)  # Admin router - sem prefixo pois já tem no router

    # Router de Prestação de Contas
    from sistemas.prestacao_contas.router import router as prestacao_contas_router
    from sistemas.prestacao_contas.router_admin import router as prestacao_contas_admin_router

    app.include_router(prestacao_contas_router, prefix="/prestacao-contas/api")
    app.include_router(prestacao_contas_admin_router)  # Admin router - sem prefixo pois já tem no router

    # Router de Relatório de Cumprimento
    from sistemas.relatorio_cumprimento.router import router as relatorio_cumprimento_router
    app.include_router(relatorio_cumprimento_router, prefix="/relatorio-cumprimento/api")

    # Router de Cumprimento de Sentença Beta
    from sistemas.cumprimento_beta.router import router as cumprimento_beta_router
    app.include_router(cumprimento_beta_router, prefix="/api")

    # Router de Classificador de Documentos
    from sistemas.classificador_documentos.router import router as classificador_documentos_router
    app.include_router(classificador_documentos_router, prefix="/classificador/api")

    # Router de BERT Training
    from sistemas.bert_training.router import router as bert_training_router
    from sistemas.extrator_autos.router import router as extrator_autos_router

    app.include_router(bert_training_router)  # prefixo /bert-training já está no router
    app.include_router(extrator_autos_router)  # prefixo /extrator-autos/api já está no router

    # Router de Normalização de Texto
    from services.text_normalizer import text_normalizer_router
    app.include_router(text_normalizer_router)
