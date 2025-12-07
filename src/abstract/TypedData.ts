import { PubSub } from '../lit/PubSubCompat';
import type { Uid } from '../lit/Uid';
import { UID } from '../utils/UID';

const MSG_NAME = '[Typed State] Wrong property name: ';

export class TypedData<T extends Record<string, unknown>> {
  private _ctxId: Uid;
  private _data: PubSub<T>;

  public constructor(initialValue: T) {
    this._ctxId = UID.generate();
    this._data = PubSub.registerCtx(initialValue, this._ctxId);
  }

  public get uid(): Uid {
    return this._ctxId;
  }

  public setValue<K extends keyof T>(prop: K, value: T[K]): void {
    if (!this._data.has(prop)) {
      console.warn(`${MSG_NAME}${String(prop)}`);
      return;
    }

    const isChanged = this._data.read(prop) !== value;
    if (isChanged) {
      this._data.pub(prop, value);
    }
  }

  public setMultipleValues(updObj: Partial<T>): void {
    for (const [prop, value] of Object.entries(updObj)) {
      this.setValue(prop as keyof T, value as T[keyof T]);
    }
  }

  public getValue<K extends keyof T>(prop: K): T[K] {
    if (!this._data.has(prop)) {
      console.warn(`${MSG_NAME}${String(prop)}`);
    }
    return this._data.read(prop);
  }

  public subscribe<K extends keyof T>(prop: K, handler: (newVal: T[K]) => void) {
    return this._data.sub(prop, handler);
  }

  public remove(): void {
    PubSub.deleteCtx(this._ctxId);
  }
}
