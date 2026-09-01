import { PAPEIS_KEY } from '../../../../auth/decorators/papeis.decorator';
import { PapelUsuario } from '../../../domain/papel-usuario.enum';
import { Usuario } from '../../../domain/usuario.entity';
import { UsuarioController } from './usuario.controller';

describe('UsuarioController.listarMecanicosDisponiveis', () => {
  it('mantém a gestão geral restrita a administrador', () => {
    expect(
      Reflect.getMetadata(PAPEIS_KEY, UsuarioController) as PapelUsuario[],
    ).toEqual([PapelUsuario.ADMINISTRADOR]);
  });

  it('permite exatamente administradores e consultores técnicos', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      UsuarioController.prototype,
      'listarMecanicosDisponiveis',
    );
    const papeis = Reflect.getMetadata(
      PAPEIS_KEY,
      descriptor?.value as object,
    ) as PapelUsuario[];

    expect(papeis).toEqual([
      PapelUsuario.ADMINISTRADOR,
      PapelUsuario.CONSULTOR_TECNICO,
    ]);
  });

  it('retorna envelope paginado sem expor credenciais', async () => {
    const mecanico = Usuario.criar({
      nome: 'Carlos Lima',
      email: 'carlos.lima@oficina.com.br',
      senhaHash: 'hash-secreto',
      papel: PapelUsuario.MECANICO,
      refreshTokenHash: 'refresh-secreto',
    });
    const listarMecanicos = {
      executar: jest.fn().mockResolvedValue({
        itens: [mecanico],
        total: 1,
      }),
    };
    const controller = new UsuarioController(
      {} as any,
      {} as any,
      listarMecanicos as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const resposta = await controller.listarMecanicosDisponiveis({
      pagina: 1,
      porPagina: 10,
      busca: 'Carlos',
      ativo: true,
    });

    expect(listarMecanicos.executar).toHaveBeenCalledWith(1, 10, {
      busca: 'Carlos',
      ativo: true,
    });
    expect(resposta.meta).toEqual({
      pagina: 1,
      porPagina: 10,
      total: 1,
      totalPaginas: 1,
    });
    expect(resposta.data[0]).toMatchObject({
      id: mecanico.id.valor,
      nome: 'Carlos Lima',
      email: 'carlos.lima@oficina.com.br',
      papel: PapelUsuario.MECANICO,
      ativo: true,
    });
    expect(resposta.data[0]).not.toHaveProperty('senhaHash');
    expect(resposta.data[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('lista usuários internos em envelope seguro', async () => {
    const administrador = Usuario.criar({
      nome: 'Ana Admin',
      email: 'ana@oficina.com.br',
      senhaHash: 'hash-secreto',
      papel: PapelUsuario.ADMINISTRADOR,
      refreshTokenHash: 'refresh-secreto',
    });
    const listarUsuarios = {
      executar: jest.fn().mockResolvedValue({
        itens: [administrador],
        total: 1,
      }),
    };
    const controller = new UsuarioController(
      {} as any,
      {} as any,
      {} as any,
      listarUsuarios as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const resposta = await controller.listar({
      pagina: 1,
      porPagina: 20,
      papel: PapelUsuario.ADMINISTRADOR,
      ativo: true,
    });

    expect(listarUsuarios.executar).toHaveBeenCalledWith(1, 20, {
      busca: undefined,
      papel: PapelUsuario.ADMINISTRADOR,
      ativo: true,
    });
    expect(resposta.data[0]).not.toHaveProperty('senhaHash');
    expect(resposta.data[0]).not.toHaveProperty('refreshTokenHash');
    expect(resposta.meta.total).toBe(1);
  });

  it('encaminha o ID autenticado ao desativar', async () => {
    const alvo = Usuario.criar({
      nome: 'Carlos',
      email: 'carlos@oficina.com.br',
      senhaHash: 'hash',
      papel: PapelUsuario.MECANICO,
    });
    const desativarUsuario = {
      executar: jest.fn().mockResolvedValue(alvo),
    };
    const controller = new UsuarioController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      desativarUsuario as any,
    );

    await controller.desativar(alvo.id.valor, {
      sub: 'us_admin',
      papel: PapelUsuario.ADMINISTRADOR,
    });

    expect(desativarUsuario.executar).toHaveBeenCalledWith(
      alvo.id.valor,
      'us_admin',
    );
  });

  it('atualiza usuário sem expor hashes', async () => {
    const alvo = Usuario.criar({
      nome: 'Carlos',
      email: 'carlos@oficina.com.br',
      senhaHash: 'hash-secreto',
      papel: PapelUsuario.MECANICO,
      refreshTokenHash: 'refresh-secreto',
    });
    const atualizarUsuario = {
      executar: jest.fn().mockResolvedValue(alvo),
    };
    const controller = new UsuarioController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      atualizarUsuario as any,
      {} as any,
      {} as any,
    );

    const resposta = await controller.atualizar(alvo.id.valor, {
      nome: 'Carlos Souza',
    });

    expect(atualizarUsuario.executar).toHaveBeenCalledWith({
      id: alvo.id.valor,
      nome: 'Carlos Souza',
    });
    expect(resposta).not.toHaveProperty('senhaHash');
    expect(resposta).not.toHaveProperty('refreshTokenHash');
  });

  it('ativa usuário sem expor hashes', async () => {
    const alvo = Usuario.criar({
      nome: 'Ana',
      email: 'ana@oficina.com.br',
      senhaHash: 'hash-secreto',
      papel: PapelUsuario.CONSULTOR_TECNICO,
    });
    const ativarUsuario = { executar: jest.fn().mockResolvedValue(alvo) };
    const controller = new UsuarioController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      ativarUsuario as any,
      {} as any,
    );

    const resposta = await controller.ativar(alvo.id.valor);

    expect(ativarUsuario.executar).toHaveBeenCalledWith(alvo.id.valor);
    expect(resposta).not.toHaveProperty('senhaHash');
    expect(resposta).not.toHaveProperty('refreshTokenHash');
  });
});
