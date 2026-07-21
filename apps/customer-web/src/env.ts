import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3000/api/v1'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Dripplex'),
  NEXT_PUBLIC_APP_TAGLINE: z.string().min(1).default('life,Simplified'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function validateClientEnv(source: NodeJS.ProcessEnv = process.env): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: source['NEXT_PUBLIC_API_BASE_URL'],
    NEXT_PUBLIC_APP_URL: source['NEXT_PUBLIC_APP_URL'],
    NEXT_PUBLIC_APP_NAME: source['NEXT_PUBLIC_APP_NAME'],
    NEXT_PUBLIC_APP_TAGLINE: source['NEXT_PUBLIC_APP_TAGLINE'],
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid customer-web environment configuration: ${details}`);
  }

  return parsed.data;
}

export const clientEnv = validateClientEnv();
