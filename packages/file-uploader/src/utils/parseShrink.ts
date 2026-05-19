/** TODO parseShrink move to package @uploadcare/image-shrink */

const MAX_SQUARE_SIDE = 16384;

const regExpShrink = /^([0-9]+)x([0-9]+)(?:\s+(\d{1,2}|100)%)?$/i;

type ParseShrinkResult = {
  size: number;
  quality?: number;
};

export const parseShrink = (value: unknown): ParseShrinkResult | false => {
  if (typeof value !== 'string') {
    return false;
  }
  const terms = regExpShrink.exec(value.toLocaleLowerCase()) ?? [];

  if (terms.length === 0) {
    return false;
  }

  const sizeShrink = Number(terms[1]) * Number(terms[2]);
  const maxSize = MAX_SQUARE_SIDE * MAX_SQUARE_SIDE;

  if (sizeShrink > maxSize) {
    console.warn(
      `Shrinked size can not be larger than ${Math.floor(maxSize / 1000 / 1000)}MP. ` +
        `You have set ${terms[1]}x${terms[2]} (` +
        `${Math.ceil(sizeShrink / 1000 / 100) / 10}MP).`,
    );
    return false;
  }

  return {
    quality: terms[3] ? Number(terms[3]) / 100 : undefined,
    size: sizeShrink,
  };
};
