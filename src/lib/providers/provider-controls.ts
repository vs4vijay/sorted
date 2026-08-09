export type ProviderCapability = 'sarvam' | 'email' | 'malware_scanner';

function enabled(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function providerEnabled(capability: ProviderCapability): boolean {
  if (capability === 'sarvam') return enabled(process.env.SARVAM_ENABLED, true) && Boolean(process.env.SARVAM_API_KEY);
  if (capability === 'email') return enabled(process.env.EMAIL_DELIVERY_ENABLED, true)
    && Boolean(process.env.EMAIL_PROVIDER_API_KEY ?? process.env.RESEND_API)
    && Boolean(process.env.EMAIL_FROM_ADDRESS);
  return enabled(process.env.MALWARE_SCANNER_ENABLED, true) && Boolean(process.env.MALWARE_SCANNER_URL);
}

export function providerControlSummary() {
  return {
    sarvam: providerEnabled('sarvam') ? 'live' as const : 'simulated' as const,
    email: providerEnabled('email') ? 'live' as const : 'simulated' as const,
    malwareScanner: providerEnabled('malware_scanner') ? 'live' as const : 'simulated' as const,
  };
}
