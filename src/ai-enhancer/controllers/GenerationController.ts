import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { AiCapability } from '../capabilities';
import type { AiProvider, AiProviderResult } from '../providers/types';

export type HistoryEntry = {
  id: string;
  prompt: string;
  capability: AiCapability;
  url: string;
};

export type RunArgs = {
  provider: AiProvider;
  prompt: string;
  capability: AiCapability;
  sourceUrl?: string;
};

const MAX_HISTORY = 20;

export class GenerationController implements ReactiveController {
  public busy = false;
  public resultUrl: string | null = null;
  public error: string | null = null;
  public history: HistoryEntry[] = [];

  private readonly _host: ReactiveControllerHost;
  private _abortController: AbortController | null = null;

  public constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  public hostDisconnected(): void {
    this.abort();
  }

  public abort(): void {
    /*
     * Only signal cancellation. Leave _abortController in place so the
     * in-flight run's `finally` can match its own controller and clear `busy`
     * — otherwise the controller would be stuck busy=true after an external
     * abort.
     */
    this._abortController?.abort();
  }

  public reset(): void {
    this.abort();
    this.resultUrl = null;
    this.error = null;
    this._host.requestUpdate();
  }

  public setResult(url: string): void {
    this.resultUrl = url;
    this._host.requestUpdate();
  }

  public async run(args: RunArgs): Promise<AiProviderResult | null> {
    if (this.busy) return null;
    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;
    this.busy = true;
    this.error = null;
    this._host.requestUpdate();

    try {
      const result = await args.provider.generate({
        prompt: args.prompt,
        capability: args.capability,
        sourceUrl: args.sourceUrl,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return null;
      this.resultUrl = result.url;
      this.history = [
        { id: crypto.randomUUID(), prompt: result.prompt, capability: result.capability, url: result.url },
        ...this.history,
      ].slice(0, MAX_HISTORY);
      return result;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return null;
      this.error = (err as Error).message || 'Generation failed';
      throw err;
    } finally {
      if (this._abortController === controller) {
        this.busy = false;
        this._abortController = null;
      }
      this._host.requestUpdate();
    }
  }
}
