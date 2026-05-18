import type { Metadata } from 'next'
import {
  getAppRouteMetadata,
  resolveMetadataLocale,
  type LocaleMetadataProps,
} from '@/lib/i18n/metadata'
import { ClientMessagesProvider } from '@/lib/i18n/clientMessages'
import { uploadsMessages } from '@/lib/i18n/client-messages/uploads'

export async function generateMetadata({ params }: LocaleMetadataProps): Promise<Metadata> {
  const locale = await resolveMetadataLocale(params)
  return getAppRouteMetadata(locale, 'jobs')
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessagesProvider messages={uploadsMessages}>{children}</ClientMessagesProvider>
}
