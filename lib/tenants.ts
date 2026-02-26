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
    name: "Casanova Metais",
    slug: "casanova",
    users: [
      {
        email: "admin@casanova.com",
        passwordHash: "$2b$10$KmWh4VEMh1vOMCuXbe2KRe/lUansSYhDyKX7H5h/ZcEuDyKnfwWe2",
        role: "admin",
        name: "Admin Casanova",
      },
    ],
  },
  {
    id: "fivep",
    name: "Fivep",
    slug: "fivep",
    users: [
      {
        email: "contato@fivep.com.br",
        passwordHash: "$2b$10$BP4iT6uj62HBkZ5COZ7IeuTVTsShRHW2T4ofZzIqv8GKy1lF1AEQG",
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
    users: [
      {
        email: "admin@yellalife.com",
        passwordHash: "$2b$10$Il8qPPEBxJgtC3aBrv/ci.GwaP1qSdl117QdvmWarjZ6Y9tF6SSAG",
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

  // Fallback to hardcoded
  for (const tenant of FALLBACK_TENANTS) {
    const user = tenant.users.find((u) => u.email === email);
    if (user) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (valid) return { tenant, user };
    }
  }
  return null;
}
