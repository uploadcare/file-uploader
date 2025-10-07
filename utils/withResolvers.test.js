import { expect } from '@esm-bundle/chai';
import { withResolvers } from './withResolvers';

describe('withResolvers', () => {
  it('resolves when external resolve is called', async () => {
    const { promise, resolve } = withResolvers();

    setTimeout(() => resolve(42), 10);

    const result = await promise;
    expect(result).to.equal(42);
  });

  it('rejects when external reject is called', async () => {
    const { promise, reject } = withResolvers();

    setTimeout(() => reject(new Error('fail')), 10);

    try {
      await promise;
      throw new Error('Promise should have been rejected');
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('fail');
    }
  });

  it('resolves with a promise-like value (flattened)', async () => {
    const { promise, resolve } = withResolvers();

    setTimeout(() => resolve(Promise.resolve('ok')), 10);

    const result = await promise;
    expect(result).to.equal('ok');
  });
});
