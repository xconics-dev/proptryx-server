import type { DB } from "@proptryx/database";
import * as schema from "@proptryx/database";
import { and, eq, inArray } from "drizzle-orm";
import { generateRandomId } from "./gen-id";

const DEFAULT_ORGANIZATION_ROLES = [
  {
    name: "Owner",
    slug: "owner",
    description: "Default company owner role created with organization creation.",
    panel: "company" as const,
  },
  {
    name: "Admin",
    slug: "admin",
    description: "Default company admin role created with organization creation.",
    panel: "company" as const,
  },
  {
    name: "Executive",
    slug: "executive",
    description: "Default company executive role created with organization creation.",
    panel: "company" as const,
  },
] as const;

type OrganizationRolesDb = Pick<DB, "select" | "insert">;

export async function ensureDefaultOrganizationRoles(
  db: OrganizationRolesDb,
  organizationId: string
) {
  const existingRoles = await db
    .select({
      slug: schema.rbacRole.slug,
    })
    .from(schema.rbacRole)
    .where(
      and(
        eq(schema.rbacRole.panel, "company"),
        eq(schema.rbacRole.organizationId, organizationId),
        inArray(
          schema.rbacRole.slug,
          DEFAULT_ORGANIZATION_ROLES.map((role) => role.slug)
        )
      )
    );

  const existingRoleSlugs = new Set(existingRoles.map((role) => role.slug));
  const rolesToInsert = DEFAULT_ORGANIZATION_ROLES.filter(
    (role) => !existingRoleSlugs.has(role.slug)
  );

  if (rolesToInsert.length === 0) {
    return;
  }

  await db.insert(schema.rbacRole).values(
    rolesToInsert.map((role) => ({
      id: generateRandomId(),
      name: role.name,
      slug: role.slug,
      description: role.description,
      panel: role.panel,
      organizationId,
      isSystem: true,
      isActive: true,
    }))
  );
}
