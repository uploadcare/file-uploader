import type { Uid } from '../lit/Uid';

// biome-ignore lint/complexity/noStaticOnlyClass: This is defined as class to be compatible with the symbiote's UID type
export class UID {
  public static generateFastUid(): Uid {
    return `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}` as Uid;
  }
  public static generateRandomUUID(): string {
    const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
    return UID.generateFastUid();
  }
}
