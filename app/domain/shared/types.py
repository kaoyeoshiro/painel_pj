"""
Tipos compartilhados do domínio.

TypeAliases e NewTypes usados por múltiplos módulos,
centralizados para evitar duplicação e ciclos de import.
"""

from typing import NewType, TypeAlias, Dict, Any

# Número de processo CNJ (20 dígitos, com ou sem formatação)
ProcessoNumero = NewType("ProcessoNumero", str)

# ID de documento no TJ-MS (código numérico)
DocumentoId = NewType("DocumentoId", int)

# ID de usuário no sistema
UserId = NewType("UserId", int)

# JSON extraído de documentos (estrutura livre)
JsonExtraido: TypeAlias = Dict[str, Any]

# Configuração de IA (modelo, temperatura, etc.)
ConfigIA: TypeAlias = Dict[str, Any]

# Variáveis de processo (extraídas ou do XML)
VariaveisProcesso: TypeAlias = Dict[str, Any]
