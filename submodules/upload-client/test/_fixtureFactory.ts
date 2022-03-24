import './_envs'

import {
  dataURItoBlob,
  dataURItoBuffer,
  getSettingsForTesting
} from './_helpers'

const isNode = (): boolean => {
  try {
    return Object.prototype.toString.call(global.process) === '[object process]'
  } catch (e) {
    return false
  }
}

const settings = getSettingsForTesting({})

/* eslint-disable max-len */
const images: { [key: string]: string } = {
  blackSquare:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAP1BMVEUAAAB9fX2MjIybm5urq6u4uLi2traBgYF4eHjZ2dl0dHTPz8/8/Pytra2enp6Ojo6UlJSkpKTz8/Pk5OTIyMhQaSTuAAABiklEQVR4nO3dQU7DMBBG4XETp00hJUDvf1a6YAMbKqTR6MXv8wX+t7RkyfH68bm+3O+992V+mL7tpx/av51Pf9qnJ9zmJ2z9t2WNLY7tGnP1hGRtgML36gnJWkzVE5JZyGchn4V8FvJZyDdC4V49IVmLU/WEZBbyWchnIZ+FfBbyWchnIZ+FfBbyWchnIZ+FfBbyWchnIZ+FfO1xjs1CPgv5LOSzkM9CPgv5LOSzkM9CPgv5LOSzkM9CPgv5LOSzkM9CPgv5LORrca6ekGyEF0MW0lnIZyGfhXwW8lnIZyGfhXwW8lnIZyGfhXwW8lnIZyGfhXwW8lnIZyHfCIVv1ROSjfDPjIV0FvJZyGchn4V8FvJZyGchn4V8FvJZyGchn4V8FvJZyGchn4V8IxTeqickazFXT0hmIZ+FfBbyWchnIZ+FfBbyWchnIZ+FfBbyWchnIZ+FfBbyWchnId8IhVv1hGQtluoJyVr06gnJLOSzkM9CPgv5LOSzkM9CvhEKj34DvsR6bUd26V9gvwdvrjmldwAAAABJRU5ErkJggg=='
}
/* eslint-enable max-len */

const pubkey = (): string =>
  (process.env.TEST_ENV === 'production'
    ? process.env.UC_KEY_FOR_INTEGRATION_TESTS
    : 'secret_public_key') || ''

const uuids: { [key: string]: { publicKey: string; uuid: string } } = {
  image: {
    publicKey: pubkey(),
    uuid: '49b4c5a1-31b3-4349-ba07-d97a2d883c37'
  },
  token: {
    publicKey: pubkey(),
    uuid: '49b4c5a1-31b3-4349-ba07-d97a2d883c37'
  },
  demo: {
    publicKey: 'demopublickey',
    uuid: ''
  },
  invalid: {
    publicKey: 'invalidpublickey',
    uuid: ''
  },
  empty: {
    publicKey: '',
    uuid: ''
  },
  multipart: {
    publicKey: 'pub_test__no_storing',
    uuid: ''
  },
  unknownProgress: {
    publicKey: 'pub_test__unknown_progress',
    uuid: '49b4c5a1-31b3-4349-ba07-d97a2d883c37'
  }
}

export type FixtureFile = {
  data: Buffer | Blob
  size: number
}

function imageBuffer(id: string): FixtureFile {
  const data = dataURItoBuffer(images[id])
  const size = data.length

  return {
    data,
    size
  }
}

function imageBlob(id: string): FixtureFile {
  const data = dataURItoBlob(images[id])
  const size = data.size

  return {
    data,
    size
  }
}

export function image(id: string): FixtureFile {
  if (isNode()) {
    return imageBuffer(id)
  }

  return imageBlob(id)
}

function fileBuffer(bytes: number): FixtureFile {
  const buffer = Buffer.alloc(bytes)

  return {
    data: buffer,
    size: buffer.length
  }
}

function fileBlob(bytes: number): FixtureFile {
  const buffer = new ArrayBuffer(bytes)
  const blob = new Blob([buffer])

  return {
    data: blob,
    size: blob.size
  }
}

export function file(mbSize: number): FixtureFile {
  const byteLength = mbSize * 1024 * 1024

  if (isNode()) {
    return fileBuffer(byteLength)
  }

  return fileBlob(byteLength)
}

export function uuid(id: string): string {
  const { uuid } = uuids[id]

  return uuid
}

export function publicKey(id: string): string {
  const { publicKey } = uuids[id]

  return publicKey
}

export function imageUrl(id: string): string {
  const images = {
    valid: `${settings.baseCDN}/49b4c5a1-31b3-4349-ba07-d97a2d883c37/20200721174713.png`,
    doesNotExist: 'https://1.com/1.jpg',
    privateIP: 'http://192.168.1.10/1.jpg'
  }

  return images[id]
}

export function token(id: string): string {
  const tokens = {
    valid: '49b4c5a1-31b3-4349-ba07-d97a2d883c37',
    empty: ''
  }

  return tokens[id]
}

export function groupId(id: string): string {
  const groupIds = {
    valid: '0b14f2f6-6d30-482b-a6d6-da2d434779d3~2',
    invalid: '123ebb27-1fd6-46c6-a859-b9893'
  }

  return groupIds[id]
}

export function groupOfFiles(id: string): Array<string> {
  const groupOfFiles = {
    valid: [
      '392e3aa3-5ed6-4ad6-a67e-b3a7c1d5b9e9',
      '49b4c5a1-31b3-4349-ba07-d97a2d883c37'
    ],
    invalid: [
      '2e6b7f23-9143-4b71-94e7-338bb',
      'e143e315-bdce-4421-9a0b-ca1aa/-/resize/x800/'
    ]
  }

  return groupOfFiles[id]
}
