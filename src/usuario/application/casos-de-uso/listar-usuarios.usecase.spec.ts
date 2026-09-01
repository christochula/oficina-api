import { ListarUsuariosUseCase } from './listar-usuarios.usecase';
import { PapelUsuario } from '../../domain/papel-usuario.enum';

describe('ListarUsuariosUseCase', () => {
  const repository = {
    listarInternos: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.listarInternos.mockResolvedValue({ itens: [], total: 0 });
  });

  it('propaga paginação e filtros ao repositório', async () => {
    const useCase = new ListarUsuariosUseCase(repository as any);
    await useCase.executar(2, 25, {
      busca: 'Ana',
      papel: PapelUsuario.ADMINISTRADOR,
      ativo: true,
    });
    expect(repository.listarInternos).toHaveBeenCalledWith(2, 25, {
      busca: 'Ana',
      papel: PapelUsuario.ADMINISTRADOR,
      ativo: true,
    });
  });

  it('usa filtros vazios por padrão', async () => {
    const useCase = new ListarUsuariosUseCase(repository as any);
    await useCase.executar(1, 20);
    expect(repository.listarInternos).toHaveBeenCalledWith(1, 20, {});
  });

  it('rejeita papel CLIENTE mesmo fora da camada HTTP', async () => {
    const useCase = new ListarUsuariosUseCase(repository as any);
    await expect(
      useCase.executar(1, 20, { papel: PapelUsuario.CLIENTE as any }),
    ).rejects.toThrow('somente papéis internos');
    expect(repository.listarInternos).not.toHaveBeenCalled();
  });
});
