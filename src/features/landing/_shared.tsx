'use client'

import type { ReactNode } from 'react'

/**
 * Korean-magazine category label.
 * Example: 표제 / Headline    부제 / Subhead    작동 방식 / Process
 * Used as a small classifier above section titles, not as a numbered eyebrow.
 */
export function CategoryLabel({
  kr,
  en,
  align = 'start',
}: {
  kr: string
  en: string
  align?: 'start' | 'between'
}) {
  return (
    <div
      className={
        align === 'between'
          ? 'flex items-baseline justify-between gap-3 text-ink-300 dark:text-ink-200'
          : 'inline-flex items-baseline gap-2 text-ink-300 dark:text-ink-200'
      }
    >
      <span className="text-[11px] font-medium tracking-wider text-clay-500 dark:text-clay-400">
        {kr}
      </span>
      <span className="label-mono">/ {en}</span>
    </div>
  )
}

/** Editorial section heading with the magazine category label above it.
 *  When a `lead` is provided, headline + lead share a two-column grid at lg.
 *  When `lead` is absent, the headline gets the full width and is forced to
 *  one line at lg so long English titles like
 *  "Start multilingual dubbing in four steps" don't wrap. */
export function SectionHeading({
  kr,
  en,
  title,
  lead,
}: {
  kr: string
  en: string
  title: ReactNode
  lead?: ReactNode
}) {
  if (!lead) {
    return (
      <div>
        <CategoryLabel kr={kr} en={en} />
        <h2 className="display-tight mt-3 break-keep text-[32px] font-semibold leading-[1.08] text-ink-900 dark:text-ink-50 sm:text-[40px] lg:whitespace-nowrap lg:text-[44px]">
          {title}
        </h2>
      </div>
    )
  }
  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
      <div>
        <CategoryLabel kr={kr} en={en} />
        <h2 className="display-tight mt-3 max-w-[26ch] break-keep text-[32px] font-semibold leading-[1.08] text-ink-900 dark:text-ink-50 sm:text-[40px] lg:text-[44px]">
          {title}
        </h2>
      </div>
      <p className="max-w-xl break-keep text-[15.5px] leading-[1.65] text-ink-500 dark:text-ink-200">
        {lead}
      </p>
    </div>
  )
}
