'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import type { DashboardSummary, DubbingJob, CreditUsageRow, LanguagePerformanceRow } from '@/features/dashboard/components/types'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!json.ok) {
    throw new Error(json.error?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
  return json.data as T
}

export function useDashboardSummary(initialData?: DashboardSummary | null) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['dashboard-summary', user?.uid],
    queryFn: async () => {
      if (!user) return null
      return fetchJson<DashboardSummary>(`/api/dashboard/summary?uid=${user.uid}`)
    },
    enabled: !!user,
    staleTime: 30_000,
    initialData: initialData ?? undefined,
  })
}

export function useRecentJobs(initialData?: DubbingJob[], limit = 10) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['recent-jobs', user?.uid, limit],
    queryFn: async () => {
      if (!user) return []
      return fetchJson<DubbingJob[]>(`/api/dashboard/jobs?uid=${encodeURIComponent(user.uid)}&limit=${limit}`)
    },
    enabled: !!user,
    staleTime: 30_000,
    initialData,
  })
}

export function useCreditUsage(initialData?: CreditUsageRow[]) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['credit-usage', user?.uid],
    queryFn: async () => {
      if (!user) return []
      return fetchJson<CreditUsageRow[]>(`/api/dashboard/credit-usage?uid=${user.uid}`)
    },
    enabled: !!user,
    staleTime: 60_000,
    initialData,
  })
}

export function useLanguagePerformance() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['language-performance', user?.uid],
    queryFn: async () => {
      if (!user) return []
      return fetchJson<LanguagePerformanceRow[]>(`/api/dashboard/language-performance?uid=${user.uid}`)
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

// useChannelStats is defined in useYouTubeData.ts — use that one instead
