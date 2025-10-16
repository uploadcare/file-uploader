import { expectType } from 'tsd';
import type {
  Config,
  FileValidatorDescriptor,
  FuncCollectionValidator,
  FuncFileValidator,
  OutputFileEntry,
} from '../../dist/index';
import '../jsx';
import React, { createRef, useRef } from 'react';

// @ts-expect-error untyped props
() => <uc-config ctx-name="1" something="wrong"></uc-config>;

// @ts-expect-error missing ctx-name
() => <uc-config></uc-config>;

// allow common html attributes and required ctx-name
() => <uc-config ctx-name="1" id="1" class="1" hidden></uc-config>;

// allow key prop
() => <uc-config ctx-name="1" key={1}></uc-config>;

// allow useRef hook
() => {
  const ref = useRef<Config | null>(null);
  expectType<Config | null>(ref.current);
  <uc-config ctx-name="1" ref={ref}></uc-config>;
};

// allow callback ref
() => {
  <uc-config
    ctx-name="1"
    ref={(el) => {
      expectType<Config | null>(el);
    }}
  ></uc-config>;
};

// allow createRef
() => {
  const ref = createRef<Config>();
  expectType<Config | null>(ref.current);
  <uc-config ctx-name="1" ref={ref}></uc-config>;
};

// accept config attributes
() => <uc-config ctx-name="1" multiple multipleMax={1} multipleMin={2} accept="str" />;

// allow to use DOM properties
() => {
  const ref = useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.metadata = { foo: 'bar' };
    config.secureSignature = '1231';
    config.multiple = true;
  }
};

// allow to pass metadata
() => {
  const ref = useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.metadata = { foo: 'bar' };
    config.metadata = () => ({ foo: 'bar' });
    config.metadata = async (entry) => {
      expectType<OutputFileEntry>(entry);
      return { foo: 'bar' };
    };
  }
};

// allow to pass validators
() => {
  const ref = useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;

    const syncFileValidator: FuncFileValidator = (outputEntry, api) => ({
      message: api.l10n('images-only-accepted'),
      payload: { entry: outputEntry },
    });

    const asyncFileValidator: FuncFileValidator = async (outputEntry, api) => ({
      message: api.l10n('images-only-accepted'),
      payload: { entry: outputEntry },
    });

    const fileValidatorDescriptor: FileValidatorDescriptor = {
      runOn: 'change',
      validator: syncFileValidator,
    };

    const maxCollection: FuncCollectionValidator = (_collection, api) => ({
      message: api.l10n('some-files-were-not-uploaded'),
    });

    config.fileValidators = [syncFileValidator, asyncFileValidator, fileValidatorDescriptor];
    config.collectionValidators = [maxCollection];
  }
};
