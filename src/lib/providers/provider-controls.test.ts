import { afterEach, describe, expect, test } from 'bun:test';
import { providerEnabled } from './provider-controls';

const original = { ...process.env };
afterEach(() => {
  for (const key of ['SARVAM_API_KEY','SARVAM_ENABLED','EMAIL_PROVIDER_API_KEY','RESEND_API','EMAIL_FROM_ADDRESS','EMAIL_DELIVERY_ENABLED','MALWARE_SCANNER_URL','MALWARE_SCANNER_ENABLED']) {
    if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
  }
});

describe('provider kill switches', () => {
  test('disables Sarvam even when a key exists', () => {
    process.env.SARVAM_API_KEY = 'synthetic-key-for-provider-test';
    process.env.SARVAM_ENABLED = 'false';
    expect(providerEnabled('sarvam')).toBe(false);
  });
  test('requires both email credentials and an explicit enabled state', () => {
    process.env.EMAIL_PROVIDER_API_KEY = 'synthetic-email-provider-key';
    process.env.EMAIL_FROM_ADDRESS = 'synthetic@example.com';
    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    expect(providerEnabled('email')).toBe(true);
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    expect(providerEnabled('email')).toBe(false);
  });
});
