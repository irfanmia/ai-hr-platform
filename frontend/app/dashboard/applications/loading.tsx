import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardApplicationsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64 rounded-xl" />
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      {/* Table */}
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}
