import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { ConfigType } from '../../types';
import type { SecureUploadsSignatureAndExpire } from '../../types/index';
import { ControllerContainer } from '../di/ControllerContainer';
import { ConfigController } from './ConfigController';
import { SecureUploadsController } from './SecureUploadsController';
import { UploadHostBridge } from './UploadHostBridge';

// Apply a bag of config overrides onto a ConfigController. The key/value share
// the same `K`, but TS can't track that correlation across the loop, so the
// per-iteration value is widened to the union at this single write boundary.
const applyConfig = (config: ConfigController, overrides: Partial<ConfigType>): void => {
  for (const key of Object.keys(overrides) as (keyof ConfigType)[]) {
    const value = overrides[key];
    if (value !== undefined) {
      config.set(key, value as ConfigType[keyof ConfigType]);
    }
  }
};

// A full `UploadHostBridge` with inert defaults; only the members a test cares
// about are overridden. Inlined (not shared) so it stays out of coverage.
const makeUploadHost = (overrides: Partial<UploadHostBridge> = {}): UploadHostBridge =>
  ({
    debug: () => {},
    getFileHooks: () => [],
    getOutputItem: ((uid: string) => ({ internalId: uid })) as unknown as UploadHostBridge['getOutputItem'],
    getApi: (() => ({})) as unknown as UploadHostBridge['getApi'],
    emitCommonUploadFailed: () => {},
    emit: () => {},
    getOutputCollectionState: (() => ({})) as unknown as UploadHostBridge['getOutputCollectionState'],
    getOutputData: () => [],
    runOnAddHooks: () => {},
    onResolverError: () => {},
    onUploadError: () => {},
    onValidatorError: () => {},
    ...overrides,
  }) satisfies UploadHostBridge;

describe('SecureUploadsController', () => {
  let controller: SecureUploadsController;
  let debug: Mock<(...args: unknown[]) => void>;
  let onResolverError: Mock<(error: unknown, context: string) => void>;

  const createController = (cfgOverrides: Partial<ConfigType> = {}) => {
    const container = new ControllerContainer();
    const config = container.get(ConfigController);
    applyConfig(config, cfgOverrides);
    debug = vi.fn<(...args: unknown[]) => void>();
    onResolverError = vi.fn<(error: unknown, context: string) => void>();
    container.bind(UploadHostBridge, () => makeUploadHost({ debug, onResolverError }));
    controller = container.get(SecureUploadsController);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    createController();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new SecureUploadsController instance', () => {
      expect(controller).toBeInstanceOf(SecureUploadsController);
    });

    it('resolves against a minimal host (inert debug/onResolverError)', async () => {
      const container = new ControllerContainer();
      const config = container.get(ConfigController);
      applyConfig(config, { secureSignature: 'sig', secureExpire: '1234567890' });
      // A bare host (inert defaults, no debug/onResolverError override) → must
      // still resolve without throwing.
      container.bind(UploadHostBridge, () => makeUploadHost());
      const bare = container.get(SecureUploadsController);

      await expect(bare.getSecureToken()).resolves.toEqual({
        secureSignature: 'sig',
        secureExpire: '1234567890',
      });
    });
  });

  describe('getSecureToken', () => {
    describe('when no secure config is set', () => {
      it('should return null when no secure configuration is provided', async () => {
        const result = await controller.getSecureToken();

        expect(result).toBeNull();
      });
    });

    describe('with static secureSignature and secureExpire', () => {
      it('should return the static secure token', async () => {
        createController({
          secureSignature: 'test-signature',
          secureExpire: '1234567890',
        });

        const result = await controller.getSecureToken();

        expect(result).toEqual({
          secureSignature: 'test-signature',
          secureExpire: '1234567890',
        });
      });

      it('should debug print when using static signature and expire', async () => {
        createController({
          secureSignature: 'test-signature',
          secureExpire: '1234567890',
        });

        await controller.getSecureToken();

        expect(debug).toHaveBeenCalled();
      });

      it('should return null if only secureSignature is set', async () => {
        createController({
          secureSignature: 'test-signature',
        });

        const result = await controller.getSecureToken();

        expect(result).toBeNull();
      });

      it('should return null if only secureExpire is set', async () => {
        createController({
          secureExpire: '1234567890',
        });

        const result = await controller.getSecureToken();

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

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        const result = await controller.getSecureToken();

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

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        await controller.getSecureToken();
        await controller.getSecureToken();
        await controller.getSecureToken();

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

        createController({
          secureUploadsSignatureResolver: resolver,
          secureUploadsExpireThreshold: 10000, // 10 seconds threshold
        });

        const result1 = await controller.getSecureToken();
        expect(result1).toEqual(expiredToken);

        vi.advanceTimersByTime(6000);

        const result2 = await controller.getSecureToken();
        expect(result2).toEqual(newToken);
        expect(resolver).toHaveBeenCalledTimes(2);
      });

      it('should warn when both static config and resolver are set', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };

        createController({
          secureSignature: 'static-signature',
          secureExpire: '1234567890',
          secureUploadsSignatureResolver: vi.fn().mockResolvedValue(mockToken),
        });

        await controller.getSecureToken();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
        );
      });

      it('should use resolver even when static config is set', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        createController({
          secureSignature: 'static-signature',
          secureExpire: '1234567890',
          secureUploadsSignatureResolver: resolver,
        });

        const result = await controller.getSecureToken();

        expect(result).toEqual(mockToken);
        expect(resolver).toHaveBeenCalled();
      });

      it('should return null when resolver returns nothing', async () => {
        const resolver = vi.fn().mockResolvedValue(undefined);

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        const result = await controller.getSecureToken();

        expect(result).toBeNull();
        expect(debug).toHaveBeenCalled();
      });

      it('should log error when resolver returns invalid result (missing secureSignature)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const invalidToken = { secureExpire: '1234567890' };
        const resolver = vi.fn().mockResolvedValue(invalidToken);

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        await controller.getSecureToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Secure signature resolver returned an invalid result:',
          invalidToken,
        );
      });

      it('should log error when resolver returns invalid result (missing secureExpire)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const invalidToken = { secureSignature: 'test-signature' };
        const resolver = vi.fn().mockResolvedValue(invalidToken);

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        await controller.getSecureToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Secure signature resolver returned an invalid result:',
          invalidToken,
        );
      });

      it('should handle resolver error and report it via onResolverError, returning the previous token', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const nowUnix = Math.floor(Date.now() / 1000);
        const validToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'valid-signature',
          secureExpire: String(nowUnix + 5),
        };
        const resolverError = new Error('Resolver failed');
        const resolver = vi.fn().mockResolvedValueOnce(validToken).mockRejectedValueOnce(resolverError);

        createController({
          secureUploadsSignatureResolver: resolver,
          secureUploadsExpireThreshold: 10000,
        });

        const result1 = await controller.getSecureToken();
        expect(result1).toEqual(validToken);

        vi.advanceTimersByTime(6000);

        const result2 = await controller.getSecureToken();
        expect(result2).toEqual(validToken);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Secure signature resolving failed. Falling back to the previous one.',
          resolverError,
        );
        expect(onResolverError).toHaveBeenCalled();
      });

      it('should debug print when token is not set yet', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        await controller.getSecureToken();

        expect(debug).toHaveBeenCalledWith('Secure signature is not set yet.');
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

        createController({
          secureUploadsSignatureResolver: resolver,
          secureUploadsExpireThreshold: 10000,
        });

        await controller.getSecureToken();

        vi.advanceTimersByTime(6000);

        await controller.getSecureToken();

        expect(debug).toHaveBeenCalledWith('Secure signature is expired. Resolving a new one...');
      });

      it('should debug print resolved token details', async () => {
        const mockToken: SecureUploadsSignatureAndExpire = {
          secureSignature: 'resolved-signature',
          secureExpire: String(Math.floor(Date.now() / 1000) + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(mockToken);

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        await controller.getSecureToken();

        expect(debug).toHaveBeenCalledWith('Secure signature resolved:', mockToken);
      });
    });

    describe('destroy', () => {
      it('clears the cached token so a later call re-resolves', async () => {
        const nowUnix = Math.floor(Date.now() / 1000);
        const token: SecureUploadsSignatureAndExpire = {
          secureSignature: 'sig',
          secureExpire: String(nowUnix + 3600),
        };
        const resolver = vi.fn().mockResolvedValue(token);

        createController({
          secureUploadsSignatureResolver: resolver,
        });

        await controller.getSecureToken(); // resolves + caches (1 call)
        await controller.getSecureToken(); // cache hit (still 1 call)
        expect(resolver).toHaveBeenCalledTimes(1);

        controller.destroy();

        await controller.getSecureToken(); // cache cleared → re-resolves
        expect(resolver).toHaveBeenCalledTimes(2);
      });
    });
  });
});
