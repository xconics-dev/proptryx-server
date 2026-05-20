# Property Client UI Data Guide

This document is a designer handoff for showcasing Proptryx property data on the public website/client UI. It is based on the current property database schema and API response shape.

Primary schema sources:

- `packages/database/src/schemas/property/property.ts`
- `packages/database/src/schemas/property/property-media.ts`
- `packages/database/src/schemas/property/property-owner.ts`
- `packages/database/src/schemas/property/property-owner-temporary.ts`
- `packages/database/src/schemas/property/property-retail.ts`
- `packages/database/src/schemas/property/property-office.ts`
- `packages/database/src/schemas/property/property-warehouse.ts`
- `packages/database/src/schemas/property/property-parking.ts`
- `packages/database/src/schemas/property/property-zone.ts`
- `services/kernel/src/routers/company/property/schema.ts`

## UI Goal

The client website should present each property as a complete commercial real estate asset, not only as a simple listing. The UI should support:

- Property listing cards and listing table/list views.
- Property detail pages.
- Media galleries.
- Location and distance intelligence.
- Ownership and split-area information.
- Type-specific property facts for retail, office, warehouse, and commercial parking.
- Public status signals such as published, verified, operational, and certificate state.

## Recommended Page Structure

Use these sections for a property detail page:

1. Hero and summary
2. Key commercial facts
3. Location and map
4. Media gallery
5. Ownership and area distribution
6. Type-specific details
7. Certificates and operational status
8. Documents
9. Related location zones
10. System or internal details, only for admin/back-office UI

## Listing Card Data

Use these fields on compact listing cards.

| UI label | Schema field | Notes |
| --- | --- | --- |
| Property name | `name` | Primary title. |
| Property type | `type` | Show as readable label: Retail, Office, Warehouse, Commercial Parking. |
| Status | `status` | Use badge. |
| City | `city` | Combine with state. |
| State | `state` | Secondary location text. |
| Address | `addressLine1`, `addressLine2` | Use one-line truncated address. |
| Area | `totalAreaSqft` | Format as sqft. |
| Price | `pricePerUnit`, `priceUnit` | Show only when available. |
| Transaction | `transactionType` | Lease, Sale, Lease Purchase. |
| Thumbnail | `mediaItems[].isThumbnail` or first public image | Prefer public image with thumbnail flag. |
| Verified | `isVerified` | Small trust badge. |
| Operational | `isOperational` | Useful for occupancy readiness. |
| Published | `isPublished` | Usually internal; public site should list only published records. |

## Detail Hero

Recommended hero fields:

| UI label | Schema field | Notes |
| --- | --- | --- |
| Property name | `name` | Main heading. |
| Description | `description` | Summary paragraph below title. |
| Type | `type` | Badge or chip. |
| Status | `status` | Badge or chip. |
| Location | `city`, `state`, `country`, `pincode` | Keep prominent. |
| Total area | `totalAreaSqft` | Key metric. |
| Road width | `roadWidthFt` | Useful commercial metric. |
| Total floors | `totalFloors` | Show when available. |
| Transaction type | `transactionType` | Lease/Sale/Lease Purchase. |
| Price | `pricePerUnit`, `priceUnit`, `priceNegotiable` | Include negotiable indicator. |

## Base Property Parameters

These fields belong to the main `property` table.

| Group | UI label | Schema field | Type | Display guidance |
| --- | --- | --- | --- | --- |
| Identity | Property ID | `id` | text | Internal/admin only. |
| Identity | Name | `name` | text | Required public title. |
| Identity | Description | `description` | text/null | Public detail copy. |
| Address | Country | `country` | text | Usually `IN`. |
| Address | State | `state` | text | Public. |
| Address | City | `city` | text | Public and filterable. |
| Address | Address line 1 | `addressLine1` | text | Public street/address. |
| Address | Address line 2 | `addressLine2` | text/null | Optional. |
| Address | Pincode | `pincode` | text | Public and filterable. |
| Map | Latitude | `latitude` | number/null | Use for map pin. |
| Map | Longitude | `longitude` | number/null | Use for map pin. |
| Metadata | Location metadata | `locationMetadata` | JSON | Distance cards and search signals. |
| Status | Verified | `isVerified` | boolean | Trust badge. |
| Status | Published | `isPublished` | boolean | Public listing gate. |
| Status | Operational | `isOperational` | boolean | Occupancy readiness. |
| Certificate | Certificate type | `certificateType` | enum | OC or CC. |
| Certificate | Certificate status | `certificateStatus` | enum | Pending, Received, Not Required. |
| Certificate | Certificate ETA date | `certificateEtaDate` | datetime/null | Show when certificate is pending. |
| Certificate | Certificate received at | `certificateReceivedAt` | datetime/null | Show when received. |
| Area | Total area | `totalAreaSqft` | number/null | Format as sqft. |
| Area | Road width | `roadWidthFt` | number/null | Format as ft. |
| Area | Total floors | `totalFloors` | integer/null | Show when relevant. |
| Area | Area type | `areaType` | enum | Single or Split. |
| Area | Area distribution | `areaDistribution` | JSON array | Repeatable split blocks. |
| Commercial | Transaction type | `transactionType` | enum/null | Lease, Sale, Lease Purchase. |
| Commercial | Price per unit | `pricePerUnit` | number/null | Pair with price unit. |
| Commercial | Price unit | `priceUnit` | enum/null | Per sqft, lump sum, per month. |
| Commercial | Price negotiable | `priceNegotiable` | boolean | Show negotiable label. |
| Type | Property type | `type` | enum | Controls type-specific section. |
| Type | Property status | `status` | enum | Availability/state badge. |
| Ownership | Organization ID | `organizationId` | text/null | Use relation `organization` for display. |
| Ownership | Ownership type | `ownershipType` | enum | Single owner or multiple owner. |
| Ownership | Super owner ID | `superOwnerId` | text/null | Use relation `superOwner` for display. |
| Audit | Created by user | `createdByUser` | text/null | Admin only. |
| Audit | Updated by user | `updatedByUser` | text/null | Admin only. |
| Audit | Created at | `createdAt` | datetime | Admin/back-office. |
| Audit | Updated at | `updatedAt` | datetime | Admin/back-office. |
| Delete | Is deleted | `isDeleted` | boolean | Admin only. |
| Delete | Deleted at | `deletedAt` | datetime/null | Admin only. |
| Delete | Deleted by user | `deletedByUser` | text/null | Admin only. |

## Enums and Display Labels

### Property Type

| Value | Display |
| --- | --- |
| `RETAIL` | Retail |
| `OFFICE` | Office |
| `WAREHOUSE` | Warehouse |
| `COMMERCIAL_PARKING` | Commercial Parking |

### Property Status

| Value | Display |
| --- | --- |
| `VACANT` | Vacant |
| `BUILD_TO_SUITE` | Build To Suite |
| `READY_TO_MOVE` | Ready To Move |
| `UNDER_NEGOTIATION` | Under Negotiation |
| `BOOKED` | Booked |
| `CLOSED` | Closed |
| `ON_HOLD` | On Hold |

### Area Type

| Value | Display |
| --- | --- |
| `SINGLE` | Single |
| `SPLIT` | Split |

### Transaction Type

| Value | Display |
| --- | --- |
| `LEASE` | Lease |
| `SALE` | Sale |
| `LEASE_PURCHASE` | Lease Purchase |

### Price Unit

| Value | Display |
| --- | --- |
| `PER_SQFT` | Per Sqft |
| `LUMP_SUM` | Lump Sum |
| `PER_MONTH` | Per Month |

### Certificate Type and Status

| Field | Values |
| --- | --- |
| `certificateType` | `OC`, `CC` |
| `certificateStatus` | `PENDING`, `RECEIVED`, `NOT_REQUIRED` |

### Ownership Type

| Value | Display |
| --- | --- |
| `SINGLE_OWNER` | Single Owner |
| `MULTIPLE_OWNER` | Multiple Owner |

## Recurrent and Repeatable Data

These are arrays or related records that can repeat for a property. Design them as lists, cards, tables, carousels, or grouped sections.

## Area Distribution Blocks

Source: `property.areaDistribution`

Show only when `areaType = SPLIT`, or show an empty state if the design needs the section always visible.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Block ID | `id` | text | Internal identifier. |
| Label | `label` | text/null | Example: North Wing. |
| Floor number/range | `floorNumber` | text/null | Example: 3rd-5th. |
| Area | `areaSqft` | number/null | Format as sqft. |
| Description | `description` | text/null | Extra details for the block. |

Design suggestion: use compact cards with block title, floor, area, and description.

## Owner Terms

Source: `ownerTerms[]`, backed by `property_owner`.

These are registered users linked as owners or co-owners.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Owner term ID | `id` | uuid | Internal/admin only. |
| Owner user ID | `userId` | text | Use nested `user` relation for display. |
| Owner profile | `user` | object | Display name, email, role, phone if available. |
| Floor number/range | `floorNumber` | text/null | Relevant for split ownership. |
| Allocated area | `allocatedAreaSqft` | number/null | Format as sqft. |
| Area description | `areaDescription` | text/null | Example: North wing, floors 3-5. |
| Handover type | `handoverType` | enum/null | Overrides property transaction when present. |
| Price per unit | `pricePerUnit` | number/null | Overrides property default when present. |
| Price unit | `priceUnit` | enum/null | Overrides property default when present. |
| Price negotiable | `priceNegotiable` | boolean/null | Null means inherit property default. |

Design suggestion: show owners as person cards with allocated floors/area and commercial terms.

## Temporary Owner Terms

Source: `temporaryOwnerTerms[]`, backed by `property_owner_temporary`.

These are manually entered owners that may not have a registered user account.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Temporary owner ID | `id` | uuid | Internal/admin only. |
| Name | `name` | text | Required display name. |
| Email | `email` | text/null | Optional. |
| Phone number | `phoneNumber` | text/null | Optional. |
| Floor number/range | `floorNumber` | text/null | Relevant for split ownership. |
| Allocated area | `allocatedAreaSqft` | number/null | Format as sqft. |
| Area description | `areaDescription` | text/null | Optional description. |
| Handover type | `handoverType` | enum/null | Per-owner term. |
| Price per unit | `pricePerUnit` | number/null | Per-owner term. |
| Price unit | `priceUnit` | enum/null | Per-owner term. |
| Price negotiable | `priceNegotiable` | boolean/null | Per-owner term. |

Design suggestion: visually distinguish temporary/manual owners from registered owners.

## Media Items

Source: `mediaItems[]`, backed by `property_media`.

Limits currently used by the API/client:

- Images: maximum 12
- Videos: maximum 4
- Documents: maximum 11

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Media ID | `id` | uuid | Internal/admin only. |
| Media type | `mediaType` | enum | `IMAGE`, `VIDEO`, `DOCUMENT`. |
| Name | `name` | text | Display title/file label. |
| Storage key | `storageKey` | text | Internal storage reference. |
| URL | `url` | text | Render image/video/document link. |
| MIME type | `mimeType` | text/null | Useful for icons and previews. |
| Size | `sizeBytes` | integer/null | Show in documents list if needed. |
| Visibility | `visibility` | enum | `PUBLIC` or `PRIVATE`. |
| Sort order | `sortOrder` | integer/null | Use for gallery order. |
| Alt text | `altText` | text/null | Use for image accessibility. |
| Thumbnail | `isThumbnail` | boolean | Prefer for listing image. |
| Created by | `createdByUser` | text/null | Admin only. |
| Updated by | `updatedByUser` | text/null | Admin only. |
| Created at | `createdAt` | datetime | Admin only. |
| Updated at | `updatedAt` | datetime | Admin only. |
| Deleted state | `isDeleted`, `deletedAt`, `deletedByUser` | mixed | Admin only. |

Design suggestion:

- Images: carousel or masonry gallery.
- Videos: separate video strip after images.
- Documents: compact document list with file type icon, title, and visibility.
- Public website should only expose `visibility = PUBLIC`.

## Zone Mappings

Source: `propertyZones[]`, backed by `property_zone`.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Mapping ID | `id` | uuid | Internal/admin only. |
| Property ID | `propertyId` | text | Internal. |
| Zone ID | `zoneId` | text | Use nested zone relation when available. |
| Zone | `zone` | relation | Display zone name. |
| Region | `zone.region` | relation-derived | Region comes through zone, not stored here. |
| Audit fields | `createdByUser`, `updatedByUser`, `createdAt`, `updatedAt` | mixed | Admin only. |
| Delete fields | `isDeleted`, `deletedAt`, `deletedByUser` | mixed | Admin only. |

Design suggestion: show zone and region as location chips.

## Location Metadata

Source: `locationMetadata.distances`

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Airport distance | `locationMetadata.distances.airportKm` | number | Format as km. |
| Railway distance | `locationMetadata.distances.railwayKm` | number | Format as km. |
| Highway distance | `locationMetadata.distances.highwayKm` | number | Format as km. |
| Commercial hub distance | `locationMetadata.distances.commercialHubKm` | number/optional | Format as km. |
| Competition distance | `locationMetadata.distances.competitionKm` | number/optional | Format as km. |

Design suggestion: use small metric cards beside or below the map.

## Relation Summary Objects

The property API detail response includes relation objects useful for UI display.

### Organization

Source: `organization`

| UI label | Field |
| --- | --- |
| Company name | `organization.name` |
| Company slug | `organization.slug` |
| Company type | `organization.type` |
| Company email | `organization.email` |
| Company phone | `organization.phoneNumber` |
| Active state | `organization.isActive` |

### Super Owner and Co-owners

Source: `superOwner`, `coOwners[]`, `ownerTerms[].user`

| UI label | Field |
| --- | --- |
| Name | `name` |
| Email | `email` |
| Email verified | `emailVerified` |
| Phone number | `phoneNumber` |
| Role | `role` |
| Panel | `panel` |
| Zone ID | `zoneId` |

## Type-Specific Details

Only one type-specific block should be emphasized based on `property.type`.

## Retail Details

Show when `type = RETAIL`.

Source: `retailDetails`, backed by `property_retail`.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Retail property type | `propertyType` | enum | `MALL`, `HIGH_STREET`. |
| Store type | `storeType` | enum | `ANCHOR`, `VANILLA`. |
| Frontage width | `frontageWidthFt` | number/null | Format as ft. |
| Beam bottom height | `beamBottomHeightFt` | number/null | Format as ft. |
| Neighbouring brands | `neighbouringBrands[]` | text array | Show as chips/list. |
| Brand categories | `brandCategories[]` | enum array | Show as chips. |

Retail category values:

- `HYPERMARKET`
- `APPAREL`
- `F_AND_B`
- `MULTIPLEX`
- `ACCESSORIES`
- `DEPARTMENTAL_STORES`
- `OTHERS`

## Office Details

Show when `type = OFFICE`.

Source: `officeDetails`, backed by `property_office`.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Floor | `floor` | text/null | Example: 8th floor. |
| Building name | `buildingName` | text/null | Public display. |
| Business district type | `businessDistrictType` | enum/null | `CBD`, `SBD`, `TBD`. |
| Car parks available | `carParksAvailable` | integer/null | Number. |
| Toilets count | `toiletsCount` | integer/null | Number. |

Business district labels:

- `CBD`: Central Business District
- `SBD`: Secondary Business District
- `TBD`: Territory/Outlying Business District

## Warehouse Details

Show when `type = WAREHOUSE`.

Source: `warehouseDetails`, backed by `property_warehouse`.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Eaves height | `eavesHeightFt` | number/null | Ground to roof slope start, in ft. |
| Top height | `topHeightFt` | number/null | Central roof peak height, in ft. |
| Construction type | `constructionType` | enum/null | `RCC_COMPLIANT`, `NON_RCC`. |
| Height ratio | `heightRatio` | number/null | `topHeightFt / eavesHeightFt`; useful as a metric. |

## Commercial Parking Details

Show when `type = COMMERCIAL_PARKING`.

Source: `parkingDetails`, backed by `property_parking`.

| UI label | Field | Type | Notes |
| --- | --- | --- | --- |
| Parking type | `parkingType` | enum | `BASEMENT`, `COVERED`, `OPENED`. |
| Parking configuration | `parkingConfiguration` | enum | `BASE_PARKING`, `INDIVIDUAL_COVERED_SPACE`, `HYDRAULIC_RACK`. |
| Total capacity | `totalCapacity` | integer/null | Number of vehicles/spaces. |
| Access type | `accessType` | enum/null | `DIRECT_ENTRY`, `THROUGH_RAMP`, `MULTI_LEVEL_ACCESS`. |
| Security control | `securityControl[]` | enum array | Multi-select. |
| Ventilation type | `ventilationType` | enum/null | `NATURAL`, `MECHANICAL`. |
| Height clearance | `heightClearanceFt` | number/null | Minimum vehicle clearance in ft. |

Security control values:

- `RFID_ENTRY`
- `MANUAL_TICKETING`
- `ANPR`
- `CCTV_ENABLED`

## Filtering and Sorting Fields

These are currently supported by the property list query and are useful for listing/search UI.

### Filters

| Filter | Field |
| --- | --- |
| Organization/company | `organizationId` |
| Super owner | `superOwnerId` |
| Property type | `type` |
| Property status | `status` |
| City | `city` |
| State | `state` |
| Published | `isPublished` |
| Operational | `isOperational` |
| Verified | `isVerified` |
| Created by | `createdByUser` |
| Own user | `ownUserId` |
| Owner user | `ownerUserId` |
| Include deleted | `includeDeleted` |
| Created date range | `startDate`, `endDate`, `timeZone` |

### Sort Fields

- `id`
- `organizationId`
- `name`
- `type`
- `status`
- `city`
- `state`
- `isPublished`
- `isOperational`
- `createdAt`
- `updatedAt`

## Recommended Public UI Priority

Use this order when screen space is limited:

1. `name`
2. `type`
3. `status`
4. `city`, `state`
5. thumbnail/gallery image
6. `totalAreaSqft`
7. `transactionType`, `pricePerUnit`, `priceUnit`
8. `isVerified`, `isOperational`
9. `roadWidthFt`, `totalFloors`
10. location distance cards
11. type-specific facts
12. owner/area distribution details
13. documents

## Empty State Rules

- Hide optional fields when they are null unless the section needs a structured comparison layout.
- Show `Price on request` when all price fields are null.
- Show `Negotiable` only when `priceNegotiable = true`.
- Show certificate ETA only when certificate status is `PENDING`.
- Show certificate received date only when certificate status is `RECEIVED`.
- Show area distribution only for split properties.
- Use public media only on the website.
- Avoid showing internal IDs on public UI.

## Public vs Admin Visibility

Public/client website:

- Show property, location, media, commercial, type-specific, and public owner/company display fields.
- Only show `isPublished = true` properties.
- Only show `mediaItems` with `visibility = PUBLIC`.
- Avoid audit fields, delete fields, storage keys, raw IDs, and internal user IDs.

Admin/back-office:

- Can show IDs, audit fields, delete state, raw storage metadata, private documents, and relation IDs.

## Suggested Designer Components

- Listing card with thumbnail, type badge, status badge, city/state, area, and price.
- Detail hero with gallery and key metrics.
- Compact commercial fact grid.
- Map panel with address and distance metrics.
- Media gallery with tabs: Images, Videos, Documents.
- Split-area distribution cards.
- Owner cards with registered/manual owner states.
- Type-specific detail panel that changes by property type.
- Certificate status timeline or badge row.
- Zone/region chips.

