import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Cliente, TipoDocumento } from '../../domain/cliente.entity';
import { DesativarClienteUseCase } from './desativar-cliente.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorUsuarioId: jest.fn(),
  buscarPorNumeroDoc: jest.fn(),
  listar: jest.fn(),
};

function criarCliente() {
  return Cliente.criar({
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'Joao',
    email: 'joao@test.com',
    telefone: '11999999999',
  });
}

describe('DesativarClienteUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve desativar cliente existente', async () => {
    const cliente = criarCliente();
    mockRepo.buscarPorId.mockResolvedValue(cliente);

    const useCase = new DesativarClienteUseCase(mockRepo as any);
    const resultado = await useCase.executar(cliente.id.valor);

    expect(resultado.ativo).toBe(false);
    expect(mockRepo.salvar).toHaveBeenCalledWith(cliente);
  });

  it('deve lançar quando cliente não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);
    const useCase = new DesativarClienteUseCase(mockRepo as any);

    await expect(useCase.executar('cl_404')).rejects.toThrow(RecursoNaoEncontrado);
  });
});
