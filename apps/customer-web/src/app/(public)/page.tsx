import * as React from 'react';

import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroSection } from '@/components/marketing/hero-section';
import { SplashIntro } from '@/components/marketing/splash-intro';

export default function LandingPage(): React.JSX.Element {
  return (
    <>
      <SplashIntro />
      <HeroSection />
      <FeatureGrid />
    </>
  );
}
