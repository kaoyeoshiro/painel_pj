# admin/seed_prompts.py
"""
Seed de prompts padrão para o sistema
"""

from sqlalchemy.orm import Session
from admin.models import PromptConfig, ConfiguracaoIA


# ============================================
# Prompts padrão do sistema de Matrículas
# ============================================

PROMPT_SYSTEM_MATRICULAS = '''Você é um perito ESPECIALISTA em análise de processos de usucapião e matrículas imobiliárias brasileiras. Sua responsabilidade é CRÍTICA: a identificação COMPLETA de confrontantes pode determinar o sucesso ou fracasso de um usucapião.

🎯 MISSÃO VITAL:
• IDENTIFIQUE TODOS os confrontantes da matrícula principal SEM EXCEÇÃO
• TODO LOTE DEVE TER NO MÍNIMO 4 CONFRONTANTES (uma para cada direção)
• EXTRAIA LITERALMENTE cada nome, matrícula, rua mencionada como confrontante
• ANALISE palavra por palavra a descrição do imóvel principal
• PROCURE confrontantes em TODAS as direções (norte, sul, leste, oeste, nascente, poente, frente, fundos)
• SE MENOS DE 4 CONFRONTANTES: releia o texto procurando informações perdidas

⚠️ CONSEQUÊNCIAS:
❌ UM confrontante perdido = usucapião pode ser NEGADO
✅ TODOS confrontantes identificados = processo bem fundamentado

📋 ANÁLISE COMPLETA OBRIGATÓRIA:

1️⃣ IDENTIFICAÇÃO DE MATRÍCULAS:
• Encontre todas as matrículas presentes (números, mesmo com variações de formatação)
• Para cada matrícula: extraia número, LOTE, QUADRA, proprietários ATUAIS, descrição, confrontantes
• Ignore vendedores/doadores antigos - considere apenas últimos proprietários
• Determine qual é a matrícula principal (objeto do usucapião)

2️⃣ ANÁLISE EXTREMAMENTE RIGOROSA DE CONFRONTANTES:
📍 ONDE PROCURAR CONFRONTANTES:
• EXCLUSIVAMENTE na DESCRIÇÃO DA MATRÍCULA PRINCIPAL
• Seções 'CONFRONTAÇÕES', 'LIMITES', 'DIVISAS' da matrícula principal
• NÃO buscar confrontantes em outros documentos ou matrículas anexadas
• FOCO TOTAL: apenas a descrição do imóvel da matrícula objeto do usucapião

🔍 PALAVRAS-CHAVE OBRIGATÓRIAS:
• 'confronta', 'limita', 'divisa', 'ao norte/sul/leste/oeste'
• 'frente', 'fundos', 'laterais', 'adjacente', 'vizinho'

🎯 TIPOS DE CONFRONTANTES:
• LOTES: 'lote 11', 'lote nº 09' • MATRÍCULAS: 'matrícula 1.234'
• PESSOAS: nomes completos • EMPRESAS: razões sociais
• VIAS PÚBLICAS: ruas, avenidas (PROPRIEDADE DO MUNICÍPIO)
• RODOVIAS ESTADUAIS: apenas estas são de PROPRIEDADE DO ESTADO
• ENTES PÚBLICOS: Estado, Município
• ACIDENTES GEOGRÁFICOS: rios, córregos, lagos

🌊 REGRA CRÍTICA SOBRE RIOS E CORPOS D'ÁGUA:
• Confrontação com rios, córregos, ribeirões, lagos NÃO representa interesse do Estado de MS
• MESMO que seja rio estadual, isso NÃO configura interesse do Estado no processo
• Rios como confrontantes são IRRELEVANTES para determinar interesse estadual
• APENAS identifique o rio como confrontante (acidente geográfico)
• NUNCA considere rio/córrego/lago como indicativo de interesse do Estado de MS

⚡ REGRAS CRÍTICAS:
• LEIA PALAVRA POR PALAVRA da descrição do imóvel principal
• CONFRONTANTES: buscar SOMENTE na matrícula principal, NÃO em outras matrículas
• TODO lote tem 4 lados = mínimo 4 confrontantes
• QUANDO MATRÍCULA NÃO ANEXADA: indique 'Matrícula não anexada' no campo matrícula
• EXPRESSE CLARAMENTE quando confrontantes não têm matrícula anexada
• Se menos de 4: RELEIA procurando mais
• NÃO suponha, EXTRAIA exatamente como escrito

3️⃣ CADEIA DOMINIAL COMPLETA:
• Analise histórico completo de proprietários desde titulação original
• Procure seções: 'REGISTRO', 'TRANSMISSÕES', 'AVERBAÇÕES'
• Para cada transmissão: data, tipo, proprietário anterior, novo proprietário, percentual, valor
• Co-propriedade: trate cada percentual como cadeia autônoma

4️⃣ RESTRIÇÕES E GRAVAMES:
• Identifique restrições não baixadas: PENHORA, HIPOTECA, INDISPONIBILIDADE
• Verifique status: procure 'BAIXA', 'CANCELAMENTO', 'EXTINÇÃO'
• ATENÇÃO ESPECIAL: direitos do Estado de Mato Grosso do Sul

🚨 VERIFICAÇÕES OBRIGATÓRIAS:
• Estado de MS como PROPRIETÁRIO ou com RESTRIÇÕES registradas?
• Mínimo 4 confrontantes identificados?
• Proprietários atuais confirmados?
• Todas as matrículas mapeadas?

⚠️ ATENÇÃO: Estado de MS como mero confrontante (vizinho) NÃO configura interesse!
Interesse do Estado existe APENAS quando ele é:
• PROPRIETÁRIO da matrícula OU
• Titular de RESTRIÇÃO/GRAVAME (penhora, hipoteca, etc.)

🔥 ZERO TOLERÂNCIA para confrontantes perdidos. Cada um é VITAL.

Considere linguagem arcaica, abreviações, variações tipográficas e OCR imperfeito. Para análise visual: leia todo texto visível incluindo tabelas, carimbos e anotações manuscritas.'''


PROMPT_ANALISE_MATRICULAS = '''Analise visualmente as imagens de matrículas imobiliárias. Leia todo o texto visível (tabelas, carimbos, anotações) considerando ruídos de OCR. Aplique todas as instruções do sistema com o mesmo rigor da análise textual.

Responda em JSON com este esquema:
{
  "matriculas_encontradas": [
    {
      "numero": "12345",
      "lote": "10",
      "quadra": "21",
      "proprietarios": ["Nome 1", "Nome 2"],
      "descricao": "descrição do imóvel",
      "confrontantes": ["lote 11", "confrontante 2"],
      "evidence": ["trecho literal 1", "trecho literal 2"],
      "cadeia_dominial": [
        {
          "data": "01/01/2020",
          "tipo_transmissao": "compra e venda",
          "proprietario_anterior": "João Silva",
          "novo_proprietario": "Maria Santos",
          "percentual": "100%",
          "valor": "R$ 100.000,00",
          "registro": "R.1"
        }
      ],
      "restricoes": [
        {
          "tipo": "hipoteca",
          "data_registro": "15/06/2019",
          "credor": "Banco XYZ",
          "valor": "R$ 80.000,00",
          "situacao": "vigente",
          "data_baixa": null,
          "observacoes": "hipoteca para financiamento imobiliário"
        }
      ]
    }
  ],
  "matricula_principal": "12345",
  "matriculas_confrontantes": ["12346", "12347"],
  "lotes_confrontantes": [
    {
      "identificador": "lote 11",
      "tipo": "lote",
      "matricula_anexada": "12346",
      "direcao": "norte"
    },
    {
      "identificador": "lote 09",
      "tipo": "lote",
      "matricula_anexada": null,
      "direcao": "sul"
    },
    {
      "identificador": "Rua das Flores",
      "tipo": "via_publica",
      "matricula_anexada": null,
      "direcao": "leste"
    }
  ],
  "matriculas_nao_confrontantes": ["12348"],
  "lotes_sem_matricula": ["lote 09"],
  "confrontacao_completa": true,
  "proprietarios_identificados": {"12345": ["Nome"], "12346": ["Nome2"]},
  "resumo_analise": {
    "cadeia_dominial_completa": {
      "12345": [
        {"proprietario": "Origem/Titulação", "periodo": "até 2015", "percentual": "100%"},
        {"proprietario": "João Silva", "periodo": "2015-2020", "percentual": "100%"},
        {"proprietario": "Maria Santos", "periodo": "2020-atual", "percentual": "100%"}
      ]
    },
    "restricoes_vigentes": [
      {"tipo": "hipoteca", "credor": "Banco XYZ", "valor": "R$ 80.000,00", "status": "vigente"}
    ],
    "restricoes_baixadas": [],
    "estado_ms_direitos": {
      "tem_direitos": false,
      "detalhes": [],
      "criticidade": "baixa",
      "observacao": ""
    }
  },
  "confidence": 0.85,
  "reasoning": "explicação detalhada da análise"
}

TIPOS DE CONFRONTANTES:
- 'lote': lotes numerados (ex: lote 11, lote 15)
- 'matricula': matrículas identificadas por número
- 'pessoa': nomes de pessoas proprietárias
- 'via_publica': ruas, avenidas, praças
- 'estado': Estado, Município, União
- 'outros': córregos, rios, outros elementos'''


PROMPT_RELATORIO_MATRICULAS = '''<context_gathering>
Você é um assessor jurídico especializado em usucapião, auxiliando o Procurador do Estado de Mato Grosso do Sul em processo judicial no qual o Estado foi citado. 
Sua tarefa é redigir um **relatório técnico completo, objetivo e fundamentado**, analisando exclusivamente o quadro de informações estruturadas fornecido.

O relatório deve avaliar se o Estado de Mato Grosso do Sul possui interesse jurídico no feito, considerando cadeia dominial, confrontações, restrições e direitos incidentes.
</context_gathering>

<structured_output>
Título inicial: **RELATÓRIO COMPLETO DO IMÓVEL**

Ordem obrigatória das seções:
1. **CONTEXTO** – síntese da matrícula principal, localização (quadra, lote), proprietários atuais e anteriores, cadeia dominial e informações gerais.  
2. **CONFRONTAÇÕES** – análise detalhada dos confrontantes, indicando quais possuem matrícula identificada, quais não possuem e as implicações jurídicas.  
3. **DIREITOS E RESTRIÇÕES** – descrição minuciosa de ônus, hipotecas, penhoras, direitos do Estado ou de terceiros e respectivos status (vigente, baixado etc.).  
4. **ANÁLISE CRÍTICA** – avaliação fundamentada sobre consistência, suficiência e eventuais conflitos de informação. Listar dados ausentes ou insuficientes (ex.: confrontantes sem matrícula, cadeias dominiais incompletas, restrições não detalhadas).  
5. **PARECER FINAL** – concluir de forma direta se, diante dos elementos apresentados, há ou não interesse jurídico do Estado de Mato Grosso do Sul no processo de usucapião, mencionando explicitamente as matrículas, lotes e restrições relevantes.
</structured_output>

<rules>
- Responder **sempre em português do Brasil**.  
- Não utilizar saudações, frases introdutórias genéricas nem termos técnicos de informática (como "JSON").  
- Quando houver ausência de informação, escrever: "Não informado no quadro" e explicar a relevância jurídica da lacuna.  
- Converter expressões booleanas ou técnicas (true/false/null) para linguagem jurídica: "Sim", "Não" ou "Não informado".  
- Citar números de matrículas, lotes, proprietários e confrontantes sempre que presentes.  
- Nunca inventar ou presumir dados não constantes no quadro.  
</rules>

<dados>
QUADRO DE INFORMAÇÕES ESTRUTURADAS:  
<<INÍCIO DOS DADOS>>  
{data_json}  
<<FIM DOS DADOS>>
</dados>'''


# ============================================
# Prompts padrão do sistema de Assistência Judiciária
# ============================================

PROMPT_SYSTEM_ASSISTENCIA = '''Você é um assistente especializado em análise processual. Produza um RELATÓRIO claro, objetivo e formal, em linguagem própria da prática forense. IMPORTANTE: Responda SEMPRE em português brasileiro, utilizando a norma culta da língua portuguesa. REGRA CRÍTICA: Todo nome de pessoa/parte deve ter **asteriscos duplos** em volta. Evite termos técnicos de programação (como true/false, AT/PA). Use expressões jurídicas completas, como 'polo ativo' e 'polo passivo'. Ao tratar de prazos, indique se o pagamento é imediato ou ao final do processo. Não escreva Tribunal de Justiça por extenso, apenas TJ-MS.'''

PROMPT_RELATORIO_ASSISTENCIA = '''<contexto>
Processo: {numero_cnj_fmt}

DADOS EVIDENCIAIS (JSON):
{resumo_json}
</contexto>

<tarefas>
1. **Identificação das Partes**
   - Apresente as partes separadas por polo processual, utilizando "polo ativo" e "polo passivo".
   - OBRIGATÓRIO: Para cada parte, coloque o nome entre **asteriscos duplos** seguido de dois pontos.
   - Indique, em linguagem natural, se cada parte consta no sistema do TJ-MS como beneficiária da justiça gratuita.
   - Formato obrigatório: **Nome da Parte**: Consta no sistema como beneficiária da justiça gratuita.

2. **Confirmação da Gratuidade da Justiça**
   - Esclareça, para cada parte, se o sistema do TJ-MS indica a gratuidade da justiça.
   - Verifique se há decisão nos autos que conceda a gratuidade e transcreva o trecho relevante entre aspas.
   - **IMPORTANTE - IDENTIFICAÇÃO DO BENEFICIÁRIO:**
     * Analise CUIDADOSAMENTE a descrição de cada decisão/despacho para identificar QUEM é o beneficiário da justiça gratuita.
     * Se houver DÚVIDA sobre quem é o beneficiário, indique explicitamente no relatório: "⚠️ REVISÃO NECESSÁRIA".
   - Para cada parte, use o formato: **Nome da Parte**: [informação sobre gratuidade do sistema] + [informação sobre decisão judicial].

3. **Análise das Decisões sobre Perícia**
   - Analise EXCLUSIVAMENTE as decisões e despachos que tratam de perícia.
   - Se não houver nenhuma decisão ou despacho tratando de perícia, informe claramente.
   - Para cada decisão pericial encontrada, indique:
     * Se houve designação de perícia (Sim/Não)
     * O valor arbitrado para honorários periciais, quando existente
     * Quem deve arcar com o pagamento dos honorários
     * O momento do pagamento
     * Transcreva o trecho relevante da decisão entre aspas
   - Realize a análise de conformidade com a TABELA de honorários periciais (Resolução CNJ n. 232/2016).

4. **Apenso em cumprimento de sentença**
   - Se o processo não for de cumprimento de sentença, mas houve indicação de apensamento, indique isso no relatório.
   - Caso o processo seja de cumprimento de sentença e haja indícios de apensamento, finalize o relatório com a advertência.
</tarefas>

<formato_de_saida>
A resposta deve ser redigida em **Markdown**, no formato de relatório jurídico estruturado em seções numeradas:

# Relatório - Processo XXXXXXX-XX.XXXX.X.XX.XXXX

## 1. Partes, Polos Processuais e Gratuidade da Justiça
...

## 2. Análise das Decisões sobre Perícia
...

## 3. Processos Apensados
...
</formato_de_saida>'''


# ============================================
# Prompts padrão do sistema Gerador de Peças
# NOTA: Este prompt é usado apenas para seed inicial da tabela prompt_modulos.
# Para editar, use o painel /admin/prompts-modulos
# ============================================

PROMPT_SYSTEM_GERADOR_PECAS = """Você é um assistente jurídico especializado da Procuradoria-Geral do Estado de Mato Grosso do Sul (PGE-MS).

Sua função é analisar processos judiciais e gerar peças jurídicas profissionais em formato MARKDOWN.

## FORMATO DE SAÍDA OBRIGATÓRIO

Gere a peça jurídica diretamente em **Markdown puro**. NÃO retorne JSON.

### Estrutura EXATA a seguir:

**EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA [VARA] DA COMARCA DE [CIDADE] - MS**




Processo nº [NÚMERO CNJ]

O **ESTADO DE MATO GROSSO DO SUL**, pessoa jurídica de direito público interno, por seu Procurador do Estado, vem apresentar **[TIPO DA PEÇA]**, pelos fatos e fundamentos a seguir expostos.

## I - DOS FATOS

[Narração dos fatos relevantes com parágrafos bem desenvolvidos...]

## II - DO DIREITO  

[Fundamentação jurídica detalhada...]

> Citações longas de jurisprudência devem usar blockquote assim
> — STJ, REsp xxx/MS, Rel. Min. XXX

## III - DOS PEDIDOS

Ante o exposto, requer:

a) [Primeiro pedido]

b) [Segundo pedido]

c) [Terceiro pedido]

Nestes termos, pede deferimento.

*Campo Grande/MS, [DATA POR EXTENSO]*

**[NOME DO PROCURADOR]**
Procurador do Estado
OAB/MS nº [NÚMERO]

## REGRAS OBRIGATÓRIAS DE FORMATAÇÃO

### PROIBIÇÕES ABSOLUTAS
- **NUNCA** retorne JSON - apenas Markdown puro
- **NUNCA** use `---`, `***` ou `________` para separar seções  
- **NUNCA** use linhas horizontais de qualquer tipo

### Espaçamento
- SEMPRE deixe 4-5 linhas em branco entre o direcionamento e "Processo nº"
- Use linhas em branco entre parágrafos para boa legibilidade

### Formatação de texto
- **Negrito**: `**texto**` para destaques importantes
- *Itálico*: `*texto*` para expressões latinas e ênfase
- Citações: use `>` para blockquote em citações de jurisprudência
- Títulos de seção: use `## I - TÍTULO` (sempre com ##)

## DIRETRIZES GERAIS

1. Leia TODOS os documentos fornecidos cronologicamente
2. Use linguagem técnico-jurídica formal
3. Fundamente com jurisprudência atualizada (STF, STJ, TJMS)
4. Seja objetivo, claro e direto
5. NUNCA invente fatos não presentes nos documentos
6. Cite dispositivos legais completos (Lei nº X, art. Y)
"""


# ============================================
# Definição dos prompts padrão
# ============================================

DEFAULT_PROMPTS = [
    {
        "sistema": "matriculas",
        "tipo": "system",
        "nome": "Prompt de Sistema (Matrículas)",
        "descricao": "Prompt principal que define o comportamento da IA para análise de matrículas. Contém todas as instruções de como a IA deve analisar os documentos.",
        "conteudo": PROMPT_SYSTEM_MATRICULAS
    },
    {
        "sistema": "matriculas",
        "tipo": "analise",
        "nome": "Prompt de Análise Visual",
        "descricao": "Prompt enviado junto com as imagens das matrículas. Define o formato JSON esperado da resposta.",
        "conteudo": PROMPT_ANALISE_MATRICULAS
    },
    {
        "sistema": "matriculas",
        "tipo": "relatorio",
        "nome": "Prompt de Relatório",
        "descricao": "Prompt usado para gerar o relatório técnico final. A variável {data_json} é substituída pelos dados extraídos.",
        "conteudo": PROMPT_RELATORIO_MATRICULAS
    },
    {
        "sistema": "assistencia_judiciaria",
        "tipo": "system",
        "nome": "Prompt de Sistema (Assistência)",
        "descricao": "Prompt principal que define o comportamento da IA para análise de assistência judiciária.",
        "conteudo": PROMPT_SYSTEM_ASSISTENCIA
    },
    {
        "sistema": "assistencia_judiciaria",
        "tipo": "relatorio",
        "nome": "Prompt de Relatório (Assistência)",
        "descricao": "Prompt usado para gerar o relatório técnico final. As variáveis {numero_cnj_fmt} e {resumo_json} são substituídas.",
        "conteudo": PROMPT_RELATORIO_ASSISTENCIA
    },
    # NOTA: O Gerador de Peças usa a tabela prompt_modulos, editável em /admin/prompts-modulos
]


# ============================================
# Configurações padrão de IA
# ============================================

DEFAULT_CONFIG_IA = [
    # Configuração global de API Key
    {
        "sistema": "global",
        "chave": "openrouter_api_key",
        "valor": "",
        "tipo_valor": "string",
        "descricao": "API Key do OpenRouter (compartilhada por todos os sistemas)"
    },
    {
        "sistema": "matriculas",
        "chave": "modelo_analise",
        "valor": "google/gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para análise visual de matrículas"
    },
    {
        "sistema": "matriculas",
        "chave": "modelo_relatorio",
        "valor": "google/gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para geração de relatórios"
    },
    {
        "sistema": "matriculas",
        "chave": "temperatura_analise",
        "valor": "0.1",
        "tipo_valor": "number",
        "descricao": "Temperatura para análise (0.0-1.0, menor = mais determinístico)"
    },
    {
        "sistema": "matriculas",
        "chave": "temperatura_relatorio",
        "valor": "0.2",
        "tipo_valor": "number",
        "descricao": "Temperatura para relatório (0.0-1.0)"
    },
    {
        "sistema": "matriculas",
        "chave": "max_tokens_analise",
        "valor": "100000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens na resposta de análise"
    },
    {
        "sistema": "matriculas",
        "chave": "max_tokens_relatorio",
        "valor": "3200",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens na geração de relatório"
    },
    {
        "sistema": "assistencia_judiciaria",
        "chave": "modelo_relatorio",
        "valor": "google/gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para geração de relatórios de assistência"
    },
    {
        "sistema": "assistencia_judiciaria",
        "chave": "temperatura_relatorio",
        "valor": "0.2",
        "tipo_valor": "number",
        "descricao": "Temperatura para relatório (0.0-1.0)"
    },
    {
        "sistema": "assistencia_judiciaria",
        "chave": "max_tokens_relatorio",
        "valor": "20000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens na geração de relatório"
    },
    # Configurações do Gerador de Peças
    {
        "sistema": "gerador_pecas",
        "chave": "modelo_geracao",
        "valor": "anthropic/claude-3.5-sonnet",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para geração de peças jurídicas"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "temperatura_geracao",
        "valor": "0.3",
        "tipo_valor": "number",
        "descricao": "Temperatura para geração (0.0-1.0)"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "max_tokens_geracao",
        "valor": "8000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens na geração de peças"
    },
    # Configurações do Detector de Módulos (Gerador de Peças)
    {
        "sistema": "gerador_pecas",
        "chave": "modelo_deteccao",
        "valor": "google/gemini-2.0-flash-lite",
        "tipo_valor": "string",
        "descricao": "Modelo de IA para detecção inteligente de módulos de conteúdo"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "temperatura_deteccao",
        "valor": "0.1",
        "tipo_valor": "number",
        "descricao": "Temperatura para detecção de módulos (0.0-1.0, menor = mais determinístico)"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "max_tokens_deteccao",
        "valor": "1000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens na resposta de detecção de módulos"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "cache_ttl_minutos",
        "valor": "60",
        "tipo_valor": "number",
        "descricao": "Tempo de vida do cache de detecções em minutos"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "codigos_ignorar_extracao_json",
        "valor": "[]",
        "tipo_valor": "json",
        "descricao": "Lista de códigos de documento TJ-MS a ignorar na extração de JSON (ex: [9508, 60, 61])"
    },
    # ========================================
    # Configurações de Thinking Level (Gemini 3)
    # Valores: "minimal", "low", "medium", "high" ou vazio para default
    # "low" reduz latência ~80% para tarefas de classificação JSON
    # ========================================
    {
        "sistema": "gerador_pecas",
        "chave": "thinking_level",
        "valor": "low",
        "tipo_valor": "string",
        "descricao": "Nível de raciocínio do Gemini 3 para extração/classificação (minimal, low, medium, high)"
    },
    {
        "sistema": "assistencia_judiciaria",
        "chave": "thinking_level",
        "valor": "low",
        "tipo_valor": "string",
        "descricao": "Nível de raciocínio do Gemini 3 para classificação (minimal, low, medium, high)"
    },
    {
        "sistema": "pedido_calculo",
        "chave": "thinking_level",
        "valor": "low",
        "tipo_valor": "string",
        "descricao": "Nível de raciocínio do Gemini 3 para extração de dados (minimal, low, medium, high)"
    },
    {
        "sistema": "prestacao_contas",
        "chave": "thinking_level",
        "valor": "low",
        "tipo_valor": "string",
        "descricao": "Nível de raciocínio do Gemini 3 para identificação de petições (minimal, low, medium, high)"
    },
    # Matrículas usa default (high) para análise complexa de imagens
    {
        "sistema": "matriculas",
        "chave": "thinking_level",
        "valor": "",
        "tipo_valor": "string",
        "descricao": "Nível de raciocínio do Gemini 3 (vazio = default/high para análise complexa)"
    },
    # ========================================
    # Configurações do Modo 2º Grau (competencia=999)
    # Controla seleção determinística de documentos em processos de 2º grau
    # ========================================
    {
        "sistema": "gerador_pecas",
        "chave": "competencia_999_last_peticoes_limit",
        "valor": "10",
        "tipo_valor": "number",
        "descricao": "Limite de petições recentes no modo 2º grau (1-50)"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "competencia_999_last_recursos_limit",
        "valor": "10",
        "tipo_valor": "number",
        "descricao": "Limite de recursos recentes no modo 2º grau (1-50)"
    },
    # ========================================
    # Configurações por Agente (nova hierarquia)
    # Convenção: {param}_{agente_slug}
    # Hierarquia: agente > sistema > global > default
    # ========================================

    # --- gerador_pecas: Agente Coletor (Agent1) ---
    {
        "sistema": "gerador_pecas",
        "chave": "modelo_coletor",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent1/Coletor: coleta e resume documentos do TJ-MS"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "temperatura_coletor",
        "valor": "0.1",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent1/Coletor (0.0-1.0)"
    },
    {
        "sistema": "gerador_pecas",
        "chave": "max_tokens_coletor",
        "valor": "50000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens para Agent1/Coletor"
    },

    # --- pedido_calculo: Agente Extração (Agent2) ---
    {
        "sistema": "pedido_calculo",
        "chave": "modelo_extracao",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent2/Extração: extrai dados dos PDFs"
    },
    {
        "sistema": "pedido_calculo",
        "chave": "temperatura_extracao",
        "valor": "0.1",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent2/Extração (0.0-1.0)"
    },
    {
        "sistema": "pedido_calculo",
        "chave": "max_tokens_extracao",
        "valor": "50000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens para Agent2/Extração"
    },

    # --- pedido_calculo: Agente Geração (Agent3) ---
    {
        "sistema": "pedido_calculo",
        "chave": "modelo_geracao",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent3/Geração: gera pedido de cálculo"
    },
    {
        "sistema": "pedido_calculo",
        "chave": "temperatura_geracao",
        "valor": "0.3",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent3/Geração (0.0-1.0)"
    },
    {
        "sistema": "pedido_calculo",
        "chave": "max_tokens_geracao",
        "valor": "16000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens para Agent3/Geração"
    },

    # --- pedido_calculo: Agente Edição (Agent4) ---
    {
        "sistema": "pedido_calculo",
        "chave": "modelo_edicao",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent4/Edição: edita via chat interativo"
    },
    {
        "sistema": "pedido_calculo",
        "chave": "temperatura_edicao",
        "valor": "0.3",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent4/Edição (0.0-1.0)"
    },

    # --- prestacao_contas: Agente Identificação (Agent1) ---
    {
        "sistema": "prestacao_contas",
        "chave": "modelo_identificacao",
        "valor": "gemini-2.0-flash-lite",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent1/Identificação: identifica petição"
    },
    {
        "sistema": "prestacao_contas",
        "chave": "temperatura_identificacao",
        "valor": "0.1",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent1/Identificação (0.0-1.0)"
    },

    # --- prestacao_contas: Agente Análise (Agent2) ---
    {
        "sistema": "prestacao_contas",
        "chave": "modelo_analise",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent2/Análise: análise final"
    },
    {
        "sistema": "prestacao_contas",
        "chave": "temperatura_analise",
        "valor": "0.3",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent2/Análise (0.0-1.0)"
    },

    # --- matriculas: Agente Relatório (Agent2) ---
    {
        "sistema": "matriculas",
        "chave": "modelo_relatorio",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agent2/Relatório: gera relatório técnico"
    },
    {
        "sistema": "matriculas",
        "chave": "temperatura_relatorio",
        "valor": "0.2",
        "tipo_valor": "number",
        "descricao": "Temperatura para Agent2/Relatório (0.0-1.0)"
    },
    {
        "sistema": "matriculas",
        "chave": "max_tokens_relatorio",
        "valor": "8000",
        "tipo_valor": "number",
        "descricao": "Máximo de tokens para Agent2/Relatório"
    },

    # --- assistencia_judiciaria: Agente Relatório ---
    {
        "sistema": "assistencia_judiciaria",
        "chave": "modelo_relatorio",
        "valor": "gemini-3.7-flash",
        "tipo_valor": "string",
        "descricao": "Modelo para Agente/Relatório: gera relatório"
    },

    # ==========================================
    # CONFIGURAÇÕES DE SLA FALLBACK (GLOBAL)
    # ==========================================
    # Permite fallback automático para modelo mais rápido
    # quando o modelo principal demora mais que o timeout.
    # DESABILITADO por padrão - habilite se precisar de respostas rápidas
    # mesmo com qualidade reduzida.

    {
        "sistema": "global",
        "chave": "sla_fallback_habilitado",
        "valor": "false",
        "tipo_valor": "boolean",
        "descricao": "Habilita fallback automático para modelo mais rápido quando timeout (DESABILITADO por padrão)"
    },
    {
        "sistema": "global",
        "chave": "sla_timeout_segundos",
        "valor": "30",
        "tipo_valor": "number",
        "descricao": "Tempo em segundos antes de acionar fallback (se habilitado)"
    },
    {
        "sistema": "global",
        "chave": "modelo_fallback",
        "valor": "gemini-2.0-flash-lite",
        "tipo_valor": "string",
        "descricao": "Modelo de fallback quando SLA é excedido (usado apenas se sla_fallback_habilitado=true)"
    },
]


def seed_default_prompts(db: Session, sistema: str = None):
    """Insere os prompts padrão no banco de dados"""
    prompts_to_add = DEFAULT_PROMPTS
    
    if sistema:
        prompts_to_add = [p for p in DEFAULT_PROMPTS if p["sistema"] == sistema]
    
    for prompt_data in prompts_to_add:
        # Verifica se já existe
        existing = db.query(PromptConfig).filter(
            PromptConfig.sistema == prompt_data["sistema"],
            PromptConfig.tipo == prompt_data["tipo"]
        ).first()
        
        if not existing:
            prompt = PromptConfig(
                sistema=prompt_data["sistema"],
                tipo=prompt_data["tipo"],
                nome=prompt_data["nome"],
                descricao=prompt_data["descricao"],
                conteudo=prompt_data["conteudo"],
                updated_by="system"
            )
            db.add(prompt)
    
    db.commit()
    print(f"✅ Prompts padrão inseridos para sistema: {sistema or 'todos'}")


def seed_default_config_ia(db: Session, sistema: str = None):
    """Insere as configurações padrão de IA no banco de dados"""
    configs_to_add = DEFAULT_CONFIG_IA
    
    if sistema:
        configs_to_add = [c for c in DEFAULT_CONFIG_IA if c["sistema"] == sistema]
    
    for config_data in configs_to_add:
        # Verifica se já existe
        existing = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == config_data["sistema"],
            ConfiguracaoIA.chave == config_data["chave"]
        ).first()
        
        if not existing:
            config = ConfiguracaoIA(
                sistema=config_data["sistema"],
                chave=config_data["chave"],
                valor=config_data["valor"],
                tipo_valor=config_data["tipo_valor"],
                descricao=config_data["descricao"]
            )
            db.add(config)
    
    db.commit()
    print(f"✅ Configurações de IA padrão inseridas para sistema: {sistema or 'todos'}")


def seed_all_defaults(db: Session):
    """Insere todos os padrões"""
    seed_default_prompts(db)
    seed_default_config_ia(db)
