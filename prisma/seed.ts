import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { monotonicFactory } from 'ulidx';

const prisma = new PrismaClient();
const ulid = monotonicFactory();

async function main() {
  const email = 'admin@oficina.com';

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) {
    console.log(`Admin ja existe: ${existe.id} (${existe.email})`);
    return;
  }

  const senhaAdmin = process.env.ADMIN_SEED_PASSWORD ?? 'Admin@123';
  const id = `us${ulid()}`;
  const senhaHash = await bcrypt.hash(senhaAdmin, 10);

  const admin = await prisma.usuario.create({
    data: {
      id,
      nome: 'Administrador',
      email,
      senhaHash,
      papel: 'ADMINISTRADOR',
      ativo: true,
    },
  });
  console.log(`Admin criado com sucesso!`);
  console.log(`  id:    ${admin.id}`);
  console.log(`  email: ${admin.email}`);
  console.log(`  senha: ${senhaAdmin}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
