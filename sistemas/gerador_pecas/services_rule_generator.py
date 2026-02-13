"""Gerador de regras deterministicas (AST JSON) via LLM."""

import json
import re
import logging
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session

from services.gemini_service import gemini_service
from .models_extraction import ExtractionVariable
from .services_mode_resolution import _get_config_sistemas_acessorios

logger = logging.getLogger(__name__)


# Modelo padrao (pode ser sobrescrito por config do banco)
GEMINI_MODEL_DEFAULT = "gemini-3-flash-preview"


class DeterministicRuleGenerator:
    """
    Gerador de regras determinísticas usando IA.

    Converte condições em linguagem natural para AST JSON
    que pode ser avaliado sem LLM no runtime.
    """

    def __init__(self, db: Session):
        self.db = db

    async def gerar_regra(
        self,
        condicao_texto: str,
        contexto: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gera uma regra determinística a partir de texto em linguagem natural.

        Args:
            condicao_texto: Condição em linguagem natural
            contexto: Contexto adicional (ex: tipo de peça, grupo)

        Returns:
            Dict com success, regra (AST), variaveis_usadas ou erro
        """
        try:
            # 1. Busca variáveis disponíveis para contexto
            variaveis_disponiveis = self._buscar_variaveis_disponiveis()

            # Log detalhado das variáveis disponíveis para diagnóstico
            slugs_disponiveis = [v['slug'] for v in variaveis_disponiveis]
            vars_sistema = [v for v in variaveis_disponiveis if v.get('fonte') == 'processo_sistema']
            slugs_sistema = [v['slug'] for v in vars_sistema]

            logger.info(
                f"[REGRA-DETERMINISTICO] Variáveis disponíveis: {len(variaveis_disponiveis)} total"
            )
            logger.info(
                f"[REGRA-DETERMINISTICO] Variáveis de SISTEMA incluídas: {len(vars_sistema)} - "
                f"Slugs: {slugs_sistema}"
            )

            # 2. Monta prompt para a IA
            prompt = self._montar_prompt_geracao(
                condicao_texto,
                variaveis_disponiveis,
                contexto
            )

            # 3. Chama o Gemini
            logger.info(f"Gerando regra determinística: '{condicao_texto[:100]}...'")

            # Busca configurações do banco (sistema "sistemas_acessorios")
            # Se não houver config, usa valores padrão conservadores
            modelo = _get_config_sistemas_acessorios(
                self.db, "gerador_regras_modelo", GEMINI_MODEL_DEFAULT
            )
            thinking_level = _get_config_sistemas_acessorios(
                self.db, "gerador_regras_thinking_level", "low"  # Padrão: LOW para ser direto
            )
            temperatura_str = _get_config_sistemas_acessorios(
                self.db, "gerador_regras_temperatura", "0.1"
            )
            try:
                temperatura = float(temperatura_str)
            except (ValueError, TypeError):
                temperatura = 0.1

            logger.info(
                f"[REGRA-DETERMINISTICO] Config: modelo={modelo}, "
                f"thinking_level={thinking_level}, temperatura={temperatura}"
            )

            response = await gemini_service.generate(
                prompt=prompt,
                system_prompt=self._get_system_prompt(),
                model=modelo,
                temperature=temperatura,
                thinking_level=thinking_level if thinking_level else None,
                context={
                    "sistema": "extracao",
                    "modulo": "regras_deterministicas",
                    "operacao": "gerar_regra"
                }
            )

            if not response.success:
                logger.error(f"Erro na chamada Gemini: {response.error}")
                return {"success": False, "erro": f"Erro na IA: {response.error}"}

            # Log da resposta bruta para diagnóstico
            logger.info(f"[REGRA-DETERMINISTICO] Resposta IA (primeiros 500 chars): {response.content[:500]}")

            # 4. Parseia a resposta JSON
            resultado = self._extrair_json_resposta(response.content)

            if not resultado:
                logger.error(f"Resposta IA não é JSON válido: {response.content[:500]}")
                return {"success": False, "erro": "A IA não retornou um JSON válido"}

            # 4.1 Verifica se IA indicou variáveis insuficientes
            if resultado.get("erro") == "variaveis_insuficientes":
                logger.warning(
                    f"[REGRA-DETERMINISTICO] IA indicou variáveis insuficientes. "
                    f"Condição: '{condicao_texto}'. "
                    f"Total variáveis disponíveis: {len(slugs_disponiveis)}. "
                    f"Variáveis de SISTEMA disponíveis: {slugs_sistema}. "
                    f"Mensagem IA: {resultado.get('mensagem')}. "
                    f"Variáveis necessárias sugeridas: {resultado.get('variaveis_necessarias')}"
                )
                return {
                    "success": False,
                    "erro": "variaveis_insuficientes",
                    "mensagem": resultado.get("mensagem", "Não há variáveis suficientes para expressar esta condição"),
                    "variaveis_necessarias": resultado.get("variaveis_necessarias", [])
                }

            regra = resultado.get("regra")
            variaveis_usadas = resultado.get("variaveis_usadas", [])

            if not regra:
                return {"success": False, "erro": "Regra não encontrada na resposta"}

            # 5. Valida a regra
            validacao = self._validar_regra(regra, variaveis_disponiveis)

            if not validacao["valid"]:
                logger.warning(
                    f"[REGRA-DETERMINISTICO] Regra inválida. "
                    f"Erros: {validacao['errors']}. "
                    f"Variáveis faltantes: {validacao.get('variaveis_faltantes')}"
                )
                return {
                    "success": False,
                    "erro": "Regra inválida",
                    "detalhes": validacao["errors"],
                    "variaveis_faltantes": validacao.get("variaveis_faltantes", []),
                    "sugestoes_variaveis": validacao.get("sugestoes_variaveis", [])
                }

            logger.info(f"Regra gerada com sucesso: {len(variaveis_usadas)} variáveis usadas")

            return {
                "success": True,
                "regra": regra,
                "variaveis_usadas": variaveis_usadas,
                "regra_texto_original": condicao_texto
            }

        except Exception as e:
            logger.exception(f"Erro ao gerar regra: {e}")
            return {"success": False, "erro": str(e)}

    def _get_system_prompt(self) -> str:
        """Retorna o prompt de sistema para geração de regras."""
        return """Você é um especialista em converter condições em linguagem natural para regras estruturadas (AST JSON).

Sua tarefa é converter uma condição textual em uma estrutura JSON que pode ser avaliada programaticamente.

OPERADORES DISPONÍVEIS:
- "equals": Igualdade exata
- "not_equals": Diferente de
- "contains": Contém texto (case insensitive)
- "not_contains": Não contém texto
- "starts_with": Começa com
- "ends_with": Termina com
- "greater_than": Maior que (números)
- "less_than": Menor que (números)
- "greater_or_equal": Maior ou igual
- "less_or_equal": Menor ou igual
- "is_empty": Está vazio/nulo
- "is_not_empty": Não está vazio
- "in_list": Está na lista
- "not_in_list": Não está na lista
- "matches_regex": Corresponde ao regex
- "exists": Variável existe e foi extraída (útil para variáveis condicionais)
- "not_exists": Variável não existe ou não foi extraída

OPERADORES LÓGICOS:
- "and": Todas as condições devem ser verdadeiras
- "or": Pelo menos uma condição deve ser verdadeira
- "not": Negação

FORMATO DA REGRA (AST JSON):
{
    "type": "condition" | "and" | "or" | "not",
    "variable": "nome_variavel",  // apenas para type=condition
    "operator": "equals" | "contains" | etc,  // apenas para type=condition
    "value": "valor_comparacao",  // apenas para type=condition
    "conditions": [...]  // para and/or/not
}

EXEMPLOS:

1. "O valor da causa é maior que 100000"
{
    "type": "condition",
    "variable": "valor_causa_numerico",
    "operator": "greater_than",
    "value": 100000
}

2. "O autor é idoso ou hipossuficiente"
{
    "type": "or",
    "conditions": [
        {"type": "condition", "variable": "autor_idoso", "operator": "equals", "value": true},
        {"type": "condition", "variable": "autor_hipossuficiente", "operator": "equals", "value": true}
    ]
}

3. "O medicamento é de alto custo e não está na lista RENAME"
{
    "type": "and",
    "conditions": [
        {"type": "condition", "variable": "medicamento_alto_custo", "operator": "equals", "value": true},
        {"type": "condition", "variable": "medicamento_rename", "operator": "equals", "value": false}
    ]
}

4. "Quando for pleiteado medicamento e ele for não incorporado ao SUS ou não incorporado para patologia" (agrupamento lógico)
{
    "type": "and",
    "conditions": [
        {"type": "condition", "variable": "pleiteado_medicamento", "operator": "equals", "value": true},
        {
            "type": "or",
            "conditions": [
                {"type": "condition", "variable": "nao_incorporado_sus", "operator": "equals", "value": true},
                {"type": "condition", "variable": "nao_incorporado_patologia", "operator": "equals", "value": true}
            ]
        }
    ]
}

5. "O autor é idoso ou (o valor é alto e urgente)" (agrupamento com OR externo)
{
    "type": "or",
    "conditions": [
        {"type": "condition", "variable": "autor_idoso", "operator": "equals", "value": true},
        {
            "type": "and",
            "conditions": [
                {"type": "condition", "variable": "valor_alto", "operator": "equals", "value": true},
                {"type": "condition", "variable": "urgente", "operator": "equals", "value": true}
            ]
        }
    ]
}

6. "Valor da causa igual ou superior a 210 salários mínimos" (usa variável booleana pré-calculada)
{
    "type": "condition",
    "variable": "valor_causa_superior_210sm",
    "operator": "equals",
    "value": true
}

7. "Valor da causa inferior a 60 salários mínimos" (usa variável booleana pré-calculada)
{
    "type": "condition",
    "variable": "valor_causa_inferior_60sm",
    "operator": "equals",
    "value": true
}

8. "A União está no polo passivo" (usa variável do grupo Sistema)
{
    "type": "condition",
    "variable": "uniao_polo_passivo",
    "operator": "equals",
    "value": true
}

9. "Município no polo passivo e valor da causa superior a 210 SM"
{
    "type": "and",
    "conditions": [
        {"type": "condition", "variable": "municipio_polo_passivo", "operator": "equals", "value": true},
        {"type": "condition", "variable": "valor_causa_superior_210sm", "operator": "equals", "value": true}
    ]
}

10. "Parecer do NAT analisou medicamento não incorporado E valor >= 210 SM E União não está no polo passivo E ajuizado após 19/09/2024"
{
    "type": "and",
    "conditions": [
        {"type": "condition", "variable": "pareceres_medicamento_nao_incorporado_sus", "operator": "equals", "value": true},
        {"type": "condition", "variable": "valor_causa_superior_210sm", "operator": "equals", "value": true},
        {"type": "condition", "variable": "uniao_polo_passivo", "operator": "equals", "value": false},
        {"type": "condition", "variable": "processo_ajuizado_apos_2024_09_19", "operator": "equals", "value": true}
    ]
}

IMPORTANTE - VARIÁVEIS DO GRUPO "SISTEMA" (PRÉ-CALCULADAS):
Estas variáveis são calculadas automaticamente a partir do processo e SEMPRE existem:
- processo_ajuizado_apos_2024_09_19: TRUE se ajuizado APÓS 19/09/2024
- valor_causa_numerico: Valor da causa como número (float)
- valor_causa_inferior_60sm: TRUE se valor < 60 salários mínimos (R$ 97.260)
- valor_causa_superior_210sm: TRUE se valor > 210 salários mínimos (R$ 340.410)
- uniao_polo_passivo: TRUE se União/órgão federal está no polo passivo
- municipio_polo_passivo: TRUE se algum município está no polo passivo
- estado_polo_passivo: TRUE se o Estado está no polo passivo
- autor_com_assistencia_judiciaria: TRUE se autor tem assistência judiciária
- autor_com_defensoria: TRUE se autor é representado por Defensoria

IMPORTANTE - VARIÁVEIS DE PARECERES (NAT):
- pareceres_medicamento_nao_incorporado_sus: TRUE se parecer do NAT analisou medicamento NÃO incorporado ao SUS
- pareceres_medicamento_incorporado_sus: TRUE se parecer do NAT analisou medicamento incorporado ao SUS
- pareceres_analisou_medicamento: TRUE se parecer analisou qualquer medicamento

PREFIRA usar essas variáveis booleanas pré-calculadas quando a condição envolver:
- Valores em salários mínimos → use valor_causa_inferior_60sm ou valor_causa_superior_210sm
- Competência/litisconsórcio → use uniao_polo_passivo, municipio_polo_passivo, estado_polo_passivo
- Datas de ajuizamento → use processo_ajuizado_apos_2024_09_19
- Parecer NAT com medicamento → use pareceres_medicamento_nao_incorporado_sus ou pareceres_medicamento_incorporado_sus

FORMATO DE RESPOSTA (JSON estrito):

CASO 1 - Se existirem variáveis suficientes para expressar a condição:
{
    "regra": { ... AST conforme exemplos acima ... },
    "variaveis_usadas": ["var1", "var2"]
}

CASO 2 - Se NÃO existirem variáveis suficientes (OBRIGATÓRIO preencher todos os campos):
{
    "erro": "variaveis_insuficientes",
    "mensagem": "Explique detalhadamente quais variáveis estão faltando e por quê. Ex: 'Para expressar esta condição, seriam necessárias variáveis que identifiquem se foi pleiteada cirurgia e se o laudo médico é de especialista do SUS, mas essas variáveis não existem no sistema.'",
    "variaveis_necessarias": [
        {
            "slug_sugerido": "nome_em_snake_case",
            "descricao": "Descrição clara e completa do que essa variável representa",
            "tipo_sugerido": "boolean"
        }
    ]
}

REGRAS CRÍTICAS:
1. Use APENAS variáveis que existem na lista fornecida
2. Se não houver variáveis suficientes, SEMPRE retorne CASO 2 com TODOS os campos preenchidos
3. No CASO 2, liste TODAS as variáveis que precisariam ser criadas para atender a condição
4. A "mensagem" deve ser explicativa para o usuário entender o problema
5. Retorne APENAS JSON válido, sem texto adicional
6. Variáveis devem estar em snake_case
7. IMPORTANTE: Para variáveis booleanas, use SEMPRE os valores literais true ou false (minúsculos, sem aspas)
   - CORRETO: "value": true
   - CORRETO: "value": false
   - ERRADO: "value": 1
   - ERRADO: "value": 0
   - ERRADO: "value": "true"
   - ERRADO: "value": "false" """

    def _buscar_variaveis_disponiveis(self) -> List[Dict]:
        """
        Busca todas as variáveis disponíveis no sistema.

        Inclui:
        - ExtractionVariable: variáveis extraídas de PDFs (tabela do banco)
        - ProcessVariableDefinition: variáveis derivadas do XML do processo (grupo "Sistema")
        """
        variaveis = []

        # 1. Variáveis de extração (PDFs) do banco de dados
        extraction_vars = self.db.query(ExtractionVariable).filter(
            ExtractionVariable.ativo == True
        ).all()

        for v in extraction_vars:
            variaveis.append({
                "slug": v.slug,
                "label": v.label,
                "tipo": v.tipo,
                "descricao": v.descricao,
                "opcoes": v.opcoes,
                "fonte": "extracao"  # Para identificar origem
            })

        logger.info(f"[REGRA-DETERMINISTICO] Variáveis de extração (banco): {len(extraction_vars)}")

        # 2. Variáveis de processo (XML) - derivadas/calculadas (grupo "Sistema")
        # IMPORTANTE: Estas variáveis incluem valor_causa_superior_210sm, uniao_polo_passivo, etc.
        vars_processo_count = 0
        try:
            from .services_process_variables import ProcessVariableResolver

            definitions = ProcessVariableResolver.get_all_definitions()
            vars_processo_count = len(definitions)

            for definition in definitions:
                variaveis.append({
                    "slug": definition.slug,
                    "label": definition.label,
                    "tipo": definition.tipo,
                    "descricao": definition.descricao,
                    "opcoes": None,
                    "fonte": "processo_sistema"  # Variável do grupo Sistema (calculada do XML)
                })

            # Log explícito das variáveis de Sistema carregadas
            slugs_sistema = [d.slug for d in definitions]
            logger.info(
                f"[REGRA-DETERMINISTICO] Variáveis de Sistema (processo): {vars_processo_count} - "
                f"Slugs: {slugs_sistema}"
            )

        except Exception as e:
            logger.error(
                f"[REGRA-DETERMINISTICO] ERRO CRÍTICO ao carregar variáveis de processo (Sistema): {e}. "
                f"Variáveis como valor_causa_superior_210sm NÃO estarão disponíveis!"
            )
            import traceback
            logger.error(traceback.format_exc())

        logger.info(
            f"[REGRA-DETERMINISTICO] TOTAL de variáveis disponíveis: {len(variaveis)} "
            f"(extração: {len(extraction_vars)}, sistema: {vars_processo_count})"
        )

        return variaveis

    def _montar_prompt_geracao(
        self,
        condicao_texto: str,
        variaveis: List[Dict],
        contexto: Optional[str] = None
    ) -> str:
        """Monta o prompt para geração da regra."""
        variaveis_formatadas = []
        for v in variaveis:
            info = f"- {v['slug']}: {v['label']} (tipo: {v['tipo']})"
            if v.get('descricao'):
                info += f" - {v['descricao']}"
            if v.get('opcoes'):
                info += f" [opções: {', '.join(v['opcoes'])}]"
            variaveis_formatadas.append(info)

        prompt = f"""Converta a seguinte condição em linguagem natural para uma regra determinística (AST JSON):

CONDIÇÃO: {condicao_texto}
"""

        if contexto:
            prompt += f"\nCONTEXTO: {contexto}\n"

        prompt += f"""
VARIÁVEIS DISPONÍVEIS:
{chr(10).join(variaveis_formatadas) if variaveis_formatadas else "(nenhuma variável cadastrada)"}

INSTRUÇÕES:
1. Use APENAS variáveis da lista acima
2. Se a condição menciona algo que não existe nas variáveis, use a mais próxima ou retorne erro
3. Retorne APENAS o JSON, sem explicações"""

        return prompt

    def _extrair_json_resposta(self, resposta: str) -> Optional[Dict]:
        """Extrai JSON da resposta da IA."""
        resposta = resposta.strip()

        # Remove marcadores de código
        if resposta.startswith("```json"):
            resposta = resposta[7:]
        elif resposta.startswith("```"):
            resposta = resposta[3:]

        if resposta.endswith("```"):
            resposta = resposta[:-3]

        resposta = resposta.strip()

        try:
            return json.loads(resposta)
        except json.JSONDecodeError:
            # Tenta encontrar JSON
            match = re.search(r'\{[\s\S]*\}', resposta)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            return None

    def _inferir_tipo_variavel(self, slug: str) -> str:
        """
        Infere o tipo de uma variável baseado no seu nome (slug).

        Usado para sugerir o tipo quando a variável não existe no sistema.

        Args:
            slug: Nome da variável em snake_case

        Returns:
            Tipo sugerido: text, boolean, number, currency, date
        """
        slug_lower = slug.lower()

        # Palavras-chave para valores monetários
        if any(x in slug_lower for x in ["valor", "custo", "preco", "montante", "total"]):
            return "currency"

        # Palavras-chave para datas
        if any(x in slug_lower for x in ["data", "date", "dia", "nascimento", "vencimento"]):
            return "date"

        # Palavras-chave para booleanos
        if any(x in slug_lower for x in [
            "idoso", "ativo", "possui", "tem_", "eh_", "e_", "is_",
            "sim_nao", "aprovado", "deferido", "urgente", "prioritario",
            "incorporado", "registrado", "valido", "existente"
        ]):
            return "boolean"

        # Palavras-chave para números
        if any(x in slug_lower for x in [
            "quantidade", "numero", "qtd", "num_", "count", "total_",
            "idade", "prazo", "dias", "meses", "anos"
        ]):
            return "number"

        # Default: texto
        return "text"

    def _validar_regra(
        self,
        regra: Dict,
        variaveis_disponiveis: List[Dict]
    ) -> Dict[str, Any]:
        """Valida a regra gerada."""
        erros = []
        variaveis_faltantes = []
        slugs_disponiveis = {v["slug"] for v in variaveis_disponiveis}

        def validar_no(no: Dict, caminho: str = ""):
            tipo = no.get("type")

            if not tipo:
                erros.append(f"{caminho}: falta 'type'")
                return

            if tipo == "condition":
                # Valida condição simples
                var = no.get("variable")
                if not var:
                    erros.append(f"{caminho}: falta 'variable'")
                elif var not in slugs_disponiveis:
                    variaveis_faltantes.append(var)
                    erros.append(f"{caminho}: variável '{var}' não existe")

                if not no.get("operator"):
                    erros.append(f"{caminho}: falta 'operator'")

            elif tipo in ("and", "or"):
                # Valida operadores lógicos
                conditions = no.get("conditions", [])
                if not conditions:
                    erros.append(f"{caminho}: '{tipo}' precisa de 'conditions'")
                else:
                    for i, cond in enumerate(conditions):
                        validar_no(cond, f"{caminho}.conditions[{i}]")

            elif tipo == "not":
                # Valida negação
                conditions = no.get("conditions", [])
                if not conditions:
                    erros.append(f"{caminho}: 'not' precisa de 'conditions'")
                else:
                    for i, cond in enumerate(conditions):
                        validar_no(cond, f"{caminho}.conditions[{i}]")

            else:
                erros.append(f"{caminho}: tipo '{tipo}' desconhecido")

        validar_no(regra, "raiz")

        # Gera sugestões para variáveis faltantes
        variaveis_faltantes_unicas = list(set(variaveis_faltantes))
        sugestoes_variaveis = []

        for var in variaveis_faltantes_unicas:
            sugestoes_variaveis.append({
                "slug": var,
                "label_sugerido": var.replace("_", " ").title(),
                "tipo_sugerido": self._inferir_tipo_variavel(var)
            })

        return {
            "valid": len(erros) == 0,
            "errors": erros,
            "variaveis_faltantes": variaveis_faltantes_unicas,
            "sugestoes_variaveis": sugestoes_variaveis
        }
