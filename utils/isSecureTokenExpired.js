/** @param {number} ms */
const msToUnixTimestamp = (ms) => Math.floor(ms / 1000);

/**
 * Check if secure token is expired. It uses a threshold of 10 seconds by default. i.e. if the token is not expired yet
 * but will expire in the next 10 seconds, it will return false.
 *
 * @param {import('../types').SecureUploadsSignatureAndExpire} secureToken
 * @param {{ threshold?: number }} options
 */
export const isSecureTokenExpired = (secureToken, { threshold }) => {
  const { secureExpire } = secureToken;
  const nowUnix = msToUnixTimestamp(Date.now());
  const expireUnix = Number(secureExpire);
  const thresholdUnix = msToUnixTimestamp(threshold);
  return nowUnix + thresholdUnix >= expireUnix;
};
