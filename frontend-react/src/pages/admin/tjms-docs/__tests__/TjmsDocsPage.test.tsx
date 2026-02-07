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

    expect(screen.getByText('Documentação Integração TJ-MS')).toBeInTheDocument();
    expect(screen.getByText(/Módulo unificado de integração com o sistema MNI\/SOAP/)).toBeInTheDocument();
  });

  it('deve mostrar alerta de sincronização backend/frontend', () => {
    render(<TjmsDocsPage />);

    expect(screen.getByText(/REGRA CRÍTICA - Sincronização Backend\/Frontend/)).toBeInTheDocument();
    expect(screen.getByText(/Ao alterar qualquer arquivo em/)).toBeInTheDocument();
  });

  it('deve mostrar os cards dos módulos', () => {
    render(<TjmsDocsPage />);

    // Verifica se os 6 módulos principais estão presentes
    expect(screen.getByText('config.py')).toBeInTheDocument();
    expect(screen.getByText('client.py')).toBeInTheDocument();
    expect(screen.getByText('models.py')).toBeInTheDocument();
    expect(screen.getByText('constants.py')).toBeInTheDocument();
    expect(screen.getByText('adapters.py')).toBeInTheDocument();
    expect(screen.getByText('parsers.py')).toBeInTheDocument();
  });
});
