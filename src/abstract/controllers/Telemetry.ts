import type { EventBus, UploaderEventKey } from '../EventBus';
import type { ConfigController } from './ConfigController';

export interface TelemetryTransport {
  send(event: { type: string; payload?: unknown; ts: number }): void;
}

class ConsoleTransport implements TelemetryTransport {
  public send(event: { type: string; payload?: unknown; ts: number }): void {
    console.debug('[uc telemetry]', event.type, event.payload);
  }
}

/**
 * Plain class (not a reactive controller — telemetry has no UI-readable state).
 * Listens to the EventBus and forwards events to the transport when enabled.
 * Defaults to a console transport; production code injects a real one.
 */
export class Telemetry {
  private _transport: TelemetryTransport = new ConsoleTransport();
  private _unsub: (() => void) | null = null;

  public constructor(
    private _config: ConfigController,
    private _events: EventBus,
  ) {
    this._wire();
  }

  public setTransport(transport: TelemetryTransport): void {
    this._transport = transport;
  }

  private _wire(): void {
    this._unsub = this._events.onAny((type, payload) => {
      if (!this._enabled()) return;
      this._transport.send({
        type,
        payload: this._sanitize(type as UploaderEventKey, payload),
        ts: Date.now(),
      });
    });
  }

  private _enabled(): boolean {
    return !!(this._config.values as { debug?: boolean }).debug;
  }

  private _sanitize(_type: UploaderEventKey, payload: unknown): unknown {
    // Strip File references to avoid leaking content into telemetry.
    if (payload && typeof payload === 'object' && 'file' in payload) {
      const { file: _file, ...rest } = payload as Record<string, unknown>;
      return rest;
    }
    return payload;
  }

  public destroy(): void {
    this._unsub?.();
    this._unsub = null;
  }
}
