import '../jsx';
import React from 'react';
import { expectTypeOf, test } from 'vitest';
import { FormInput } from '../../dist/index';

test('<uc-form-input> takes ctx-name and an optional name', () => {
  () => <uc-form-input ctx-name="my-uploader" name="test-name" />;
  () => <uc-form-input ctx-name="my-uploader" />;
  // @ts-expect-error missing ctx-name
  () => <uc-form-input name="test-name" />;
});

test('FormInput is constructible and is an element', () => {
  expectTypeOf(new FormInput()).toExtend<HTMLElement>();
});
