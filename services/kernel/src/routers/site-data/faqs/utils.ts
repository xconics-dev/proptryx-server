import { db, faq, property } from "@proptryx/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findFaqById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(faq.id, id)
    : and(eq(faq.id, id), eq(faq.isDeleted, false));

  return db
    .select()
    .from(faq)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findActivePropertyById(id: string) {
  return db
    .select({ id: property.id })
    .from(property)
    .where(and(eq(property.id, id), eq(property.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}
