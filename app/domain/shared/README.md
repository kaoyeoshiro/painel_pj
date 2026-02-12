# app/domain/shared - Contratos Compartilhados

Este módulo contém tipos, protocolos e constantes compartilhadas por múltiplos
sistemas do Portal PGE, criados para evitar ciclos de import.

## Arquivos

### protocols.py
Define interfaces (Protocols) para serviços principais:
- **AIServiceProtocol**: Interface para serviços de IA (Gemini, etc)
- **DocumentClassifierProtocol**: Interface para classificadores de documentos
- **TJMSClientProtocol**: Interface para cliente TJ-MS

### types.py
Define type aliases e NewTypes reutilizáveis:
- **ProcessoNumero**: NewType para número CNJ de processo
- **DocumentoId**: NewType para ID de documento no TJ-MS
- **UserId**: NewType para ID de usuário
- **JsonExtraido**: TypeAlias para JSON extraído de documentos
- **ConfigIA**: TypeAlias para configurações de IA
- **VariaveisProcesso**: TypeAlias para variáveis de processo

## Uso



## Princípios

1. **Neutralidade**: Este módulo NÃO deve importar módulos de domínio específicos
2. **Estabilidade**: Mudanças aqui afetam muitos módulos — cuidado ao alterar
3. **Leveza**: Apenas tipos e protocolos, sem lógica de negócio
4. **Documentação**: Cada tipo/protocolo deve ter docstring clara

## Quando Adicionar Algo Aqui

✅ Adicione se:
- O tipo/protocolo é usado por 3+ sistemas diferentes
- Há ciclo de import entre módulos por causa desse tipo
- É um contrato de interface estável

❌ NÃO adicione se:
- É específico de um sistema
- Contém lógica de negócio
- É um modelo ORM (use  do sistema)
