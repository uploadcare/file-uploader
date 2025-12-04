import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SecureUploadsSignatureAndExpire } from '../../../types/index';
import type { UploaderBlock } from '../../UploaderBlock';
import { SecureUploadsManager } from '../SecureUploadsManager';

const createMockBlock = (config: Partial<UploaderBlock['cfg']> = {}): UploaderBlock =>
  ({
    debugPrint: vi.fn(),
    telemetryManager: {
      sendEventError: vi.fn(),
    },
    cfg: {
      secureSignature: undefined,
      secureExpire: undefined,
      secureUploadsSignatureResolver: undefined,
      secureUploadsExpireThreshold: 10000,
      ...config,
    },
  }) as unknown as UploaderBlock;

describe('SecureUploadsManager', () => {
  let manager: SecureUploadsManager;
  let mockBlock: UploaderBlock;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBlock = createMockBlock();
    manager = new SecureUploadsManager(mockBlock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a new SecureUploadsManager instance', () => {
      expect(manager).toBeInstanceOf(SecureUploadsManager);
    });
  });

  describe('getSecureToken', () => {
    describe('when no secure config is set', () => {
      it('should return null when no secure configuration is provided', async () => {
        const result = await manager.getSecureToken();

        expect(result).toBeNull();
      });
    });

    describe('with static secureSignature and secureExpire', () => {
      it('should return the static secure token', async () => {
        mockBlock = createMockBlock({
          secureSignature: 'test-signature',
          secureExpire: '1234567890',
        });
        manager = new SecureUploadsManager(mockBlock);

        const result = await manager.getSecureToken();

        expect(result).toEqual({
          secureSignature: 'test-signature',
          secureExpire: '1234567890',
        });
      });

      it('should debug print when using static signature and expire', async () => {
        mockBlock = createMockBlock({
          secureSignature: 'test-signature',
          secureExpire: '1234567890',
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        expect(mockBlock.debugPrint).toHaveBeenCalled();
      });

      it('should return null if only secureSignature is set', async () => {
        mockBlock = createMockBlock({
          secureSignature: 'test-signature',
        });
        manager = new SecureUploadsManager(mockBlock);

        const result = await manager.getSecureToken();

        expect(result).toBeNull();
      });

      it('should return null if only secureExpire is set', async () => {
        mockBlock = createMockBlock({
          secureExpire: '1234567890',
        });
        manager = new SecureUploadsManager(mockBlock);

        const result = await manager.getSecureToken();

        expect(result).toBeNull();
      });
    });

    describe('with secureUploadsSignatureResolver', () => {
      it('should call the resolver and return the token', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        const result = await manager.getSecureToken();

        expect(resolver).toHaveBeenCalled();
        expect(result).toEqual(mockToken);
      });

      it('should cache the resolved token and not call resolver again', async () => {
        const futureExpire = String(Math.floor(Date.now() / 1000) + 3600);
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: futureExpire,
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();
        await manager.getSecureToken();
        await manager.getSecureToken();

        expect(resolver).toHaveBeenCalledTimes(1);
      });

      it('should resolve a new token when the cached one is expired', async () => {
        const nowUnix = Math.floor(Date.now() / 1000);
        const expiredToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'expired-signature',
          secureExpire: String(nowUnix + 5), // Expires in 5 seconds
        };
        const newToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'new-signature',
          secureExpire: String(nowUnix + 3600), // Expires in 1 hour
        };
        const resolver = vi.fn().mockResolvedValueOnce(expiredToken).mockResolvedValueOnce(newToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
          secureUploadsExpireThreshold: 10000, // 10 seconds threshold
        });
        manager = new SecureUploadsManager(mockBlock);

        const result1 = await manager.getSecureToken();
        expect(result1).toEqual(expiredToken);

        vi.advanceTimersByTime(6000);

        const result2 = await manager.getSecureToken();
        expect(result2).toEqual(newToken);
        expect(resolver).toHaveBeenCalledTimes(2);
      });

      it('should warn when both static config and resolver are set', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };

        mockBlock = createMockBlock({
          secureSignature: 'static-signature',
          secureExpire: '1234567890',
          secureUploadsSignatureResolver: vi.fn().mockResolvedValue(mockToken),
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
        );

        consoleWarnSpy.mockRestore();
      });

      it('should use resolver even when static config is set', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        mockBlock = createMockBlock({
          secureSignature: 'static-signature',
          secureExpire: '1234567890',
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        const result = await manager.getSecureToken();

        expect(result).toEqual(mockToken);
        expect(resolver).toHaveBeenCalled();
      });

      it('should return null when resolver returns nothing', async () => {
        const resolver = vi.fn().mockResolvedValue(undefined);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        const result = await manager.getSecureToken();

        expect(result).toBeNull();
        expect(mockBlock.debugPrint).toHaveBeenCalled();
      });

      it('should log error when resolver returns invalid result (missing secureSignature)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const invalidToken = { secureExpire: '1234567890' };
        const resolver = vi.fn().mockResolvedValue(invalidToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Secure signature resolver returned an invalid result:',
          invalidToken,
        );

        consoleErrorSpy.mockRestore();
      });

      it('should log error when resolver returns invalid result (missing secureExpire)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const invalidToken = { secureSignature: 'test-signature' };
        const resolver = vi.fn().mockResolvedValue(invalidToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Secure signature resolver returned an invalid result:',
          invalidToken,
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle resolver error and return previous token', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const nowUnix = Math.floor(Date.now() / 1000);
        const validToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'valid-signature',
          secureExpire: String(nowUnix + 5),
        };
        const resolverError = new Error('Resolver failed');
        const resolver = vi.fn().mockResolvedValueOnce(validToken).mockRejectedValueOnce(resolverError);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
          secureUploadsExpireThreshold: 10000,
        });
        manager = new SecureUploadsManager(mockBlock);

        const result1 = await manager.getSecureToken();
        expect(result1).toEqual(validToken);

        vi.advanceTimersByTime(6000);

        const result2 = await manager.getSecureToken();
        expect(result2).toEqual(validToken);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Secure signature resolving failed. Falling back to the previous one.',
          resolverError,
        );
        expect(mockBlock.telemetryManager.sendEventError).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it('should debug print when token is not set yet', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        expect(mockBlock.debugPrint).toHaveBeenCalledWith('[secure-uploads]', 'Secure signature is not set yet.');
      });

      it('should debug print when token is expired', async () => {
        const nowUnix = Math.floor(Date.now() / 1000);
        const expiredToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'expired-signature',
          secureExpire: String(nowUnix + 5),
        };
        const newToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'new-signature',
          secureExpire: String(nowUnix + 3600),
        };
        const resolver = vi.fn().mockResolvedValueOnce(expiredToken).mockResolvedValueOnce(newToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
          secureUploadsExpireThreshold: 10000,
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        vi.advanceTimersByTime(6000);

        await manager.getSecureToken();

        expect(mockBlock.debugPrint).toHaveBeenCalledWith(
          '[secure-uploads]',
          'Secure signature is expired. Resolving a new one...',
        );
      });

      it('should debug print resolved token details', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        mockBlock = createMockBlock({
          secureUploadsSignatureResolver: resolver,
        });
        manager = new SecureUploadsManager(mockBlock);

        await manager.getSecureToken();

        expect(mockBlock.debugPrint).toHaveBeenCalledWith('[secure-uploads]', 'Secure signature resolved:', mockToken);
      });
    });
  });
});
