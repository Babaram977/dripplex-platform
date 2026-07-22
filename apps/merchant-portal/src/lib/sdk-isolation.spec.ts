import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'coverage') continue;
      files.push(...walk(full));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.includes('.spec.') &&
      !entry.includes('.test.')
    ) {
      files.push(full);
    }
  }
  return files;
}

describe('Merchant Portal SDK isolation', () => {
  it('keeps screens off *.http.ts / *.mock.ts and uses portal barrel', () => {
    const files = walk(path.join(root, 'src'));
    const offenders: string[] = [];
    let sawBarrel = false;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (
        /from ['"][^'"]*\.(http|mock)['"]/.test(text) ||
        /\.(http|mock)\.ts/.test(path.basename(file))
      ) {
        offenders.push(path.relative(root, file));
      }
      if (file.endsWith('sdk-merchant.ts') && text.includes('createMerchantSdk')) {
        sawBarrel = true;
      }
    }
    expect(offenders).toEqual([]);
    expect(sawBarrel).toBe(true);
  });
});
