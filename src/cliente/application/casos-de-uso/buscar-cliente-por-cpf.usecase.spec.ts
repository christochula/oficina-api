import { BuscarClientePorNumeroDocUseCase } from './buscar-cliente-por-cpf.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { TipoDocumento } from '../../domain/cliente.entity';
import { Cliente } from '../../domain/cliente.entity';

const mockRepo = {
  buscarPorNumeroDoc: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new BuscarClientePorNumeroDocUseCase(mockRepo as any);
}

function clienteFake() {
  return Cliente.criar({
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'João',
    email: 'joao@test.com',
    telefone: '11999',
  });
}

describe('BuscarClientePorNumeroDocUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve normalizar o doc antes de buscar', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(cliente);

    const uc = criarUseCase();
    await uc.executar('111.444.777-35');

    expect(mockRepo.buscarPorNumeroDoc).toHaveBeenCalledWith('11144477735');
  });

  it('deve retornar o cliente encontrado', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(cliente);

    const uc = criarUseCase();
    const resultado = await uc.executar('11144477735');
    expect(resultado).toBe(cliente);
  });

  it('deve lançar RecursoNaoEncontrado se cliente não existir', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('11144477735')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });

  it('deve normalizar CNPJ formatado antes de buscar', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);

    const uc = criarUseCase();
    try {
      await uc.executar('11.222.333/0001-81');
    } catch {
      // espera-se RecursoNaoEncontrado
    }
    expect(mockRepo.buscarPorNumeroDoc).toHaveBeenCalledWith('11222333000181');
  });
});
