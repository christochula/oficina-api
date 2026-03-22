import { RegistrarPecaUseCase } from './registrar-peca.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorPecaId: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new RegistrarPecaUseCase(mockRepo as any);
}

describe('RegistrarPecaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve criar estoque com a peça e salvar', async () => {
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const estoque = await uc.executar({
      codigo: 'PC001',
      nome: 'Filtro de Óleo',
      precoVenda: 45.9,
    });

    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
    expect(estoque.peca.codigo).toBe('PC001');
    expect(estoque.peca.nome).toBe('Filtro de Óleo');
    expect(estoque.peca.precoVenda).toBe(45.9);
    expect(estoque.peca.ativo).toBe(true);
  });

  it('deve usar quantidadeInicial 0 por padrão', async () => {
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const estoque = await uc.executar({ codigo: 'PC002', nome: 'Pastilha', precoVenda: 80 });
    expect(estoque.quantidadeDisponivel).toBe(0);
  });

  it('deve usar quantidadeInicial fornecida', async () => {
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const estoque = await uc.executar({ codigo: 'PC003', nome: 'Pneu', precoVenda: 400, quantidadeInicial: 10 });
    expect(estoque.quantidadeDisponivel).toBe(10);
  });

  it('deve usar quantidadeMinima fornecida', async () => {
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const estoque = await uc.executar({ codigo: 'PC004', nome: 'Vela', precoVenda: 30, quantidadeMinima: 5 });
    expect(estoque.quantidadeMinima).toBe(5);
  });

  it('deve gerar pecaId com prefixo pc', async () => {
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const estoque = await uc.executar({ codigo: 'PC005', nome: 'Correia', precoVenda: 120 });
    expect(estoque.peca.id.valor.startsWith('pc')).toBe(true);
  });
});
