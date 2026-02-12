# sistemas/gerador_pecas/services_json_sync.py
"""
Servico de sincronizacao e reconciliacao de JSON de categorias.

Extraido de router_extraction.py (Fase 5a do plano de refatoracao).
Contem a logica de negocio dos endpoints:
- sincronizar_json_sem_ia (merge JSON sem IA)
- aplicar_json_nas_perguntas (reconciliacao bidirecional)

Tambem corrige o bug da funcao _variavel_na_regra que estava ausente.
"""

import json
import logging
import time
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models_extraction import (
    ExtractionQuestion, ExtractionVariable, PromptVariableUsage
)
from .models_resumo_json import CategoriaResumoJSON

logger = logging.getLogger(__name__)


class JsonSyncService:
    """Servico para sincronizacao e reconciliacao de JSON de categorias."""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # METODOS PUBLICOS
    # ========================================================================

    def sincronizar_json(self, categoria_id: int) -> dict:
        """
        Sincroniza o JSON da categoria com as perguntas cadastradas, SEM usar IA.

        Reconstroi o JSON a partir das perguntas ativas (BD como fonte de verdade).
        NAO salva automaticamente — retorna o JSON para o frontend decidir.

        Returns:
            dict com campos compativeis com SyncJsonResponse.
        """
        categoria = self.db.query(CategoriaResumoJSON).filter(
            CategoriaResumoJSON.id == categoria_id
        ).first()
        if not categoria:
            return {"success": False, "erro": "Categoria não encontrada"}

        try:
            perguntas = self.db.query(ExtractionQuestion).filter(
                ExtractionQuestion.categoria_id == categoria_id,
                ExtractionQuestion.ativo == True
            ).order_by(ExtractionQuestion.ordem, ExtractionQuestion.id).all()

            if not perguntas:
                return {
                    "success": True,
                    "extraction_schema": {},
                    "variaveis_adicionadas": 0,
                    "mensagem": "Nenhuma pergunta ativa encontrada para esta categoria"
                }

            # Carrega JSON atual da categoria
            try:
                json_atual = json.loads(categoria.formato_json) if categoria.formato_json else {}
            except json.JSONDecodeError as e:
                logger.warning(f"JSON inválido na categoria {categoria_id}: {e}")
                json_atual = {}

            # Valida perguntas e identifica incompletas
            perguntas_incompletas = []
            perguntas_validas = []
            namespace = categoria.namespace if categoria.namespace else ""

            # Coleta indice expandido de slugs validos para validar dependencias
            slugs_validos = set()
            slugs_por_id = {}

            for p in perguntas:
                if p.nome_variavel_sugerido and p.nome_variavel_sugerido.strip():
                    slug_completo = p.nome_variavel_sugerido.strip()
                    nome_base = self._remover_prefixo(slug_completo, namespace)

                    slugs_validos.add(slug_completo)
                    slugs_validos.add(self._normalizar_para_lookup(slug_completo))
                    if nome_base != slug_completo:
                        slugs_validos.add(nome_base)
                        slugs_validos.add(self._normalizar_para_lookup(nome_base))

                    slugs_por_id[p.id] = slug_completo

            for p in perguntas:
                slug = p.nome_variavel_sugerido
                tipo = p.tipo_sugerido

                if not slug or not slug.strip():
                    perguntas_incompletas.append({
                        "id": p.id,
                        "pergunta": p.pergunta[:100] + "..." if len(p.pergunta) > 100 else p.pergunta,
                        "problema": "Falta nome/slug da variável"
                    })
                    continue

                if not tipo or not tipo.strip():
                    perguntas_incompletas.append({
                        "id": p.id,
                        "pergunta": p.pergunta[:100] + "..." if len(p.pergunta) > 100 else p.pergunta,
                        "slug": slug,
                        "problema": "Falta tipo da variável"
                    })
                    continue

                # Valida dependencia
                if p.depends_on_variable and not self._dependencia_existe(
                    p.depends_on_variable, slugs_validos
                ):
                    slugs_disponiveis = sorted([
                        s for s in slugs_validos
                        if not s.islower() or s == self._normalizar_para_lookup(s)
                    ])[:10]

                    perguntas_incompletas.append({
                        "id": p.id,
                        "pergunta": p.pergunta[:100] + "..." if len(p.pergunta) > 100 else p.pergunta,
                        "slug": slug,
                        "problema": f"Dependência inválida: variável '{p.depends_on_variable}' não encontrada. "
                                   f"Slugs disponíveis: {slugs_disponiveis}"
                    })
                    continue

                perguntas_validas.append(p)

            # Se ha perguntas incompletas, retorna erro
            if perguntas_incompletas:
                logger.warning(
                    f"Sincronização JSON categoria {categoria_id} falhou: "
                    f"{len(perguntas_incompletas)} pergunta(s) incompleta(s): "
                    f"{[p['problema'] for p in perguntas_incompletas]}"
                )
                return {
                    "success": False,
                    "perguntas_incompletas": perguntas_incompletas,
                    "erro": f"Não foi possível atualizar: {len(perguntas_incompletas)} pergunta(s) incompleta(s)"
                }

            # SEMPRE reconstroi o JSON a partir do BD (fonte da verdade)
            json_novo = {}
            variaveis_adicionadas = []
            variaveis_modificadas = []

            for p in perguntas_validas:
                slug = p.nome_variavel_sugerido.strip()
                tipo = p.tipo_sugerido.strip().lower()

                config = {
                    "type": tipo,
                    "description": p.pergunta
                }

                if p.depends_on_variable:
                    config["conditional"] = True
                    config["depends_on"] = p.depends_on_variable
                    if p.dependency_operator:
                        config["dependency_operator"] = p.dependency_operator
                    if p.dependency_value is not None:
                        config["dependency_value"] = p.dependency_value

                if p.dependency_config:
                    config["dependency_config"] = p.dependency_config

                if tipo == "choice" and p.opcoes_sugeridas:
                    config["options"] = p.opcoes_sugeridas

                if hasattr(p, 'required') and p.required is not None:
                    config["required"] = p.required

                if slug in json_atual:
                    if not self._configs_sao_iguais(config, json_atual[slug]):
                        variaveis_modificadas.append(slug)
                else:
                    variaveis_adicionadas.append(slug)

                json_novo[slug] = config

            # Campos orfaos sao removidos propositalmente
            variaveis_removidas = [chave for chave in json_atual.keys() if chave not in json_novo]
            if variaveis_removidas:
                logger.info(f"Variáveis removidas do JSON (sem pergunta ativa): {variaveis_removidas}")

            # Detecta se houve alteracao real
            json_atual_normalizado = self._normalizar_para_comparacao(json_atual)
            json_novo_normalizado = self._normalizar_para_comparacao(json_novo)
            houve_alteracao = json_atual_normalizado != json_novo_normalizado

            # Monta mensagem
            if variaveis_adicionadas or variaveis_modificadas or variaveis_removidas or houve_alteracao:
                partes_mensagem = []
                if variaveis_adicionadas:
                    partes_mensagem.append(f"{len(variaveis_adicionadas)} variável(is) adicionada(s)")
                if variaveis_modificadas:
                    partes_mensagem.append(f"{len(variaveis_modificadas)} variável(is) atualizada(s)")
                if variaveis_removidas:
                    partes_mensagem.append(f"{len(variaveis_removidas)} variável(is) órfã(s) removida(s)")
                if not variaveis_adicionadas and not variaveis_modificadas and not variaveis_removidas and houve_alteracao:
                    partes_mensagem.append("estrutura/ordem atualizada")
                mensagem = "JSON atualizado: " + ", ".join(partes_mensagem)
            else:
                mensagem = "Nada para atualizar - JSON já está sincronizado com o banco de dados"

            logger.info(
                f"Sincronização JSON categoria {categoria_id}: "
                f"{len(variaveis_adicionadas)} adicionadas, "
                f"{len(variaveis_modificadas)} modificadas, "
                f"{len(variaveis_removidas)} removidas, "
                f"houve_alteracao={houve_alteracao}"
            )

            return {
                "success": True,
                "extraction_schema": json_novo,
                "variaveis_adicionadas": len(variaveis_adicionadas),
                "variaveis_adicionadas_lista": variaveis_adicionadas if variaveis_adicionadas else None,
                "variaveis_modificadas": len(variaveis_modificadas),
                "variaveis_modificadas_lista": variaveis_modificadas if variaveis_modificadas else None,
                "variaveis_removidas": len(variaveis_removidas),
                "variaveis_removidas_lista": variaveis_removidas if variaveis_removidas else None,
                "houve_alteracao": houve_alteracao,
                "mensagem": mensagem
            }

        except Exception as e:
            import traceback
            erro_detalhado = traceback.format_exc()
            logger.error(
                f"Erro ao sincronizar JSON da categoria {categoria_id}: {str(e)}\n"
                f"Stacktrace:\n{erro_detalhado}"
            )
            return {"success": False, "erro": f"Erro ao sincronizar JSON: {str(e)}"}

    def reconciliar_json(
        self,
        categoria_id: int,
        json_content: str,
        confirmar_remocao_variaveis_em_uso: bool,
        user_id: int
    ) -> dict:
        """
        Aplica o JSON como fonte de verdade, reconciliando perguntas e variaveis.

        Faz sincronizacao bidirecional: cria, atualiza e remove conforme diff.

        Returns:
            dict com campos compativeis com AplicarJsonResponse.
        """
        start_time = time.time()

        categoria = self.db.query(CategoriaResumoJSON).filter(
            CategoriaResumoJSON.id == categoria_id
        ).first()
        if not categoria:
            return {
                "success": False,
                "erro": "Categoria não encontrada",
                "tempo_ms": int((time.time() - start_time) * 1000)
            }

        # 1. PARSEIA E VALIDA O JSON
        try:
            novo_json = json.loads(json_content)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "erro": f"JSON inválido: {str(e)}",
                "tempo_ms": int((time.time() - start_time) * 1000)
            }

        if not isinstance(novo_json, dict):
            return {
                "success": False,
                "erro": "JSON deve ser um objeto (dicionário), não um array ou valor primitivo",
                "tempo_ms": int((time.time() - start_time) * 1000)
            }

        # 2. EXTRAI CAMPOS DO JSON E VALIDA ESTRUTURA
        campos_json = {}
        erros_validacao = []

        for slug, campo_info in novo_json.items():
            if not isinstance(campo_info, dict):
                campos_json[slug] = {
                    "type": self._normalizar_tipo(str(campo_info)) if campo_info else "text",
                    "description": f"Campo {slug}",
                    "options": None,
                    "depends_on": None,
                    "depends_value": None,
                    "depends_operator": None
                }
                continue

            tipo = self._normalizar_tipo(campo_info.get("type", "text"))
            descricao = campo_info.get("description", campo_info.get("pergunta", f"Campo {slug}"))
            opcoes = campo_info.get("options", campo_info.get("opcoes"))

            if opcoes and not isinstance(opcoes, list):
                opcoes = [str(opcoes)]

            depends_on = (
                campo_info.get("depends_on") or
                campo_info.get("conditional") or
                campo_info.get("depends_on_variable")
            )
            depends_value = campo_info.get("depends_value", campo_info.get("dependency_value"))
            depends_operator = campo_info.get("depends_operator", campo_info.get("dependency_operator", "equals"))

            if isinstance(depends_on, dict):
                depends_value = depends_on.get("value", depends_on.get("equals"))
                depends_on = depends_on.get("field", depends_on.get("variable"))

            campos_json[slug] = {
                "type": tipo,
                "description": descricao,
                "options": opcoes,
                "depends_on": depends_on,
                "depends_value": depends_value,
                "depends_operator": depends_operator
            }

        # 3. VALIDA DEPENDENCIAS
        slugs_json = set(campos_json.keys())
        for slug, info in campos_json.items():
            if info["depends_on"]:
                dep = info["depends_on"]
                namespace = categoria.namespace or ""
                dep_normalizado = dep
                if namespace and dep.startswith(namespace + "_"):
                    dep_normalizado = dep[len(namespace) + 1:]

                if dep not in slugs_json and dep_normalizado not in slugs_json:
                    dep_com_prefixo = f"{namespace}_{dep}" if namespace else dep
                    if dep_com_prefixo not in slugs_json:
                        erros_validacao.append({
                            "slug": slug,
                            "erro": f"Dependência inválida: '{dep}' não existe no JSON",
                            "sugestao": f"Slugs disponíveis: {sorted(list(slugs_json)[:10])}"
                        })

        if erros_validacao:
            return {
                "success": False,
                "erro": f"JSON contém {len(erros_validacao)} erro(s) de validação",
                "erros_validacao": erros_validacao,
                "tempo_ms": int((time.time() - start_time) * 1000)
            }

        # 4. CARREGA ESTADO ATUAL DO BD
        perguntas_atuais = self.db.query(ExtractionQuestion).filter(
            ExtractionQuestion.categoria_id == categoria_id
        ).all()
        perguntas_por_slug = {
            p.nome_variavel_sugerido: p for p in perguntas_atuais if p.nome_variavel_sugerido
        }

        variaveis_atuais = self.db.query(ExtractionVariable).filter(
            ExtractionVariable.categoria_id == categoria_id
        ).all()
        variaveis_por_slug = {v.slug: v for v in variaveis_atuais}

        # 5. CALCULA DIFF
        slugs_bd = set(perguntas_por_slug.keys()) | set(variaveis_por_slug.keys())
        to_create = slugs_json - slugs_bd
        to_update = slugs_json & slugs_bd
        to_delete = slugs_bd - slugs_json

        # 5.1 VERIFICACAO DE SEGURANCA: variaveis em uso como condicao de ativacao
        if to_delete and not confirmar_remocao_variaveis_em_uso:
            from admin.models_prompts import PromptModulo
            from .schemas_extraction import VariavelEmUsoDetalhe

            variaveis_em_uso = []
            for slug in to_delete:
                usos = self.db.query(PromptVariableUsage).filter(
                    PromptVariableUsage.variable_slug == slug
                ).all()

                if usos:
                    prompt_ids = [u.prompt_id for u in usos]
                    prompts = self.db.query(PromptModulo).filter(
                        PromptModulo.id.in_(prompt_ids)
                    ).all()

                    prompts_info = []
                    for p in prompts:
                        tipo_uso = []
                        if p.regra_deterministica:
                            regra_json = (
                                p.regra_deterministica
                                if isinstance(p.regra_deterministica, dict)
                                else json.loads(p.regra_deterministica)
                            )
                            if self._variavel_na_regra(slug, regra_json):
                                tipo_uso.append("regra_primaria")
                        if p.regra_deterministica_secundaria:
                            regra_sec_json = (
                                p.regra_deterministica_secundaria
                                if isinstance(p.regra_deterministica_secundaria, dict)
                                else json.loads(p.regra_deterministica_secundaria)
                            )
                            if self._variavel_na_regra(slug, regra_sec_json):
                                tipo_uso.append("regra_secundaria")

                        prompts_info.append({
                            "id": p.id,
                            "nome": p.nome,
                            "titulo": p.titulo,
                            "tipo_uso": tipo_uso
                        })

                    variavel = variaveis_por_slug.get(slug)
                    variaveis_em_uso.append(VariavelEmUsoDetalhe(
                        slug=slug,
                        label=variavel.label if variavel else slug,
                        prompts=prompts_info
                    ))

            if variaveis_em_uso:
                return {
                    "success": False,
                    "requer_confirmacao": True,
                    "variaveis_em_uso_condicoes": variaveis_em_uso,
                    "mensagem": f"{len(variaveis_em_uso)} variável(is) a remover está(ão) em uso como condição de ativação",
                    "erro": "VARIAVEIS_EM_USO_CONDICOES",
                    "tempo_ms": int((time.time() - start_time) * 1000)
                }

        # Contadores e detalhes
        perguntas_criadas = 0
        perguntas_atualizadas = 0
        perguntas_removidas = 0
        variaveis_criadas = 0
        variaveis_atualizadas = 0
        variaveis_removidas = 0
        lista_criadas = []
        lista_atualizadas = []
        lista_removidas = []

        # 6. PROCESSA CRIACOES E ATUALIZACOES NA ORDEM DO JSON
        slugs_json_ordenados = list(novo_json.keys())

        for ordem_json, slug in enumerate(slugs_json_ordenados):
            if slug not in campos_json:
                continue

            info = campos_json[slug]

            if slug in to_create:
                nova_pergunta = ExtractionQuestion(
                    categoria_id=categoria_id,
                    pergunta=info["description"],
                    nome_variavel_sugerido=slug,
                    tipo_sugerido=info["type"],
                    opcoes_sugeridas=info["options"],
                    depends_on_variable=info["depends_on"],
                    dependency_operator=info["depends_operator"],
                    dependency_value=info["depends_value"],
                    ativo=True,
                    ordem=ordem_json,
                    criado_por=user_id,
                    atualizado_por=user_id
                )
                self.db.add(nova_pergunta)
                self.db.flush()
                perguntas_criadas += 1

                nova_variavel = ExtractionVariable(
                    slug=slug,
                    label=info["description"][:200] if len(info["description"]) > 200 else info["description"],
                    descricao=info["description"],
                    tipo=info["type"],
                    opcoes=info["options"],
                    categoria_id=categoria_id,
                    source_question_id=nova_pergunta.id,
                    depends_on_variable=info["depends_on"],
                    is_conditional=bool(info["depends_on"]),
                    ativo=True
                )
                self.db.add(nova_variavel)
                variaveis_criadas += 1
                lista_criadas.append(slug)

                logger.info(f"[AplicarJSON] Criado: slug={slug}, tipo={info['type']}, ordem={ordem_json}")

            elif slug in to_update:
                houve_mudanca = False

                if slug in perguntas_por_slug:
                    pergunta = perguntas_por_slug[slug]

                    if pergunta.ordem != ordem_json:
                        pergunta.ordem = ordem_json
                        houve_mudanca = True
                    if pergunta.tipo_sugerido != info["type"]:
                        pergunta.tipo_sugerido = info["type"]
                        houve_mudanca = True
                    if pergunta.pergunta != info["description"]:
                        pergunta.pergunta = info["description"]
                        houve_mudanca = True
                    if pergunta.opcoes_sugeridas != info["options"]:
                        pergunta.opcoes_sugeridas = info["options"]
                        houve_mudanca = True
                    if pergunta.depends_on_variable != info["depends_on"]:
                        pergunta.depends_on_variable = info["depends_on"]
                        pergunta.dependency_operator = info["depends_operator"]
                        pergunta.dependency_value = info["depends_value"]
                        houve_mudanca = True
                    if not pergunta.ativo:
                        pergunta.ativo = True
                        houve_mudanca = True

                    if houve_mudanca:
                        pergunta.atualizado_por = user_id
                        pergunta.atualizado_em = datetime.utcnow()
                        perguntas_atualizadas += 1

                if slug in variaveis_por_slug:
                    variavel = variaveis_por_slug[slug]
                    var_mudou = False

                    if variavel.tipo != info["type"]:
                        variavel.tipo = info["type"]
                        var_mudou = True
                    if variavel.descricao != info["description"]:
                        variavel.descricao = info["description"]
                        variavel.label = info["description"][:200] if len(info["description"]) > 200 else info["description"]
                        var_mudou = True
                    if variavel.opcoes != info["options"]:
                        variavel.opcoes = info["options"]
                        var_mudou = True
                    if variavel.depends_on_variable != info["depends_on"]:
                        variavel.depends_on_variable = info["depends_on"]
                        variavel.is_conditional = bool(info["depends_on"])
                        var_mudou = True
                    if not variavel.ativo:
                        variavel.ativo = True
                        var_mudou = True

                    if var_mudou:
                        variavel.atualizado_em = datetime.utcnow()
                        variaveis_atualizadas += 1
                        houve_mudanca = True

                if houve_mudanca:
                    lista_atualizadas.append(slug)
                    logger.info(f"[AplicarJSON] Atualizado: slug={slug}, ordem={ordem_json}")

        # 7. PROCESSA REMOCOES
        for slug in sorted(to_delete):
            uso_prompts = self.db.query(PromptVariableUsage).filter(
                PromptVariableUsage.variable_slug == slug
            ).count()

            outras_categorias = self.db.query(ExtractionVariable).filter(
                ExtractionVariable.slug == slug,
                ExtractionVariable.categoria_id != categoria_id,
                ExtractionVariable.ativo == True
            ).count()

            if slug in perguntas_por_slug:
                pergunta = perguntas_por_slug[slug]
                if uso_prompts > 0:
                    pergunta.ativo = False
                    pergunta.atualizado_por = user_id
                    pergunta.atualizado_em = datetime.utcnow()
                else:
                    self.db.delete(pergunta)
                perguntas_removidas += 1

            if slug in variaveis_por_slug:
                variavel = variaveis_por_slug[slug]
                if outras_categorias > 0:
                    variavel.categoria_id = None
                    variavel.atualizado_em = datetime.utcnow()
                elif uso_prompts > 0:
                    variavel.ativo = False
                    variavel.atualizado_em = datetime.utcnow()
                else:
                    self.db.query(ExtractionQuestion).filter(
                        ExtractionQuestion.depends_on_variable == slug
                    ).update({
                        ExtractionQuestion.depends_on_variable: None,
                        ExtractionQuestion.dependency_operator: None,
                        ExtractionQuestion.dependency_value: None
                    })
                    self.db.query(ExtractionVariable).filter(
                        ExtractionVariable.depends_on_variable == slug
                    ).update({
                        ExtractionVariable.depends_on_variable: None,
                        ExtractionVariable.is_conditional: False
                    })
                    self.db.delete(variavel)
                variaveis_removidas += 1

            lista_removidas.append(slug)
            logger.info(
                f"[AplicarJSON] Removido: slug={slug}, "
                f"uso_prompts={uso_prompts}, outras_cats={outras_categorias}"
            )

        # 8. ATUALIZA O JSON DA CATEGORIA
        categoria.formato_json = json_content
        categoria.atualizado_em = datetime.utcnow()

        # 9. COMMIT DA TRANSACAO
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"[AplicarJSON] Erro ao commitar: {e}")
            return {
                "success": False,
                "erro": f"Erro ao salvar alterações: {str(e)}",
                "tempo_ms": int((time.time() - start_time) * 1000)
            }

        tempo_ms = int((time.time() - start_time) * 1000)

        # Monta mensagem
        partes = []
        if perguntas_criadas:
            partes.append(f"{perguntas_criadas} pergunta(s) criada(s)")
        if perguntas_atualizadas:
            partes.append(f"{perguntas_atualizadas} pergunta(s) atualizada(s)")
        if perguntas_removidas:
            partes.append(f"{perguntas_removidas} pergunta(s) removida(s)")
        if variaveis_criadas:
            partes.append(f"{variaveis_criadas} variável(is) criada(s)")
        if variaveis_atualizadas:
            partes.append(f"{variaveis_atualizadas} variável(is) atualizada(s)")
        if variaveis_removidas:
            partes.append(f"{variaveis_removidas} variável(is) removida(s)")

        if partes:
            mensagem = "Aplicação concluída: " + ", ".join(partes)
        else:
            mensagem = "Nenhuma alteração necessária - JSON já estava sincronizado"

        logger.info(
            f"[AplicarJSON] categoria_id={categoria_id}, "
            f"criadas={len(lista_criadas)}, atualizadas={len(lista_atualizadas)}, "
            f"removidas={len(lista_removidas)}, tempo={tempo_ms}ms"
        )

        return {
            "success": True,
            "perguntas_criadas": perguntas_criadas,
            "perguntas_atualizadas": perguntas_atualizadas,
            "perguntas_removidas": perguntas_removidas,
            "variaveis_criadas": variaveis_criadas,
            "variaveis_atualizadas": variaveis_atualizadas,
            "variaveis_removidas": variaveis_removidas,
            "criadas": lista_criadas,
            "atualizadas": lista_atualizadas,
            "removidas": lista_removidas,
            "mensagem": mensagem,
            "tempo_ms": tempo_ms
        }

    # ========================================================================
    # HELPERS PRIVADOS
    # ========================================================================

    @staticmethod
    def _variavel_na_regra(slug: str, regra_json: dict) -> bool:
        """
        Verifica se um slug de variavel aparece em uma regra deterministica (AST JSON).

        Percorre recursivamente a arvore da regra buscando o campo 'variable'.
        Corrige o bug onde esta funcao era chamada mas nao existia.
        """
        if not regra_json or not isinstance(regra_json, dict):
            return False

        # Verifica se esta condicao usa a variavel
        if regra_json.get("variable") == slug:
            return True

        # Percorre condicoes compostas (and/or)
        for condicao in regra_json.get("conditions", []):
            if JsonSyncService._variavel_na_regra(slug, condicao):
                return True

        return False

    @staticmethod
    def _normalizar_para_lookup(valor: str) -> str:
        """Normaliza valor para comparacao (lowercase, strip)."""
        return valor.strip().lower() if valor else ""

    @staticmethod
    def _normalizar_para_comparacao(obj: Any) -> Any:
        """Normaliza objeto para comparacao estrutural (ordena chaves, arrays)."""
        if isinstance(obj, dict):
            return {k: JsonSyncService._normalizar_para_comparacao(obj[k]) for k in sorted(obj.keys())}
        elif isinstance(obj, list):
            if obj and isinstance(obj[0], dict):
                if 'id' in obj[0]:
                    return sorted(
                        [JsonSyncService._normalizar_para_comparacao(item) for item in obj],
                        key=lambda x: str(x.get('id', ''))
                    )
                elif 'value' in obj[0]:
                    return sorted(
                        [JsonSyncService._normalizar_para_comparacao(item) for item in obj],
                        key=lambda x: str(x.get('value', ''))
                    )
            return [JsonSyncService._normalizar_para_comparacao(item) for item in obj]
        return obj

    @staticmethod
    def _configs_sao_iguais(config_bd: dict, config_json: dict) -> bool:
        """Compara se duas configuracoes sao estruturalmente iguais."""
        return (
            JsonSyncService._normalizar_para_comparacao(config_bd)
            == JsonSyncService._normalizar_para_comparacao(config_json)
        )

    @staticmethod
    def _normalizar_tipo(tipo_raw: str) -> str:
        """Normaliza tipos do JSON para tipos do sistema."""
        if not tipo_raw:
            return "text"
        tipo = tipo_raw.lower().strip()
        mapeamento = {
            "string": "text",
            "texto": "text",
            "text": "text",
            "number": "number",
            "numero": "number",
            "integer": "number",
            "int": "number",
            "float": "number",
            "boolean": "boolean",
            "bool": "boolean",
            "sim/nao": "boolean",
            "sim/não": "boolean",
            "date": "date",
            "data": "date",
            "datetime": "date",
            "choice": "choice",
            "escolha": "choice",
            "enum": "choice",
            "select": "choice",
            "list": "list",
            "lista": "list",
            "array": "list",
            "currency": "currency",
            "moeda": "currency",
            "monetario": "currency",
            "monetário": "currency",
        }
        return mapeamento.get(tipo, "text")

    @staticmethod
    def _remover_prefixo(slug: str, ns: str) -> str:
        """Remove prefixo de namespace do slug se presente."""
        if not slug or not ns:
            return slug or ""
        prefixo = ns + "_"
        if slug.startswith(prefixo):
            return slug[len(prefixo):]
        return slug

    @staticmethod
    def _dependencia_existe(depends_on: str, slugs_validos: set) -> bool:
        """Verifica se dependencia existe (por slug completo ou nome base)."""
        if not depends_on:
            return True
        valor_normalizado = JsonSyncService._normalizar_para_lookup(depends_on)
        return depends_on in slugs_validos or valor_normalizado in slugs_validos
