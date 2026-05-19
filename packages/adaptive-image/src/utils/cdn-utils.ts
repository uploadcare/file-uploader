/**
 * Trim leading `-/`, `/` and trailing `/` from CDN operation
 */
export const normalizeCdnOperation = (operation?: unknown): string => {
  if (typeof operation !== 'string' || !operation) {
    return '';
  }
  let str = operation.trim();
  if (str.startsWith('-/')) {
    str = str.slice(2);
  } else if (str.startsWith('/')) {
    str = str.slice(1);
  }

  if (str.endsWith('/')) {
    str = str.slice(0, str.length - 1);
  }
  return str;
};

/**
 * Join multiple CDN operations into one string without trailing or leading delimeters
 */
export const joinCdnOperations = (...operations: unknown[]): string => {
  return operations
    .filter((op): op is string => typeof op === 'string' && !!op)
    .map((op) => normalizeCdnOperation(op))
    .join('/-/');
};

/**
 * Create string with leading `-/` from passed CDN operations. Do the same as `joinCdnOperations` but adds leading `-/`
 * and trailing `/`
 */
export const createCdnUrlModifiers = (...cdnOperations: unknown[]): string => {
  const joined = joinCdnOperations(...cdnOperations);
  return joined ? `-/${joined}/` : '';
};

/**
 * Extract filename or file URL
 */
export function extractFilename(cdnUrl: string): string {
  const url = new URL(cdnUrl);
  const noOrigin = url.pathname + url.search + url.hash;
  const urlFilenameIdx = noOrigin.lastIndexOf('http');
  const plainFilenameIdx = noOrigin.lastIndexOf('/');
  let filename = '';

  if (urlFilenameIdx >= 0) {
    filename = noOrigin.slice(urlFilenameIdx);
  } else if (plainFilenameIdx >= 0) {
    filename = noOrigin.slice(plainFilenameIdx + 1);
  }

  return filename;
}

/**
 * Extract UUID from CDN URL
 */
export function extractUuid(cdnUrl: string): string {
  const url = new URL(cdnUrl);
  const { pathname } = url;
  const slashIndex = pathname.indexOf('/');
  const secondSlashIndex = pathname.indexOf('/', slashIndex + 1);
  return pathname.substring(slashIndex + 1, secondSlashIndex);
}

/**
 * Extract operations string from CDN URL
 */
export function extractCdnUrlModifiers(cdnUrl: string): string {
  const withoutFilename = trimFilename(cdnUrl);
  const url = new URL(withoutFilename);
  const operationsMarker = url.pathname.indexOf('/-/');
  if (operationsMarker === -1) {
    return '';
  }
  const operationsStr = url.pathname.substring(operationsMarker).slice(1);

  return operationsStr;
}

/**
 * Extract UUID from CDN URL
 */
export function extractOperations(cdnUrl: string): string[] {
  const operationsStr = extractCdnUrlModifiers(cdnUrl);

  return operationsStr
    .split('/-/')
    .filter(Boolean)
    .map((operation) => normalizeCdnOperation(operation));
}

/**
 * Trim filename or file URL
 */
export function trimFilename(cdnUrl: string): string {
  const url = new URL(cdnUrl);
  const filename = extractFilename(cdnUrl);
  const filenamePathPart = isFileUrl(filename) ? splitFileUrl(filename).pathname : filename;

  url.pathname = url.pathname.replace(filenamePathPart, '');
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Detect if filename is actually file URL
 */
export function isFileUrl(filename: string): boolean {
  return filename.startsWith('http');
}

/**
 * Split file URL into the path and search parts
 */
export function splitFileUrl(fileUrl: string): { pathname: string; search: string; hash: string } {
  const url = new URL(fileUrl);
  return {
    pathname: `${url.origin}${url.pathname ?? ''}`,
    search: url.search ?? '',
    hash: url.hash ?? '',
  };
}

/**
 * Create a final CDN URL with CDN modifiers and filename
 */
export const createCdnUrl = (baseCdnUrl: string, cdnModifiers?: string, filename?: string): string => {
  const url = new URL(trimFilename(baseCdnUrl));
  const resolvedFilename = filename ?? extractFilename(baseCdnUrl);
  const resolvedModifiers = cdnModifiers ?? '';
  // TODO: fix double slash pathname bug (--cfg-cdn-cname: 'https://ucarecdn.com/' - trailing slash case)
  if (url.pathname.startsWith('//')) {
    url.pathname = url.pathname.replace('//', '/');
  }
  if (resolvedFilename && isFileUrl(resolvedFilename)) {
    const splitted = splitFileUrl(resolvedFilename);
    url.pathname = `${url.pathname}${resolvedModifiers}${splitted.pathname || ''}`;
    url.search = splitted.search;
    url.hash = splitted.hash;
  } else {
    url.pathname = `${url.pathname}${resolvedModifiers}${resolvedFilename || ''}`;
  }
  return url.toString();
};

/**
 * Create URL for an original file on CDN
 */
export const createOriginalUrl = (cdnUrl: string, uuid: string): string => {
  const url = new URL(cdnUrl);
  url.pathname = `${uuid}/`;
  return url.toString();
};
