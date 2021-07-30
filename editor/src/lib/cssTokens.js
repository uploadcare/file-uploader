export function cssTokens(...args) {
  return args
    .reduce((result, arg) => {
      if (typeof arg === 'string') {
        result.push(arg);
        return result;
      }

      if (arg) {
        let mapping = arg;
        for (let token of Object.keys(mapping)) {
          if (mapping[token]) {
            result.push(token);
          }
        }
      }

      return result;
    }, [])
    .join(' ');
}
