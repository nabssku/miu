export interface ParsedLinkUrl {
  isValid: boolean;
  url: string;
  hostname: string;
  displayPath: string;
  errorLabel: string;
}

function isValidHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost') return true;

  // IPv4 check
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return host.split('.').every((octet) => {
      const n = Number(octet);
      return n >= 0 && n <= 255;
    });
  }

  // IPv6 bracketed host
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.length > 2;
  }

  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
    return false;
  }

  const labels = host.split('.');
  if (labels.some((part) => !part || !/^[a-z0-9-]+$/i.test(part))) {
    return false;
  }

  const tld = labels[labels.length - 1];
  return tld.length >= 2;
}

/**
 * Validates and normalizes an external web URL for link/bookmark blocks.
 * Only permits http:// and https:// protocols.
 */
export function parseLinkUrl(rawInput: string): ParsedLinkUrl {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      url: '',
      hostname: '',
      displayPath: '',
      errorLabel: 'URL Kosong'
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      url: '',
      hostname: '',
      displayPath: '',
      errorLabel: 'URL tidak boleh mengandung spasi'
    };
  }

  // Reject explicit non-HTTP(S) schemes (e.g. javascript:, data:, file:),
  // while still allowing host:port (e.g. localhost:3000) to be normalized.
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\d+(?:\/|$|\?|#))/.test(trimmed)) {
      return {
        isValid: false,
        url: '',
        hostname: '',
        displayPath: '',
        errorLabel: 'Gunakan protokol http:// atau https://'
      };
    }
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    const isLocalTarget = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$|\?|#)/i.test(normalized);
    normalized = `${isLocalTarget ? 'http' : 'https'}://${normalized}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return {
      isValid: false,
      url: '',
      hostname: '',
      displayPath: '',
      errorLabel: 'Format URL tidak valid'
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      url: '',
      hostname: '',
      displayPath: '',
      errorLabel: 'Gunakan protokol http:// atau https://'
    };
  }

  if (!isValidHost(parsed.hostname)) {
    return {
      isValid: false,
      url: '',
      hostname: '',
      displayPath: '',
      errorLabel: 'Masukkan domain atau URL valid'
    };
  }

  const hostname = parsed.hostname.replace(/^www\./i, '');
  const pathWithQuery =
    (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;

  return {
    isValid: true,
    url: parsed.toString(),
    hostname,
    displayPath: `${hostname}${pathWithQuery}`,
    errorLabel: ''
  };
}
