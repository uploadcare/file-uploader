import React from 'react';
import { expectType } from 'tsd';
import '../jsx';
import { OutputFileEntry } from '..';

// @ts-expect-error untyped props
() => <lr-config ctx-name="1" something="wrong"></lr-config>;

// @ts-expect-error missing ctx-name
() => <lr-config></lr-config>;

// allow common html attributes and required ctx-name
() => <lr-config ctx-name="1" id="1" class="1" hidden></lr-config>;

// allow key prop
() => <lr-config ctx-name="1" key={1}></lr-config>;

// allow useRef hook
() => {
  const ref = React.useRef<Config | null>(null);
  expectType<Config | null>(ref.current);
  <lr-config ctx-name="1" ref={ref}></lr-config>;
};

// allow callback ref
() => {
  <lr-config
    ctx-name="1"
    ref={(el) => {
      expectType<Config | null>(el);
    }}
  ></lr-config>;
};

// allow createRef
() => {
  const ref = React.createRef<Config>();
  expectType<Config | null>(ref.current);
  <lr-config ctx-name="1" ref={ref}></lr-config>;
};

// accept config attributes
() => <lr-config ctx-name="1" multiple multipleMax={1} multipleMin={2} accept="str" />;

// allow to use DOM properties
() => {
  const ref = React.useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.metadata = {foo: 'bar'}
    config.secureSignature = '1231'
    config.multiple = true
  }
};


// allow to pass metadata
() => {
  const ref = React.useRef<Config | null>(null);
  if (ref.current) {
    const config = ref.current;
    config.metadata = {foo: 'bar'}
    config.metadata = () => ({foo: 'bar'})
    config.metadata = async (entry) => {
      expectType<OutputFileEntry>(entry)
      return {foo: 'bar'}
    }
  }
};
