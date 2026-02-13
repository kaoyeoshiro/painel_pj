# sistemas/pedido_calculo/seed_config.py
"""
Script para popular prompts e configurações iniciais do sistema Pedido de Cálculo.

Execução:
    python -c "from sistemas.pedido_calculo.seed_config import seed_all; seed_all()"
"""

from database.connection import SessionLocal
from admin.models import PromptConfig, ConfiguracaoIA
from datetime import datetime
from utils.timezone import get_utc_now


SISTEMA = "pedido_calculo"


# ============================================
# Prompts
# ============================================

PROMPTS = [
    {
        "tipo": "extracao_pdfs",
        "nome": "Extração de Informações dos PDFs (Agente 2)",
        "descricao": "Prompt usado para extrair informações das sentenças, acórdãos e certidões",
        "conteudo": """Analise os documentos judiciais a seguir e extraia as informações em formato JSON.

## CONTEXTO
Este é um processo de CUMPRIMENTO DE SENTENÇA contra a Fazenda Pública.
Preciso extrair informações para elaborar um pedido de cálculo pericial.

## DOCUMENTOS PARA ANÁLISE
{textos_documentos}

## INFORMAÇÕES A EXTRAIR
Retorne um JSON com a seguinte estrutura:

```json
{{
    "objeto_condenacao": "Descrição clara do que foi condenado (ex: 'Indenização relativa ao FGTS 8%')",
    "valor_solicitado_parte": "Valor total que o exequente está requerendo (ex: 'R$ 13.524,41')",
    "periodo_condenacao": {{
        "inicio": "MM/AAAA do início do período",
        "fim": "MM/AAAA do fim do período"
    }},
    "correcao_monetaria": {{
        "indice": "Índice determinado na sentença/acórdão (ex: 'IPCA-E até 08/12/2021, após SELIC')",
        "termo_inicial": "A partir de quando incide (ex: 'vencimento de cada obrigação')",
        "termo_final": "Até quando incide (ex: 'data do efetivo pagamento')",
        "observacao": "Observações relevantes sobre EC 113/2021, se aplicável"
    }},
    "juros_moratorios": {{
        "taxa": "Taxa de juros (ex: 'Inclusos na SELIC', '1% a.m.', 'poupança')",
        "termo_inicial": "A partir de quando (ex: 'citação')",
        "termo_final": "Até quando (ex: '08/12/2021')",
        "observacao": "Observações sobre EC 113/2021, se aplicável"
    }},
    "datas": {{
        "citacao_recebimento": "DD/MM/AAAA - data de RECEBIMENTO efetivo da citação pela PGE (extraída da certidão 9508)",
        "transito_julgado": "DD/MM/AAAA do trânsito em julgado",
        "intimacao_impugnacao_recebimento": "DD/MM/AAAA - data de RECEBIMENTO da intimação para impugnar (da certidão 9508)"
    }},
    "criterios_calculo": [
        "Critério 1 para cálculo",
        "Critério 2 para cálculo"
    ],
    "calculo_exequente": {{
        "valor_total": "Valor total do cálculo do exequente",
        "data_base": "Data base do cálculo apresentado"
    }}
}}
```

## REGRAS IMPORTANTES

1. **EC 113/2021**: A partir de 09/12/2021, aplica-se apenas SELIC (que já inclui correção e juros).
   - Se citação foi posterior a 09/12/2021: aplica-se SELIC desde o início
   - Se citação foi anterior: IPCA-E + juros até 08/12/2021, depois apenas SELIC

2. **Prevalência**: Se houver ACÓRDÃO, seus critérios prevalecem sobre a sentença.
   Analise os acórdãos em ordem cronológica para pegar a decisão final.

3. **Data de citação**: A data relevante é o RECEBIMENTO pela PGE, não a expedição.
   Extraia da Certidão do Sistema (9508), que indica quando foi efetivamente visualizada.

4. **Período da condenação**: Extraia exatamente como definido na sentença/acórdão.
   Respeite prescrições declaradas.

5. **Critérios de cálculo**: Liste todos os critérios específicos mencionados na sentença
   que o perito deve observar ao elaborar o cálculo.

## FORMATO DE RESPOSTA
Retorne APENAS o JSON, sem explicações adicionais. Use null para campos não encontrados."""
    },
    {
        "tipo": "geracao_pedido",
        "nome": "Geração do Pedido de Cálculo (Agente 3)",
        "descricao": "Prompt usado para gerar o pedido de cálculo final em Markdown",
        "conteudo": """Gere um PEDIDO DE CÁLCULOS para cumprimento de sentença com base nas informações fornecidas.

## DADOS DO PROCESSO
{dados_json}

## FORMATO DO DOCUMENTO
Gere o pedido no seguinte formato MARKDOWN:

# QUADRO PEDIDO DE CÁLCULOS – CUMPRIMENTO DE SENTENÇA

**Autor:** [nome do autor]
**CPF:** [CPF formatado]
**Réu:** Estado de Mato Grosso do Sul
**Autos nº:** [número do processo formatado]
**Comarca:** [comarca]
**Vara:** [vara]
**PGENET Nº:** [deixar em branco para preenchimento manual]

---

## 1. OBJETO DA CONDENAÇÃO

[Descrever claramente o objeto da condenação conforme sentença/acórdão]

### 1.1 VALOR SOLICITADO PELA PARTE (OBRIGATÓRIO)

**R$ [valor]** (data-base: [data])

---

## 2. PRAZO PROCESSUAL

**Termo Inicial:** [data de recebimento da intimação pela PGE]
**Termo Final:** [30 dias úteis após o termo inicial]

---

## 3. DATA DE CITAÇÃO (P. CONHECIMENTO)

[Data de recebimento efetivo pela PGE, conforme certidão 9508]

---

## 4. DATAS PROCESSUAIS

**Data de Ajuizamento:** [data] 
**Trânsito em Julgado:** [data]

---

## 5. PRAZO PARA CÁLCULO

[Calcular 30 dias úteis a partir do termo inicial]

---

## 6. ÍNDICE DE CORREÇÃO MONETÁRIA

[Índice conforme sentença/acórdão]

**Termo Inicial:** [especificar]
**Termo Final:** [especificar]

[Observação sobre EC 113/2021 se aplicável]

---

## 7. TAXA DE JUROS MORATÓRIOS

[Taxa conforme sentença/acórdão]

**Termo Inicial:** [especificar]
**Termo Final:** [especificar]

[Observação sobre EC 113/2021 se aplicável]

---

## 8. PERÍODO DA CONDENAÇÃO

[MM/AAAA até MM/AAAA]

---

## 9. CRITÉRIOS PARA CÁLCULO

[Lista de critérios específicos extraídos da sentença/acórdão]

- Elaborar relatório comparativo com o cálculo do exequente (anexado)
- Anexar fichas financeiras (se aplicável)

---

## 10. RESPONSÁVEIS

**Procurador(a) responsável:** ___________________
**Assessor(a) responsável:** ___________________
**Data:** {data_atual}

---

## REGRAS OBRIGATÓRIAS

1. Use APENAS as informações fornecidas - não invente dados
2. Se alguma informação estiver faltando, indique "[A VERIFICAR]"
3. Mantenha o formato exato do template
4. Calcule os prazos considerando dias úteis (segunda a sexta)
5. Para EC 113/2021: 
   - Se citação posterior a 09/12/2021: aplica-se apenas SELIC desde o início
   - Se citação anterior: índice até 08/12/2021, depois SELIC"""
    },
    {
        "tipo": "edicao_pedido",
        "nome": "Edição de Pedido via Chat",
        "descricao": "Prompt usado quando o usuário solicita alterações no pedido via chat",
        "conteudo": """Você é um assistente especializado em editar pedidos de cálculo judicial.

O usuário solicitou a seguinte alteração no pedido de cálculo:

"{mensagem_usuario}"

## Pedido Atual (Markdown):
{pedido_markdown}

## Dados do Processo:
- Autor: {autor}
- Processo: {numero_processo}
- Objeto: {objeto_condenacao}

## Instruções:
1. Aplique APENAS a alteração solicitada pelo usuário
2. Mantenha toda a estrutura e formatação do pedido
3. Retorne o pedido completo atualizado em Markdown
4. NÃO adicione comentários ou explicações, apenas o pedido atualizado

Pedido atualizado:"""
    }
]


# ============================================
# Configurações de Modelos
# ============================================

CONFIGURACOES = [
    {
        "chave": "modelo_extracao",
        "valor": "gemini-3-flash-preview",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para extração de informações dos PDFs (Agente 2)"
    },
    {
        "chave": "modelo_geracao",
        "valor": "gemini-3-flash-preview",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para geração do pedido de cálculo (Agente 3)"
    },
    {
        "chave": "modelo_edicao",
        "valor": "gemini-3-flash-preview",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para edição do pedido via chat"
    },
    {
        "chave": "temperatura_extracao",
        "valor": "0.1",
        "tipo_valor": "number",
        "descricao": "Temperatura para extração (baixa = mais preciso)"
    },
    {
        "chave": "temperatura_geracao",
        "valor": "0.3",
        "tipo_valor": "number",
        "descricao": "Temperatura para geração de texto"
    }
]


def seed_prompts(db):
    """Popula prompts iniciais"""
    for prompt_data in PROMPTS:
        existing = db.query(PromptConfig).filter(
            PromptConfig.sistema == SISTEMA,
            PromptConfig.tipo == prompt_data["tipo"]
        ).first()
        
        if not existing:
            prompt = PromptConfig(
                sistema=SISTEMA,
                tipo=prompt_data["tipo"],
                nome=prompt_data["nome"],
                descricao=prompt_data["descricao"],
                conteudo=prompt_data["conteudo"],
                is_active=True,
                created_at=get_utc_now(),
                updated_at=get_utc_now()
            )
            db.add(prompt)
            print(f"✅ Prompt criado: {prompt_data['tipo']}")
        else:
            print(f"⏭️ Prompt já existe: {prompt_data['tipo']}")

    db.commit()


def seed_configuracoes(db):
    """Popula configurações de modelos"""
    for config_data in CONFIGURACOES:
        existing = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == SISTEMA,
            ConfiguracaoIA.chave == config_data["chave"]
        ).first()

        if not existing:
            config = ConfiguracaoIA(
                sistema=SISTEMA,
                chave=config_data["chave"],
                valor=config_data["valor"],
                tipo_valor=config_data["tipo_valor"],
                descricao=config_data["descricao"],
                created_at=get_utc_now(),
                updated_at=get_utc_now()
            )
            db.add(config)
            print(f"✅ Configuração criada: {config_data['chave']}")
        else:
            print(f"⏭️ Configuração já existe: {config_data['chave']}")
    
    db.commit()


def seed_all():
    """Executa todos os seeds"""
    print("\n🌱 Populando configurações do Pedido de Cálculo...")
    
    db = SessionLocal()
    try:
        seed_prompts(db)
        seed_configuracoes(db)
        print("\n✅ Configurações populadas com sucesso!\n")
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
