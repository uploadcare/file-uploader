import type { SharedInstancesBag } from './shared-instances';

export const getOutputData = (bag: SharedInstancesBag) => {
  const entriesIds = bag.uploadCollection.items();
  const data = entriesIds.map((itemId) => bag.api.getOutputItem(itemId));
  return data;
};
