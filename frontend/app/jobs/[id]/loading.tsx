import { Skeleton } from "@/components/ui/skeleton";

export default function JobDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="mb-2 h-6 w-32 rounded-md" />
      <Skeleton className="mb-4 h-10 w-80 rounded-xl" />
      <Skeleton className="mb-8 h-5 w-48 rounded-md" />
      <div className="grid gap-8 md:grid-cols-[1fr,260px]">
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
