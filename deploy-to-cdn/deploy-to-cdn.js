import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fg from 'fast-glob';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import semver from 'semver';

const BUCKET = 'uploadcare-static';
const REGION = 'us-east-1';

const getVersionRanges = (version) => {
  const parsed = semver.parse(version);
  if (parsed.prerelease.length) {
    const [type, ...nums] = parsed.prerelease;
    const prereleases = [[type], ...nums.map((num, idx) => [type, ...nums.slice(0, idx), 'x'])];

    const globVersions = prereleases.map((prerelease) => {
      parsed.prerelease = prerelease;
      return parsed.format();
    });
    return [...globVersions, version];
  }

  return [`${parsed.major}.x`, `${parsed.major}.${parsed.minor}.x`, version];
};

const uploadFile = async (file, { dry, client }) => {
  console.log(`uploading ${file.content.length}B to ${file.uploadPath}, ${file.mimeType}`);

  if (dry) {
    return;
  }

  const result = await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: file.uploadPath,
      Body: file.content,
      ContentType: `${file.mimeType}; charset=utf-8`,
      ACL: 'public-read',
    })
  );

  return result;
};

export const deployToCdn = async ({ name, version, input, dry }) => {
  const s3Path = `libs/${name}`;

  if (!semver.valid(version)) {
    console.error(`Version is invalid (${version})`);
    return;
  }
  if (dry) {
    console.log('dry run');
  }

  const relativePathList = fg.sync('**/**', { cwd: input });

  const files = await Promise.all(
    relativePathList.map((relativePath) => {
      const absolutePath = path.join(input, relativePath.toString());
      const mimeType = mime.lookup(absolutePath);
      const content = fs.promises.readFile(absolutePath, { encoding: 'utf-8' });
      return Promise.all([content, relativePath, mimeType]).then(([file, relativePath, mimeType]) => ({
        content: file,
        relativePath,
        mimeType,
      }));
    })
  );

  const versionRanges = getVersionRanges(version);
  const uploadFilesList = files.reduce((acc, file) => {
    const versionPaths = versionRanges.map((version) => `${s3Path}/${version}/${file.relativePath}`);
    const filesToUpload = versionPaths.reduce((acc, versionPath) => [...acc, { ...file, uploadPath: versionPath }], []);
    return [...acc, ...filesToUpload];
  }, []);

  const s3Client = new S3Client({ region: REGION });
  await Promise.all(uploadFilesList.map((file) => uploadFile(file, { client: s3Client, dry }))).catch((error) => {
    console.error('Error: \n', error.message);
    process.exit(1);
  });
};
