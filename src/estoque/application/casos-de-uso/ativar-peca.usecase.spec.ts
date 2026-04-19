import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { AtivarPecaUseCase } from './ativar-peca.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorPecaId: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

describe('AtivarPecaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve ativar peça', async () => {
    const agora = new Date();
    const estoque = Estoque.criar({
      peca: {
        id: PecaId.novo(),
        codigo: 'PC-301',
        nome: 'Correia',
        descricao: null,
        precoVenda: 120,
        ativo: false,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      quantidadeDisponivel: 3,
      quantidadeMinima: 1,
    });
    estoque.desativarPeca();
    mockRepo.buscarPorId.mockResolvedValue(estoque);

    const useCase = new AtivarPecaUseCase(mockRepo as any);
    const resultado = await useCase.executar(estoque.id.valor);

    expect(resultado.peca.ativo).toBe(true);
  });
});
