import init, {greet} from './pkg/wasm_tools.js';

init().then((wasm) => {
  // greet();
  console.log(wasm);
});