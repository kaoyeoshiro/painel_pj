/**
 * Testes para TjmsDocsPage
 *
 * Página estática de documentação - não requer mocks de API.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TjmsDocsPage } from '../TjmsDocsPage';

describe('TjmsDocsPage', () => {
  it('deve renderizar o título da página', () => {
    render(<TjmsDocsPage />);

    expect(screen.getByText('Documentacao Integracao TJ-MS')).toBeInTheDocument();
  });

  it('deve mostrar alerta de sincronização backend/frontend', () => {
    render(<TjmsDocsPage />);

    expect(screen.getByText('Importante: Sincronizacao Backend/Frontend')).toBeInTheDocument();
    expect(screen.getByText(/Quando alterar qualquer arquivo listado abaixo/)).toBeInTheDocument();
  });

  it('deve mostrar bloco de migração concluída', () => {
    render(<TjmsDocsPage />);

    expect(screen.getByText(/Migracao Concluida/)).toBeInTheDocument();
    expect(screen.getByText(/Todos os sistemas foram migrados/)).toBeInTheDocument();
  });

  it('deve mostrar a arquitetura unificada', () => {
    render(<TjmsDocsPage />);

    expect(screen.getByText('Arquitetura Unificada de Integracao')).toBeInTheDocument();
  });

  it('deve mostrar os módulos no bloco de código', () => {
    render(<TjmsDocsPage />);

    // Os módulos estão dentro de um <pre> block, verificar que o texto contém os nomes dos módulos
    const preBlock = screen.getByText(/CLIENTE UNIFICADO/);
    expect(preBlock).toBeInTheDocument();
    expect(preBlock.textContent).toContain('config.py');
    expect(preBlock.textContent).toContain('client.py');
    expect(preBlock.textContent).toContain('models.py');
    expect(preBlock.textContent).toContain('constants.py');
    expect(preBlock.textContent).toContain('adapters.py');
    expect(preBlock.textContent).toContain('parsers.py');
  });
});
