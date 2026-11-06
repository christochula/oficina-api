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
import { VeiculoController } from './veiculo.controller';
import { CriarVeiculoUseCase } from '../../../application/casos-de-uso/criar-veiculo.usecase';
import { BuscarVeiculoPorPlacaUseCase } from '../../../application/casos-de-uso/buscar-veiculo-por-placa.usecase';
import { AtualizarVeiculoUseCase } from '../../../application/casos-de-uso/atualizar-veiculo.usecase';
import { DesativarVeiculoUseCase } from '../../../application/casos-de-uso/desativar-veiculo.usecase';
import { AtivarVeiculoUseCase } from '../../../application/casos-de-uso/ativar-veiculo.usecase';
import { ListarVeiculosUseCase } from '../../../application/casos-de-uso/listar-veiculos.usecase';

describe('VeiculoController HTTP validation and operator access', () => {
  let app: INestApplication;
  const payload = {
    placa: 'BRA2E19',
    renavam: '12345678901',
    chassi: '9BWZZZ377VT004251',
    marca: 'Fiat',
    modelo: 'Demo',
    ano: 2020,
    cor: 'Prata',
    quilometragem: 12000,
  };
  const veiculo = { id: 've_test', ...payload };
  const criar = { executar: jest.fn().mockResolvedValue(veiculo) };
  const buscar = { executar: jest.fn().mockResolvedValue(veiculo) };
  const atualizar = { executar: jest.fn().mockResolvedValue(veiculo) };
  const desativar = { executar: jest.fn().mockResolvedValue(veiculo) };
  const ativar = { executar: jest.fn().mockResolvedValue(veiculo) };
  const listar = {
    executar: jest.fn().mockResolvedValue({ itens: [veiculo], total: 3 }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [VeiculoController],
      providers: [
        { provide: CriarVeiculoUseCase, useValue: criar },
        { provide: BuscarVeiculoPorPlacaUseCase, useValue: buscar },
        { provide: AtualizarVeiculoUseCase, useValue: atualizar },
        { provide: DesativarVeiculoUseCase, useValue: desativar },
        { provide: AtivarVeiculoUseCase, useValue: ativar },
        { provide: ListarVeiculosUseCase, useValue: listar },
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

  it('keeps customer and mechanic roles outside the vehicle management endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/veiculos').expect(401);
    for (const role of ['CLIENTE', 'MECANICO']) {
      await request(app.getHttpServer())
        .get('/api/v1/veiculos')
        .set('x-test-role', role)
        .expect(403);
    }
    expect(listar.executar).not.toHaveBeenCalled();
  });

  it('validates registration values and transforms numeric fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/veiculos')
      .set('x-test-role', 'CONSULTOR_TECNICO')
      .send({ ...payload, ano: '2020', quilometragem: '12000' })
      .expect(201);
    expect(criar.executar).toHaveBeenCalledWith(payload);
    await request(app.getHttpServer())
      .post('/api/v1/veiculos')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ ...payload, placa: 'INVALIDA', ano: 1800 })
      .expect(400);
    expect(criar.executar).toHaveBeenCalledTimes(1);
  });

  it('paginates vehicle lists and forwards plate lookup', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/veiculos?pagina=2&porPagina=2')
      .set('x-test-role', 'ADMINISTRADOR')
      .expect(200);
    expect(response.body.meta).toMatchObject({
      pagina: 2,
      porPagina: 2,
      total: 3,
      totalPaginas: 2,
    });
    expect(listar.executar).toHaveBeenCalledWith(2, 2);
    await request(app.getHttpServer())
      .get('/api/v1/veiculos/placa/BRA2E19')
      .set('x-test-role', 'CONSULTOR_TECNICO')
      .expect(200);
    expect(buscar.executar).toHaveBeenCalledWith('BRA2E19');
  });

  it('allows mutable data only and routes activation changes by record ID', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/veiculos/ve_test')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ placa: 'ABC1234' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/v1/veiculos/ve_test')
      .set('x-test-role', 'ADMINISTRADOR')
      .send({ cor: 'Azul', quilometragem: '13000' })
      .expect(200);
    expect(atualizar.executar).toHaveBeenCalledWith({
      id: 've_test',
      cor: 'Azul',
      quilometragem: 13000,
    });
    for (const operation of ['desativar', 'ativar']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/veiculos/ve_test/${operation}`)
        .set('x-test-role', 'ADMINISTRADOR')
        .expect(200);
    }
    expect(desativar.executar).toHaveBeenCalledWith('ve_test');
    expect(ativar.executar).toHaveBeenCalledWith('ve_test');
  });
});
