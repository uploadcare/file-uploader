import AbortController from 'abort-controller'
import { onCancel } from '../../src/tools/onCancel'

describe('onCancel', () => {
  it('should work', done => {
    const ctrl = new AbortController()

    onCancel(ctrl.signal, done)
    ctrl.abort()
  })

  it('should run callback ones', async () => {
    const ctrl = new AbortController()
    const hanlder = jest.fn()

    ctrl.abort()
    onCancel(ctrl.signal, hanlder)
    ctrl.abort()

    // onCancel works async
    // this hack for wait execution of AbortController
    const spy = await Promise.resolve(hanlder)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should execute more than one callback', async () => {
    const ctrl = new AbortController()
    const firstOnCancel = jest.fn()
    const secondOnCancel = jest.fn()

    onCancel(ctrl.signal, firstOnCancel)
    onCancel(ctrl.signal, secondOnCancel)

    ctrl.abort()

    // onCancel works async
    // this hack for wait execution of onCancel
    const [spy1, spy2] = await Promise.resolve([firstOnCancel, secondOnCancel])

    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('should run callback on already aborted signal', async () => {
    const spy = jest.fn()
    const ctrl = new AbortController()

    ctrl.abort()
    onCancel(ctrl.signal, spy)

    // this hack for wait execution of onCancel
    await Promise.resolve()

    expect(spy).toHaveBeenCalled()
  })
})
