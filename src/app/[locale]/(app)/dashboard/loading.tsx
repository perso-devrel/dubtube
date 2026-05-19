import { Card } from '@/components/ui'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-paper-200 dark:bg-paper-700 ${className ?? ''}`} />
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-5 w-64" />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>

      {/* Quick start */}
      <Card>
        <Skeleton className="h-6 w-28" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-64" />
        </Card>
        <Card>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-64" />
        </Card>
      </div>

      {/* Recent jobs */}
      <Card>
        <Skeleton className="h-6 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
    </div>
  )
}
