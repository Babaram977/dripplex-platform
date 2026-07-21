import * as React from 'react';

import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroSection } from '@/components/marketing/hero-section';

export default function LandingPage(): React.JSX.Element {
  return (
    <>
      <HeroSection />
      <FeatureGrid />
    </>
  );
}
