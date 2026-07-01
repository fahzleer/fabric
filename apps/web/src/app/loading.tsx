import { Skeleton } from "@fabric/ui";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <div className="mb-8">
          <Skeleton className="mx-auto size-16 rounded-full" />
        </div>

        <h1 className="mb-2 text-xl font-semibold text-foreground">Loading Fabric...</h1>

        <div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-foreground" />
        </div>
      </div>
    </div>
  );
}
