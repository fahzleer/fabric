# @fabric/contract — oRPC Input/Output Schemas

**Location**: `packages/contract/src/`

The contract package defines the typed interface between API consumers and API providers. It is the boundary at which `@fabric/types` (domain types) translate into wire-format DTOs (Data Transfer Objects) suitable for HTTP transport.

---

## Why a Separate Contract Package?

Without a contract package, you have two options — both bad:

1. **Share domain types directly**: Exposes internal business logic (branded types, state machines, internal IDs) to API consumers. A change to an internal type is a breaking change in the public API.

2. **Duplicate types in each consumer**: `ProductSummaryDto` defined in cf-api and redefined in the Next.js frontend. They drift. They break. You discover the drift at runtime.

The contract package is the explicit answer: one definition, consumed by both the provider (cf-api) and the consumer (web). The provider serializes domain objects *into* contract types. The consumer deserializes contract types *from* HTTP responses.

---

## oRPC

`@orpc/client` provides end-to-end type safety for HTTP procedures — similar to tRPC but not coupled to React or Next.js. The contract defines the input/output types; the client infers them automatically.

```typescript
// Contract defines: listProducts(input: ListProductsInput) → PaginatedProductsDto
// Client usage — fully typed, no code generation
const products = await orpc.products.list({ page: 1, perPage: 20, category: "premium" })
// TypeScript knows: products is PaginatedProductsDto
```

---

## Product Contract

```typescript
// Input/output for product listing
type ProductSortField = "price_asc" | "price_desc" | "name_asc" | "name_desc" | "created_desc"

type ListProductsInput = {
  page?: number              // Default 1
  perPage?: number           // Default 20, max 100
  category?: ProductCategory
  minPrice?: number          // Cents
  maxPrice?: number          // Cents
  sort?: ProductSortField    // Default "created_desc"
}

type ProductImageDto = {
  url: string
  altText: string
  isPrimary: boolean
  order: number
}

type ProductSummaryDto = {
  id: string
  name: string
  price: number              // Amount in cents
  priceCurrency: string      // CurrencyCode
  category: ProductCategory
  status: ProductStatus
  primaryImage: ProductImageDto | null
  availableSizes: ProductSize[]
}

type ProductDetailDto = ProductSummaryDto & {
  description: string
  images: ProductImageDto[]
  createdAt: string          // ISO 8601
  updatedAt: string          // ISO 8601
}

type PaginatedProductsDto = {
  items: ProductSummaryDto[]
  total: number
  page: number
  perPage: number
}
```

---

## Auth Contract

```typescript
type RegisterInput = {
  email: string
  password: string
  displayName: string
  role?: "customer" | "store_owner"   // Default "customer"
}

type RegisterOutput = {
  accessToken: string      // PASETO v3.local
  refreshToken: string     // PASETO v3.local
  user: {
    id: string
    email: string
    displayName: string
    role: UserRole
  }
}

type LoginInput = {
  email: string
  password: string
}

type LoginOutput = RegisterOutput   // Same shape

type RefreshInput  = { refreshToken: string }
type RefreshOutput = { accessToken: string }
```

---

## Router Definition

```typescript
// packages/contract/src/routers/product.router.ts
export const productRouter = {
  list:   createProcedure({ input: ListProductsInput,   output: PaginatedProductsDto }),
  get:    createProcedure({ input: { id: string },       output: ProductDetailDto     }),
  create: createProcedure({ input: CreateProductInput,  output: ProductDetailDto,    auth: true }),
  update: createProcedure({ input: UpdateProductInput,  output: ProductDetailDto,    auth: true }),
}

// packages/contract/src/routers/auth.router.ts
export const authRouter = {
  register: createProcedure({ input: RegisterInput, output: RegisterOutput }),
  login:    createProcedure({ input: LoginInput,    output: LoginOutput    }),
  refresh:  createProcedure({ input: RefreshInput,  output: RefreshOutput  }),
  logout:   createProcedure({ input: {},            output: {},  auth: true }),
}
```

---

## Usage Pattern

**In cf-api (provider side)**:
```typescript
import { PaginatedProductsDto, ProductSummaryDto } from "@fabric/contract"

// Map domain objects to contract DTOs before returning
function toProductSummaryDto(product: Product): ProductSummaryDto {
  return {
    id: product.id.value,
    name: product.name.value,
    price: product.price.amount,
    priceCurrency: product.price.currency,
    // ...
  }
}
```

**In apps/web (consumer side)**:
```typescript
import { orpc } from "@/lib/orpc"
import type { ProductSummaryDto } from "@fabric/contract"

// oRPC client infers types from the contract automatically
const { data } = useQuery(orpc.products.list.queryOptions({ page: 1 }))
// data: PaginatedProductsDto | undefined
```
