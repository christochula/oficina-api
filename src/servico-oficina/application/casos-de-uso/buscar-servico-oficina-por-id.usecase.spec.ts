import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { ServicoOficina } from '../../domain/servico-oficina.entity';
import { ServicoOficinaId } from '../../domain/servico-oficina-id.value-object';
import { BuscarServicoOficinaPorIdUseCase } from './buscar-servico-oficina-por-id.usecase';

describe('BuscarServicoOficinaPorIdUseCase', () => {
  const mockRepo = {
    salvar: jest.fn(),
    buscarPorId: jest.fn(),
    listar: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('deve retornar o serviço quando encontrado', async () => {
    const servico = ServicoOficina.reconstituir({
      id: ServicoOficinaId.novo(),
      nome: 'Geometria',
      descricao: 'Ajuste completo',
      categoria: 'Suspensão',
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    mockRepo.buscarPorId.mockResolvedValue(servico);

    const useCase = new BuscarServicoOficinaPorIdUseCase(mockRepo as any);
    const resultado = await useCase.executar(servico.id.valor);

    expect(resultado).toBe(servico);
  });

  it('deve lançar RecursoNaoEncontrado quando não encontrar serviço', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    const useCase = new BuscarServicoOficinaPorIdUseCase(mockRepo as any);

    await expect(useCase.executar('sv_404')).rejects.toThrow(RecursoNaoEncontrado);
  });
});
