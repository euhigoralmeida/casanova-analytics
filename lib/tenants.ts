import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export type TenantUser = {
  email: string;
  passwordHash: string;
  role: "admin" | "viewer" | "editor";
  globalRole?: string; // "platform_admin" | undefined
  name: string;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  users: TenantUser[];
};

// Hardcoded fallback (for when DB has no tenants yet)
const FALLBACK_TENANTS: Tenant[] = [
  {
    id: "casanova",
    name: "Casanova",
    slug: "casanova",
    logo: "/logo-casanova.png",
    users: [
      {
        email: "casanova@fivep.com.br",
        passwordHash: "$2b$12$T2f9oRaehlbIR0/hnVJ12eoPdDiUJBfU8jV7VV1RiyO1pPUqmzRgu",
        role: "admin",
        name: "Admin Casanova",
      },
    ],
  },
  {
    id: "fivep",
    name: "Fivep",
    slug: "fivep",
    logo: "/logo-fivep.png",
    users: [
      {
        email: "adm@fivep.com.br",
        passwordHash: "$2b$12$xTXW7iLmNQR6/HjF24oYvOI7g1/yI8fzBSL.VD9WWZB9rSZvbY7vy",
        role: "admin",
        globalRole: "platform_admin",
        name: "Higo Almeida",
      },
    ],
  },
  {
    id: "yellalife",
    name: "Yella Life",
    slug: "yellalife",
    logo: "/logo-yellalife.png",
    users: [
      {
        email: "yella@fivep.com.br",
        passwordHash: "$2b$12$WyHPLeDXsTxTI87w7Ic.JOByfM7POqDVngoU/c4di4dC3nDsfpXEW",
        role: "admin",
        name: "Admin Yella Life",
      },
    ],
  },
];

export async function getTenant(tenantId: string): Promise<Tenant | undefined> {
  try {
    const dbTenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { slug: tenantId }], active: true },
      include: { users: { where: { active: true } } },
    });
    if (dbTenant) {
      return {
        id: dbTenant.id,
        name: dbTenant.name,
        slug: dbTenant.slug,
        logo: dbTenant.logo ?? undefined,
        users: dbTenant.users.map((u) => ({
          email: u.email,
          passwordHash: u.passwordHash,
          role: u.role as TenantUser["role"],
          globalRole: u.globalRole ?? undefined,
          name: u.name,
        })),
      };
    }
  } catch {
    // DB not available, use fallback
  }
  return FALLBACK_TENANTS.find((t) => t.id === tenantId || t.slug === tenantId);
}

export async function getAllTenants(): Promise<Tenant[]> {
  try {
    const dbTenants = await prisma.tenant.findMany({
      where: { active: true },
      include: { users: { where: { active: true } } },
    });
    if (dbTenants.length > 0) {
      return dbTenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        logo: t.logo ?? undefined,
        users: t.users.map((u) => ({
          email: u.email,
          passwordHash: u.passwordHash,
          role: u.role as TenantUser["role"],
          globalRole: u.globalRole ?? undefined,
          name: u.name,
        })),
      }));
    }
  } catch {
    // DB not available
  }
  return FALLBACK_TENANTS;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ tenant: Tenant; user: TenantUser } | null> {
  // Try DB first
  try {
    const dbUser = await prisma.user.findFirst({
      where: { email, active: true },
      include: { tenant: true },
    });
    if (dbUser && dbUser.tenant.active) {
      const valid = await bcrypt.compare(password, dbUser.passwordHash);
      if (valid) {
        // Update last login
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {});

        const tenant: Tenant = {
          id: dbUser.tenant.id,
          name: dbUser.tenant.name,
          slug: dbUser.tenant.slug,
          logo: dbUser.tenant.logo ?? undefined,
          users: [],
        };
        const user: TenantUser = {
          email: dbUser.email,
          passwordHash: dbUser.passwordHash,
          role: dbUser.role as TenantUser["role"],
          globalRole: dbUser.globalRole ?? undefined,
          name: dbUser.name,
        };
        return { tenant, user };
      }
      return null; // wrong password, don't try fallback
    }
  } catch {
    // DB not available, try fallback
  }

  // Fallback to hardcoded credentials
  for (const fallbackTenant of FALLBACK_TENANTS) {
    const user = fallbackTenant.users.find((u) => u.email === email);
    if (user) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (valid) {
        // Try to resolve real DB tenant ID to avoid mismatch with
        // admin impersonation which always uses the DB ID
        const dbTenant = await getTenant(fallbackTenant.slug);
        const tenant = dbTenant ?? fallbackTenant;
        return { tenant, user: { ...user, globalRole: dbTenant?.users.find(u => u.email === email)?.globalRole ?? user.globalRole } };
      }
    }
  }
  return null;
}
