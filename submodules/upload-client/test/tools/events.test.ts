/* eslint-disable @typescript-eslint/unbound-method */
import { Events } from '../../src/uploadFile/events'

describe('Events', () => {
  it('should create instance', () => {
    const emitter = new Events()

    expect(emitter).toBeDefined()
    expect(emitter.on).toBeDefined()
    expect(emitter.off).toBeDefined()
    expect(emitter.emit).toBeDefined()
  })

  it('should emit events', () => {
    type EventsMap = {
      test1: string
      test2: undefined
    }

    const spy = jest.fn()
    const emitter = new Events<EventsMap>()

    emitter.on('test1', spy)
    emitter.on('test2', spy)

    emitter.emit('test1', 'hello')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith('hello')

    emitter.emit('test2', undefined)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith(undefined)
  })

  it("should don't emit events after unbind handler", () => {
    type EventsMap = {
      test: string
    }

    const spy = jest.fn()
    const emitter = new Events<EventsMap>()

    emitter.on('test', spy)

    emitter.emit('test', 'hello')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith('hello')

    emitter.off('test', spy)
    emitter.emit('test', 'world')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith('hello')
  })

  it('off method should unbind all handlers if only event name provided', () => {
    type EventsMap = {
      test: string
    }

    const firstSpy = jest.fn()
    const secondSpy = jest.fn()
    const emitter = new Events<EventsMap>()

    emitter.on('test', firstSpy)
    emitter.on('test', secondSpy)

    emitter.emit('test', 'hello')

    expect(firstSpy).toHaveBeenCalledTimes(1)
    expect(secondSpy).toHaveBeenCalledTimes(1)
    expect(firstSpy).toHaveBeenLastCalledWith('hello')
    expect(secondSpy).toHaveBeenLastCalledWith('hello')

    emitter.off('test')
    emitter.emit('test', 'world')

    expect(firstSpy).toHaveBeenCalledTimes(1)
    expect(secondSpy).toHaveBeenCalledTimes(1)
  })
})
