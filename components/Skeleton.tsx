export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/70 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div>
            <Skeleton className="h-3 w-20 mb-1.5" />
            <Skeleton className="h-2 w-12" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-1.5 mb-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="pt-3 border-t border-slate-100 flex justify-between">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
