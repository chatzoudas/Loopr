import { Skeleton } from "@/components/ui/skeleton";

export function FeedSkeleton() {
  return (
    <div className="flex flex-col space-y-4 pt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex space-x-4 border rounded-xl p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
