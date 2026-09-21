import { PrismaClient, AuthProvider, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const client = new PrismaClient();
  try {
    const email = 'admin@gobloco.com';
    const username = 'admin';
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    const existing = await client.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      await client.user.update({
        where: { id: existing.id },
        data: { role: 1, passwordHash, status: UserStatus.ACTIVE },
      });
      console.log(`Admin atualizado (id ${existing.id}, role=1): ${email}`);
    } else {
      const user = await client.user.create({
        data: {
          name: 'Administrador',
          username,
          email,
          passwordHash,
          role: 1,
          authProvider: AuthProvider.LOCAL,
          status: UserStatus.ACTIVE,
        },
      });
      console.log(`Admin criado (id ${user.id}): ${email}`);
    }
  } catch (e) {
    console.error('ERRO:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}

main();