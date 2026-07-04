"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * Header search — the SearchAction JSON-LD in layout.tsx has always pointed
 * at /products?q={search_term_string}, but no UI ever read that param until
 * now. Submitting navigates to /products?q=... where ProductsCatalog seeds
 * its initial filter from the query string.
 */
export function SearchInput() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products");
  }

  return (
    <search className="hidden sm:block">
      <form onSubmit={handleSubmit} className="relative">
        <label htmlFor="header-search" className="sr-only">
          ค้นหาสินค้า
        </label>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="header-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ค้นหาสินค้า…"
          className="w-40 rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-56"
        />
      </form>
    </search>
  );
}
