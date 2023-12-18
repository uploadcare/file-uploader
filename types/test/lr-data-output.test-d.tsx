import { expectType } from 'tsd';
import { DataOutput } from '../../index.js';
import { Output } from '../../blocks/DataOutput/DataOutput.js';

() => <lr-data-output ctx-name="my-uploader" />;

const dataOutput = new DataOutput();
dataOutput.addEventListener('lr-data-output', (e) => {
  expectType<
    CustomEvent<{
      timestamp: number;
      ctxName: string;
      data: Output;
    }>
  >(e);
});

dataOutput.validationInput;
