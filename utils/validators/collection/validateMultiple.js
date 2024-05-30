//@ts-check

/** @type {import('../../../abstract/ValidationManager.js').FuncCollectionValidator} */
export const validateMultiple = (collection, block) => {
  const total = collection.totalCount;
  const multipleMin = block.cfg.multiple ? block.cfg.multipleMin : 0;
  const multipleMax = block.cfg.multiple ? block.cfg.multipleMax : 1;

  if (multipleMin && total < multipleMin) {
    const message = block.l10n('files-count-limit-error-too-few', {
      min: multipleMin,
      max: multipleMax,
      total,
    });

    return {
      type: 'TOO_FEW_FILES',
      message,
      payload: {
        total,
        min: multipleMin,
        max: multipleMax,
      },
    };
  }

  if (multipleMax && total > multipleMax) {
    const message = block.l10n('files-count-limit-error-too-many', {
      min: multipleMin,
      max: multipleMax,
      total,
    });
    return {
      type: 'TOO_MANY_FILES',
      message,
      payload: {
        total,
        min: multipleMin,
        max: multipleMax,
      },
    };
  }
};
