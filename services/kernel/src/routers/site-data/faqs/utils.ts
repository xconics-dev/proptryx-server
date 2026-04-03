import { db, faq } from "@proptryx/database";
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
