import { Skeleton } from "@/components/ui/skeleton";

export default function MyDashboardLoading() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}
