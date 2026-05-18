import {
  BusinessDistrictType,
  HandoverType,
  ParkingAccessType,
  ParkingConfiguration,
  ParkingSecurityControl,
  ParkingType,
  ParkingVentilationType,
  PriceUnit,
  PropertyMediaType,
  PropertyMediaVisibility,
  PropertyStatus,
  PropertyType,
  RetailBrandCategory,
  RetailPropertyType,
  RetailStoreType,
  WarehouseConstructionType,
  organization,
  property,
  user,
} from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

const propertyUserSummarySchema = createDbSelectSchema(user, {
  omit: [
    "image",
    "banned",
    "banReason",
    "banExpires",
    "phoneNumberVerified",
    "deletedAt",
    "createdAt",
    "updatedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
    "isDeleted",
  ],
});

const propertyOrganizationSummarySchema = createDbSelectSchema(organization, {
  omit: ["metadata", "razorpayCustomerId", "createdAt", "updatedAt", "deletedAt", "deletedByUser"],
});

export const propertySchema = createDbSelectSchema(property);

const propertyOwnerTermsSchema = z.object({
  userId: z.string().min(1, "Owner user id is required"),
  distributionBlockId: z.string().trim().min(1).nullable().optional(),
  floorNumber: z.string().trim().min(1).nullable().optional(),
  allocatedAreaSqft: z.number().nullable().optional(),
  areaDescription: z.string().trim().min(1).nullable().optional(),
  handoverType: z.enum(HandoverType.enumValues).nullable().optional(),
  pricePerUnit: z.number().nullable().optional(),
  priceUnit: z.enum(PriceUnit.enumValues).nullable().optional(),
  priceNegotiable: z.boolean().nullable().optional(),
});

const propertyTemporaryOwnerTermsSchema = propertyOwnerTermsSchema.omit({ userId: true }).extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Temporary owner name is required"),
  email: z.string().trim().email("Enter a valid owner email").nullable().optional(),
  phoneNumber: z.string().trim().min(1).nullable().optional(),
});

const propertyOwnerDetailSchema = propertyOwnerTermsSchema.extend({
  id: z.string().uuid(),
  user: propertyUserSummarySchema,
});

const propertyTemporaryOwnerDetailSchema = propertyTemporaryOwnerTermsSchema.extend({
  id: z.string().uuid(),
});

const propertyMediaInputSchema = z.object({
  id: z.string().uuid().optional(),
  mediaType: z.enum(PropertyMediaType.enumValues),
  name: z.string().trim().min(1, "Media name is required"),
  storageKey: z.string().trim().min(1, "Storage key is required"),
  url: z.string().trim().url("Enter a valid media URL"),
  mimeType: z.string().trim().min(1).nullable().optional(),
  sizeBytes: z.number().int().nullable().optional(),
  visibility: z.enum(PropertyMediaVisibility.enumValues).optional(),
  sortOrder: z.number().int().nullable().optional(),
  altText: z.string().trim().min(1).nullable().optional(),
  isThumbnail: z.boolean().optional(),
});

const propertyAreaDistributionBlockSchema = z.object({
  id: z.string().trim().min(1, "Distribution block id is required"),
  label: z.string().trim().min(1).nullable().optional(),
  floorNumber: z.string().trim().min(1).nullable().optional(),
  areaSqft: z.number().nullable().optional(),
  description: z.string().trim().min(1).nullable().optional(),
});

const propertyMediaLimits: Record<(typeof PropertyMediaType.enumValues)[number], number> = {
  DOCUMENT: 11,
  IMAGE: 12,
  VIDEO: 4,
};

const propertyMediaLimitLabels: Record<(typeof PropertyMediaType.enumValues)[number], string> = {
  DOCUMENT: "document",
  IMAGE: "image",
  VIDEO: "video",
};

const validatePropertyMediaLimits = (
  mediaItems: z.infer<typeof propertyMediaInputSchema>[] | undefined,
  ctx: z.RefinementCtx
) => {
  if (!mediaItems) {
    return;
  }

  for (const mediaType of PropertyMediaType.enumValues) {
    const count = mediaItems.filter((item) => item.mediaType === mediaType).length;
    const limit = propertyMediaLimits[mediaType];

    if (count > limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Maximum ${limit} ${propertyMediaLimitLabels[mediaType]} files allowed per property.`,
        path: ["mediaItems"],
      });
    }
  }
};

const validateOwnerAllocatedArea = (
  {
    ownerTerms,
    temporaryOwnerTerms,
    totalAreaSqft,
  }: {
    ownerTerms?: z.infer<typeof propertyOwnerTermsSchema>[];
    temporaryOwnerTerms?: z.infer<typeof propertyTemporaryOwnerTermsSchema>[];
    totalAreaSqft?: number | null;
  },
  ctx: z.RefinementCtx
) => {
  if (
    !(
      totalAreaSqft &&
      totalAreaSqft > 0 &&
      ((ownerTerms?.length ?? 0) > 0 || (temporaryOwnerTerms?.length ?? 0) > 0)
    )
  ) {
    return;
  }

  const allocatedAreaSqft = (ownerTerms ?? []).reduce(
    (total, term) => total + (term.allocatedAreaSqft ?? 0),
    0
  );
  const temporaryAllocatedAreaSqft = (temporaryOwnerTerms ?? []).reduce(
    (total, term) => total + (term.allocatedAreaSqft ?? 0),
    0
  );

  if (allocatedAreaSqft + temporaryAllocatedAreaSqft > totalAreaSqft) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Owner allocations cannot exceed total area sqft (${totalAreaSqft}).`,
      path: ["ownerTerms"],
    });
  }
};

const validatePropertyAreaDistribution = (
  {
    areaDistribution,
    areaType,
    ownerTerms,
    temporaryOwnerTerms,
    totalAreaSqft,
  }: {
    areaDistribution?: z.infer<typeof propertyAreaDistributionBlockSchema>[];
    areaType?: string | null;
    ownerTerms?: z.infer<typeof propertyOwnerTermsSchema>[];
    temporaryOwnerTerms?: z.infer<typeof propertyTemporaryOwnerTermsSchema>[];
    totalAreaSqft?: number | null;
  },
  ctx: z.RefinementCtx
) => {
  const blocks = areaDistribution ?? [];

  if (areaType === "SPLIT" && blocks.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one area distribution block is required for split properties.",
      path: ["areaDistribution"],
    });
  }

  const blockIds = new Set<string>();
  const blockAreaById = new Map<string, number>();
  let distributedArea = 0;

  blocks.forEach((block, index) => {
    if (blockIds.has(block.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Distribution block ids must be unique.",
        path: ["areaDistribution", index, "id"],
      });
    }

    blockIds.add(block.id);
    const blockArea = block.areaSqft ?? 0;
    blockAreaById.set(block.id, blockArea);
    distributedArea += blockArea;
  });

  if (totalAreaSqft && totalAreaSqft > 0 && distributedArea > totalAreaSqft) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Area distribution cannot exceed total area sqft (${totalAreaSqft}).`,
      path: ["areaDistribution"],
    });
  }

  const allocatedAreaByBlockId = new Map<string, number>();

  for (const ownerTerm of [...(ownerTerms ?? []), ...(temporaryOwnerTerms ?? [])]) {
    if (!ownerTerm.distributionBlockId) {
      continue;
    }

    if (!blockIds.has(ownerTerm.distributionBlockId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Owner allocation references unknown distribution block ${ownerTerm.distributionBlockId}.`,
        path: ["ownerTerms"],
      });
      continue;
    }

    allocatedAreaByBlockId.set(
      ownerTerm.distributionBlockId,
      (allocatedAreaByBlockId.get(ownerTerm.distributionBlockId) ?? 0) +
        (ownerTerm.allocatedAreaSqft ?? 0)
    );
  }

  for (const [blockId, allocatedArea] of allocatedAreaByBlockId) {
    const blockArea = blockAreaById.get(blockId) ?? 0;

    if (blockArea > 0 && allocatedArea > blockArea) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Owner allocations for distribution block ${blockId} cannot exceed ${blockArea} sqft.`,
        path: ["ownerTerms"],
      });
    }
  }
};

const propertyMediaDetailSchema = propertyMediaInputSchema.extend({
  id: z.string().uuid(),
  visibility: z.enum(PropertyMediaVisibility.enumValues),
  sortOrder: z.number().int().nullable(),
  isThumbnail: z.boolean(),
});

const stringArrayWithoutBlankItemsSchema = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : [],
  z.array(z.string().min(1)).default([])
);

const propertyRetailDetailsSchema = z.object({
  propertyType: z.enum(RetailPropertyType.enumValues).default("MALL"),
  storeType: z.enum(RetailStoreType.enumValues).default("VANILLA"),
  frontageWidthFt: z.number().nullable().optional(),
  beamBottomHeightFt: z.number().nullable().optional(),
  neighbouringBrands: stringArrayWithoutBlankItemsSchema.optional(),
  brandCategories: z.array(z.enum(RetailBrandCategory.enumValues)).optional(),
});

const propertyOfficeDetailsSchema = z.object({
  floor: z.string().trim().min(1).nullable().optional(),
  buildingName: z.string().trim().min(1).nullable().optional(),
  businessDistrictType: z.enum(BusinessDistrictType.enumValues).nullable().optional(),
  carParksAvailable: z.number().int().nullable().optional(),
  toiletsCount: z.number().int().nullable().optional(),
});

const propertyWarehouseDetailsSchema = z.object({
  eavesHeightFt: z.number().nullable().optional(),
  topHeightFt: z.number().nullable().optional(),
  constructionType: z.enum(WarehouseConstructionType.enumValues).nullable().optional(),
  heightRatio: z.number().nullable().optional(),
});

const propertyParkingDetailsSchema = z.object({
  parkingType: z.enum(ParkingType.enumValues).default("BASEMENT"),
  parkingConfiguration: z.enum(ParkingConfiguration.enumValues).default("BASE_PARKING"),
  totalCapacity: z.number().int().nullable().optional(),
  accessType: z.enum(ParkingAccessType.enumValues).nullable().optional(),
  securityControl: z.array(z.enum(ParkingSecurityControl.enumValues)).optional(),
  ventilationType: z.enum(ParkingVentilationType.enumValues).nullable().optional(),
  heightClearanceFt: z.number().nullable().optional(),
});

export const propertyDetailSchema = propertySchema.extend({
  organization: propertyOrganizationSummarySchema.nullable(),
  superOwner: propertyUserSummarySchema.nullable(),
  coOwners: z.array(propertyUserSummarySchema).default([]),
  ownerTerms: z.array(propertyOwnerDetailSchema).default([]),
  temporaryOwnerTerms: z.array(propertyTemporaryOwnerDetailSchema).default([]),
  mediaItems: z.array(propertyMediaDetailSchema).default([]),
  retailDetails: propertyRetailDetailsSchema.nullable(),
  officeDetails: propertyOfficeDetailsSchema.nullable(),
  warehouseDetails: propertyWarehouseDetailsSchema.nullable(),
  parkingDetails: propertyParkingDetailsSchema.nullable(),
});

export const propertyPermanentDeleteResultSchema = z
  .object({
    message: z.string(),
  })
  .extend({
    coOwnerIds: z.array(z.string().min(1)).optional(),
  });

export const propertyCreateSchema = createDbInsertSchema(property, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      organizationId: z.string().min(1, "Organization id is required").nullable().optional(),
    });
  },
})
  .extend({
    coOwnerIds: z.array(z.string().min(1)).optional(),
    areaDistribution: z.array(propertyAreaDistributionBlockSchema).optional(),
    ownerTerms: z.array(propertyOwnerTermsSchema).optional(),
    temporaryOwnerTerms: z.array(propertyTemporaryOwnerTermsSchema).optional(),
    mediaItems: z.array(propertyMediaInputSchema).optional(),
    retailDetails: propertyRetailDetailsSchema.nullable().optional(),
    officeDetails: propertyOfficeDetailsSchema.nullable().optional(),
    warehouseDetails: propertyWarehouseDetailsSchema.nullable().optional(),
    parkingDetails: propertyParkingDetailsSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    validatePropertyMediaLimits(value.mediaItems, ctx);
    validateOwnerAllocatedArea(value, ctx);
    validatePropertyAreaDistribution(value, ctx);
  });

export const propertyUpdateSchema = createDbUpdateSchema(property, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
})
  .extend({
    coOwnerIds: z.array(z.string().min(1)).optional(),
    areaDistribution: z.array(propertyAreaDistributionBlockSchema).optional(),
    ownerTerms: z.array(propertyOwnerTermsSchema).optional(),
    temporaryOwnerTerms: z.array(propertyTemporaryOwnerTermsSchema).optional(),
    mediaItems: z.array(propertyMediaInputSchema).optional(),
    retailDetails: propertyRetailDetailsSchema.nullable().optional(),
    officeDetails: propertyOfficeDetailsSchema.nullable().optional(),
    warehouseDetails: propertyWarehouseDetailsSchema.nullable().optional(),
    parkingDetails: propertyParkingDetailsSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    validatePropertyMediaLimits(value.mediaItems, ctx);
    validateOwnerAllocatedArea(value, ctx);
    validatePropertyAreaDistribution(value, ctx);
  });

export const propertyListSortFields = [
  "id",
  "organizationId",
  "name",
  "type",
  "status",
  "city",
  "state",
  "isPublished",
  "isOperational",
  "createdAt",
  "updatedAt",
] as const;

export const propertyListQuerySchema = createListQuerySchema({
  sortFields: propertyListSortFields,
  extraShape: {
    organizationId: z.string().optional(),
    superOwnerId: z.string().optional(),
    type: z.enum(PropertyType.enumValues).optional(),
    status: z.enum(PropertyStatus.enumValues).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    isPublished: optionalBooleanQuerySchema,
    isOperational: optionalBooleanQuerySchema,
    isVerified: optionalBooleanQuerySchema,
    createdByUser: z.string().optional(),
    ownUserId: z.string().optional(),
    ownerUserId: z.string().optional(),
    includeDeleted: optionalBooleanQuerySchema,
  },
});

export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;

export const propertyGetQuerySchema = z.object({
  includeDeleted: optionalBooleanQuerySchema,
});

export const propertyListResponseSchema = createListResponseSchema(propertyDetailSchema);
