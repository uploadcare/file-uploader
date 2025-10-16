import { Data, UID } from '@symbiotejs/symbiote';

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
  private __typedSchema: T;
  private __ctxId: string;
  private __schema: ExtractDataFromSchema<T>;
  private __data: Data;

  constructor(typedSchema: T, ctxName?: string) {
    this.__typedSchema = typedSchema;
    this.__ctxId = ctxName || UID.generate();

    this.__schema = Object.keys(typedSchema).reduce(
      (acc, key) => {
        if (typedSchema[key]) {
          (acc as Record<string, unknown>)[key] = typedSchema[key].value;
        }
        return acc;
      },
      {} as ExtractDataFromSchema<T>,
    );
    this.__data = Data.registerCtx(this.__schema, this.__ctxId);
  }

  get uid(): string {
    return this.__ctxId;
  }

  setValue<K extends ExtractKeysFromSchema<T>>(prop: K, value: ExtractDataFromSchema<T>[K]): void {
    if (!Object.hasOwn(this.__typedSchema, prop) || !this.__typedSchema[prop]) {
      console.warn(MSG_NAME + prop);
      return;
    }
    const pDesc = this.__typedSchema[prop];

    const isMatchConstructorType = value?.constructor === pDesc.type;
    const isMatchInstanceType = (value as object) instanceof (pDesc.type as Constructor);
    const isMatchNullable = pDesc.nullable && value === null;

    if (isMatchConstructorType || isMatchInstanceType || isMatchNullable) {
      this.__data.pub(prop, value);
      return;
    }
    console.warn(MSG_TYPE + prop);
  }

  setMultipleValues(updObj: Partial<ExtractDataFromSchema<T>>): void {
    for (const [prop, value] of Object.entries(updObj)) {
      this.setValue(prop as ExtractKeysFromSchema<T>, value);
    }
  }

  getValue<K extends ExtractKeysFromSchema<T>>(prop: K): ExtractDataFromSchema<T>[K] {
    if (!Object.hasOwn(this.__typedSchema, prop)) {
      console.warn(MSG_NAME + prop);
    }
    return this.__data.read(prop);
  }

  subscribe<K extends ExtractKeysFromSchema<T>>(prop: K, handler: (newVal: ExtractDataFromSchema<T>[K]) => void) {
    return this.__data.sub(prop, handler);
  }

  remove(): void {
    Data.deleteCtx(this.__ctxId);
  }
}
