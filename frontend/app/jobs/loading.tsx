import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading skeleton for /jobs. Rendered while the page's
 * server components + initial data resolve. Matches the layout of the
 * rendered page (filter sidebar + card grid) so the transition feels
 * instant rather than jumpy.
 */
export default function JobsLoading() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Skeleton className="mb-6 h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px,1fr]">
          {/* Filter sidebar */}
          <aside className="hidden md:block space-y-4">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </aside>
          {/* Card grid */}
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
