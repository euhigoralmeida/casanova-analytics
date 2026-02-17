import bcrypt from "bcryptjs";

export type TenantUser = {
  email: string;
  passwordHash: string;
  role: "admin" | "viewer";
  name: string;
};

export type Tenant = {
  id: string;
  name: string;
  logo?: string;
  users: TenantUser[];
};

// V1: configuração estática (single-tenant)
// Expandir para multi-tenant no futuro (JSON/DB)
const tenants: Tenant[] = [
  {
    id: "casanova",
    name: "Casanova Metais",
    users: [
      {
        email: "admin@casanova.com",
        passwordHash: "$2b$10$KmWh4VEMh1vOMCuXbe2KRe/lUansSYhDyKX7H5h/ZcEuDyKnfwWe2",
        role: "admin",
        name: "Admin Casanova",
      },
    ],
  },
];

export function getTenant(tenantId: string): Tenant | undefined {
  return tenants.find((t) => t.id === tenantId);
}

export function getAllTenants(): Tenant[] {
  return tenants;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ tenant: Tenant; user: TenantUser } | null> {
  for (const tenant of tenants) {
    const user = tenant.users.find((u) => u.email === email);
    if (user) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (valid) return { tenant, user };
    }
  }
  return null;
}
