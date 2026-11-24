import { describe, expect, it } from 'vitest';
import { takeUnexpectedRequests } from '../../tests/setup.specs';

/** The specs project runs offline: `tests/setup.specs.ts` answers telemetry itself and fails any other request. */
describe('specs network guard', () => {
  it('answers telemetry without reaching tlm.uploadcare.com', async () => {
    const response = await fetch('https://tlm.uploadcare.com/api/v1/events', { method: 'POST', body: '{}' });

    expect(response.ok).toBe(true);
    expect(takeUnexpectedRequests()).toEqual([]);
  });

  it('rejects and records any other outbound fetch', async () => {
    await expect(fetch('https://upload.uploadcare.com/base/')).rejects.toThrow(/unexpected network request/);

    expect(takeUnexpectedRequests()).toEqual(['GET https://upload.uploadcare.com/base/']);
  });

  it('rejects and records an outbound XMLHttpRequest', () => {
    const xhr = new XMLHttpRequest();

    expect(() => xhr.open('POST', 'https://upload.uploadcare.com/base/')).toThrow(/unexpected network request/);
    expect(takeUnexpectedRequests()).toEqual(['POST https://upload.uploadcare.com/base/']);
  });
});
