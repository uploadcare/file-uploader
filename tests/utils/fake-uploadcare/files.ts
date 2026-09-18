import { readFileSync } from 'node:fs';
import path from 'node:path';
import { imageSize } from './image-size';

/**
 * What the fake Uploadcare keeps: the files uploaded to it, the groups built from them, and the `from_url` jobs still
 * being polled.
 *
 * All of it is per session, and a session is one test file's page. The suite runs its files in parallel against one
 * fake, so a single shared store would mean one file's upload being answered with another's — and clearing it between
 * tests would drop a file that a test still running elsewhere was about to ask about.
 */

export type StoredImage = { width: number; height: number; format: string };

export type StoredFile = {
  uuid: string;
  /** As the client sent it. The API reports this as `original_filename`. */
  name: string;
  size: number;
  mimeType: string;
  bytes: Uint8Array;
  image?: StoredImage;
  isStored: boolean;
};

export type FromUrlJob = { uuid: string; polls: number };

export type Session = {
  files: Map<string, StoredFile>;
  groups: Map<string, string[]>;
  fromUrlJobs: Map<string, FromUrlJob>;
  issued: number;
};

/** Names the session on every redirected request; set by `tests/utils/network.ts`. */
export const SESSION_HEADER = 'x-fake-uploadcare-session';

const sessions = new Map<string, Session>();

/**
 * The bytes behind every file this fake did not receive itself — the demo-project files below, and whatever a
 * `from_url` job resolves to. One of the suite's own fixtures, so that the CDN has real, decodable bytes to serve and
 * `/info/` has real dimensions to report.
 */
export const STOCK_IMAGE = new Uint8Array(
  readFileSync(path.join(import.meta.dirname, '../../fixtures/test_image.jpeg')),
);

/**
 * Files the tests address by uuid without uploading them first: they exist in the demo project, and `<uc-img>` and
 * the cloud image editor are pointed straight at them.
 */
const DEMO_FILES = [
  '7124ae98-344c-42b2-ae2a-bd9aa79d76d8',
  'f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f',
  '90e06e59-8055-4435-9291-c005a98cf098',
];

/** Empties a session, or starts one: only the files that were there before anybody uploaded anything. */
export const resetSession = (id: string) => {
  const session: Session = { files: new Map(), groups: new Map(), fromUrlJobs: new Map(), issued: 0 };
  for (const uuid of DEMO_FILES) {
    session.files.set(uuid, {
      uuid,
      name: 'demo.jpg',
      size: STOCK_IMAGE.byteLength,
      mimeType: 'image/jpeg',
      bytes: STOCK_IMAGE,
      image: imageSize(STOCK_IMAGE),
      isStored: true,
    });
  }
  sessions.set(id, session);
  return session;
};

/** The session a request belongs to. An unknown one is started rather than refused: it has simply uploaded nothing. */
export const sessionOf = (request: Request) => {
  const id = request.headers.get(SESSION_HEADER) ?? 'default';
  return sessions.get(id) ?? resetSession(id);
};

/**
 * Ids count up within a session instead of being random, so that a failing run names the same file every time and a
 * uuid in a DOM assertion or a log line can be traced back to the upload that made it.
 */
export const nextUuid = (session: Session) =>
  `${(++session.issued).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

export const store = (session: Session, file: Omit<StoredFile, 'uuid'>) => {
  const stored = { ...file, uuid: nextUuid(session) };
  session.files.set(stored.uuid, stored);
  return stored;
};

/** The real API strips everything but word characters, dots and dashes; tests assert on both spellings. */
const sanitize = (name: string) => name.replace(/[^\w.-]/g, '');

const imageInfo = (file: StoredFile) =>
  file.image && {
    dpi: [72, 72],
    width: file.image.width,
    format: file.image.format,
    height: file.image.height,
    sequence: false,
    color_mode: 'RGB',
    orientation: null,
    geo_location: null,
    datetime_original: null,
  };

/** The `/info/` payload, which is also what `from_url` and `/group/` embed. */
export const fileInfo = (file: StoredFile) => {
  const image = imageInfo(file);
  const [type, subtype] = file.mimeType.split('/');
  return {
    size: file.size,
    total: file.size,
    done: file.size,
    uuid: file.uuid,
    file_id: file.uuid,
    original_filename: file.name,
    is_image: Boolean(file.image),
    is_stored: file.isStored,
    image_info: image ?? null,
    video_info: null,
    content_info: { mime: { mime: file.mimeType, type, subtype }, ...(image ? { image } : {}) },
    is_ready: true,
    filename: sanitize(file.name),
    mime_type: file.mimeType,
    metadata: {},
  };
};
