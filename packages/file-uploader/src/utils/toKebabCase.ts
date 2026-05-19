export type KebabCase<T extends string> = T extends `${infer Head} ${infer Tail}`
  ? `${Lowercase<Head>}-${KebabCase<Tail>}`
  : Lowercase<T>;

export const toKebabCase = <T extends string>(str: T): KebabCase<T> =>
  str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    ?.map((x) => x.toLowerCase())
    .join('-') as KebabCase<T>;
