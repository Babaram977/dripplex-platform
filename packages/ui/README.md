# `@dripplex/ui`

Shared design system built on Radix UI primitives, Tailwind tokens, and shadcn-style components.

## Brand identity

Official Dripplex colours, logo mark, and tagline (`life,Simplified`) live in:

- `src/brand/tokens.ts`
- `src/styles/globals.css`
- `src/brand/dripplex-logo.tsx`

See [docs/BRAND-IDENTITY.md](../../docs/BRAND-IDENTITY.md).

## Exports

- `.` — components (`Button`, `Card`, `Input`, `toast`, `DripplexLogo`, etc.)
- `./styles.css` — design tokens and base styles
- `./tailwind` — `dripplexTailwindPreset` for portal Tailwind configs

## Usage

```tsx
import { Button, DripplexLogo, DripplexTagline } from '@dripplex/ui';
```

```css
@import '@dripplex/ui/styles.css';
```
