# @fabric/orpc — oRPC Utility Layer

**Location**: `packages/orpc/src/`

Utility wrappers around `@orpc/server` that provide typed procedure creation with built-in auth and error handling conventions.

---

## API

```typescript
// Create an unauthenticated procedure
export function createPub<TInput, TOutput>(opts: {
  input: Schema<TInput>
  output: Schema<TOutput>
  handler: (input: TInput, ctx: PublicContext) => Promise<TOutput>
}): Procedure<TInput, TOutput>

// Create an authenticated procedure (requires valid PASETO context)
export function createAuthed<TInput, TOutput>(opts: {
  input: Schema<TInput>
  output: Schema<TOutput>
  handler: (input: TInput, ctx: AuthedContext) => Promise<TOutput>
}): Procedure<TInput, TOutput>

// AuthedContext provides
interface AuthedContext {
  userId: string
  userRole: UserRole
  userEmail: string
}

// Typed error for oRPC procedures
export class ORPCError extends Error {
  constructor(
    public readonly code: string,   // e.g. "NOT_FOUND", "UNAUTHORIZED"
    message: string
  )
}

// Generate OpenAPI spec from router (for documentation / SDK generation)
export async function generateOpenApiSpec(
  router: Router,
  options: OpenApiOptions
): Promise<OpenApiSpec>
```

---

## Usage

```typescript
// packages/contract/src/routers/product.router.ts
import { createPub, createAuthed } from "@fabric/orpc"

export const productRouter = {
  list: createPub({
    input: ListProductsInput,
    output: PaginatedProductsDto,
    handler: async (input, ctx) => {
      // Public — no auth required
      return productService.listActive(input)
    },
  }),

  create: createAuthed({
    input: CreateProductInput,
    output: ProductDetailDto,
    handler: async (input, ctx) => {
      // ctx.userId, ctx.userRole are available
      if (ctx.userRole !== "store_owner") throw new ORPCError("FORBIDDEN", "store_owner required")
      return productService.create(input, ctx.userId)
    },
  }),
}
```

---

## Why oRPC Over tRPC?

tRPC is Next.js-first and couples the router to React adapter infrastructure. oRPC is runtime-agnostic — it works equally well in Hono (cf-api), Next.js server actions (web), and standalone scripts. The contract package (`@fabric/contract`) uses oRPC types without depending on any framework.
