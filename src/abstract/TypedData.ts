import { PubSub, UID } from '@symbiotejs/symbiote';

const MSG_NAME = '[Typed State] Wrong property name: ';
const MSG_TYPE = '[Typed State] Wrong property type: ';

export type TypedSchema = Record<string, { type: unknown; value: unknown; nullable?: boolean }>;

export type Constructor<T = any> = new (...args: any[]) => T;

export type ExtractType<T, V> = T extends StringConstructor
  ? string
  : T extends BooleanConstructor
    ? boolean
    : T extends NumberConstructor
      ? number
      : T extends ArrayConstructor
        ? V
        : T extends Constructor
          ? InstanceType<T>
          : T;

export type ExtractDataFromSchema<T extends TypedSchema> = {
  [K in keyof T]: ExtractType<T[K]['type'], T[K]['value']> | (T[K]['nullable'] extends true ? null : never);
};

export type ExtractKeysFromSchema<T extends TypedSchema> = Extract<keyof T, string>;

export class TypedData<T extends TypedSchema> {
  private _typedSchema: T;
  private _ctxId: string;
  private _schema: ExtractDataFromSchema<T>;
  private _data: PubSub<ExtractDataFromSchema<T>>;

  public constructor(typedSchema: T, ctxName?: string) {
    this._typedSchema = typedSchema;
    this._ctxId = ctxName || UID.generate();

    this._schema = Object.keys(typedSchema).reduce(
      (acc, key) => {
        if (typedSchema[key]) {
          (acc as Record<string, unknown>)[key] = typedSchema[key].value;
        }
        return acc;
      },
      {} as ExtractDataFromSchema<T>,
    );
    this._data = PubSub.registerCtx(this._schema, this._ctxId);
  }

  public get uid(): string {
    return this._ctxId;
  }

  public setValue<K extends ExtractKeysFromSchema<T>>(prop: K, value: ExtractDataFromSchema<T>[K]): void {
    if (!Object.hasOwn(this._typedSchema, prop) || !this._typedSchema[prop]) {
      console.warn(MSG_NAME + prop);
      return;
    }
    const pDesc = this._typedSchema[prop];

    const isChanged = this._data.read(prop) !== value;
    const isMatchConstructorType = value?.constructor === pDesc.type;
    const isMatchInstanceType = (value as object) instanceof (pDesc.type as Constructor);
    const isMatchNullable = pDesc.nullable && value === null;

    if (isChanged && (isMatchConstructorType || isMatchInstanceType || isMatchNullable)) {
      this._data.pub(prop, value);
      return;
    } else if (isChanged) {
      console.warn(MSG_TYPE + prop);
    }
  }

  public setMultipleValues(updObj: Partial<ExtractDataFromSchema<T>>): void {
    for (const [prop, value] of Object.entries(updObj)) {
      this.setValue(prop as ExtractKeysFromSchema<T>, value);
    }
  }

  public getValue<K extends ExtractKeysFromSchema<T>>(prop: K): ExtractDataFromSchema<T>[K] {
    if (!Object.hasOwn(this._typedSchema, prop)) {
      console.warn(MSG_NAME + prop);
    }
    return this._data.read(prop);
  }

  public subscribe<K extends ExtractKeysFromSchema<T>>(
    prop: K,
    handler: (newVal: ExtractDataFromSchema<T>[K]) => void,
  ) {
    return this._data.sub(prop, handler as (val: unknown) => void);
  }

  public remove(): void {
    PubSub.deleteCtx(this._ctxId);
  }
}
