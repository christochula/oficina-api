import { CriarUsuarioUseCase } from './criar-usuario.usecase';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../domain/papel-usuario.enum';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
}));

const mockRepo = {
  buscarPorEmail: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
};

function criarUseCase() {
  return new CriarUsuarioUseCase(mockRepo as any);
}

describe('CriarUsuarioUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar ConflitoDeRecurso se email já existir', async () => {
    mockRepo.buscarPorEmail.mockResolvedValue({ id: 'us_01' });

    const uc = criarUseCase();
    await expect(
      uc.executar({
        nome: 'João',
        email: 'joao@test.com',
        senha: '123',
        papel: PapelUsuario.MECANICO,
      }),
    ).rejects.toThrow(ConflitoDeRecurso);
  });

  it('deve criar usuário com hash da senha', async () => {
    mockRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const usuario = await uc.executar({
      nome: 'Carlos',
      email: 'carlos@oficina.com',
      senha: 'senha123',
      papel: PapelUsuario.MECANICO,
    });

    expect(usuario.nome).toBe('Carlos');
    expect(usuario.email).toBe('carlos@oficina.com');
    expect(usuario.senhaHash).toBe('$2b$10$hashedpassword');
    expect(usuario.papel).toBe(PapelUsuario.MECANICO);
  });

  it('deve salvar o usuário criado', async () => {
    mockRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({
      nome: 'Ana',
      email: 'ana@test.com',
      senha: 'pass',
      papel: PapelUsuario.ADMINISTRADOR,
    });

    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
  });

  it('deve gerar id com prefixo us', async () => {
    mockRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const usuario = await uc.executar({
      nome: 'Zé',
      email: 'ze@test.com',
      senha: 'pass',
      papel: PapelUsuario.CONSULTOR_TECNICO,
    });
    expect(usuario.id.valor.startsWith('us')).toBe(true);
  });

  it('deve normalizar e-mail antes de verificar e persistir', async () => {
    mockRepo.buscarPorEmail.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const usuario = await uc.executar({
      nome: 'Ana',
      email: '  ANA@OFICINA.COM.BR ',
      senha: 'senha123',
      papel: PapelUsuario.ADMINISTRADOR,
    });

    expect(mockRepo.buscarPorEmail).toHaveBeenCalledWith('ana@oficina.com.br');
    expect(usuario.email).toBe('ana@oficina.com.br');
  });

  it('deve rejeitar senha acima de 72 bytes antes do bcrypt', async () => {
    const uc = criarUseCase();
    await expect(
      uc.executar({
        nome: 'Ana',
        email: 'ana@oficina.com.br',
        senha: 'á'.repeat(37),
        papel: PapelUsuario.ADMINISTRADOR,
      }),
    ).rejects.toThrow('72 bytes');
    expect(mockRepo.salvar).not.toHaveBeenCalled();
  });
});
