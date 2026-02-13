import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, type ColumnDef } from '../DataTable'

// Tipo de dados de teste
interface Pessoa {
  id: number
  nome: string
  idade: number
  cidade: string
}

// Colunas de teste
const columns: ColumnDef<Pessoa>[] = [
  { accessor: 'nome', header: 'Nome', sortable: true },
  { accessor: 'idade', header: 'Idade', sortable: true },
  { accessor: 'cidade', header: 'Cidade' },
]

// Dados de teste
const dados: Pessoa[] = [
  { id: 1, nome: 'Alice', idade: 30, cidade: 'Campo Grande' },
  { id: 2, nome: 'Bruno', idade: 25, cidade: 'Dourados' },
  { id: 3, nome: 'Carla', idade: 35, cidade: 'Campo Grande' },
  { id: 4, nome: 'Diego', idade: 28, cidade: 'Tres Lagoas' },
  { id: 5, nome: 'Elena', idade: 22, cidade: 'Corumba' },
]

describe('DataTable', () => {
  it('deve renderizar tabela com dados', () => {
    render(<DataTable columns={columns} data={dados as unknown as Record<string, unknown>[]} />)

    expect(screen.getByText('Nome')).toBeInTheDocument()
    expect(screen.getByText('Idade')).toBeInTheDocument()
    expect(screen.getByText('Cidade')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bruno')).toBeInTheDocument()
  })

  it('deve mostrar skeleton quando isLoading', () => {
    render(<DataTable columns={columns} data={[]} isLoading />)

    // Headers ainda aparecem no skeleton
    expect(screen.getByText('Nome')).toBeInTheDocument()
    // Dados nao devem aparecer
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('deve mostrar mensagem vazia quando nao ha dados', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Sem resultados" />)

    expect(screen.getByText('Sem resultados')).toBeInTheDocument()
  })

  it('deve filtrar dados pelo campo de busca', async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={dados as unknown as Record<string, unknown>[]}
        searchable
      />
    )

    const input = screen.getByPlaceholderText('Buscar...')
    await user.type(input, 'Alice')

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument()
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('deve ordenar ao clicar no header ordenavel', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={dados as unknown as Record<string, unknown>[]} />)

    // Clica no header "Idade" para ordenar ascendente
    const idadeHeader = screen.getByText('Idade')
    await user.click(idadeHeader)

    // Pega todas as celulas da coluna Idade (indice 1)
    const rows = screen.getAllByRole('row').slice(1) // remove header
    const firstRowCells = rows[0].querySelectorAll('td')
    // Idade menor (22 - Elena) deve ser primeira
    expect(firstRowCells[1].textContent).toBe('22')
  })

  it('deve paginar quando ha muitos dados', () => {
    // Gera 25 itens
    const muitosDados = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      nome: `Pessoa ${i + 1}`,
      idade: 20 + i,
      cidade: 'Cidade',
    }))

    render(
      <DataTable
        columns={columns}
        data={muitosDados as unknown as Record<string, unknown>[]}
        pageSize={10}
      />
    )

    // Deve mostrar informacao de paginacao
    expect(screen.getByText(/Pagina 1 de 3/)).toBeInTheDocument()
    expect(screen.getByText('Anterior')).toBeDisabled()
    expect(screen.getByText('Proximo')).not.toBeDisabled()
  })

  it('deve chamar onRowClick ao clicar numa linha', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(
      <DataTable
        columns={columns}
        data={dados as unknown as Record<string, unknown>[]}
        onRowClick={handleClick}
      />
    )

    await user.click(screen.getByText('Alice'))

    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Alice', idade: 30 })
    )
  })

  it('deve renderizar celula com funcao render customizada', () => {
    const customColumns: ColumnDef<Pessoa>[] = [
      { accessor: 'nome', header: 'Nome' },
      {
        accessor: 'idade',
        header: 'Idade',
        render: (val) => <span data-testid="custom-cell">{String(val)} anos</span>,
      },
    ]

    render(
      <DataTable
        columns={customColumns}
        data={dados as unknown as Record<string, unknown>[]}
      />
    )

    const customCells = screen.getAllByTestId('custom-cell')
    expect(customCells[0]).toHaveTextContent('30 anos')
  })

  it('deve navegar entre paginas', async () => {
    const user = userEvent.setup()
    const muitosDados = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      nome: `Pessoa ${i + 1}`,
      idade: 20 + i,
      cidade: 'Cidade',
    }))

    render(
      <DataTable
        columns={columns}
        data={muitosDados as unknown as Record<string, unknown>[]}
        pageSize={10}
      />
    )

    expect(screen.getByText(/Pagina 1 de 2/)).toBeInTheDocument()

    // Vai para proxima pagina
    await user.click(screen.getByText('Proximo'))
    expect(screen.getByText(/Pagina 2 de 2/)).toBeInTheDocument()
    expect(screen.getByText('Proximo')).toBeDisabled()

    // Volta para pagina anterior
    await user.click(screen.getByText('Anterior'))
    expect(screen.getByText(/Pagina 1 de 2/)).toBeInTheDocument()
  })

  it('deve exibir mensagem padrao quando emptyMessage nao e fornecida', () => {
    render(<DataTable columns={columns} data={[]} />)

    expect(screen.getByText('Nenhum resultado encontrado')).toBeInTheDocument()
  })
})
