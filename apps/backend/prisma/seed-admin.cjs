// Idempotent, env-gated privileged-user bootstrap for the Operations / Admin
// console. Chained from the end of prisma/seed-rbac.cjs (the backend's single
// preDeployCommand), so it runs after roles are seeded and the roles it grants
// are guaranteed to exist.
//
// It creates or updates one or more portal users from environment variables,
// so production logins for the Ops/Admin console exist without any credential
// being committed to source control. It is a no-op when no account is
// configured, so leaving it wired into every deploy is safe.
//
// Preferred form — a JSON array in BOOTSTRAP_ADMINS. Each entry grants one or
// more roles via `roles: [...]` (or a single `role: "..."`):
//   [{"email":"a@x.com","passwordHash":"$2b$...",
//     "roles":["super_administrator","operations_staff"]},
//    {"email":"b@x.com","passwordHash":"$2b$...",
//     "roles":["administrator","operations_staff"],
//     "firstName":"Support","lastName":"Manager","phone":"+234..."}]
//
// Because a bcrypt hash contains `$`, the JSON can also be supplied base64-
// encoded via BOOTSTRAP_ADMINS_B64 (takes precedence when set) to sidestep any
// `$`-interpolation by the platform storing the variable. Decode target is the
// same JSON array as above.
//
// Single-account fallback (used only when neither JSON form is set):
//   BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD_HASH,
//   BOOTSTRAP_ADMIN_ROLE (default super_administrator),
//   BOOTSTRAP_ADMIN_FIRST_NAME, BOOTSTRAP_ADMIN_LAST_NAME, BOOTSTRAP_ADMIN_PHONE
//
// Every passwordHash is a PRECOMPUTED bcrypt hash — bcrypt is never invoked
// here and no plaintext password ever reaches the environment.
//
// Written as plain CommonJS (not TypeScript) for the same reason as
// seed-rbac.cjs: prisma/ is copied into the production image as raw source and
// ts-node/typescript are pruned from the prod build.

/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS
   script run directly via `node`, not compiled TS source. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function resolveAccounts() {
  const b64 = (process.env.BOOTSTRAP_ADMINS_B64 || '').trim();
  const raw = b64
    ? Buffer.from(b64, 'base64').toString('utf8').trim()
    : (process.env.BOOTSTRAP_ADMINS || '').trim();
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Admin bootstrap: BOOTSTRAP_ADMINS is not valid JSON — ${error.message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Admin bootstrap: BOOTSTRAP_ADMINS must be a JSON array.');
    }
    return parsed;
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const passwordHash = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH;
  if (!email || !passwordHash) {
    return [];
  }
  return [
    {
      email,
      passwordHash,
      role: process.env.BOOTSTRAP_ADMIN_ROLE,
      firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME,
      lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME,
      phone: process.env.BOOTSTRAP_ADMIN_PHONE,
    },
  ];
}

async function ensureAccount(entry) {
  const email = (entry.email || '').trim().toLowerCase();
  const passwordHash = (entry.passwordHash || '').trim();
  if (!email || !passwordHash) {
    throw new Error('Admin bootstrap: each account needs both an email and a passwordHash.');
  }

  // Accept either `roles: [...]` (multi-role) or a single `role: '...'`.
  const roleNames = (
    Array.isArray(entry.roles) && entry.roles.length > 0
      ? entry.roles
      : [entry.role || 'super_administrator']
  ).map((name) => String(name).trim());
  const firstName = (entry.firstName || 'DrippleX').trim();
  const lastName = (entry.lastName || 'Admin').trim();
  const phone = (entry.phone || '').trim() || null;

  const roles = [];
  for (const roleName of roleNames) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      throw new Error(
        `Admin bootstrap: role "${roleName}" is not configured (the RBAC seed must run first).`,
      );
    }
    roles.push(role);
  }

  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: 'ACTIVE', emailVerifiedAt: now },
    create: {
      email,
      phone,
      passwordHash,
      firstName,
      lastName,
      status: 'ACTIVE',
      emailVerifiedAt: now,
      registrationChannel: 'OPERATIONS_CONSOLE',
    },
  });

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }

  process.stdout.write(
    `Admin bootstrap: ensured ${email} with role(s) ${roleNames.join(', ')} (user ${user.id}).\n`,
  );
}

async function main() {
  const accounts = resolveAccounts();
  if (accounts.length === 0) {
    process.stdout.write('Admin bootstrap: no accounts configured — skipping.\n');
    return;
  }
  for (const entry of accounts) {
    await ensureAccount(entry);
  }
  process.stdout.write(`Admin bootstrap: ensured ${String(accounts.length)} account(s).\n`);
}

main()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
