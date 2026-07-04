/**
 * Shared `layoutId` key between the product-card thumbnail (grid) and the
 * quick-view modal's image (`@modal/(.)product/[id]`). Because Next.js
 * intercepting routes keep the grid mounted underneath the modal, `motion`
 * detects both elements sharing this id and animates a real shared-element
 * transition (the thumbnail morphs into the modal image) instead of a generic
 * cross-fade. Centralized so both sides can never drift out of sync.
 */
export function productImageLayoutId(productId: string): string {
  return `product-image-${productId}`;
}
