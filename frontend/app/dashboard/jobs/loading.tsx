import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardJobsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}
