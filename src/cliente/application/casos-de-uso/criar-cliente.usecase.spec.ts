import { CriarClienteUseCase } from './criar-cliente.usecase';
import { TipoDocumento } from '../../domain/cliente.entity';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../../usuario/domain/papel-usuario.enum';
import { Usuario } from '../../../usuario/domain/usuario.entity';

const mockRepo = {
  buscarPorNumeroDoc: jest.fn(),
  buscarPorUsuarioId: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

const mockUsuarioRepo = {
  buscarPorId: jest.fn(),
  buscarPorEmail: jest.fn(),
};

function criarUseCase() {
  return new CriarClienteUseCase(mockRepo as any, mockUsuarioRepo as any);
}

describe('CriarClienteUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve normalizar o numeroDoc removendo pontos, tracos e barras', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockUsuarioRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const cliente = await uc.executar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '111.444.777-35',
      nome: 'Joao',
      email: 'joao@test.com',
      telefone: '11999',
    });

    expect(mockRepo.buscarPorNumeroDoc).toHaveBeenCalledWith('11144477735');
    expect(cliente.numeroDoc).toBe('11144477735');
  });

  it('deve lancar ConflitoDeRecurso se o documento ja existir', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue({ id: 'cl_01' });

    const uc = criarUseCase();
    await expect(
      uc.executar({
        tipoDoc: TipoDocumento.CPF,
        numeroDoc: '11144477735',
        nome: 'Joao',
        email: 'joao@test.com',
        telefone: '11999',
      }),
    ).rejects.toThrow(ConflitoDeRecurso);
  });

  it('deve salvar e retornar o cliente criado', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockUsuarioRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const cliente = await uc.executar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '11144477735',
      nome: 'Maria',
      email: 'maria@test.com',
      telefone: '11888',
    });

    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
    expect(cliente.nome).toBe('Maria');
    expect(cliente.tipoDoc).toBe(TipoDocumento.CPF);
  });

  it('deve normalizar CNPJ removendo pontos, barras e tracos', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockUsuarioRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({
      tipoDoc: TipoDocumento.CNPJ,
      numeroDoc: '11.222.333/0001-81',
      nome: 'Empresa X',
      email: 'empresa@x.com',
      telefone: '1133334444',
    });

    expect(mockRepo.buscarPorNumeroDoc).toHaveBeenCalledWith('11222333000181');
  });

  it('deve associar automaticamente usuario CLIENTE quando o email coincidir', async () => {
    const usuario = Usuario.criar({
      nome: 'Cliente User',
      email: 'joao@test.com',
      senhaHash: 'hash',
      papel: PapelUsuario.CLIENTE,
    });
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockRepo.buscarPorUsuarioId.mockResolvedValue(null);
    mockUsuarioRepo.buscarPorEmail.mockResolvedValue(usuario);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const cliente = await uc.executar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '11144477735',
      nome: 'Joao',
      email: 'joao@test.com',
      telefone: '11999',
    });

    expect(cliente.usuarioId).toBe(usuario.id.valor);
  });
});
