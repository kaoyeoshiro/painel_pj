"""
Implementações concretas de ports outbound.
"""

from app.adapters.bert_adapter import BertAdapter
from app.adapters.gemini_adapter import GeminiAdapter
from app.adapters.tjms_adapter import TJMSAdapter

__all__ = ["GeminiAdapter", "TJMSAdapter", "BertAdapter"]

