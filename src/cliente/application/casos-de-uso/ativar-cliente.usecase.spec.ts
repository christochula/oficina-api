import { Cliente, TipoDocumento } from '../../domain/cliente.entity';
import { AtivarClienteUseCase } from './ativar-cliente.usecase';

const mockRepo = {
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorUsuarioId: jest.fn(),
  buscarPorNumeroDoc: jest.fn(),
  listar: jest.fn(),
};

describe('AtivarClienteUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve ativar cliente', async () => {
    const cliente = Cliente.criar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '11144477735',
      nome: 'Joao',
      email: 'joao@test.com',
      telefone: '11999999999',
      ativo: false,
    });
    cliente.desativar();
    mockRepo.buscarPorId.mockResolvedValue(cliente);

    const useCase = new AtivarClienteUseCase(mockRepo as any);
    const resultado = await useCase.executar(cliente.id.valor);

    expect(resultado.ativo).toBe(true);
  });
});
