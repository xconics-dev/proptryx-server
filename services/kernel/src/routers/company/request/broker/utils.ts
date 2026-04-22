import { broker_request, db } from "@proptryx/database";
import { and, eq } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

export async function findBrokerRequestById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(broker_request.id, id)
    : and(eq(broker_request.id, id), eq(broker_request.isDeleted, false));

  return db
    .select()
    .from(broker_request)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}
