import { Prisma, PrismaClient, TipoDocumento } from '@prisma/client';
import { monotonicFactory } from 'ulidx';
import {
  isValidCNPJ,
  isValidCPF,
} from '../src/shared/utils/documento-validator';
import { clientesDemo, pecasDemo, veiculosDemo } from './demo-data';

interface ResultadoCarga {
  criados: number;
  ignorados: number;
}

const prisma = new PrismaClient();
const ulid = monotonicFactory();

function exigir(condicao: boolean, mensagem: string): void {
  if (!condicao) {
    throw new Error('Massa de demonstração inválida: ' + mensagem);
  }
}

function exigirValoresUnicos(campo: string, valores: readonly string[]): void {
  exigir(
    new Set(valores).size === valores.length,
    'há valores duplicados em ' + campo,
  );
}

function isValidRenavam(renavam: string): boolean {
  if (!/^\d{11}$/.test(renavam)) return false;

  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = pesos.reduce(
    (total, peso, indice) => total + peso * Number(renavam[indice]),
    0,
  );
  const resto = (soma * 10) % 11;
  const digito = resto === 10 ? 0 : resto;
  return digito === Number(renavam[10]);
}

function validarMassa(): void {
  exigir(clientesDemo.length > 0, 'nenhum cliente informado');
  exigir(veiculosDemo.length > 0, 'nenhum veículo informado');
  exigir(pecasDemo.length > 0, 'nenhuma peça informada');

  exigirValoresUnicos(
    'clientes.numeroDoc',
    clientesDemo.map((cliente) => cliente.numeroDoc),
  );
  exigirValoresUnicos(
    'veiculos.placa',
    veiculosDemo.map((veiculo) => veiculo.placa),
  );
  exigirValoresUnicos(
    'veiculos.renavam',
    veiculosDemo.map((veiculo) => veiculo.renavam),
  );
  exigirValoresUnicos(
    'veiculos.chassi',
    veiculosDemo.map((veiculo) => veiculo.chassi),
  );
  exigirValoresUnicos(
    'pecas.codigo',
    pecasDemo.map((peca) => peca.codigo),
  );

  for (const cliente of clientesDemo) {
    const documentoValido =
      cliente.tipoDoc === TipoDocumento.CPF
        ? isValidCPF(cliente.numeroDoc)
        : isValidCNPJ(cliente.numeroDoc);
    exigir(documentoValido, 'documento de cliente inválido');
    exigir(
      cliente.email.endsWith('@example.com'),
      'e-mail fictício deve usar example.com',
    );
    exigir(/^\d{8}$/.test(cliente.cep), 'CEP deve conter oito dígitos');
  }

  for (const veiculo of veiculosDemo) {
    exigir(
      /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(veiculo.placa),
      'placa inválida',
    );
    exigir(isValidRenavam(veiculo.renavam), 'RENAVAM inválido');
    exigir(
      /^[A-HJ-NPR-Z0-9]{17}$/.test(veiculo.chassi),
      'chassi deve ter 17 caracteres válidos',
    );
    exigir(
      Number.isInteger(veiculo.quilometragem) && veiculo.quilometragem >= 0,
      'quilometragem deve ser inteira e não negativa',
    );
  }

  for (const peca of pecasDemo) {
    exigir(
      peca.codigo === peca.codigo.toUpperCase(),
      'código deve ser maiúsculo',
    );
    exigir(Number(peca.precoVenda) >= 0, 'preço não pode ser negativo');
    exigir(
      Number(peca.quantidadeDisponivel) >= 0,
      'estoque disponível não pode ser negativo',
    );
    exigir(
      Number(peca.quantidadeMinima) >= 0,
      'estoque mínimo não pode ser negativo',
    );
  }
}

async function carregarClientes(
  tx: Prisma.TransactionClient,
): Promise<ResultadoCarga> {
  const resultado: ResultadoCarga = { criados: 0, ignorados: 0 };

  for (const cliente of clientesDemo) {
    const existente = await tx.cliente.findUnique({
      where: { numeroDoc: cliente.numeroDoc },
      select: { id: true },
    });
    if (existente) {
      resultado.ignorados += 1;
      continue;
    }

    await tx.cliente.create({
      data: {
        id: 'cl' + ulid(),
        usuarioId: null,
        ...cliente,
        ativo: true,
      },
    });
    resultado.criados += 1;
  }

  return resultado;
}

async function carregarVeiculos(
  tx: Prisma.TransactionClient,
): Promise<ResultadoCarga> {
  const resultado: ResultadoCarga = { criados: 0, ignorados: 0 };

  for (const veiculo of veiculosDemo) {
    const existente = await tx.veiculo.findFirst({
      where: {
        OR: [
          { placa: veiculo.placa },
          { renavam: veiculo.renavam },
          { chassi: veiculo.chassi },
        ],
      },
      select: { id: true },
    });
    if (existente) {
      resultado.ignorados += 1;
      continue;
    }

    await tx.veiculo.create({
      data: {
        id: 've' + ulid(),
        ...veiculo,
        ativo: true,
      },
    });
    resultado.criados += 1;
  }

  return resultado;
}

async function carregarPecas(
  tx: Prisma.TransactionClient,
): Promise<ResultadoCarga> {
  const resultado: ResultadoCarga = { criados: 0, ignorados: 0 };

  for (const peca of pecasDemo) {
    const existente = await tx.peca.findUnique({
      where: { codigo: peca.codigo },
      select: { id: true },
    });
    if (existente) {
      resultado.ignorados += 1;
      continue;
    }

    await tx.peca.create({
      data: {
        id: 'pc' + ulid(),
        codigo: peca.codigo,
        nome: peca.nome,
        descricao: peca.descricao,
        precoVenda: peca.precoVenda,
        ativo: true,
        estoque: {
          create: {
            quantidadeDisponivel: peca.quantidadeDisponivel,
            quantidadeMinima: peca.quantidadeMinima,
          },
        },
      },
    });
    resultado.criados += 1;
  }

  return resultado;
}

async function main(): Promise<void> {
  validarMassa();

  if (process.argv.includes('--validate-only')) {
    console.log(
      JSON.stringify({
        evento: 'demo_seed.validado',
        clientes: clientesDemo.length,
        veiculos: veiculosDemo.length,
        pecas: pecasDemo.length,
      }),
    );
    return;
  }

  const execucaoEmProducao =
    process.env.NODE_ENV?.toLowerCase() === 'production';
  const producaoLiberada = process.env.ALLOW_DEMO_SEED === 'true';
  if (execucaoEmProducao && !producaoLiberada) {
    throw new Error(
      'Execução da massa de demonstração bloqueada em produção. ' +
        'Defina ALLOW_DEMO_SEED=true somente se essa carga for intencional.',
    );
  }

  const resultado = await prisma.$transaction(
    async (tx) => {
      const clientes = await carregarClientes(tx);
      const veiculos = await carregarVeiculos(tx);
      const pecas = await carregarPecas(tx);
      return { clientes, veiculos, pecas };
    },
    { maxWait: 10000, timeout: 30000 },
  );

  console.log(
    JSON.stringify({
      evento: 'demo_seed.concluido',
      ...resultado,
    }),
  );
}

main()
  .catch((error: unknown) => {
    const mensagem =
      error instanceof Error &&
      (error.message.startsWith('Massa de demonstração inválida:') ||
        error.message.startsWith('Execução da massa de demonstração bloqueada'))
        ? error.message
        : undefined;
    console.error({
      evento: 'demo_seed.falhou',
      tipoErro: error instanceof Error ? error.name : 'UnknownError',
      ...(mensagem ? { mensagem } : {}),
    });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
