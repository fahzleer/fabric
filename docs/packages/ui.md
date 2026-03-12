# @fabric/ui — Component Library

**Location**: `packages/ui/`
**Base**: shadcn/ui (Radix UI primitives + Tailwind CSS)
**Storybook**: port 6006 (`bun run storybook`)
**Tests**: Vitest

---

## What's Here

Shared UI primitives consumed by `apps/web`. Components are unstyled by Radix UI at the primitive level and styled with Tailwind CSS classes. The component set is intentionally minimal — only components used by multiple pages.

**Current components**:
- `Dialog` — Modal dialog (Radix Dialog)
- `Select` — Dropdown select (Radix Select)
- `Button` — Styled button with variants

---

## Usage

```tsx
import { Button, Dialog, Select } from "@fabric/ui"

// Button variants
<Button variant="primary" size="sm">Submit</Button>
<Button variant="ghost" disabled>Loading...</Button>

// Dialog
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Content>
    <Dialog.Title>Confirm Action</Dialog.Title>
    <Dialog.Description>This cannot be undone.</Dialog.Description>
    <Dialog.Footer>
      <Button variant="destructive" onClick={confirm}>Delete</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

---

## Adding Components

1. Install the Radix primitive if needed: `bun add @radix-ui/react-{name}`
2. Create `packages/ui/src/components/{name}.tsx`
3. Export from `packages/ui/src/index.ts`
4. Write a Storybook story in `packages/ui/src/stories/{name}.stories.tsx`
5. Add a Vitest test for interaction behavior

---

## Design Decisions

**Radix UI as the foundation**: Accessibility is handled at the primitive level. Focus management, keyboard navigation, ARIA roles — Radix handles all of this. The team writes styles, not accessibility plumbing.

**Tailwind CSS 4 (not CSS Modules)**: Tailwind's CSS-first approach (v4 uses CSS `@theme` variables, no JavaScript config) aligns with the project's preference for zero JavaScript in the styling pipeline where possible.

**No design token abstraction layer**: Colors, spacing, and typography are defined in `tailwind.css` as CSS variables. Components reference these variables directly. There is no separate design token system — the variables *are* the tokens.
