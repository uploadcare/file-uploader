import { deserializeCsv } from '../../../../utils/comma-separated';
import type { TabIdValue } from '../toolbar-constants';
import { ALL_TABS } from '../toolbar-constants';

const isTabIdValue = (value: string): value is TabIdValue => (ALL_TABS as readonly string[]).includes(value);

export const parseTabs = (tabs?: string): readonly TabIdValue[] => {
  if (!tabs) {
    return ALL_TABS;
  }
  const tabList = deserializeCsv(tabs).filter(isTabIdValue);
  if (tabList.length === 0) {
    return ALL_TABS;
  }
  return tabList;
};
