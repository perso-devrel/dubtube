'use client'

import { MetadataLocalizationTool } from '@/features/metadata/components/MetadataLocalizationTool'
import { PageHeader } from '@/components/layout/PageHeader'
import { useLocaleText } from '@/hooks/useLocaleText'

export default function MetadataPage() {
  const t = useLocaleText()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('app.app.metadata.page.youTubeTitleAndDescriptionTranslation')}
        description={t('app.app.metadata.page.localizeYouTubeTitlesAndDescriptionsIntoMultipleLanguages')}
      />

      <MetadataLocalizationTool />
    </div>
  )
}
