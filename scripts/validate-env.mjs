#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envExamplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');

const PLACEHOLDER_PATTERNS = [/^replace-with/i, /^changeme/i, /^your[-_]/i, /^example/i, /^todo/i];

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
];

function parseEnv(content) {
  const entries = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function main() {
  if (!existsSync(envExamplePath)) {
    console.error('Missing .env.example at repository root.');
    process.exit(1);
  }

  const exampleEnv = parseEnv(readFileSync(envExamplePath, 'utf8'));
  const usingLocalEnv = existsSync(envPath);
  const activeEnv = usingLocalEnv ? parseEnv(readFileSync(envPath, 'utf8')) : exampleEnv;

  const errors = [];

  for (const key of REQUIRED_KEYS) {
    const value = activeEnv[key];

    if (!value) {
      errors.push(`${key} is missing`);
      continue;
    }

    if (!usingLocalEnv) {
      continue;
    }

    if (key.includes('SECRET') && value.length < 32) {
      errors.push(`${key} must be at least 32 characters`);
    }

    if (key.includes('SECRET') && isPlaceholder(value)) {
      errors.push(`${key} still uses a placeholder value`);
    }
  }

  if (errors.length > 0) {
    console.error('Environment validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    usingLocalEnv
      ? 'Local .env validation passed.'
      : 'Environment template validation passed (.env.example).',
  );
}

main();
