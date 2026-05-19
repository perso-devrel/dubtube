'use client'

import { SettingsClient } from '@/features/settings/components/SettingsClient'
import { PageHeader } from '@/components/layout/PageHeader'
import { useLocaleText } from '@/hooks/useLocaleText'

export default function SettingsPage() {
  const t = useLocaleText()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('app.app.settings.page.settings')}
        description={t('app.app.settings.page.manageDisplayLanguageAndYouTubeDefaults')}
      />

      <SettingsClient />
    </div>
  )
}
