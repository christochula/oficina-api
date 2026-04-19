import { RegistrarServicoOficinaUseCase } from './registrar-servico-oficina.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

describe('RegistrarServicoOficinaUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve criar e salvar serviço no catálogo', async () => {
    mockRepo.salvar.mockResolvedValue(undefined);

    const useCase = new RegistrarServicoOficinaUseCase(mockRepo as any);
    const servico = await useCase.executar({
      nome: 'Troca de óleo',
      descricao: 'Troca de óleo e filtro',
      categoria: 'Preventiva',
    });

    expect(servico.nome).toBe('Troca de óleo');
    expect(servico.ativo).toBe(true);
    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
  });
});
