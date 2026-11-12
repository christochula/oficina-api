import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ServicoOficinaController } from './servico-oficina.controller';
import { RegistrarServicoOficinaUseCase } from '../../../application/casos-de-uso/registrar-servico-oficina.usecase';
import { ListarServicosOficinaUseCase } from '../../../application/casos-de-uso/listar-servicos-oficina.usecase';
import { BuscarServicoOficinaPorIdUseCase } from '../../../application/casos-de-uso/buscar-servico-oficina-por-id.usecase';
import { AtualizarServicoOficinaUseCase } from '../../../application/casos-de-uso/atualizar-servico-oficina.usecase';
import { DesativarServicoOficinaUseCase } from '../../../application/casos-de-uso/desativar-servico-oficina.usecase';
import { AtivarServicoOficinaUseCase } from '../../../application/casos-de-uso/ativar-servico-oficina.usecase';

describe('ServicoOficinaController HTTP catalog permissions', () => {
  let app: INestApplication;
  const servico = {
    id: 'sv_test',
    nome: 'Alinhamento',
    descricao: 'Alinhamento dos eixos',
    categoria: 'Preventiva',
  };
  const registrar = { executar: jest.fn().mockResolvedValue(servico) };
  const listar = {
    executar: jest.fn().mockResolvedValue({ itens: [servico], total: 4 }),
  };
  const buscar = { executar: jest.fn().mockResolvedValue(servico) };
  const atualizar = { executar: jest.fn().mockResolvedValue(servico) };
  const desativar = { executar: jest.fn().mockResolvedValue(servico) };
  const ativar = { executar: jest.fn().mockResolvedValue(servico) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ServicoOficinaController],
      providers: [
        { provide: RegistrarServicoOficinaUseCase, useValue: registrar },
        { provide: ListarServicosOficinaUseCase, useValue: listar },
        { provide: BuscarServicoOficinaPorIdUseCase, useValue: buscar },
        { provide: AtualizarServicoOficinaUseCase, useValue: atualizar },
        { provide: DesativarServicoOficinaUseCase, useValue: desativar },
        { provide: AtivarServicoOficinaUseCase, useValue: ativar },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          const papel = req.headers['x-test-role'];
          if (!papel) throw new UnauthorizedException();
          req.user = { sub: 'test-operator', papel };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  it('allows authenticated workshop roles to read catalog while denying customers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/servicos-oficina')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/servicos-oficina')
      .set('x-test-role', 'CLIENTE')
      .expect(403);
    for (const role of ['ADMINISTRADOR', 'CONSULTOR_TECNICO', 'MECANICO']) {
      const result = await request(app.getHttpServer())
        .get('/api/v1/servicos-oficina?pagina=2&porPagina=3')
        .set('x-test-role', role)
        .expect(200);
      expect(result.body.meta).toEqual({
        pagina: 2,
        porPagina: 3,
        total: 4,
        totalPaginas: 2,
      });
    }
    expect(listar.executar).toHaveBeenCalledWith(2, 3, {
      busca: undefined,
      ativo: undefined,
    });
  });

  it('restricts catalog mutations to administrators and validates DTOs', async () => {
    const payload = {
      nome: servico.nome,
      descricao: servico.descricao,
      categoria: servico.categoria,
    };
    for (const role of ['CONSULTOR_TECNICO', 'MECANICO', 'CLIENTE']) {
      await request(app.getHttpServer())
        .post('/api/v1/servicos-oficina')
        .set('x-test-role', role)
        .send(payload)
        .expect(403);
    }
    await request(app.getHttpServer())
      .post('/api/v1/servicos-oficina')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ nome: 'A' })
      .expect(400);
    expect(registrar.executar).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/v1/servicos-oficina')
      .set('x-test-role', 'ADMINISTRADOR')
      .send(payload)
      .expect(201);
    expect(registrar.executar).toHaveBeenCalledWith(payload);
  });

  it('forwards record IDs and mutable nullable fields to the correct operations', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/servicos-oficina/sv_test')
      .set('x-test-role', 'MECANICO')
      .expect(200);
    expect(buscar.executar).toHaveBeenCalledWith('sv_test');
    await request(app.getHttpServer())
      .patch('/api/v1/servicos-oficina/sv_test')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ nome: 'Alinhamento completo', descricao: null, categoria: null })
      .expect(200);
    expect(atualizar.executar).toHaveBeenCalledWith({
      id: 'sv_test',
      nome: 'Alinhamento completo',
      descricao: null,
      categoria: null,
    });
    for (const operation of ['desativar', 'ativar']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/servicos-oficina/sv_test/${operation}`)
        .set('x-test-role', 'ADMINISTRADOR')
        .expect(200);
    }
    expect(desativar.executar).toHaveBeenCalledWith('sv_test');
    expect(ativar.executar).toHaveBeenCalledWith('sv_test');
  });

  it('preserves not-found semantics from the application layer', async () => {
    buscar.executar.mockRejectedValueOnce(new NotFoundException('Ausente'));
    await request(app.getHttpServer())
      .get('/api/v1/servicos-oficina/absent')
      .set('x-test-role', 'CONSULTOR_TECNICO')
      .expect(404);
  });
  it('validates global search and inactive filters without weakening role access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/servicos-oficina')
      .query({
        busca: '  Última revisão  ',
        ativo: 'false',
        pagina: 6,
        porPagina: 20,
      })
      .set('x-test-role', 'CONSULTOR_TECNICO')
      .expect(200);
    expect(listar.executar).toHaveBeenCalledWith(6, 20, {
      busca: 'Última revisão',
      ativo: false,
    });
    for (const query of [
      { ativo: 'yes' },
      { busca: 'x'.repeat(121) },
      { porPagina: 101 },
    ]) {
      await request(app.getHttpServer())
        .get('/api/v1/servicos-oficina')
        .query(query)
        .set('x-test-role', 'ADMINISTRADOR')
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/api/v1/servicos-oficina?busca=ultima&ativo=false')
      .set('x-test-role', 'CLIENTE')
      .expect(403);
  });
});
