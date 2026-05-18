export type PropertyDocument = {
  name: string;
  url: string;
  visibility: "PUBLIC" | "PRIVATE";
  lastModified: string;
};

export type PropertyLocationMetadata = {
  distances: {
    airportKm: number;
    railwayKm: number;
    highwayKm: number;
    commercialHubKm?: number;
    competitionKm?: number;
  };
};

export type PropertyAreaDistributionBlock = {
  id: string;
  label?: string | null;
  floorNumber?: string | null;
  areaSqft?: number | null;
  description?: string | null;
};

export const defaultPropertyLocationMetadata: PropertyLocationMetadata = {
  distances: {
    airportKm: 0,
    railwayKm: 0,
    highwayKm: 0,
    commercialHubKm: 0,
    competitionKm: 0,
  },
};

export const defaultPropertyDocuments: PropertyDocument[] = [];
export const defaultPropertyAreaDistribution: PropertyAreaDistributionBlock[] = [];
