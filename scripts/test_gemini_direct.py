"""
Script de teste direto para verificar se a API do Gemini está respondendo
"""
import os
import sys
import google.generativeai as genai
from dotenv import load_dotenv

# Força UTF-8 no Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Carrega variáveis de ambiente
load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_KEY")

print(f"=== TESTE DIRETO DA API GEMINI ===")
print(f"API Key configurada: {GEMINI_KEY[:20]}..." if GEMINI_KEY else "API Key NAO encontrada!")
print()

if not GEMINI_KEY:
    print("[ERRO] GEMINI_KEY nao esta configurada no .env")
    exit(1)

try:
    # Configura a API
    genai.configure(api_key=GEMINI_KEY)

    print("[OK] API configurada com sucesso")
    print()

    # Lista modelos disponíveis
    print("[INFO] Listando modelos disponiveis...")
    models = genai.list_models()
    gemini_models = [m for m in models if 'gemini' in m.name.lower()]

    if gemini_models:
        print(f"[OK] Encontrados {len(gemini_models)} modelos Gemini:")
        for model in gemini_models[:5]:  # Mostra primeiros 5
            print(f"  - {model.name}")
    else:
        print("[AVISO] Nenhum modelo Gemini encontrado")

    print()

    # Testa chamada simples
    print("[TESTE] Testando chamada simples ao modelo gemini-3-flash-preview...")
    model = genai.GenerativeModel('gemini-3-flash-preview')

    response = model.generate_content("Responda apenas: OK")

    print(f"[OK] Resposta recebida: {response.text}")
    print()

    # Testa chamada com prompt mais complexo
    print("[TESTE] Testando prompt mais complexo...")
    response = model.generate_content("Liste 3 cores primarias em formato JSON com chave 'cores'")

    print(f"[OK] Resposta: {response.text}")
    print()

    print("=" * 50)
    print("[SUCESSO] TESTE CONCLUIDO COM SUCESSO!")
    print("A API do Gemini esta funcionando corretamente.")
    print("=" * 50)

except Exception as e:
    print()
    print("=" * 50)
    print(f"[ERRO] ERRO AO TESTAR GEMINI:")
    print(f"Tipo: {type(e).__name__}")
    print(f"Mensagem: {str(e)}")
    print("=" * 50)

    # Verifica erros comuns
    if "API_KEY_INVALID" in str(e) or "401" in str(e):
        print("\n[DIAGNOSTICO] API Key invalida ou expirada")
    elif "quota" in str(e).lower() or "429" in str(e):
        print("\n[DIAGNOSTICO] Quota excedida ou rate limit")
    elif "timeout" in str(e).lower():
        print("\n[DIAGNOSTICO] Timeout na conexao")
    else:
        print("\n[DIAGNOSTICO] Erro desconhecido - verificar logs acima")

    exit(1)
