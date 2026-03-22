import { AcessoNegado } from '../../../shared/excecoes/dominio.exception';
import { Cliente, TipoDocumento } from '../../domain/cliente.entity';
import { ClienteId } from '../../domain/cliente-id.value-object';
import { BuscarClientePorUsuarioUseCase } from './buscar-cliente-por-usuario.usecase';

const mockRepo = {
  buscarPorUsuarioId: jest.fn(),
};

function criarUseCase() {
  return new BuscarClientePorUsuarioUseCase(mockRepo as any);
}

function clienteFake() {
  return Cliente.reconstituir({
    id: ClienteId.novo(),
    usuarioId: 'us_01',
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'Joao Silva',
    email: 'joao@test.com',
    telefone: '11999',
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });
}

describe('BuscarClientePorUsuarioUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve retornar o cliente vinculado ao usuario', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorUsuarioId.mockResolvedValue(cliente);

    const uc = criarUseCase();
    const resultado = await uc.executar('us_01');

    expect(resultado).toBe(cliente);
  });

  it('deve lancar AcessoNegado quando o usuario nao estiver vinculado', async () => {
    mockRepo.buscarPorUsuarioId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('us_01')).rejects.toThrow(AcessoNegado);
  });
});
