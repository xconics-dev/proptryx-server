import { broker_request, getDB } from "@proptryx/database";
import { buildColumnSort, createTableListFetcher } from "@proptryx/utils";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { BrokerRequestListQuery } from "./schema";

const MIN_FUZZY_SEARCH_LENGTH = 4;

function normalizeBrokerRequestSearchValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function buildBrokerRequestSearchRank(searchTerm: string) {
  const prefixTerm = `${searchTerm}%`;
  const fuzzyScores =
    searchTerm.length >= MIN_FUZZY_SEARCH_LENGTH
      ? [
          sql`similarity(lower(${broker_request.email}), ${searchTerm})`,
          sql`similarity(lower(${broker_request.phoneNumber}), ${searchTerm}) * 0.98`,
          sql`similarity(lower(${broker_request.name}), ${searchTerm}) * 0.95`,
          sql`similarity(lower(${broker_request.pincode}), ${searchTerm}) * 0.92`,
          sql`coalesce(similarity(lower(${broker_request.address}), ${searchTerm}), 0) * 0.9`,
        ]
      : [sql`0`];

  return sql<number>`greatest(
    case when lower(${broker_request.email}) = ${searchTerm} then 1.15 else 0 end,
    case when lower(${broker_request.phoneNumber}) = ${searchTerm} then 1.12 else 0 end,
    case when lower(${broker_request.name}) = ${searchTerm} then 1 else 0 end,
    case when lower(${broker_request.pincode}) = ${searchTerm} then 0.98 else 0 end,
    case when lower(${broker_request.email}) like ${prefixTerm} then 0.97 else 0 end,
    case when lower(${broker_request.phoneNumber}) like ${prefixTerm} then 0.95 else 0 end,
    case when lower(${broker_request.name}) like ${prefixTerm} then 0.92 else 0 end,
    case when lower(${broker_request.pincode}) like ${prefixTerm} then 0.9 else 0 end,
    ${sql.join(fuzzyScores, sql`, `)}
  )`;
}

function createBrokerRequestListFetcher(enableFuzzySearch: boolean) {
  return createTableListFetcher<
    typeof broker_request,
    typeof broker_request.$inferSelect,
    BrokerRequestListQuery
  >({
    db: getDB,
    table: broker_request,
    where: ({ params }) =>
      params.includeDeleted ? undefined : eq(broker_request.isDeleted, false),
    search: {
      exact: [broker_request.id],
      prefix: [broker_request.email, broker_request.phoneNumber, broker_request.pincode],
      contains: [broker_request.name, broker_request.address],
      build: enableFuzzySearch
        ? ({ searchTerm }) => {
            const normalizedSearchTerm = normalizeBrokerRequestSearchValue(searchTerm);

            if (!normalizedSearchTerm || normalizedSearchTerm.length < MIN_FUZZY_SEARCH_LENGTH) {
              return undefined;
            }

            return [
              sql`lower(${broker_request.email}) % ${normalizedSearchTerm}`,
              sql`lower(${broker_request.phoneNumber}) % ${normalizedSearchTerm}`,
              sql`lower(${broker_request.name}) % ${normalizedSearchTerm}`,
              sql`lower(${broker_request.pincode}) % ${normalizedSearchTerm}`,
              sql`coalesce(lower(${broker_request.address}), '') % ${normalizedSearchTerm}`,
            ];
          }
        : undefined,
    },
    sorting: {
      defaultBy: "createdAt",
      defaultOrder: "desc",
      definitions: {
        id: buildColumnSort(broker_request.id),
        name: buildColumnSort(broker_request.name),
        email: buildColumnSort(broker_request.email),
        phoneNumber: buildColumnSort(broker_request.phoneNumber),
        pincode: buildColumnSort(broker_request.pincode),
        createdAt: ({ direction, params }) => {
          const normalizedSearchTerm = normalizeBrokerRequestSearchValue(params.search);
          const createdAtOrder =
            direction === "asc" ? asc(broker_request.createdAt) : desc(broker_request.createdAt);

          if (
            !enableFuzzySearch ||
            !normalizedSearchTerm ||
            normalizedSearchTerm.length < MIN_FUZZY_SEARCH_LENGTH
          ) {
            return createdAtOrder;
          }

          return [desc(buildBrokerRequestSearchRank(normalizedSearchTerm)), createdAtOrder];
        },
        updatedAt: buildColumnSort(broker_request.updatedAt),
      },
    },
    sortColumns: {
      id: broker_request.id,
      name: broker_request.name,
      email: broker_request.email,
      phoneNumber: broker_request.phoneNumber,
      pincode: broker_request.pincode,
      createdAt: broker_request.createdAt,
      updatedAt: broker_request.updatedAt,
    },
  });
}

export const fetchBrokerRequestList = createBrokerRequestListFetcher(true);
export const fetchBrokerRequestListWithoutFuzzySearch = createBrokerRequestListFetcher(false);

export function isPgTrgmUnavailableError(error: unknown) {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? Reflect.get(error, "cause")
      : undefined;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? Reflect.get(cause, "code")
      : undefined;
  const message =
    typeof cause === "object" && cause !== null && "message" in cause
      ? String(Reflect.get(cause, "message"))
      : error instanceof Error
        ? error.message
        : "";

  return (
    code === "42883" &&
    (message.includes("similarity") ||
      message.includes("operator does not exist: text % text") ||
      message.includes("operator does not exist: character varying %"))
  );
}
