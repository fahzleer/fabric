export default function ProductModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="relative max-w-2xl w-full bg-white rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="absolute top-4 right-4 z-10 rounded-full bg-gray-200 p-2 w-10 h-10" />

        <div className="grid grid-cols-1 md:grid-cols-2 animate-pulse">
          <div className="aspect-square bg-gray-200" />

          <div className="p-6 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />

            <div className="space-y-2 pt-4">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-4/6" />
            </div>

            <div className="pt-4">
              <div className="h-4 bg-gray-200 rounded w-16 mb-2" />
              <div className="flex gap-2">
                <div className="h-8 w-12 bg-gray-200 rounded" />
                <div className="h-8 w-12 bg-gray-200 rounded" />
                <div className="h-8 w-12 bg-gray-200 rounded" />
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <div className="h-10 bg-gray-200 rounded w-full" />
              <div className="h-10 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
