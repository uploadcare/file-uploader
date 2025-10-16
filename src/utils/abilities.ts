export const canUsePermissionsApi = () => {
  return typeof navigator.permissions !== 'undefined';
};
