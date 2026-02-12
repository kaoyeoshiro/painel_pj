# adapters/__init__.py
"""
Adapters (DIP) — Interfaces e implementacoes concretas.

Services dependem de interfaces (ports), nao de implementacoes concretas.
Isto permite testes com mocks e troca de implementacao sem alterar logica de negocio.
"""
from adapters.ports import IGeminiPort, ITJMSPort, IBertPort  # noqa: F401
