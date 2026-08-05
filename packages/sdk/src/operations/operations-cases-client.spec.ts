import { describe, expect, it, vi } from 'vitest';

import { OperationsCasesClient } from './operations-cases-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsCasesClient', () => {
  it('getCase() gets /operations/cases/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsCasesClient(http);

    await client.getCase('case-1');

    expect(request).toHaveBeenCalledWith('/operations/cases/case-1', {
      method: 'GET',
      auth: true,
    });
  });

  it('updateCase() patches /operations/cases/:id with the body', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsCasesClient(http);

    await client.updateCase('case-1', { status: 'ASSIGNED', assignedToId: 'user-1', version: 3 });

    expect(request).toHaveBeenCalledWith('/operations/cases/case-1', {
      method: 'PATCH',
      body: { status: 'ASSIGNED', assignedToId: 'user-1', version: 3 },
      auth: true,
    });
  });

  it('addNote() posts /operations/cases/:id/notes with the body', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsCasesClient(http);

    await client.addNote('case-1', { note: 'Called the driver.' });

    expect(request).toHaveBeenCalledWith('/operations/cases/case-1/notes', {
      method: 'POST',
      body: { note: 'Called the driver.' },
      auth: true,
    });
  });
});
