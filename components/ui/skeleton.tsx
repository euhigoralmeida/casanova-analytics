export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-zinc-200 rounded ${className ?? ""}`} />
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <Skeleton className="h-5 w-48 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
