/**
 * LOCAL STACK ONLY. Provisions the DEV super admin "out of band", the way the backend docs require
 * (docs/PROJECT_CONTEXT.md: a fresh install has no SUPER_ADMIN and there is no API path to one).
 *
 * Promotes the seeded bootstrap account to SUPER_ADMIN and clears its forced password change, with
 * an audit row. Refuses to touch any database other than the local stack's.
 *
 * Run through stack.ps1 (it sets the local env and runs this with the backend's own tsx).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const backendDir = process.env.CLEARWOOD_BACKEND_DIR;
const email = process.env.DEV_SUPERADMIN_EMAIL;
if (!backendDir || !email) throw new Error('Run this through local-stack/stack.ps1 provision.');

const url = new URL(process.env.DATABASE_URL ?? '');
if (`${url.hostname}:${url.port}` !== '127.0.0.1:3317' || url.pathname !== '/clearwood_local') {
  throw new Error(
    `Refusing to provision ${url.hostname}:${url.port}${url.pathname}: not the local stack.`,
  );
}

const { prisma } = await import(
  pathToFileURL(path.join(backendDir, 'prisma/seed/context.ts')).href
);

const user = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
if (!user) throw new Error(`${email} does not exist yet - run the seed first.`);

const role = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' }, select: { id: true } });
if (!role) throw new Error('SUPER_ADMIN role is missing - run the seed first.');

await prisma.$transaction(async (tx: typeof prisma) => {
  await tx.adminUserRole.deleteMany({ where: { adminUserId: user.id } });
  await tx.adminUserRole.create({ data: { adminUserId: user.id, roleId: role.id } });
  await tx.adminUser.update({
    where: { id: user.id },
    data: { mustChangePassword: false, permissionVersion: { increment: 1 } },
  });
  await tx.auditLog.create({
    data: {
      actorType: 'SYSTEM',
      action: 'ROLE_ASSIGNED',
      entity: 'AdminUser',
      entityId: user.id,
      severity: 'CRITICAL',
      meta: JSON.stringify({
        email,
        role: 'SUPER_ADMIN',
        source: 'local-stack provision (DEV only)',
      }),
    },
  });
});

console.log(`${email} is now the DEV SUPER_ADMIN.`);
await prisma.$disconnect();
