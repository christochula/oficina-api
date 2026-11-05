import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ClienteController } from './cliente.controller';
import { CriarClienteUseCase } from '../../../application/casos-de-uso/criar-cliente.usecase';
import { ListarClientesUseCase } from '../../../application/casos-de-uso/listar-clientes.usecase';
import { BuscarClientePorNumeroDocUseCase } from '../../../application/casos-de-uso/buscar-cliente-por-cpf.usecase';
import { AtualizarClienteUseCase } from '../../../application/casos-de-uso/atualizar-cliente.usecase';
import { DesativarClienteUseCase } from '../../../application/casos-de-uso/desativar-cliente.usecase';
import { AtivarClienteUseCase } from '../../../application/casos-de-uso/ativar-cliente.usecase';

describe('ClienteController HTTP validation and operator access', () => {
  let app: INestApplication;
  const payload = {
    tipoDoc: 'CPF',
    numeroDoc: '11144477735',
    nome: 'Cliente teste',
    email: 'cliente@example.com',
    telefone: '11999999999',
    usuarioId: 'us_test',
    endereco: { logradouro: 'Rua A', numero: '10', cidade: 'Sao Paulo' },
  };
  const cliente = { id: 'cl_test', ...payload };
  const criar = { executar: jest.fn().mockResolvedValue(cliente) };
  const listar = {
    executar: jest.fn().mockResolvedValue({ itens: [cliente], total: 5 }),
  };
  const buscar = { executar: jest.fn().mockResolvedValue(cliente) };
  const atualizar = { executar: jest.fn().mockResolvedValue(cliente) };
  const desativar = { executar: jest.fn().mockResolvedValue(cliente) };
  const ativar = { executar: jest.fn().mockResolvedValue(cliente) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClienteController],
      providers: [
        { provide: CriarClienteUseCase, useValue: criar },
        { provide: ListarClientesUseCase, useValue: listar },
        { provide: BuscarClientePorNumeroDocUseCase, useValue: buscar },
        { provide: AtualizarClienteUseCase, useValue: atualizar },
        { provide: DesativarClienteUseCase, useValue: desativar },
        { provide: AtivarClienteUseCase, useValue: ativar },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          // Authentication is a transport fixture; the real PapeisGuard still runs.
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

  it('requires authentication and prevents clients/mechanics reading the customer directory', async () => {
    await request(app.getHttpServer()).get('/api/v1/clientes').expect(401);
    for (const role of ['CLIENTE', 'MECANICO']) {
      await request(app.getHttpServer())
        .get('/api/v1/clientes')
        .set('x-test-role', role)
        .expect(403);
    }
    expect(listar.executar).not.toHaveBeenCalled();
  });

  it('validates nested customer data and forwards operator registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('x-test-role', 'CONSULTOR_TECNICO')
      .send(payload)
      .expect(201);
    expect(criar.executar).toHaveBeenCalledWith(payload);
    await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ ...payload, numeroDoc: '11111111111' })
      .expect(400);
    expect(criar.executar).toHaveBeenCalledTimes(1);
  });

  it('returns pagination metadata with typed filters and resolves documents', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/clientes?pagina=2&porPagina=2&busca=Cliente&ativo=false')
      .set('x-test-role', 'ADMINISTRADOR')
      .expect(200);
    expect(result.body.meta).toEqual({
      pagina: 2,
      porPagina: 2,
      total: 5,
      totalPaginas: 3,
    });
    expect(listar.executar).toHaveBeenCalledWith(2, 2, {
      busca: 'Cliente',
      ativo: false,
    });
    await request(app.getHttpServer())
      .get('/api/v1/clientes/documento/11144477735')
      .set('x-test-role', 'CONSULTOR_TECNICO')
      .expect(200);
    expect(buscar.executar).toHaveBeenCalledWith('11144477735');
  });

  it('rejects fiscal identity edits and forwards update/activation to the correct record', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/clientes/cl_test')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ numeroDoc: '52998224725' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/v1/clientes/cl_test')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ nome: 'Nome atualizado', endereco: { cidade: 'Campinas' } })
      .expect(200);
    expect(atualizar.executar).toHaveBeenCalledWith({
      id: 'cl_test',
      nome: 'Nome atualizado',
      endereco: { cidade: 'Campinas' },
    });
    for (const operation of ['desativar', 'ativar']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/clientes/cl_test/${operation}`)
        .set('x-test-role', 'ADMINISTRADOR')
        .expect(200);
    }
    expect(desativar.executar).toHaveBeenCalledWith('cl_test');
    expect(ativar.executar).toHaveBeenCalledWith('cl_test');
  });
});
