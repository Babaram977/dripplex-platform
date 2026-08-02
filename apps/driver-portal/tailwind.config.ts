import type { Config } from 'tailwindcss';

import { dripplexTailwindPreset } from '@dripplex/ui/tailwind';

const config: Config = {
  presets: [dripplexTailwindPreset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/hooks/src/**/*.{ts,tsx}',
  ],
};
export default config;
