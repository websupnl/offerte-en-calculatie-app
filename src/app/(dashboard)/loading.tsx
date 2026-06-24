export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-[104px] border-b bg-white" />
      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-xl border bg-white" />
          ))}
        </div>
        <div className="h-80 rounded-xl border bg-white" />
      </div>
    </div>
  );
}
