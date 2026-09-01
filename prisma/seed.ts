import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { monotonicFactory } from 'ulidx';

const prisma = new PrismaClient();
const ulid = monotonicFactory();

async function main() {
  const email = 'admin@oficina.com';

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) {
    console.log('admin_seed.skipped');
    return;
  }

  const senhaAdmin = process.env.ADMIN_SEED_PASSWORD?.trim();
  if (!senhaAdmin || senhaAdmin.length < 12) {
    throw new Error(
      'ADMIN_SEED_PASSWORD is required and must have at least 12 characters.',
    );
  }
  const id = `us${ulid()}`;
  const senhaHash = await bcrypt.hash(senhaAdmin, 10);

  await prisma.usuario.create({
    data: {
      id,
      nome: 'Administrador',
      email,
      senhaHash,
      papel: 'ADMINISTRADOR',
      ativo: true,
    },
  });
  console.log('admin_seed.created');
}

main()
  .catch((error: unknown) => {
    console.error({
      event: 'admin_seed.failed',
      error_type: error instanceof Error ? error.name : 'UnknownError',
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
