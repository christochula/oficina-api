import {
  RegraDeNegocio,
  RecursoNaoEncontrado,
} from '../../../shared/excecoes/dominio.exception';
import { Estoque } from '../../domain/estoque.entity';
import { PecaId } from '../../domain/peca-id.value-object';
import { AtualizarPecaUseCase } from './atualizar-peca.usecase';

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
      codigo: 'PC-200',
      nome: 'Filtro de óleo',
      descricao: 'Original',
      precoVenda: 50,
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    quantidadeDisponivel: 15,
    quantidadeMinima: 3,
  });
}

describe('AtualizarPecaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve atualizar dados da peça e salvar', async () => {
    const estoque = criarEstoque();
    mockRepo.buscarPorId.mockResolvedValue(estoque);

    const useCase = new AtualizarPecaUseCase(mockRepo as any);
    const resultado = await useCase.executar({
      pecaId: estoque.id.valor,
      nome: 'Filtro de óleo premium',
      precoVenda: 65,
    });

    expect(resultado.peca.nome).toBe('Filtro de óleo premium');
    expect(resultado.peca.precoVenda).toBe(65);
    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
  });

  it('deve lançar RegraDeNegocio quando nenhum campo for informado', async () => {
    const useCase = new AtualizarPecaUseCase(mockRepo as any);

    await expect(useCase.executar({ pecaId: 'pc_01' })).rejects.toThrow(
      RegraDeNegocio,
    );
  });

  it('deve lançar RecursoNaoEncontrado quando a peça não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);
    const useCase = new AtualizarPecaUseCase(mockRepo as any);

    await expect(
      useCase.executar({ pecaId: 'pc_404', nome: 'x' }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });
});
