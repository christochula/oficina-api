import { BuscarUsuarioPorIdUseCase } from './buscar-usuario-por-id.usecase';
import { RecursoNaoEncontrado } from '../../../shared/excecoes/dominio.exception';
import { Usuario } from '../../domain/usuario.entity';
import { PapelUsuario } from '../../domain/papel-usuario.enum';

const mockRepo = {
  buscarPorId: jest.fn(),
  salvar: jest.fn(),
  buscarPorEmail: jest.fn(),
};

function criarUseCase() {
  return new BuscarUsuarioPorIdUseCase(mockRepo as any);
}

describe('BuscarUsuarioPorIdUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lançar RecursoNaoEncontrado se usuário não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    const uc = criarUseCase();
    await expect(uc.executar('us_01')).rejects.toThrow(RecursoNaoEncontrado);
  });

  it('deve retornar o usuário quando existir', async () => {
    const usuario = Usuario.criar({
      nome: 'Admin',
      email: 'admin@oficina.com',
      senhaHash: 'hash',
      papel: PapelUsuario.ADMINISTRADOR,
    });
    mockRepo.buscarPorId.mockResolvedValue(usuario);

    const uc = criarUseCase();
    const resultado = await uc.executar(usuario.id.valor);
    expect(resultado).toBe(usuario);
  });
});
