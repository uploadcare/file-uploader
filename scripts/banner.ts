import pkgJson from '../package.json';
export function banner() {
  const repositoryUrl = pkgJson.repository.url;
  const licenseUrl = new URL('blob/main/LICENSE', repositoryUrl).toString();
  const licenseName = pkgJson.license;
  const pkgName = pkgJson.name;
  const version = pkgJson.version;
  const buildTime = new Date().toISOString();

  return [
    '/**',
    ' * @license',
    ` * Package: ${pkgName}@${version} (${licenseName})`,
    ` * License: ${licenseUrl}`,
    ` * Built: ${buildTime}`,
    ' */',
  ].join('\n');
}
