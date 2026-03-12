export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </header>

      {/* Product detail skeleton */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Image skeleton */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />

            {/* Thumbnail gallery skeleton */}
            <div className="grid grid-cols-4 gap-4">
              {["thumb-0", "thumb-1", "thumb-2", "thumb-3"].map((key) => (
                <div key={key} className="aspect-square bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Product info skeleton */}
          <div className="flex flex-col space-y-4">
            {/* Title */}
            <div className="h-8 bg-gray-200 rounded w-3/4 animate-pulse" />
            {/* Tagline */}
            <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
            {/* Price */}
            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />

            {/* Description */}
            <div className="mt-6 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            </div>

            {/* Sizes */}
            <div className="mt-6 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
              <div className="flex gap-2">
                {["size-xs", "size-s", "size-m", "size-l", "size-xl"].map((key) => (
                  <div key={key} className="h-10 w-14 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>

            {/* Add to cart button */}
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse mt-8" />

            {/* Material & Care */}
            <div className="mt-8 border-t border-gray-200 pt-8 space-y-4">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
