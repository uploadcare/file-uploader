const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';
const ESCAPED_PATTERN = /\\([0-9a-fA-F]{1,6} ?)/g;

function hasLeadingTrailingQuotes(str: string): boolean {
  if (str.length < 2) return false;
  return (
    (str[0] === DOUBLE_QUOTE || str[0] === SINGLE_QUOTE) &&
    (str[str.length - 1] === DOUBLE_QUOTE || str[str.length - 1] === SINGLE_QUOTE)
  );
}

function trimQuotes(str: string): string {
  let result = str;
  if (result[0] === DOUBLE_QUOTE || result[0] === SINGLE_QUOTE) {
    result = result.slice(1);
  }
  if (result[result.length - 1] === DOUBLE_QUOTE || result[result.length - 1] === SINGLE_QUOTE) {
    result = result.slice(0, -1);
  }
  return result;
}

function escapeQuotes(str: string): string {
  let result = '';
  let prev = '';
  for (let i = 0; i < str.length; i++) {
    const next = str[i + 1];
    if (str[i] === '\\' && next === '"') {
      result += '\\"';
      i++;
    } else if (str[i] === '"' && prev !== '\\') {
      result += '\\"';
    } else {
      result += str[i];
    }
    prev = str[i] ?? '';
  }
  return result;
}

export function parseCssPropertyValue(input: string): string | number | boolean | null | undefined {
  let output = input;

  if (hasLeadingTrailingQuotes(input)) {
    output = trimQuotes(output);

    // Unescape CSS unicode sequences
    // esbuild (and other bundlers) escapes unicode characters in CSS
    // Firefox doesn't unescape them, WebKit browsers do
    // see format here https://www.w3.org/International/questions/qa-escapes#nutshell
    output = output.replace(ESCAPED_PATTERN, (_match, group) => {
      return String.fromCodePoint(parseInt(group.trim(), 16));
    });

    // Replace escaped CSS new-line separators with JSON escaped ones
    // WebKit browsers do that automatically, Firefox doesn't
    // see format here https://www.w3.org/TR/CSS22/syndata.html#strings
    output = output.replaceAll('\\\n', '\\n');

    // Escape quotes
    // WebKit browsers escapes them, Firefox doesn't
    output = escapeQuotes(output);

    // wrap output with trailing and leading double quotes to match JSON spec
    output = DOUBLE_QUOTE + output + DOUBLE_QUOTE;
  }

  try {
    return JSON.parse(output) as string | number | boolean | null | undefined;
  } catch (_error) {
    return undefined;
  }
}
