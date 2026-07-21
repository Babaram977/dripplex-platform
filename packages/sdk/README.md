# `@dripplex/sdk`

Typed HTTP client for Dripplex REST APIs under `/api/v1`.

## Usage

```ts
import { DripplexClient } from '@dripplex/sdk';

const client = new DripplexClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: () => localStorage.getItem('accessToken'),
});

await client.auth.login({ email, password });
```
