export default function RootLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto animate-pulse" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading Fabric...</h1>

        <div className="w-48 h-1 bg-gray-200 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-gray-900 rounded-full w-1/3 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
