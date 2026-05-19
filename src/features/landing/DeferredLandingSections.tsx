'use client'

import { HowItWorks } from './HowItWorks'
import { FeatureShowcase } from './FeatureShowcase'
import { ROICalculator } from './ROICalculator'
import { PricingSection } from './PricingSection'
import { CTASection } from './CTASection'

/**
 * All landing sections render eagerly. Previous lazy gating with
 * IntersectionObserver caused sections to remain in skeleton state after
 * back-navigation from external/auth pages — BFCache restore and
 * scroll-restoration race conditions kept `isReady` stuck at false.
 */
export function DeferredLandingSections() {
  return (
    <>
      <HowItWorks />
      <FeatureShowcase />
      <ROICalculator />
      <PricingSection />
      <CTASection />
    </>
  )
}
