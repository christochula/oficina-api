import { AtualizarClienteUseCase } from './atualizar-cliente.usecase';
import { Cliente, TipoDocumento } from '../../domain/cliente.entity';
import { ClienteId } from '../../domain/cliente-id.value-object';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';

const mockRepo = {
  buscarPorId: jest.fn(),
  salvar: jest.fn(),
  buscarPorNumeroDoc: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new AtualizarClienteUseCase(mockRepo as any);
}

function clienteFake() {
  return Cliente.reconstituir({
    id: ClienteId.novo(),
    tipoDoc: TipoDocumento.CPF,
    numeroDoc: '11144477735',
    nome: 'João Silva',
    email: 'joao@test.com',
    telefone: '11999',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });
}

describe('AtualizarClienteUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se cliente não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(
      uc.executar({ id: 'cl_01', nome: 'Novo Nome' }),
    ).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve atualizar nome do cliente e salvar', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorId.mockResolvedValue(cliente);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({ id: cliente.id.valor, nome: 'Novo Nome' });

    expect(resultado.nome).toBe('Novo Nome');
    expect(mockRepo.salvar).toHaveBeenCalledWith(cliente);
  });

  it('deve atualizar email do cliente', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorId.mockResolvedValue(cliente);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({ id: cliente.id.valor, email: 'novo@email.com' });
    expect(resultado.email).toBe('novo@email.com');
  });

  it('não deve alterar tipoDoc nem numeroDoc', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorId.mockResolvedValue(cliente);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({ id: cliente.id.valor, nome: 'Outro' });

    expect(cliente.tipoDoc).toBe(TipoDocumento.CPF);
    expect(cliente.numeroDoc).toBe('11144477735');
  });

  it('deve retornar o cliente atualizado', async () => {
    const cliente = clienteFake();
    mockRepo.buscarPorId.mockResolvedValue(cliente);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const resultado = await uc.executar({ id: cliente.id.valor, telefone: '11777' });
    expect(resultado).toBe(cliente);
  });
});
