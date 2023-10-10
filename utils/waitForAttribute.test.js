import { expect } from '@esm-bundle/chai';
import { spy } from 'sinon';
import { delay } from './delay';
import { waitForAttribute } from './waitForAttribute';

const TEST_ATTRIBUTE = 'test-attribute';

describe('waitForAttribute', () => {
  it('should call onTimeout callback when timeout is over', async () => {
    const element = document.createElement('div');
    const onMutate = spy();
    const onTimeout = spy();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onMutate,
      onTimeout,
      timeout: 10,
    });
    await delay(100);
    expect(onMutate.called).to.be.false;
    expect(onTimeout.calledOnce).to.be.true;
  });
  it('should call onMutate callback when attribute is set async', async () => {
    const element = document.createElement('div');
    const onMutate = spy();
    const onTimeout = spy();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onMutate,
      onTimeout,
      timeout: 10,
    });
    element.setAttribute(TEST_ATTRIBUTE, 'test');
    await delay(100);
    expect(onMutate.calledOnce).to.be.true;
    expect(onMutate.getCall(0).args[0]).to.equal('test');
    expect(onTimeout.called).to.be.false;
  });
  it('should call onMutate callback when attribute is set sync', async () => {
    const element = document.createElement('div');
    element.setAttribute(TEST_ATTRIBUTE, 'test');
    const onMutate = spy();
    const onTimeout = spy();
    waitForAttribute({
      element,
      attribute: TEST_ATTRIBUTE,
      onMutate,
      onTimeout,
      timeout: 10,
    });
    await delay(100);
    expect(onMutate.calledOnce).to.be.true;
    expect(onMutate.getCall(0).args[0]).to.equal('test');
    expect(onTimeout.called).to.be.false;
  });
});
