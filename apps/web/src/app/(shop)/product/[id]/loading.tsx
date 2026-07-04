import { Skeleton } from "@fabric/ui";

export default function Loading() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Header skeleton */}
      <header className="border-b border-border bg-background shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Skeleton className="h-6 w-32" />
        </div>
      </header>

      {/* Product detail skeleton */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Image skeleton */}
          <div className="space-y-4">
            <Skeleton className="aspect-square w-full rounded-lg" />

            {/* Thumbnail gallery skeleton */}
            <div className="grid grid-cols-4 gap-4">
              {["thumb-0", "thumb-1", "thumb-2", "thumb-3"].map((key) => (
                <Skeleton key={key} className="aspect-square" />
              ))}
            </div>
          </div>

          {/* Product info skeleton */}
          <div className="flex flex-col space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-8 w-24" />

            {/* Description */}
            <div className="mt-6 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Sizes */}
            <div className="mt-6 space-y-2">
              <Skeleton className="h-4 w-16" />
              <div className="flex gap-2">
                {["size-xs", "size-s", "size-m", "size-l", "size-xl"].map((key) => (
                  <Skeleton key={key} className="h-10 w-14" />
                ))}
              </div>
            </div>

            {/* Add to cart button */}
            <Skeleton className="mt-8 h-12 w-full rounded-lg" />

            {/* Material & Care */}
            <div className="mt-8 space-y-4 border-t border-border pt-8">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
