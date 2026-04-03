# Property Schema Overview

This is the full property model in one place: the core `property` table, the type-specific extension tables, and the ownership junction.

```mermaid
erDiagram
  USER ||--o{ PROPERTY : "super owner"
  USER ||--o{ PROPERTY : "created by / updated by / deleted by"
  USER ||--o{ PROPERTY_OWNER : "co-owner"
  USER ||--o{ PROPERTY_MEDIA : "media audit"

  PROPERTY ||--o{ PROPERTY_MEDIA : "media"
  PROPERTY ||--o| PROPERTY_RETAIL : "retail details"
  PROPERTY ||--o| PROPERTY_OFFICE : "office details"
  PROPERTY ||--o| PROPERTY_WAREHOUSE : "warehouse details"
  PROPERTY ||--o| PROPERTY_PARKING : "parking details"
  PROPERTY ||--o{ PROPERTY_OWNER : "owners"

  PROPERTY {
    uuid id PK
    text name
    text description
    text country
    text state
    text city
    text address_line1
    text address_line2
    text pincode
    real latitude
    real longitude
    jsonb location_metadata
    bool is_verified
    bool is_published
    bool is_operational
    certificate_type certificate_type
    certificate_status certificate_status
    timestamp certificate_eta_date
    timestamp certificate_received_at
    real total_area_sqft
    real road_width_ft
    area_type area_type
    transaction_type transaction_type
    price_unit price_unit
    bool price_negotiable
    property_type type
    property_status status
    property_ownership_type ownership_type
    text super_owner_id FK
    text created_by_user FK
    text updated_by_user FK
    timestamp created_at
    timestamp updated_at
    bool is_deleted
    timestamp deleted_at
    text deleted_by_user FK
  }

  PROPERTY_RETAIL {
    uuid id PK
    uuid property_id FK
    retail_mall_type property_type
    retail_store_type store_type
    real frontage_width_ft
    real beam_bottom_height_ft
    text[] neighbouring_brands
    retail_brand_category[] brand_categories
  }

  PROPERTY_OFFICE {
    uuid id PK
    uuid property_id FK
    text floor
    text building_name
    business_district_type business_district_type
    int car_parks_available
    int toilets_count
  }

  PROPERTY_WAREHOUSE {
    uuid id PK
    uuid property_id FK
    real eaves_height_ft
    real top_height_ft
    warehouse_construction_type construction_type
    real height_ratio
  }

  PROPERTY_PARKING {
    uuid id PK
    uuid property_id FK
    parking_type parking_type
    parking_configuration parking_configuration
    int total_capacity
    parking_access_type access_type
    parking_security_control[] security_control
    parking_ventilation_type ventilation_type
    real height_clearance_ft
  }

  PROPERTY_OWNER {
    uuid id PK
    uuid property_id FK
    text user_id FK
    text floor_number
    real allocated_area_sqft
    text area_description
    real price_per_unit
    price_unit price_unit
    bool price_negotiable
  }

  PROPERTY_MEDIA {
    uuid id PK
    uuid property_id FK
    property_media_type media_type
    text name
    text storage_key
    text url
    text mime_type
    int size_bytes
    property_media_visibility visibility
    int sort_order
    text alt_text
    bool is_thumbnail
    text created_by_user FK
    text updated_by_user FK
    timestamp created_at
    timestamp updated_at
    bool is_deleted
    timestamp deleted_at
    text deleted_by_user FK
  }
```

## Required Fields

`property` required fields:
- `name`
- `country`
- `state`
- `city`
- `addressLine1`
- `pincode`
- `isVerified`
- `isPublished`
- `isOperational`
- `certificateType`
- `certificateStatus`
- `areaType`
- `priceNegotiable`
- `type`
- `status`
- `ownershipType`
- `createdAt`
- `updatedAt`
- `isDeleted`

Extension table required fields:
- `property_retail.propertyId`, `property_retail.propertyType`, `property_retail.storeType`
- `property_office.propertyId`
- `property_warehouse.propertyId`
- `property_parking.propertyId`, `property_parking.parkingType`, `property_parking.parkingConfiguration`
- `property_owner.propertyId`, `property_owner.userId`
- `property_media.propertyId`, `property_media.mediaType`, `property_media.name`, `property_media.storageKey`, `property_media.url`, `property_media.visibility`

## Relationship Notes

- `property.superOwnerId -> user.id`
- `property.createdByUser / updatedByUser / deletedByUser -> user.id`
- `property_owner.userId -> user.id`
- `property_owner.propertyId -> property.id`
- `property_media.propertyId -> property.id`
- `property_media.createdByUser / updatedByUser / deletedByUser -> user.id`
- Each subtype table is `1:0..1` from `property`
- `property.owners` is `1:N` through `property_owner`
- `property.mediaItems` is `1:N` through `property_media`
- `ownershipType = SINGLE_OWNER` means only `superOwner` is expected
- `ownershipType = MULTIPLE_OWNER` means `property_owner` rows are also expected

## Field Groups

- Identity: `id`, `name`, `description`
- Location: `country`, `state`, `city`, `addressLine1`, `addressLine2`, `pincode`, `latitude`, `longitude`
- Search metadata: `locationMetadata`
- Operational: `isVerified`, `isPublished`, `isOperational`
- Certificate: `certificateType`, `certificateStatus`, `certificateEtaDate`, `certificateReceivedAt`
- Area and pricing: `totalAreaSqft`, `roadWidthFt`, `areaType`, `transactionType`, `priceUnit`, `priceNegotiable`
- Classification: `type`, `status`, `ownershipType`
- Ownership and audit: `superOwnerId`, `createdByUser`, `updatedByUser`, `createdAt`, `updatedAt`, `isDeleted`, `deletedAt`, `deletedByUser`
- Media: `property_media`

## Operational Rule

Keep `isOperational` aligned with `certificateStatus`:

- `PENDING` -> `isOperational = false`
- `RECEIVED` -> `isOperational = true`
- `NOT_REQUIRED` -> `isOperational = true`

Suggested transition behavior:

- When `certificateStatus` becomes `RECEIVED`, stamp `certificateReceivedAt` if it is empty.
- When `certificateStatus` becomes `PENDING`, clear `certificateReceivedAt`.
- When `certificateStatus` becomes `NOT_REQUIRED`, keep `certificateReceivedAt` as-is or `null` if you prefer to avoid implying a receipt event.
