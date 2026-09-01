import {
  RecursoNaoEncontrado,
  RegraDeNegocio,
} from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { AtivarUsuarioUseCase } from './ativar-usuario.usecase';

function usuario(papel: PapelUsuario) {
  const resultado = Usuario.criar({
    nome: 'Usuário',
    email: 'usuario@oficina.com.br',
    senhaHash: 'hash',
    papel,
    refreshTokenHash: 'refresh',
  });
  resultado.desativar();
  return resultado;
}

describe('AtivarUsuarioUseCase', () => {
  const repository = { buscarPorId: jest.fn(), salvar: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('ativa e salva usuário interno sem restaurar refresh token', async () => {
    const alvo = usuario(PapelUsuario.MECANICO);
    repository.buscarPorId.mockResolvedValue(alvo);
    const useCase = new AtivarUsuarioUseCase(repository as any);

    const resultado = await useCase.executar(alvo.id.valor);

    expect(resultado.ativo).toBe(true);
    expect(resultado.refreshTokenHash).toBeNull();
    expect(repository.salvar).toHaveBeenCalledWith(alvo);
  });

  it('rejeita usuário CLIENTE', async () => {
    const alvo = usuario(PapelUsuario.CLIENTE);
    repository.buscarPorId.mockResolvedValue(alvo);
    const useCase = new AtivarUsuarioUseCase(repository as any);
    await expect(useCase.executar(alvo.id.valor)).rejects.toThrow(
      RegraDeNegocio,
    );
  });

  it('lança RecursoNaoEncontrado para ID inexistente', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    const useCase = new AtivarUsuarioUseCase(repository as any);
    await expect(useCase.executar('us_01')).rejects.toThrow(
      RecursoNaoEncontrado,
    );
  });
});
