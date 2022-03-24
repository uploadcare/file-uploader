import buildFormData from '../../src/tools/buildFormData'
import * as factory from '../_fixtureFactory'

describe('buildFormData', () => {
  it('should return FormData with nice input object', () => {
    const data = buildFormData([
      ['file', factory.image('blackSquare').data, 'file.jpeg'],
      ['UPLOADCARE_PUB_KEY', factory.publicKey('demo')]
    ])

    expect(data).toBeDefined()
    expect(typeof data).toBe('object')
    expect(typeof data.append).toBe('function')
  })

  it('should support arrays', () => {
    const data = buildFormData([
      ['test', ['test', '1', 2]],
      ['test2', 'test']
    ])

    expect(data).toBeDefined()
    expect(typeof data).toBe('object')
    expect(typeof data.append).toBe('function')
  })
})
