import { Skeleton } from "@fabric/ui";

export default function ProductModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-card shadow-xl animate-in zoom-in-95 duration-200">
        <Skeleton className="absolute top-4 right-4 z-10 size-10 rounded-full" />

        <div className="grid grid-cols-1 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-none" />

          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />

            <div className="space-y-2 pt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>

            <div className="pt-4">
              <Skeleton className="mb-2 h-4 w-16" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
