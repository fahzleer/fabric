import type { MerchantProduct } from "@/lib/merchant-api";
import { Atom } from "@effect-atom/atom-react";

/**
 * Source-of-truth for the merchant's product list. The server component
 * seeds this once on page load. Marked keepAlive so it is not garbage-collected
 * between render and the first useLayoutEffect that hydrates it.
 */
export const merchantAllProductsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]));

/**
 * Filter inputs. The query is debounced 150ms to avoid filtering on every
 * keystroke while the user is still typing.
 */
const merchantRawQueryAtom = Atom.keepAlive(Atom.make(""));
export const merchantQueryAtom = Atom.keepAlive(Atom.debounce(merchantRawQueryAtom, "150 millis"));
export const merchantCategoryAtom = Atom.keepAlive(Atom.make("all"));
export const merchantStatusAtom = Atom.keepAlive(Atom.make("all"));

/**
 * Pure derivation — no Effect, no manual `set`. Recomputes only when one
 * of {query, category, status, allProducts} changes. The debounce on the
 * query atom means a fast typist triggers exactly one filter pass 150ms
 * after the last keystroke, not one per keystroke.
 */
export const merchantResultsAtom = Atom.keepAlive(
  Atom.readable((get) => {
    const products = get(merchantAllProductsAtom);
    const query = get(merchantQueryAtom);
    const category = get(merchantCategoryAtom);
    const status = get(merchantStatusAtom);

    const q = query.toLowerCase();
    return products.filter((p) => {
      if (q !== "" && !p.name.toLowerCase().includes(q)) return false;
      if (category !== "all" && p.category !== category) return false;
      if (status !== "all" && p.status !== status) return false;
      return true;
    });
  })
);

/** Re-export the raw query atom under a friendlier name for the input component. */
export { merchantRawQueryAtom };
