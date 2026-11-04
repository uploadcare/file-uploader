import { describe, expect, it } from 'vitest';
import { isVideoFormat, pickVideoMimeType, recordingFileType } from '../videoFormat';

/** A browser that records only the listed types. */
const supports =
  (...types: string[]) =>
  (mimeType: string) =>
    types.includes(mimeType);

describe('pickVideoMimeType', () => {
  it('takes the first listed format the browser supports', () => {
    const isSupported = supports('video/webm', 'video/mp4;codecs=avc1,mp4a.40.2');

    expect(pickVideoMimeType({ explicit: undefined, formats: 'mp4, webm', isSupported })).toBe(
      'video/mp4;codecs=avc1,mp4a.40.2',
    );
    expect(pickVideoMimeType({ explicit: undefined, formats: 'webm, mp4', isSupported })).toBe('video/webm');
  });

  it('falls back to plain mp4 where H.264 + AAC is not offered', () => {
    expect(pickVideoMimeType({ explicit: undefined, formats: 'mp4', isSupported: supports('video/mp4') })).toBe(
      'video/mp4',
    );
  });

  it('skips formats the browser cannot record', () => {
    expect(pickVideoMimeType({ explicit: undefined, formats: 'mp4, webm', isSupported: supports('video/webm') })).toBe(
      'video/webm',
    );
  });

  it('accepts MIME types with a single codec', () => {
    const isSupported = supports('video/webm;codecs=vp9');

    expect(pickVideoMimeType({ explicit: undefined, formats: 'video/webm;codecs=vp9, webm', isSupported })).toBe(
      'video/webm;codecs=vp9',
    );
  });

  it('prefers a supported mediaRecorderOptions.mimeType', () => {
    const isSupported = supports('video/webm', 'video/x-matroska;codecs=avc1');

    expect(pickVideoMimeType({ explicit: 'video/x-matroska;codecs=avc1', formats: 'webm', isSupported })).toBe(
      'video/x-matroska;codecs=avc1',
    );
    expect(pickVideoMimeType({ explicit: 'video/ogg', formats: 'webm', isSupported })).toBe('video/webm');
  });

  it('leaves the choice to the browser when nothing listed is supported', () => {
    expect(pickVideoMimeType({ explicit: undefined, formats: 'mp4', isSupported: supports() })).toBeUndefined();
    expect(
      pickVideoMimeType({ explicit: undefined, formats: '', isSupported: supports('video/webm') }),
    ).toBeUndefined();
  });
});

describe('isVideoFormat', () => {
  it.each([
    'webm',
    'mp4',
    'video/mp4',
    'video/x-matroska;codecs=avc1',
    'video/webm; codecs=vp9',
  ])('accepts %j', (item) => {
    expect(isVideoFormat(item)).toBe(true);
  });

  it.each(['mov', 'audio/webm', 'video/', 'webm video', 'toString', 'constructor'])('rejects %j', (item) => {
    expect(isVideoFormat(item)).toBe(false);
  });
});

describe('recordingFileType', () => {
  it.each([
    ['video/webm;codecs=vp8,opus', 'video/webm'],
    ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'],
    ['video/x-matroska;codecs=avc1', 'video/x-matroska'],
    ['video/quicktime', 'video/quicktime'],
    ['', 'video/webm'],
    [undefined, 'video/webm'],
  ])('%j records as %j', (recorderType, fileType) => {
    expect(recordingFileType(recorderType)).toBe(fileType);
  });
});
