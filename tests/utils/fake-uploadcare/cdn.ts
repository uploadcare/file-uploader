import { HttpResponse, type HttpResponseResolver, http } from 'msw';
import { type Session, sessionOf } from './files';

/**
 * https://ucarecdn.com and the per-project cnames under `*.ucarecd.net` that `cdnCname` derives from a public key.
 *
 * Transformation operations are parsed but not applied: `-/resize/500x/` gets the original bytes back, at whatever
 * size they were uploaded. The suite asserts on the DOM built around an image — that a preview appeared, that the
 * right URL was requested — never on its pixels, and resizing here would mean an image codec in the test harness.
 *
 * ponytail: ops ignored. If a test ever needs the delivered size to be real, this is where a codec would go.
 */

/** `/:uuid/-/resize/500x/` and `/:group~3/nth/1/-/preview/`, which is how a group's members are addressed. */
const NTH = /(?:^|\/)nth\/(\d+)\//;

const resolve = (session: Session, id: string, pathname: string) => {
  if (!id.includes('~')) {
    return session.files.get(id);
  }
  const members = session.groups.get(id);
  const nth = Number(pathname.match(NTH)?.[1] ?? 0);
  return members?.[nth] ? session.files.get(members[nth]) : undefined;
};

const deliver: HttpResponseResolver<{ uuid: string }> = ({ params, request }) => {
  const { pathname } = new URL(request.url);
  const file = resolve(sessionOf(request), params.uuid, pathname);

  if (!file) {
    return HttpResponse.text('File not found', { status: 404 });
  }

  // `-/json/` is the metadata the cloud image editor works from, not a rendition of the image.
  if (pathname.includes('/-/json/')) {
    return file.image
      ? HttpResponse.json({
          id: file.uuid,
          format: file.image.format,
          width: file.image.width,
          height: file.image.height,
          sequence: false,
          dpi: [72, 72],
          color_mode: 'RGB',
          orientation: null,
          geo_location: null,
          datetime_original: null,
          hash: file.uuid.slice(0, 16),
        })
      : HttpResponse.text('Not an image', { status: 400 });
  }

  return new HttpResponse(file.bytes, { headers: { 'content-type': file.mimeType } });
};

/**
 * Matched by hand rather than by path pattern: the host is not fixed, since every project has its own cname, and the
 * id has to be picked out of a path whose remaining segments are operations.
 */
const isCdnRequest = ({ request }: { request: Request }) => {
  const { host, pathname } = new URL(request.url);
  if (host !== 'ucarecdn.com' && !host.endsWith('.ucarecd.net')) {
    return false;
  }
  const uuid = pathname.split('/')[1] ?? '';
  return { matches: uuid.length > 0, params: { uuid } };
};

export const cdn = [http.get(isCdnRequest, deliver)];
