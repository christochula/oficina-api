import { DarEntradaEstoqueUseCase } from './dar-entrada-estoque.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';

const mockRepo = {
  buscarPorPecaId: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new DarEntradaEstoqueUseCase(mockRepo as any);
}

function estoqueFake(quantidade = 5) {
  const agora = new Date();
  return Estoque.criar({
    peca: {
      id: PecaId.novo(),
      codigo: 'PC001',
      nome: 'Filtro',
      precoVenda: 45,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    quantidadeDisponivel: quantidade,
  });
}

describe('DarEntradaEstoqueUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se estoque não existir', async () => {
    mockRepo.buscarPorPecaId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('pc_01', 10)).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve dar entrada e retornar estoque atualizado', async () => {
    const estoque = estoqueFake(5);
    mockRepo.buscarPorPecaId.mockResolvedValue(estoque);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar(estoque.peca.id.valor, 10);

    expect(resultado.quantidadeDisponivel).toBe(15);
  });

  it('deve salvar estoque após entrada', async () => {
    const estoque = estoqueFake(5);
    mockRepo.buscarPorPecaId.mockResolvedValue(estoque);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar(estoque.peca.id.valor, 3);
    expect(mockRepo.salvar).toHaveBeenCalledWith(estoque);
  });
});
