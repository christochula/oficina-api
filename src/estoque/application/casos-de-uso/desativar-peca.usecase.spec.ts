import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { DesativarPecaUseCase } from './desativar-peca.usecase';

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
      codigo: 'PC-300',
      nome: 'Filtro',
      descricao: null,
      precoVenda: 20,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    quantidadeDisponivel: 5,
    quantidadeMinima: 1,
  });
}

describe('DesativarPecaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve desativar peça', async () => {
    const estoque = criarEstoque();
    mockRepo.buscarPorId.mockResolvedValue(estoque);

    const useCase = new DesativarPecaUseCase(mockRepo as any);
    const resultado = await useCase.executar(estoque.id.valor);

    expect(resultado.peca.ativo).toBe(false);
  });

  it('deve lançar quando peça não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);
    const useCase = new DesativarPecaUseCase(mockRepo as any);

    await expect(useCase.executar('pc_404')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });
});
