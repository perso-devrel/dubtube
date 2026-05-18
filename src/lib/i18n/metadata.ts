import type { Metadata } from 'next'
import { SUPPORTED_LANGUAGE_COUNT } from '@/utils/languages'
import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  resolveAppLocale,
  withLocalePath,
  type AppLocale,
} from '@/lib/i18n/config'
import { message, type MessageKey } from '@/lib/i18n/messages'
import { SITE_NAME } from '@/lib/seo'

export type LocaleMetadataProps = {
  params: Promise<{ locale: string }>
}

type LocalizedPageMetadata = {
  title: MessageKey
  description?: MessageKey
  path: string
}

const OPEN_GRAPH_LOCALES: Record<AppLocale, string> = {
  ko: 'ko_KR',
  en: 'en_US',
}

const sharedOpenGraphImage = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'sub2tube - AI caption and dubbing tools for YouTube creators',
}

const landingTitle = 'metadata.landing.title'
const landingDescription = 'metadata.landing.description'

const marketingMetadata = {
  privacy: {
    title: 'lib.i18n.metadata.titlePrivacyPolicy',
    description: 'lib.i18n.metadata.descriptionHowsub2tubeHandlesPersonalDataYouTubeAPI',
    path: '/privacy',
  },
  terms: {
    title: 'lib.i18n.metadata.titleTermsOfService',
    description: 'lib.i18n.metadata.descriptionsub2tubeTermsOfServiceIncludingYouTubeAPI',
    path: '/terms',
  },
  support: {
    title: 'lib.i18n.metadata.titleSupportAndContact',
    description: 'lib.i18n.metadata.descriptionSupportAndContact',
    path: '/support',
  },
} satisfies Record<string, LocalizedPageMetadata>

const appRouteMetadata = {
  batch: { title: 'lib.i18n.metadata.titleDubbingJobs', path: '/batch' },
  billing: { title: 'lib.i18n.metadata.titleBilling', path: '/billing' },
  dashboard: { title: 'lib.i18n.metadata.titleDashboard', path: '/dashboard' },
  dubbing: { title: 'lib.i18n.metadata.titleNewDubbing', path: '/dubbing' },
  jobs: { title: 'lib.i18n.metadata.titleDubbingJobs', path: '/jobs' },
  metadata: { title: 'lib.i18n.metadata.titleTitleDescription', path: '/metadata' },
  ops: { title: 'lib.i18n.metadata.titleOperations', path: '/ops' },
  settings: { title: 'lib.i18n.metadata.titleSettings', path: '/settings' },
  uploads: { title: 'lib.i18n.metadata.titleYouTubeUploads', path: '/uploads' },
  youtube: { title: 'lib.i18n.metadata.titleYouTubeSettings', path: '/youtube' },
} satisfies Record<string, LocalizedPageMetadata>

export async function resolveMetadataLocale(params: Promise<{ locale: string }>): Promise<AppLocale> {
  const { locale } = await params
  return resolveAppLocale(locale)
}

function localizedAlternates(path: string, locale: AppLocale): Metadata['alternates'] {
  return {
    canonical: withLocalePath(path, locale),
    languages: Object.fromEntries([
      ...APP_LOCALES.map((appLocale) => [appLocale, withLocalePath(path, appLocale)]),
      ['x-default', withLocalePath(path, DEFAULT_APP_LOCALE)],
    ]),
  }
}

export function getLandingMetadata(locale: AppLocale): Metadata {
  const title = message(locale, landingTitle)
  const description = message(locale, landingDescription, { SUPPORTED_LANGUAGE_COUNT })
  const path = '/'

  return {
    title,
    description,
    alternates: localizedAlternates(path, locale),
    openGraph: {
      title,
      description,
      type: 'website',
      url: withLocalePath(path, locale),
      locale: OPEN_GRAPH_LOCALES[locale],
      alternateLocale: APP_LOCALES.filter((appLocale) => appLocale !== locale).map((appLocale) => OPEN_GRAPH_LOCALES[appLocale]),
      siteName: SITE_NAME,
      images: [sharedOpenGraphImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-image'],
    },
  }
}

export function getSoftwareJsonLd(locale: AppLocale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    description: message(locale, landingDescription, { SUPPORTED_LANGUAGE_COUNT }),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: locale === 'ko' ? 'KRW' : 'USD',
    },
  }
}

export function getMarketingMetadata(locale: AppLocale, page: keyof typeof marketingMetadata): Metadata {
  return getPageMetadata(locale, marketingMetadata[page], { robots: { index: true, follow: true } })
}

export function getAppRouteMetadata(locale: AppLocale, page: keyof typeof appRouteMetadata): Metadata {
  return getPageMetadata(locale, appRouteMetadata[page], {
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  })
}

function getPageMetadata(
  locale: AppLocale,
  page: LocalizedPageMetadata,
  extra: Metadata = {},
): Metadata {
  const title = message(locale, page.title)
  const description = page.description ? message(locale, page.description) : undefined
  const alternates = localizedAlternates(page.path, locale)
  const openGraph: NonNullable<Metadata['openGraph']> = {
    title,
    description,
    type: 'website',
    url: withLocalePath(page.path, locale),
    locale: OPEN_GRAPH_LOCALES[locale],
    alternateLocale: APP_LOCALES.filter((appLocale) => appLocale !== locale).map((appLocale) => OPEN_GRAPH_LOCALES[appLocale]),
    siteName: SITE_NAME,
    images: [sharedOpenGraphImage],
  }
  const twitter: NonNullable<Metadata['twitter']> = {
    card: 'summary_large_image',
    title,
    description,
    images: ['/twitter-image'],
  }

  return {
    title,
    description,
    alternates,
    ...extra,
    openGraph: {
      ...openGraph,
      ...extra.openGraph,
    },
    twitter: {
      ...twitter,
      ...extra.twitter,
    },
  }
}
