import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { BuscarPecaPorIdUseCase } from './buscar-peca-por-id.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorPecaId: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarEstoque(): Estoque {
  const agora = new Date();
  return Estoque.criar({
    peca: {
      id: PecaId.novo(),
      codigo: 'PC-100',
      nome: 'Pastilha de freio',
      descricao: 'Dianteira',
      precoVenda: 199.9,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    quantidadeDisponivel: 10,
    quantidadeMinima: 2,
  });
}

describe('BuscarPecaPorIdUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar o estoque quando a peça existir', async () => {
    const estoque = criarEstoque();
    mockRepo.buscarPorId.mockResolvedValue(estoque);

    const useCase = new BuscarPecaPorIdUseCase(mockRepo as any);
    const resultado = await useCase.executar(estoque.id.valor);

    expect(resultado).toBe(estoque);
  });

  it('deve lançar RecursoNaoEncontrado quando a peça não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    const useCase = new BuscarPecaPorIdUseCase(mockRepo as any);

    await expect(useCase.executar('pc_inexistente')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });
});
