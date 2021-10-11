import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fg from 'fast-glob';

const PRE_RELEASE_REGEXP = /(^\d+\.\d+\.\d+-)((alpha|beta|rc)\.\d+)\.?\d*?$/;
const MINOR_RELEASE_REGEXP = /^(\d+\.\d+)\.\d+/;
const MAJOR_RELEASE_REGEXP = /^(\d+)\.\d+\.\d+/;

const getVersionTypes = (version) => {
  let preReleaseMatch = version.match(PRE_RELEASE_REGEXP);
  return [
    version,
    ...(preReleaseMatch
      ? [
          preReleaseMatch[1] + version.replace(PRE_RELEASE_REGEXP, '$2.x'),
          preReleaseMatch[1] + version.replace(PRE_RELEASE_REGEXP, '$3.x'),
        ]
      : [version.replace(MINOR_RELEASE_REGEXP, '$1.x'), version.replace(MAJOR_RELEASE_REGEXP, '$1.x')]),
  ];
};

const S3_PATH = 'libs/editor/';
const UPLOAD_FROM = './dist/';
const BUCKET = 'uploadcare-static';
const REGION = 'us-east-1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(fs.readFileSync('./package.json').toString());
const versionTypes = getVersionTypes(pkg.version);
const files = fg.sync('**/**', { cwd: UPLOAD_FROM });
const s3Client = new S3Client({ region: REGION });

const getContentType = (filePath) => {
  let extension = path.extname(filePath);
  return {
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
  }[extension];
};

const uploadToS3 = async (data, filePath, { dry }) => {
  let contentType = getContentType(filePath);
  console.log(`uploading ${data.length}B to ${filePath}, ${contentType}`);

  if (dry) {
    console.log('DRY RUN.');
    return undefined;
  }

  const result = await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filePath,
      Body: data,
      ContentType: `${contentType}; charset=utf-8`,
      ACL: 'public-read',
    })
  );

  return result;
};

const uploadFile = (data, fileName, options) => {
  return Promise.all(versionTypes.map((version) => uploadToS3(data, `${S3_PATH}${version}/${fileName}`, options)));
};

Promise.all(
  files.map((uploadPath) => {
    const absolutePath = path.join(__dirname, UPLOAD_FROM, uploadPath);
    const file = fs.promises.readFile(absolutePath, { encoding: 'utf-8' });
    return Promise.all([file, uploadPath]);
  })
)
  .then((filesData) => Promise.all(filesData.map(([file, uploadPath]) => uploadFile(file, uploadPath, { dry: false }))))
  .catch((error) => {
    console.error('Error: \n', error.message);
    process.exit(1);
  });
