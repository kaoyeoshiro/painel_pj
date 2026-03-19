# sistemas/matriculas_confrontantes/services_ia.py
"""
Serviços de IA para análise de matrículas com visão computacional

Este módulo contém as funções de análise visual extraídas do sistema original.
Os prompts são carregados do banco de dados se disponíveis, ou usam fallbacks.
"""

import os
import io
import json
import base64
import requests
import logging
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple, Union

from PIL import Image

# Configura logger específico
logger = logging.getLogger("matriculas")

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logger.warning("⚠️ PyMuPDF não disponível")

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

from config import DEFAULT_MODEL, FULL_REPORT_MODEL
from services.ia_params_resolver import get_ia_params


# =========================
# Funções para carregar prompts do banco
# =========================

def get_prompt_from_db(sistema: str, tipo: str) -> Optional[str]:
    """Busca um prompt do banco de dados"""
    try:
        from database.connection import SessionLocal
        from admin.models import PromptConfig
        
        db = SessionLocal()
        try:
            prompt = db.query(PromptConfig).filter(
                PromptConfig.sistema == sistema,
                PromptConfig.tipo == tipo,
                PromptConfig.is_active == True
            ).first()
            
            if prompt:
                return prompt.conteudo
            return None
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️ Erro ao buscar prompt do banco: {e}")
        return None


def get_config_from_db(sistema: str, chave: str) -> Optional[str]:
    """Busca uma configuração de IA do banco de dados"""
    try:
        from database.connection import SessionLocal
        from admin.models import ConfiguracaoIA
        
        db = SessionLocal()
        try:
            config = db.query(ConfiguracaoIA).filter(
                ConfiguracaoIA.sistema == sistema,
                ConfiguracaoIA.chave == chave
            ).first()
            
            if config:
                return config.valor
            return None
        finally:
            db.close()
    except Exception as e:
        print(f"⚠️ Erro ao buscar config do banco: {e}")
        return None


# =========================
# Estruturas de Dados
# =========================

@dataclass
class TransmissaoInfo:
    """Informações sobre uma transmissão na cadeia dominial"""
    data: Optional[str] = None
    tipo_transmissao: Optional[str] = None
    proprietario_anterior: Optional[str] = None
    novo_proprietario: Optional[str] = None
    percentual: Optional[str] = None
    valor: Optional[str] = None
    registro: Optional[str] = None


@dataclass
class RestricaoInfo:
    """Informações sobre restrições e gravames"""
    tipo: str
    data_registro: Optional[str] = None
    credor: Optional[str] = None
    valor: Optional[str] = None
    situacao: str = "vigente"
    data_baixa: Optional[str] = None
    observacoes: Optional[str] = None


@dataclass
class MatriculaInfo:
    numero: str
    proprietarios: List[str]
    descricao: str
    confrontantes: List[str]
    evidence: List[str]
    lote: Optional[str] = None
    quadra: Optional[str] = None
    cadeia_dominial: List[TransmissaoInfo] = None
    restricoes: List[RestricaoInfo] = None
    
    def __post_init__(self):
        if self.cadeia_dominial is None:
            self.cadeia_dominial = []
        if self.restricoes is None:
            self.restricoes = []


@dataclass
class LoteConfronta:
    """Informações sobre um lote confrontante"""
    identificador: str
    tipo: str
    matricula_anexada: Optional[str] = None
    direcao: Optional[str] = None
    proprietarios: List[str] = None
    
    def __post_init__(self):
        if self.proprietarios is None:
            self.proprietarios = []


@dataclass
class EstadoMSDireitos:
    """Informações sobre direitos do Estado de MS"""
    tem_direitos: bool = False
    detalhes: List[Dict] = None
    criticidade: str = "baixa"
    observacao: str = ""
    
    def __post_init__(self):
        if self.detalhes is None:
            self.detalhes = []


@dataclass
class ResumoAnalise:
    """Resumo estruturado da análise para o relatório"""
    cadeia_dominial_completa: Dict[str, List[Dict]] = None
    restricoes_vigentes: List[Dict] = None
    restricoes_baixadas: List[Dict] = None
    estado_ms_direitos: EstadoMSDireitos = None
    
    def __post_init__(self):
        if self.cadeia_dominial_completa is None:
            self.cadeia_dominial_completa = {}
        if self.restricoes_vigentes is None:
            self.restricoes_vigentes = []
        if self.restricoes_baixadas is None:
            self.restricoes_baixadas = []
        if self.estado_ms_direitos is None:
            self.estado_ms_direitos = EstadoMSDireitos()


@dataclass
class AnalysisResult:
    arquivo: str
    matriculas_encontradas: List[MatriculaInfo]
    matricula_principal: Optional[str]
    matriculas_confrontantes: List[str]
    lotes_confrontantes: List[LoteConfronta]
    matriculas_nao_confrontantes: List[str]
    lotes_sem_matricula: List[str]
    confrontacao_completa: Optional[bool]
    proprietarios_identificados: Dict[str, List[str]]
    resumo_analise: Optional[ResumoAnalise] = None
    confidence: Optional[float] = None
    reasoning: str = ""
    raw_json: Dict = None
    
    def __post_init__(self):
        if self.resumo_analise is None:
            self.resumo_analise = ResumoAnalise()
        if self.raw_json is None:
            self.raw_json = {}
    
    @property
    def is_confrontante(self) -> Optional[bool]:
        """Compatibilidade: retorna se encontrou Estado MS como confrontante"""
        estado_patterns = ['estado de mato grosso do sul', 'estado de ms', 'estado do ms']
        for matricula in self.matriculas_encontradas:
            for confrontante in matricula.confrontantes:
                if any(pattern in confrontante.lower() for pattern in estado_patterns):
                    return True
        return False


# =========================
# Prompts
# =========================

SYSTEM_PROMPT = (
    "Você é um perito ESPECIALISTA em análise de processos de usucapião e matrículas imobiliárias brasileiras. "
    "Sua responsabilidade é CRÍTICA: a identificação COMPLETA de confrontantes pode determinar o sucesso ou fracasso de um usucapião.\n\n"

    "🎯 MISSÃO VITAL:\n"
    "• IDENTIFIQUE TODOS os confrontantes da matrícula principal SEM EXCEÇÃO\n"
    "• TODO LOTE DEVE TER NO MÍNIMO 4 CONFRONTANTES (uma para cada direção)\n"
    "• EXTRAIA LITERALMENTE cada nome, matrícula, rua mencionada como confrontante\n"
    "• ANALISE palavra por palavra a descrição do imóvel principal\n"
    "• PROCURE confrontantes em TODAS as direções (norte, sul, leste, oeste, nascente, poente, frente, fundos)\n"
    "• SE MENOS DE 4 CONFRONTANTES: releia o texto procurando informações perdidas\n\n"

    "⚠️ CONSEQUÊNCIAS:\n"
    "❌ UM confrontante perdido = usucapião pode ser NEGADO\n"
    "✅ TODOS confrontantes identificados = processo bem fundamentado\n\n"

    "📋 ANÁLISE COMPLETA OBRIGATÓRIA:\n\n"

    "1️⃣ IDENTIFICAÇÃO DE MATRÍCULAS:\n"
    "• Encontre todas as matrículas presentes (números, mesmo com variações de formatação)\n"
    "• Para cada matrícula: extraia número, LOTE, QUADRA, proprietários ATUAIS, descrição, confrontantes\n"
    "• Ignore vendedores/doadores antigos - considere apenas últimos proprietários\n"
    "• Determine qual é a matrícula principal (objeto do usucapião)\n\n"

    "2️⃣ ANÁLISE EXTREMAMENTE RIGOROSA DE CONFRONTANTES:\n"
    "📍 ONDE PROCURAR CONFRONTANTES:\n"
    "• EXCLUSIVAMENTE na DESCRIÇÃO DA MATRÍCULA PRINCIPAL\n"
    "• Seções 'CONFRONTAÇÕES', 'LIMITES', 'DIVISAS' da matrícula principal\n"
    "• NÃO buscar confrontantes em outros documentos ou matrículas anexadas\n"
    "• FOCO TOTAL: apenas a descrição do imóvel da matrícula objeto do usucapião\n\n"

    "🔍 PALAVRAS-CHAVE OBRIGATÓRIAS:\n"
    "• 'confronta', 'limita', 'divisa', 'ao norte/sul/leste/oeste'\n"
    "• 'frente', 'fundos', 'laterais', 'adjacente', 'vizinho'\n\n"

    "🎯 TIPOS DE CONFRONTANTES:\n"
    "• LOTES: 'lote 11', 'lote nº 09' • MATRÍCULAS: 'matrícula 1.234'\n"
    "• PESSOAS: nomes completos • EMPRESAS: razões sociais\n"
    "• VIAS PÚBLICAS: ruas, avenidas (PROPRIEDADE DO MUNICÍPIO)\n"
    "• RODOVIAS ESTADUAIS: apenas estas são de PROPRIEDADE DO ESTADO\n"
    "• ENTES PÚBLICOS: Estado, Município\n"
    "• ACIDENTES GEOGRÁFICOS: rios, córregos, lagos\n\n"

    "🌊 REGRA CRÍTICA SOBRE RIOS E CORPOS D'ÁGUA:\n"
    "• Confrontação com rios, córregos, ribeirões, lagos NÃO representa interesse do Estado de MS\n"
    "• MESMO que seja rio estadual, isso NÃO configura interesse do Estado no processo\n"
    "• Rios como confrontantes são IRRELEVANTES para determinar interesse estadual\n"
    "• APENAS identifique o rio como confrontante (acidente geográfico)\n"
    "• NUNCA considere rio/córrego/lago como indicativo de interesse do Estado de MS\n\n"

    "⚡ REGRAS CRÍTICAS:\n"
    "• LEIA PALAVRA POR PALAVRA da descrição do imóvel principal\n"
    "• CONFRONTANTES: buscar SOMENTE na matrícula principal, NÃO em outras matrículas\n"
    "• TODO lote tem 4 lados = mínimo 4 confrontantes\n"
    "• QUANDO MATRÍCULA NÃO ANEXADA: indique 'Matrícula não anexada' no campo matrícula\n"
    "• EXPRESSE CLARAMENTE quando confrontantes não têm matrícula anexada\n"
    "• Se menos de 4: RELEIA procurando mais\n"
    "• NÃO suponha, EXTRAIA exatamente como escrito\n\n"

    "3️⃣ CADEIA DOMINIAL COMPLETA:\n"
    "• Analise histórico completo de proprietários desde titulação original\n"
    "• Procure seções: 'REGISTRO', 'TRANSMISSÕES', 'AVERBAÇÕES'\n"
    "• Para cada transmissão: data, tipo, proprietário anterior, novo proprietário, percentual, valor\n"
    "• Co-propriedade: trate cada percentual como cadeia autônoma\n\n"

    "4️⃣ RESTRIÇÕES E GRAVAMES:\n"
    "• Identifique restrições não baixadas: PENHORA, HIPOTECA, INDISPONIBILIDADE\n"
    "• Verifique status: procure 'BAIXA', 'CANCELAMENTO', 'EXTINÇÃO'\n"
    "• ATENÇÃO ESPECIAL: direitos do Estado de Mato Grosso do Sul\n\n"


    "🚨 VERIFICAÇÕES OBRIGATÓRIAS:\n"
    "• Estado de MS como PROPRIETÁRIO ou com RESTRIÇÕES registradas?\n"
    "• Mínimo 4 confrontantes identificados?\n"
    "• Proprietários atuais confirmados?\n"
    "• Todas as matrículas mapeadas?\n\n"

    "⚠️ ATENÇÃO: Estado de MS como mero confrontante (vizinho) NÃO configura interesse!\n"
    "Interesse do Estado existe APENAS quando ele é:\n"
    "• PROPRIETÁRIO da matrícula OU\n"
    "• Titular de RESTRIÇÃO/GRAVAME (penhora, hipoteca, etc.)\n\n"

    "🔥 ZERO TOLERÂNCIA para confrontantes perdidos. Cada um é VITAL.\n\n"

    "Considere linguagem arcaica, abreviações, variações tipográficas e OCR imperfeito. "
    "Para análise visual: leia todo texto visível incluindo tabelas, carimbos e anotações manuscritas."
)


# Instruções específicas por tipo de análise
ANALYSIS_INSTRUCTIONS = {
    'vision': (
        "Analise visualmente as imagens de matrículas imobiliárias. "
        "Leia todo o texto visível (tabelas, carimbos, anotações) considerando ruídos de OCR. "
        "Aplique todas as instruções do sistema com o mesmo rigor da análise textual.\n\n"
    ),
}


# Esquema JSON padronizado
JSON_SCHEMA = '''
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
      ],
    }
  ],
  "matricula_principal": "12345",
  "matriculas_confrontantes": ["12346", "12347"],
  "lotes_confrontantes": [
    {
      "identificador": "lote 11",
      "tipo": "lote",
      "matricula_anexada": "12346",
      "direcao": "norte",
      "proprietarios": ["João da Silva", "Maria da Silva"]
    },
    {
      "identificador": "lote 09",
      "tipo": "lote",
      "matricula_anexada": null,
      "direcao": "sul",
      "proprietarios": []
    },
    {
      "identificador": "Rua das Flores",
      "tipo": "via_publica",
      "matricula_anexada": null,
      "direcao": "leste",
      "proprietarios": []
    },
    {
      "identificador": "BR-163",
      "tipo": "rodovia_estadual",
      "matricula_anexada": null,
      "direcao": "oeste"
    }
  ],
  "matriculas_nao_confrontantes": ["12348"],
  "lotes_sem_matricula": ["lote 09"],
  "confrontacao_completa": true|false|null,
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
    "restricoes_baixadas": [
      {"tipo": "penhora", "data_baixa": "10/12/2021", "motivo": "quitação judicial"}
    ],
    "estado_ms_direitos": {
      "tem_direitos": true|false,
      "detalhes": [
        {"matricula": "12345", "tipo_direito": "credor_hipoteca", "status": "vigente", "valor": "R$ 50.000,00"}
      ],
      "criticidade": "alta|media|baixa",
      "observacao": "Estado de MS possui hipoteca vigente na matrícula principal"
    }
  },
  "confidence": 0.0-1.0,
  "reasoning": "explicação detalhada da análise"
}

TIPOS DE CONFRONTANTES:
- 'lote': lotes numerados (ex: lote 11, lote 15)
- 'matricula': matrículas identificadas por número
- 'pessoa': nomes de pessoas proprietárias
- 'via_publica': ruas, avenidas, praças
- 'estado': Estado, Município, União
- 'outros': córregos, rios, outros elementos
'''


def get_system_prompt() -> str:
    """Obtém o prompt de sistema do banco ou usa fallback"""
    db_prompt = get_prompt_from_db("matriculas", "system")
    if db_prompt:
        return db_prompt
    return SYSTEM_PROMPT


def get_analysis_prompt() -> str:
    """Obtém o prompt de análise do banco ou usa fallback"""
    db_prompt = get_prompt_from_db("matriculas", "analise")
    if db_prompt:
        return db_prompt
    return ANALYSIS_INSTRUCTIONS['vision'] + JSON_SCHEMA


def get_report_prompt_template() -> str:
    """Obtém o template do prompt de relatório do banco ou usa fallback"""
    db_prompt = get_prompt_from_db("matriculas", "relatorio")
    if db_prompt:
        return db_prompt
    # Fallback para o template padrão
    return '''<context_gathering>
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


def build_full_report_prompt(data_json: str) -> str:
    """Monta prompt para solicitar um relatório textual completo à LLM."""
    template = get_report_prompt_template()
    return template.replace("{data_json}", data_json).strip()


# =========================
# Funções de Conversão
# =========================

def image_to_base64(image_path_or_pil: Union[str, Image.Image], max_size: int = 1024, jpeg_quality: int = 85) -> str:
    """Converte imagem para base64"""
    try:
        if isinstance(image_path_or_pil, str):
            img = Image.open(image_path_or_pil)
        else:
            img = image_path_or_pil
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=jpeg_quality, optimize=True)
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return img_str
    except Exception as e:
        print(f"Erro ao converter imagem para base64: {e}")
        return ""


def pdf_to_images(pdf_path: str, max_pages: Optional[int] = 10) -> List[Image.Image]:
    """Converte PDF para lista de imagens"""
    images = []
    
    try:
        if PDF2IMAGE_AVAILABLE:
            try:
                if max_pages is None:
                    pdf_images = convert_from_path(pdf_path, dpi=200)
                else:
                    pdf_images = convert_from_path(pdf_path, dpi=200, first_page=1, last_page=max_pages)
                return pdf_images
            except Exception:
                pass
        
        if PYMUPDF_AVAILABLE:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            pages_to_process = total_pages if max_pages is None else min(total_pages, max_pages)
            
            for page_num in range(pages_to_process):
                page = doc[page_num]
                mat = fitz.Matrix(2.0, 2.0)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("ppm")
                img = Image.open(io.BytesIO(img_data))
                images.append(img)
            doc.close()
            
    except Exception as e:
        print(f"Erro ao converter PDF para imagens: {e}")
    
    return images


# =========================
# API Gemini (usando serviço centralizado)
# =========================

async def call_gemini_vision_async(model: str, system_prompt: str, user_prompt: str, 
                                   images_base64: List[str], temperature: float = 0.1, 
                                   max_tokens: int = 1500, api_key: str = None) -> Dict:
    """Chama a API Gemini com suporte a visão computacional (versão assíncrona)"""
    from services.gemini_service import gemini_service
    
    logger.info(f"   └─ Enviando {len(images_base64)} imagem(ns) para análise...")
    
    # Prepara imagens no formato esperado (com prefixo data:)
    images_with_prefix = []
    for img_b64 in images_base64:
        if img_b64:
            if not img_b64.startswith("data:"):
                img_b64 = f"data:image/jpeg;base64,{img_b64}"
            images_with_prefix.append(img_b64)
    
    # Combina system_prompt e user_prompt
    prompt_completo = f"{system_prompt}\n\n{user_prompt}"
    
    import time
    start_time = time.time()
    
    response = await gemini_service.generate_with_images(
        prompt=prompt_completo,
        images_base64=images_with_prefix,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature
    )
    
    elapsed = time.time() - start_time
    
    if not response.success:
        logger.error(f"   ❌ API retornou erro: {response.error}")
        raise RuntimeError(f"Erro na API: {response.error}")
    
    logger.info(f"   └─ Resposta recebida em {elapsed:.1f}s")
    
    # Retorna no formato esperado pelo código existente
    return {
        "choices": [{
            "message": {
                "content": response.content
            }
        }]
    }


def call_gemini_vision(model: str, system_prompt: str, user_prompt: str, 
                       images_base64: List[str], temperature: float = 0.1, 
                       max_tokens: int = 1500, api_key: str = None) -> Dict:
    """Chama a API Gemini com suporte a visão computacional (detecta contexto)"""
    import asyncio
    
    try:
        loop = asyncio.get_running_loop()
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(
            call_gemini_vision_async(model, system_prompt, user_prompt, 
                                     images_base64, temperature, max_tokens, api_key)
        )
    except RuntimeError:
        return asyncio.run(
            call_gemini_vision_async(model, system_prompt, user_prompt, 
                                     images_base64, temperature, max_tokens, api_key)
        )


async def call_gemini_text_async(model: str, system_prompt: str, user_prompt: str,
                                 temperature: float = 0.2, max_tokens: int = 2000, 
                                 api_key: str = None) -> str:
    """Chama a API Gemini para gerar texto (versão assíncrona)"""
    from services.gemini_service import gemini_service
    
    import time
    start_time = time.time()
    
    response = await gemini_service.generate(
        prompt=user_prompt,
        system_prompt=system_prompt,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature
    )
    
    elapsed = time.time() - start_time
    
    if not response.success:
        raise RuntimeError(f"Erro na API: {response.error}")
    
    logger.info(f"   └─ Relatório gerado em {elapsed:.1f}s")
    
    return response.content


def call_gemini_text(model: str, system_prompt: str, user_prompt: str,
                     temperature: float = 0.2, max_tokens: int = 2000, 
                     api_key: str = None) -> str:
    """Chama a API Gemini para gerar texto (detecta contexto)"""
    import asyncio
    
    try:
        loop = asyncio.get_running_loop()
        import nest_asyncio
        nest_asyncio.apply()
        return loop.run_until_complete(
            call_gemini_text_async(model, system_prompt, user_prompt, 
                                   temperature, max_tokens, api_key)
        )
    except RuntimeError:
        return asyncio.run(
            call_gemini_text_async(model, system_prompt, user_prompt, 
                                   temperature, max_tokens, api_key)
        )


# Aliases para compatibilidade
def call_openrouter_vision(model: str, system_prompt: str, user_prompt: str, 
                           images_base64: List[str], temperature: float = 0.0, 
                           max_tokens: int = 1500, api_key: str = None) -> Dict:
    """Alias para call_gemini_vision (compatibilidade)"""
    # Normaliza o modelo
    from services.gemini_service import GeminiService
    model = GeminiService.normalize_model(model)
    return call_gemini_vision(model, system_prompt, user_prompt, images_base64, 
                               temperature, max_tokens, api_key)


def call_openrouter_text(model: str, system_prompt: str, user_prompt: str,
                         temperature: float = 0.2, max_tokens: int = 2000, 
                         api_key: str = None) -> str:
    """Alias para call_gemini_text (compatibilidade)"""
    # Normaliza o modelo
    from services.gemini_service import GeminiService
    model = GeminiService.normalize_model(model)
    return call_gemini_text(model, system_prompt, user_prompt, 
                            temperature, max_tokens, api_key)


def clean_json_response(content: str) -> str:
    """Extrai JSON de uma resposta que pode conter markdown"""
    import re
    content = content.strip()
    
    # Padrão: ```json ... ```
    match = re.search(r'```json\s*\n(.*?)\n```', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    # Padrão: ``` ... ```
    match = re.search(r'```\s*\n(.*?)\n```', content, re.DOTALL)
    if match:
        candidate = match.group(1).strip()
        if candidate.startswith('{') or candidate.startswith('['):
            return candidate
    
    # Padrão: { ... }
    match = re.search(r'\{.*\}', content, re.DOTALL)
    if match:
        return match.group(0).strip()
    
    return content


# =========================
# Análise Principal
# =========================

def analyze_with_vision_llm(model: str, file_path: str, api_key: str = None, matricula_hint: str = None) -> AnalysisResult:
    """Analisa documento usando visão computacional da LLM"""
    fname = os.path.basename(file_path)
    
    try:
        ext = os.path.splitext(file_path.lower())[1]
        
        if ext == ".pdf":
            images = pdf_to_images(file_path, max_pages=None)
        elif ext in [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"]:
            images = [Image.open(file_path)]
        else:
            raise ValueError(f"Formato não suportado: {ext}")
        
        if not images:
            raise ValueError("Não foi possível extrair imagens do arquivo")
        
        # Converte para base64
        images_b64 = []
        for img in images:
            if img and hasattr(img, 'size'):
                b64 = image_to_base64(img, max_size=1536)
                if b64:
                    images_b64.append(b64)
        
        if not images_b64:
            raise ValueError("Não foi possível converter imagens")
        
        # Obtém prompts do banco de dados (com fallback)
        system_prompt = get_system_prompt()
        vision_prompt = get_analysis_prompt()
        
        # Injeta hint da matrícula principal se fornecido
        if matricula_hint:
            hint_text = f"\n\nATENÇÃO: A MATRÍCULA PRINCIPAL (OBJETO DA ANÁLISE) É: {matricula_hint}\nDê prioridade total a esta matrícula como sendo o imóvel central.\n"
            vision_prompt = hint_text + vision_prompt

        # Usa resolver de parâmetros por agente (hierarquia: agente > sistema > global > default)
        try:
            from database.connection import SessionLocal
            db = SessionLocal()
            try:
                params = get_ia_params(db, "matriculas", "analise")
            finally:
                db.close()
            modelo_analise = params.modelo if params.modelo else model
            temperatura = params.temperatura
            max_tokens = params.max_tokens or 100000
            logger.info(f"   └─ Modelo resolvido: {modelo_analise} (fonte: {params.modelo_source})")
            logger.info(f"   └─ Thinking level: {params.thinking_level} (fonte: {params.thinking_level_source})")
        except Exception as e:
            logger.warning(f"Erro ao obter params por resolver, usando fallback: {e}")
            temperatura = float(get_config_from_db("matriculas", "temperatura_analise") or "0.1")
            max_tokens = int(get_config_from_db("matriculas", "max_tokens_analise") or "100000")
            modelo_analise = get_config_from_db("matriculas", "modelo_analise") or model
            logger.info(f"   └─ Modelo (fallback): {modelo_analise}")

        data = call_openrouter_vision(
            model=modelo_analise,
            system_prompt=system_prompt,
            user_prompt=vision_prompt,
            images_base64=images_b64,
            temperature=temperatura,
            max_tokens=max_tokens,
            api_key=api_key
        )
        
        content = data["choices"][0]["message"].get("content", "")
        clean_content = clean_json_response(content)
        
        try:
            parsed = json.loads(clean_content)
        except json.JSONDecodeError:
            parsed = {
                "matriculas_encontradas": [],
                "matricula_principal": None,
                "matriculas_confrontantes": [],
                "lotes_confrontantes": [],
                "matriculas_nao_confrontantes": [],
                "lotes_sem_matricula": [],
                "confrontacao_completa": None,
                "proprietarios_identificados": {},
                "confidence": None,
                "reasoning": f"Erro de parsing JSON"
            }
        
        # Converte para objetos
        matriculas_obj = []
        for m_data in parsed.get("matriculas_encontradas", []):
            if isinstance(m_data, dict):
                matriculas_obj.append(MatriculaInfo(
                    numero=str(m_data.get("numero", "")),
                    proprietarios=m_data.get("proprietarios", []),
                    descricao=str(m_data.get("descricao", "")),
                    confrontantes=m_data.get("confrontantes", []),
                    evidence=m_data.get("evidence", []),
                    lote=m_data.get("lote"),
                    quadra=m_data.get("quadra")
                ))
        
        lotes_obj = []
        for lote_data in parsed.get("lotes_confrontantes", []):
            if isinstance(lote_data, dict):
                lotes_obj.append(LoteConfronta(
                    identificador=lote_data.get("identificador", ""),
                    tipo=lote_data.get("tipo", "outros"),
                    matricula_anexada=lote_data.get("matricula_anexada"),
                    direcao=lote_data.get("direcao"),
                    proprietarios=lote_data.get("proprietarios", [])
                ))
        
        return AnalysisResult(
            arquivo=fname,
            matriculas_encontradas=matriculas_obj,
            matricula_principal=parsed.get("matricula_principal"),
            matriculas_confrontantes=parsed.get("matriculas_confrontantes", []),
            lotes_confrontantes=lotes_obj,
            matriculas_nao_confrontantes=parsed.get("matriculas_nao_confrontantes", []),
            lotes_sem_matricula=parsed.get("lotes_sem_matricula", []),
            confrontacao_completa=parsed.get("confrontacao_completa"),
            proprietarios_identificados=parsed.get("proprietarios_identificados", {}),
            confidence=parsed.get("confidence"),
            reasoning=parsed.get("reasoning", ""),
            raw_json=parsed
        )
        
    except Exception as e:
        return AnalysisResult(
            arquivo=fname,
            matriculas_encontradas=[],
            matricula_principal=None,
            matriculas_confrontantes=[],
            lotes_confrontantes=[],
            matriculas_nao_confrontantes=[],
            lotes_sem_matricula=[],
            confrontacao_completa=None,
            proprietarios_identificados={},
            confidence=None,
            reasoning=f"Erro na análise visual: {str(e)}",
            raw_json={}
        )
