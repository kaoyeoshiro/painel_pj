# -*- coding: utf-8 -*-
"""
Script de refatoracao - Fase 1: Endpoints simples de CRUD de PromptConfig e ConfiguracaoIA.

Remove db.query dos endpoints basicos e usa repositories.
"""

import re
import sys
from pathlib import Path

# Adiciona root ao path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))


def refactor_router_py():
    """Refatora admin/router.py - Fase 1."""
    file_path = ROOT_DIR / "admin" / "router.py"
    content = file_path.read_text(encoding="utf-8")

    # Backup
    backup_path = file_path.with_suffix(".py.bak")
    backup_path.write_text(content, encoding="utf-8")
    print(f"✅ Backup criado: {backup_path}")

    # 1. Adicionar imports dos repositories (se ainda não existir)
    if "from admin.repositories import" not in content:
        import_block = """from admin.repositories import (
    get_prompt_config_repo,
    get_config_repo,
    PromptConfigRepository,
    ConfiguracaoIARepository,
)"""
        # Inserir após imports de admin.schemas
        content = content.replace(
            "from admin.seed_prompts import seed_default_prompts",
            f"{import_block}\nfrom admin.seed_prompts import seed_default_prompts"
        )
        print("✅ Imports de repositories adicionados")

    # 2. Refatorar list_prompts
    content = re.sub(
        r'@router\.get\("/api/prompts", response_model=PromptListResponse\)\nasync def list_prompts\(\s*sistema: Optional\[str\] = None,\s*tipo: Optional\[str\] = None,\s*current_user: User = Depends\(require_admin\),\s*db: Session = Depends\(get_db\)\s*\):\s*"""Lista todos os prompts configurados \(apenas admin\)"""\s*query = db\.query\(PromptConfig\)[^\n]*\s*if sistema:[^\n]*\s*query = query\.filter\(PromptConfig\.sistema == sistema\)\s*if tipo:[^\n]*\s*query = query\.filter\(PromptConfig\.tipo == tipo\)[^\n]*\s*prompts = query\.order_by\(PromptConfig\.sistema, PromptConfig\.tipo\)\.all\(\)[^\n]*\s*return PromptListResponse\(prompts=prompts, total=len\(prompts\)\)',
        '''@router.get("/api/prompts", response_model=PromptListResponse)
async def list_prompts(
    sistema: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo)
):
    """Lista todos os prompts configurados (apenas admin)"""
    prompts = repo.list_with_filters(sistema=sistema, tipo=tipo)
    return PromptListResponse(prompts=prompts, total=len(prompts))''',
        content,
        flags=re.DOTALL
    )
    print("✅ list_prompts refatorado")

    # 3. Refatorar get_prompt
    content = re.sub(
        r'@router\.get\("/api/prompts/\{prompt_id\}", response_model=PromptResponse\)\nasync def get_prompt\(\s*prompt_id: int,\s*current_user: User = Depends\(require_admin\),\s*db: Session = Depends\(get_db\)\s*\):\s*"""Obtém um prompt específico"""\s*prompt = db\.query\(PromptConfig\)\.filter\(PromptConfig\.id == prompt_id\)\.first\(\)',
        '''@router.get("/api/prompts/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int,
    current_user: User = Depends(require_admin),
    repo: PromptConfigRepository = Depends(get_prompt_config_repo)
):
    """Obtém um prompt específico"""
    prompt = repo.get_by_id(prompt_id)''',
        content,
        flags=re.DOTALL
    )
    print("✅ get_prompt refatorado")

    # 4. Refatorar update_prompt
    content = re.sub(
        r'(@router\.put\("/api/prompts/\{prompt_id\}", response_model=PromptResponse\)\nasync def update_prompt\(\s*prompt_id: int,\s*prompt_data: PromptUpdate,\s*current_user: User = Depends\(require_admin\),)\s*db: Session = Depends\(get_db\)',
        r'\1\n    repo: PromptConfigRepository = Depends(get_prompt_config_repo)',
        content
    )
    content = re.sub(
        r'("""Atualiza um prompt existente"""\s*)prompt = db\.query\(PromptConfig\)\.filter\(PromptConfig\.id == prompt_id\)\.first\(\)',
        r'\1prompt = repo.get_by_id(prompt_id)',
        content
    )
    content = re.sub(
        r'(prompt\.updated_by = current_user\.username\s*)db\.commit\(\)\s*db\.refresh\(prompt\)',
        r'\1repo.commit()\n    repo.refresh(prompt)',
        content
    )
    print("✅ update_prompt refatorado")

    # 5. Refatorar delete_prompt
    content = re.sub(
        r'(@router\.delete\("/api/prompts/\{prompt_id\}"\)\nasync def delete_prompt\(\s*prompt_id: int,\s*current_user: User = Depends\(require_admin\),)\s*db: Session = Depends\(get_db\)',
        r'\1\n    repo: PromptConfigRepository = Depends(get_prompt_config_repo)',
        content
    )
    content = re.sub(
        r'("""Exclui um prompt"""\s*)prompt = db\.query\(PromptConfig\)\.filter\(PromptConfig\.id == prompt_id\)\.first\(\)',
        r'\1prompt = repo.get_by_id(prompt_id)',
        content
    )
    content = re.sub(
        r'(if not prompt:\s*raise HTTPException.*?\s*)db\.delete\(prompt\)\s*db\.commit\(\)',
        r'\1repo.delete(prompt)\n    repo.commit()',
        content,
        flags=re.DOTALL
    )
    print("✅ delete_prompt refatorado")

    # Salvar arquivo refatorado
    file_path.write_text(content, encoding="utf-8")
    print(f"✅ Arquivo refatorado salvo: {file_path}")

    # Contar db.query restantes
    remaining = content.count("db.query(")
    print(f"\n📊 db.query() restantes: {remaining}")


if __name__ == "__main__":
    print("🚀 Iniciando refatoração Fase 1: CRUD de PromptConfig")
    print("=" * 60)
    refactor_router_py()
    print("=" * 60)
    print("✅ Refatoração Fase 1 concluída!")
    print("\n⚠️  Próximos passos:")
    print("1. Revisar mudanças: git diff admin/router.py")
    print("2. Testar endpoints refatorados")
    print("3. Executar testes: pytest tests/test_admin_repositories.py -v")
