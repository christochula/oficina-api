import { StatusOrdemServico as StatusOrdemServicoPrisma } from '@prisma/client';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';
import { PapelUsuario } from '../../domain/papel-usuario.enum';
import { Usuario } from '../../domain/usuario.entity';
import { PrismaUsuarioRepository } from './prisma-usuario.repository';

describe('PrismaUsuarioRepository', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn();
  const upsert = jest.fn();
  const ordemServicoCount = jest.fn();
  const prisma = {
    usuario: { findMany, count, findFirst, upsert },
    ordemServico: { count: ordemServicoCount },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
    upsert.mockResolvedValue(undefined);
    ordemServicoCount.mockResolvedValue(0);
  });

  it('restringe a consulta ao papel MECANICO e aplica paginação estável', async () => {
    const repository = new PrismaUsuarioRepository(prisma as any);

    await repository.listarMecanicos(2, 10, {
      busca: ' Carlos ',
      ativo: true,
    });

    const consulta = findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({
      skip: 10,
      take: 10,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      where: {
        papel: PapelUsuario.MECANICO,
        ativo: true,
        OR: [
          { nome: { contains: 'Carlos', mode: 'insensitive' } },
          { email: { contains: 'Carlos', mode: 'insensitive' } },
          { id: { contains: 'Carlos', mode: 'insensitive' } },
        ],
      },
    });
    expect(count).toHaveBeenCalledWith({ where: consulta.where });
  });

  it('preserva o filtro explícito de mecânicos inativos', async () => {
    const repository = new PrismaUsuarioRepository(prisma as any);

    await repository.listarMecanicos(1, 20, { ativo: false });

    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      papel: PapelUsuario.MECANICO,
      ativo: false,
    });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('não cria alternativas de busca para termo vazio', async () => {
    const repository = new PrismaUsuarioRepository(prisma as any);

    await repository.listarMecanicos(1, 20, { busca: '   ' });

    const where = findMany.mock.calls[0][0].where;
    expect(where).toEqual({ papel: PapelUsuario.MECANICO });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('lista apenas papéis internos quando o filtro de papel é omitido', async () => {
    const repository = new PrismaUsuarioRepository(prisma as any);

    await repository.listarInternos(1, 25, {
      busca: ' ANA ',
      ativo: true,
    });

    const consulta = findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({
      skip: 0,
      take: 25,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      where: {
        papel: {
          in: [
            PapelUsuario.ADMINISTRADOR,
            PapelUsuario.CONSULTOR_TECNICO,
            PapelUsuario.MECANICO,
          ],
        },
        ativo: true,
        OR: [
          { nome: { contains: 'ANA', mode: 'insensitive' } },
          { email: { contains: 'ANA', mode: 'insensitive' } },
          { id: { contains: 'ANA', mode: 'insensitive' } },
        ],
      },
    });
    expect(count).toHaveBeenCalledWith({ where: consulta.where });
  });

  it('aplica papel interno específico na listagem', async () => {
    const repository = new PrismaUsuarioRepository(prisma as any);
    await repository.listarInternos(1, 20, {
      papel: PapelUsuario.CONSULTOR_TECNICO,
      ativo: false,
    });
    expect(findMany.mock.calls[0][0].where).toEqual({
      papel: PapelUsuario.CONSULTOR_TECNICO,
      ativo: false,
    });
  });

  it('conta outros administradores ativos', async () => {
    count.mockResolvedValue(2);
    const repository = new PrismaUsuarioRepository(prisma as any);
    await expect(
      repository.contarAdministradoresAtivos('us_alvo'),
    ).resolves.toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: {
        papel: PapelUsuario.ADMINISTRADOR,
        ativo: true,
        id: { not: 'us_alvo' },
      },
    });
  });

  it('conta somente os cinco estados ativos atribuídos ao mecânico', async () => {
    ordemServicoCount.mockResolvedValue(3);
    const repository = new PrismaUsuarioRepository(prisma as any);
    await expect(
      repository.contarOrdensNaoTerminaisDoMecanico('us_mecanico'),
    ).resolves.toBe(3);
    expect(ordemServicoCount).toHaveBeenCalledWith({
      where: {
        mecanicoResponsavelId: 'us_mecanico',
        status: {
          in: [
            StatusOrdemServicoPrisma.ATRIBUIDA,
            StatusOrdemServicoPrisma.EM_DIAGNOSTICO,
            StatusOrdemServicoPrisma.AGUARDANDO_APROVACAO,
            StatusOrdemServicoPrisma.APROVADA,
            StatusOrdemServicoPrisma.EM_EXECUCAO,
          ],
        },
      },
    });
  });

  it('busca e-mail sem diferenciar maiúsculas e minúsculas', async () => {
    const repository = new PrismaUsuarioRepository(prisma as any);
    await repository.buscarPorEmail('  ADMIN@OFICINA.COM.BR ');
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'ADMIN@OFICINA.COM.BR',
          mode: 'insensitive',
        },
      },
    });
  });

  it('mapeia conflito P2002 ao salvar para HTTP 409', async () => {
    upsert.mockRejectedValue({ code: 'P2002' });
    const repository = new PrismaUsuarioRepository(prisma as any);
    const usuario = Usuario.criar({
      nome: 'Ana',
      email: 'ana@oficina.com.br',
      senhaHash: 'hash',
      papel: PapelUsuario.ADMINISTRADOR,
    });

    await expect(repository.salvar(usuario)).rejects.toBeInstanceOf(
      ConflitoDeRecurso,
    );
  });
});
