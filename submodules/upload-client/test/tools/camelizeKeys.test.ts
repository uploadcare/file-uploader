import camelizeKeys, { camelize } from '../../src/tools/camelizeKeys'

type Camelize = {
  fooBar: string
  fooBarBaz: string
  foo: string
  fooBarBaz4: Record<string, unknown>
}

describe('camelize', () => {
  it('should works', () => {
    expect(camelize('foo_bar')).toBe('fooBar')
    expect(camelize('foo-bar')).toBe('fooBar')
    expect(camelize('foo.bar')).toBe('fooBar')
    expect(camelize('Foo_bar')).toBe('fooBar')
    expect(camelize('foo_bar_baz')).toBe('fooBarBaz')
  })
})

describe('camelizeKeys', () => {
  it('should works', () => {
    expect(camelizeKeys<string>('foo_bar')).toBe('foo_bar')
    expect(
      camelizeKeys<Camelize>({
        foo_bar: 'test1',
        foo_bar_baz: 'test2',
        foo: 'test3',
        Foo_bar_baz_4: { one_more_thing: 'test4' }
      })
    ).toEqual({
      fooBar: 'test1',
      fooBarBaz: 'test2',
      foo: 'test3',
      fooBarBaz4: { oneMoreThing: 'test4' }
    })
  })
})
