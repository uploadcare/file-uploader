/* eslint-disable @typescript-eslint/indent */
type BaseTypes = string | number | void

type Query = {
  [key: string]: BaseTypes | BaseTypes[]
}

const serializePair = (key: string, value: BaseTypes): string | null =>
  typeof value !== 'undefined' ? `${key}=${encodeURIComponent(value)}` : null

const createQuery = (query: Query): string =>
  Object.entries(query)
    .reduce<(string | null)[]>(
      (params, [key, value]) =>
        params.concat(
          Array.isArray(value)
            ? value.map((value) => serializePair(`${key}[]`, value))
            : serializePair(key, value)
        ),
      []
    )
    .filter((x) => !!x)
    .join('&')

const getUrl = (base: string, path: string, query?: Query): string =>
  [
    base,
    path,
    query && Object.keys(query).length > 0 ? '?' : '',
    query && createQuery(query)
  ]
    .filter(Boolean)
    .join('')

export default getUrl
