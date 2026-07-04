import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/shared/database/prisma.service';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configurarAplicacao } from '../src/shared/http/configurar-aplicacao';
import { startPostgres, stopPostgres, getDatabaseUrl } from './testcontainers-setup';
import { execSync } from 'child_process';

jest.setTimeout(120000);

function unwrap<T>(body: any): T {
  return (body?.data ?? body) as T;
}

function extrairId(valor: any): string {
  if (!valor) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor.id === 'string') return valor.id;
  if (typeof valor.id?.valor === 'string') return valor.id.valor;
  return '';
}

function gerarCpfValido(seed: number): string {
  const base = String(seed).slice(-9).padStart(9, '0').split('').map(Number);

  const calcDigito = (numeros: number[], pesoInicial: number): number => {
    const soma = numeros.reduce((acc, n, idx) => acc + n * (pesoInicial - idx), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcDigito(base, 10);
  const d2 = calcDigito([...base, d1], 11);

  return [...base, d1, d2].join('');
}

describe('Fluxo completo da Ordem de Serviço (e2e com Testcontainers)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService | undefined;

  beforeAll(async () => {
    // Iniciar container PostgreSQL
    await startPostgres();

    // Configurar DATABASE_URL antes de criar o módulo
    process.env.DATABASE_URL = getDatabaseUrl();

    // Compilar módulo
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarAplicacao(app);
    await app.init();

    // Obter PrismaService e executar migrações
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    await prismaService.$connect();

    // Executar migrações do Prisma
    try {
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
        stdio: 'pipe',
      });
    } catch (error) {
      // Migrações podem já estar aplicadas
    }

    // Executar seed do admin
    try {
      execSync('npx ts-node prisma/seed.ts', {
        env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
        stdio: 'pipe',
      });
    } catch (error) {
      // Seed pode já ter sido executado
    }
  });

  afterAll(async () => {
    if (prismaService) {
      await prismaService.$disconnect();
    }

    if (app) {
      await app.close();
    }

    // Parar container
    await stopPostgres();
  });

  it('deve executar fluxo ponta a ponta: abrir, aprovar, executar, finalizar e entregar', async () => {
    const sufixo = Date.now();
    const adminEmail = 'admin@oficina.com';
    const adminSenha = process.env.ADMIN_SEED_PASSWORD ?? 'Admin@123';

    const loginAdminResp = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, senha: adminSenha })
      .expect(200);

    const loginAdmin = unwrap<{ accessToken: string }>(loginAdminResp.body);
    const tokenAdmin = loginAdmin.accessToken;

    const criarMecanicoResp = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: `Mecanico ${sufixo}`,
        email: `mecanico.${sufixo}@oficina.com`,
        senha: 'Senha@123',
        papel: 'MECANICO',
      })
      .expect(201);

    const mecanico = unwrap<{ id: string }>(criarMecanicoResp.body);

    const criarUsuarioClienteResp = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: `Cliente User ${sufixo}`,
        email: `cliente.${sufixo}@oficina.com`,
        senha: 'Senha@123',
        papel: 'CLIENTE',
      })
      .expect(201);

    const usuarioCliente = unwrap<{ id: string }>(criarUsuarioClienteResp.body);

    const numeroDoc = gerarCpfValido(sufixo);

    const criarClienteResp = await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        tipoDoc: 'CPF',
        numeroDoc,
        nome: `Cliente ${sufixo}`,
        email: `cliente.${sufixo}@oficina.com`,
        telefone: '11999999999',
        usuarioId: usuarioCliente.id,
      })
      .expect(201);

    const cliente = unwrap<any>(criarClienteResp.body);
    const clienteId = extrairId(cliente);

    const placa = `ABC${String(sufixo).slice(-4)}`;
    const criarVeiculoResp = await request(app.getHttpServer())
      .post('/api/v1/veiculos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        placa,
        renavam: String(10000000000 + (sufixo % 89999999999)),
        chassi: `9BWZZZ377VT${String(sufixo).slice(-6).padStart(6, '0')}`,
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        cor: 'Prata',
      })
      .expect(201);

    const veiculo = unwrap<any>(criarVeiculoResp.body);
    const veiculoId = extrairId(veiculo);

    const criarServicoResp = await request(app.getHttpServer())
      .post('/api/v1/servicos-oficina')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: `Troca de oleo ${sufixo}`, descricao: 'Troca completa', categoria: 'Preventiva' })
      .expect(201);

    const servico = unwrap<any>(criarServicoResp.body);
    const servicoId = extrairId(servico);

    const registrarPecaResp = await request(app.getHttpServer())
      .post('/api/v1/estoque/pecas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo: `PC-${sufixo}`,
        nome: 'Filtro de oleo',
        descricao: 'Filtro original',
        precoVenda: 35,
        quantidadeInicial: 10,
        quantidadeMinima: 2,
      })
      .expect(201);

    const estoque = unwrap<any>(registrarPecaResp.body);
    const pecaId = extrairId(estoque.peca);

    const abrirOSResp = await request(app.getHttpServer())
      .post('/api/v1/ordens-servico')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        clienteId,
        veiculoId,
        servicosSolicitados: [{ servicoId }],
        problemasRelatados: [{ descricao: 'Barulho no motor' }],
      })
      .expect(201);

    const os = unwrap<any>(abrirOSResp.body);
    const osId = extrairId(os);

    const buscarOSResp = await request(app.getHttpServer())
      .get(`/api/v1/ordens-servico/${osId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const osPersistida = unwrap<any>(buscarOSResp.body);
    const osNumero = osPersistida.numero;

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/atribuir/${mecanico.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const loginMecanicoResp = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `mecanico.${sufixo}@oficina.com`, senha: 'Senha@123' })
      .expect(200);

    const tokenMecanico = unwrap<{ accessToken: string }>(loginMecanicoResp.body).accessToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/diagnostico`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .send({ descricao: 'Necessária troca de filtro e óleo' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/orcamento`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .send({
        grupos: [
          {
            titulo: 'Manutencao preventiva',
            linhas: [
              { tipo: 'MATERIAL', descricao: 'Filtro de oleo', quantidade: 1, valorUnitario: 35, pecaId },
              { tipo: 'SERVICO', descricao: 'Troca de oleo', quantidade: 1, valorUnitario: 120 },
            ],
          },
        ],
      })
      .expect(200);

    const loginClienteResp = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `cliente.${sufixo}@oficina.com`, senha: 'Senha@123' })
      .expect(200);

    const tokenCliente = unwrap<{ accessToken: string }>(loginClienteResp.body).accessToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/aprovar`)
      .set('Authorization', `Bearer ${tokenCliente}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/iniciar-execucao`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/consumo-peca`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .send({ pecaId, quantidade: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/finalizar`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/entregar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const statusPublicoResp = await request(app.getHttpServer())
      .get(`/api/v1/ordens-servico/publico/status/${osNumero}/${numeroDoc}`)
      .expect(200);

    const statusPublico = unwrap<{ status: string }>(statusPublicoResp.body);
    expect(statusPublico.status).toBe('ENTREGUE');
  });

  it('deve processar aprovacao externa via webhook com idempotencia e validar token', async () => {
    const sufixo = Date.now() + 1;
    const adminEmail = 'admin@oficina.com';
    const adminSenha = process.env.ADMIN_SEED_PASSWORD ?? 'Admin@123';

    const loginAdminResp = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, senha: adminSenha })
      .expect(200);

    const tokenAdmin = unwrap<{ accessToken: string }>(loginAdminResp.body).accessToken;

    const criarMecanicoResp = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: `Mecanico webhook ${sufixo}`,
        email: `mecanico.webhook.${sufixo}@oficina.com`,
        senha: 'Senha@123',
        papel: 'MECANICO',
      })
      .expect(201);

    const mecanico = unwrap<{ id: string }>(criarMecanicoResp.body);

    const criarUsuarioClienteResp = await request(app.getHttpServer())
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: `Cliente webhook user ${sufixo}`,
        email: `cliente.webhook.${sufixo}@oficina.com`,
        senha: 'Senha@123',
        papel: 'CLIENTE',
      })
      .expect(201);

    const usuarioCliente = unwrap<{ id: string }>(criarUsuarioClienteResp.body);
    const numeroDoc = gerarCpfValido(sufixo);

    const criarClienteResp = await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        tipoDoc: 'CPF',
        numeroDoc,
        nome: `Cliente webhook ${sufixo}`,
        email: `cliente.webhook.${sufixo}@oficina.com`,
        telefone: '11999999999',
        usuarioId: usuarioCliente.id,
      })
      .expect(201);

    const cliente = unwrap<any>(criarClienteResp.body);
    const clienteId = extrairId(cliente);

    const placa = `WKB${String(sufixo).slice(-4)}`;
    const criarVeiculoResp = await request(app.getHttpServer())
      .post('/api/v1/veiculos')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        placa,
        renavam: String(10000000000 + (sufixo % 89999999999)),
        chassi: `9BWZZZ377VT${String(sufixo).slice(-6).padStart(6, '0')}`,
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2021,
        cor: 'Cinza',
      })
      .expect(201);

    const veiculo = unwrap<any>(criarVeiculoResp.body);
    const veiculoId = extrairId(veiculo);

    const criarServicoResp = await request(app.getHttpServer())
      .post('/api/v1/servicos-oficina')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: `Alinhamento ${sufixo}`,
        descricao: 'Alinhamento completo',
        categoria: 'Preventiva',
      })
      .expect(201);

    const servico = unwrap<any>(criarServicoResp.body);
    const servicoId = extrairId(servico);

    const abrirOSResp = await request(app.getHttpServer())
      .post('/api/v1/ordens-servico')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        clienteId,
        veiculoId,
        servicosSolicitados: [{ servicoId }],
        problemasRelatados: [{ descricao: 'Vibracao ao frear' }],
      })
      .expect(201);

    const osId = extrairId(unwrap<any>(abrirOSResp.body));

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/atribuir/${mecanico.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const loginMecanicoResp = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `mecanico.webhook.${sufixo}@oficina.com`, senha: 'Senha@123' })
      .expect(200);

    const tokenMecanico = unwrap<{ accessToken: string }>(loginMecanicoResp.body).accessToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/diagnostico`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .send({ descricao: 'Disco empenado e desalinhamento' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${osId}/orcamento`)
      .set('Authorization', `Bearer ${tokenMecanico}`)
      .send({
        grupos: [
          {
            titulo: 'Correcao',
            linhas: [{ tipo: 'SERVICO', descricao: 'Alinhamento', quantidade: 1, valorUnitario: 180 }],
          },
        ],
      })
      .expect(200);

    const tokenWebhook = `token-webhook-${sufixo}`;
    process.env.ORCAMENTO_WEBHOOK_TOKEN = tokenWebhook;

    const webhookAprovacaoResp = await request(app.getHttpServer())
      .post('/api/v1/ordens-servico/webhook/orcamento')
      .set('x-webhook-token', tokenWebhook)
      .send({ osId, decisao: 'APROVADO', origem: 'gateway-fase2' })
      .expect(201);

    const webhookAprovacao = unwrap<{ status: string }>(webhookAprovacaoResp.body);
    expect(webhookAprovacao.status).toBe('APROVADA');

    const webhookIdempotenteResp = await request(app.getHttpServer())
      .post('/api/v1/ordens-servico/webhook/orcamento')
      .set('x-webhook-token', tokenWebhook)
      .send({ osId, decisao: 'APROVADO', origem: 'gateway-fase2' })
      .expect(201);

    const webhookIdempotente = unwrap<{ status: string }>(webhookIdempotenteResp.body);
    expect(webhookIdempotente.status).toBe('APROVADA');

    await request(app.getHttpServer())
      .post('/api/v1/ordens-servico/webhook/orcamento')
      .set('x-webhook-token', 'token-invalido')
      .send({ osId, decisao: 'APROVADO', origem: 'gateway-fase2' })
      .expect(401);

    const emailAprovacaoResp = await request(app.getHttpServer())
      .post(`/api/v1/ordens-servico/${osId}/status/email`)
      .send({
        novoStatus: 'APROVADA',
        origemMensagem: 'caixa-entrada-oficina',
        idMensagemExterna: `msg-${sufixo}`,
      })
      .expect(201);

    const emailAprovacao = unwrap<{ status: string }>(emailAprovacaoResp.body);
    expect(emailAprovacao.status).toBe('APROVADA');
  });
});
