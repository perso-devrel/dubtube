'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui'
import { useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { useOperationsAccess } from '@/features/ops/hooks/useOperationsAccess'

export function OpsAlertButton() {
  const router = useLocaleRouter()
  const t = useLocaleText()
  const query = useOperationsAccess()

  const count = query.data?.alertCount ?? 0
  const label = count > 0
    ? t('features.ops.components.opsAlertButton.valueOperationsAlerts', { count: count })
    : t('features.ops.components.opsAlertButton.operationsAlerts')

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      className="relative"
      onClick={() => router.push('/ops')}
    >
      <Bell className="h-4.5 w-4.5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-paper-50">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  )
}
