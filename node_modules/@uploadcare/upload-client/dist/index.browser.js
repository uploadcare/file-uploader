class UploadClientError extends Error {
    constructor(message, code, request, response, headers) {
        super();
        this.name = 'UploadClientError';
        this.message = message;
        this.code = code;
        this.request = request;
        this.response = response;
        this.headers = headers;
        Object.setPrototypeOf(this, UploadClientError.prototype);
    }
}
const cancelError = (message = 'Request canceled') => {
    const error = new UploadClientError(message);
    error.isCancel = true;
    return error;
};

const onCancel = (signal, callback) => {
    if (signal) {
        if (signal.aborted) {
            Promise.resolve().then(callback);
        }
        else {
            signal.addEventListener('abort', () => callback(), { once: true });
        }
    }
};

const request = ({ method, url, data, headers = {}, signal, onProgress }) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const requestMethod = (method === null || method === void 0 ? void 0 : method.toUpperCase()) || 'GET';
    let aborted = false;
    xhr.open(requestMethod, url);
    if (headers) {
        Object.entries(headers).forEach((entry) => {
            const [key, value] = entry;
            typeof value !== 'undefined' &&
                !Array.isArray(value) &&
                xhr.setRequestHeader(key, value);
        });
    }
    xhr.responseType = 'text';
    onCancel(signal, () => {
        aborted = true;
        xhr.abort();
        reject(cancelError());
    });
    xhr.onload = () => {
        if (xhr.status != 200) {
            // analyze HTTP status of the response
            reject(new Error(`Error ${xhr.status}: ${xhr.statusText}`)); // e.g. 404: Not Found
        }
        else {
            const request = {
                method: requestMethod,
                url,
                data,
                headers: headers || undefined,
                signal,
                onProgress
            };
            // Convert the header string into an array
            // of individual headers
            const headersArray = xhr
                .getAllResponseHeaders()
                .trim()
                .split(/[\r\n]+/);
            // Create a map of header names to values
            const responseHeaders = {};
            headersArray.forEach(function (line) {
                const parts = line.split(': ');
                const header = parts.shift();
                const value = parts.join(': ');
                if (header && typeof header !== 'undefined') {
                    responseHeaders[header] = value;
                }
            });
            const responseData = xhr.response;
            const responseStatus = xhr.status;
            resolve({
                request,
                data: responseData,
                headers: responseHeaders,
                status: responseStatus
            });
        }
    };
    xhr.onerror = () => {
        if (aborted)
            return;
        // only triggers if the request couldn't be made at all
        reject(new Error('Network error'));
    };
    if (onProgress && typeof onProgress === 'function') {
        xhr.upload.onprogress = (event) => {
            onProgress({ value: event.loaded / event.total });
        };
    }
    if (data) {
        xhr.send(data);
    }
    else {
        xhr.send();
    }
});

function identity(obj) {
    return obj;
}

const transformFile = identity;
var getFormData = () => new FormData();

const isFileTuple = (tuple) => tuple[0] === 'file';
function buildFormData(body) {
    const formData = getFormData();
    for (const tuple of body) {
        if (Array.isArray(tuple[1])) {
            // refactor this
            tuple[1].forEach((val) => val && formData.append(tuple[0] + '[]', `${val}`));
        }
        else if (isFileTuple(tuple)) {
            const name = tuple[2];
            const file = transformFile(tuple[1]); // lgtm[js/superfluous-trailing-arguments]
            formData.append(tuple[0], file, name);
        }
        else if (tuple[1] != null) {
            formData.append(tuple[0], `${tuple[1]}`);
        }
    }
    return formData;
}

const serializePair = (key, value) => typeof value !== 'undefined' ? `${key}=${encodeURIComponent(value)}` : null;
const createQuery = (query) => Object.entries(query)
    .reduce((params, [key, value]) => params.concat(Array.isArray(value)
    ? value.map((value) => serializePair(`${key}[]`, value))
    : serializePair(key, value)), [])
    .filter((x) => !!x)
    .join('&');
const getUrl = (base, path, query) => [
    base,
    path,
    query && Object.keys(query).length > 0 ? '?' : '',
    query && createQuery(query)
]
    .filter(Boolean)
    .join('');

/*
  Settings for future support:
  parallelDirectUploads: 10,
 */
const defaultSettings = {
    baseCDN: 'https://ucarecdn.com',
    baseURL: 'https://upload.uploadcare.com',
    maxContentLength: 50 * 1024 * 1024,
    retryThrottledRequestMaxTimes: 1,
    multipartMinFileSize: 25 * 1024 * 1024,
    multipartChunkSize: 5 * 1024 * 1024,
    multipartMinLastPartSize: 1024 * 1024,
    maxConcurrentRequests: 4,
    multipartMaxAttempts: 3,
    pollingTimeoutMilliseconds: 10000,
    pusherKey: '79ae88bd931ea68464d9'
};
const defaultContentType = 'application/octet-stream';
const defaultFilename = 'original';

var version = '2.2.0';

/**
 * Returns User Agent based on version and settings.
 */
function getUserAgent({ userAgent, publicKey = '', integration = '' } = {}) {
    const libraryName = 'UploadcareUploadClient';
    const libraryVersion = version;
    const languageName = 'JavaScript';
    if (typeof userAgent === 'string') {
        return userAgent;
    }
    if (typeof userAgent === 'function') {
        return userAgent({
            publicKey,
            libraryName,
            libraryVersion,
            languageName,
            integration
        });
    }
    const mainInfo = [libraryName, libraryVersion, publicKey]
        .filter(Boolean)
        .join('/');
    const additionInfo = [languageName, integration].filter(Boolean).join('; ');
    return `${mainInfo} (${additionInfo})`;
}

const SEPARATOR = /\W|_/g;
/**
 * Transforms a string to camelCased.
 */
function camelize(text) {
    return text
        .split(SEPARATOR)
        .map((word, index) => word.charAt(0)[index > 0 ? 'toUpperCase' : 'toLowerCase']() +
        word.slice(1))
        .join('');
}
/**
 * Transforms keys of an object to camelCased recursively.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function camelizeKeys(source) {
    if (!source || typeof source !== 'object') {
        return source;
    }
    return Object.keys(source).reduce((accumulator, key) => {
        accumulator[camelize(key)] =
            typeof source[key] === 'object' ? camelizeKeys(source[key]) : source[key];
        return accumulator;
    }, {});
}

/**
 * setTimeout as Promise.
 *
 * @param {number} ms Timeout in milliseconds.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const defaultOptions = {
    factor: 2,
    time: 100
};
function retrier(fn, options = defaultOptions) {
    let attempts = 0;
    function runAttempt(fn) {
        const defaultDelayTime = Math.round(options.time * Math.pow(options.factor, attempts));
        const retry = (ms) => delay(ms !== null && ms !== void 0 ? ms : defaultDelayTime).then(() => {
            attempts += 1;
            return runAttempt(fn);
        });
        return fn({
            attempt: attempts,
            retry
        });
    }
    return runAttempt(fn);
}

const REQUEST_WAS_THROTTLED_CODE = 'RequestThrottledError';
const DEFAULT_RETRY_AFTER_TIMEOUT = 15000;
function getTimeoutFromThrottledRequest(error) {
    const { headers } = error || {};
    return ((headers &&
        Number.parseInt(headers['x-throttle-wait-seconds']) * 1000) ||
        DEFAULT_RETRY_AFTER_TIMEOUT);
}
function retryIfThrottled(fn, retryThrottledMaxTimes) {
    return retrier(({ attempt, retry }) => fn().catch((error) => {
        if ('response' in error &&
            (error === null || error === void 0 ? void 0 : error.code) === REQUEST_WAS_THROTTLED_CODE &&
            attempt < retryThrottledMaxTimes) {
            return retry(getTimeoutFromThrottledRequest(error));
        }
        throw error;
    }));
}

/**
 * Performs file uploading request to Uploadcare Upload API.
 * Can be canceled and has progress.
 */
function base(file, { publicKey, fileName, baseURL = defaultSettings.baseURL, secureSignature, secureExpire, store, signal, onProgress, source = 'local', integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => {
        var _a;
        return request({
            method: 'POST',
            url: getUrl(baseURL, '/base/', {
                jsonerrors: 1
            }),
            headers: {
                'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
            },
            data: buildFormData([
                ['file', file, (_a = fileName !== null && fileName !== void 0 ? fileName : file.name) !== null && _a !== void 0 ? _a : defaultFilename],
                ['UPLOADCARE_PUB_KEY', publicKey],
                [
                    'UPLOADCARE_STORE',
                    typeof store === 'undefined' ? 'auto' : store ? 1 : 0
                ],
                ['signature', secureSignature],
                ['expire', secureExpire],
                ['source', source]
            ]),
            signal,
            onProgress
        }).then(({ data, headers, request }) => {
            const response = camelizeKeys(JSON.parse(data));
            if ('error' in response) {
                throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
            }
            else {
                return response;
            }
        });
    }, retryThrottledRequestMaxTimes);
}

var TypeEnum;
(function (TypeEnum) {
    TypeEnum["Token"] = "token";
    TypeEnum["FileInfo"] = "file_info";
})(TypeEnum || (TypeEnum = {}));
/**
 * Uploading files from URL.
 */
function fromUrl(sourceUrl, { publicKey, baseURL = defaultSettings.baseURL, store, fileName, checkForUrlDuplicates, saveUrlForRecurrentUploads, secureSignature, secureExpire, source = 'url', signal, integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => request({
        method: 'POST',
        headers: {
            'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        url: getUrl(baseURL, '/from_url/', {
            jsonerrors: 1,
            pub_key: publicKey,
            source_url: sourceUrl,
            store: typeof store === 'undefined' ? 'auto' : store ? 1 : undefined,
            filename: fileName,
            check_URL_duplicates: checkForUrlDuplicates ? 1 : undefined,
            save_URL_duplicates: saveUrlForRecurrentUploads ? 1 : undefined,
            signature: secureSignature,
            expire: secureExpire,
            source: source
        }),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response) {
            throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
        }
        else {
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

var Status;
(function (Status) {
    Status["Unknown"] = "unknown";
    Status["Waiting"] = "waiting";
    Status["Progress"] = "progress";
    Status["Error"] = "error";
    Status["Success"] = "success";
})(Status || (Status = {}));
const isErrorResponse = (response) => {
    return 'status' in response && response.status === Status.Error;
};
/**
 * Checking upload status and working with file tokens.
 */
function fromUrlStatus(token, { publicKey, baseURL = defaultSettings.baseURL, signal, integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes } = {}) {
    return retryIfThrottled(() => request({
        method: 'GET',
        headers: publicKey
            ? {
                'X-UC-User-Agent': getUserAgent({
                    publicKey,
                    integration,
                    userAgent
                })
            }
            : undefined,
        url: getUrl(baseURL, '/from_url/status/', {
            jsonerrors: 1,
            token
        }),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response && !isErrorResponse(response)) {
            throw new UploadClientError(response.error.content, undefined, request, response, headers);
        }
        else {
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

/**
 * Create files group.
 */
function group(uuids, { publicKey, baseURL = defaultSettings.baseURL, jsonpCallback, secureSignature, secureExpire, signal, source, integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => request({
        method: 'POST',
        headers: {
            'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        url: getUrl(baseURL, '/group/', {
            jsonerrors: 1,
            pub_key: publicKey,
            files: uuids,
            callback: jsonpCallback,
            signature: secureSignature,
            expire: secureExpire,
            source
        }),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response) {
            throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
        }
        else {
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

/**
 * Get info about group.
 */
function groupInfo(id, { publicKey, baseURL = defaultSettings.baseURL, signal, source, integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => request({
        method: 'GET',
        headers: {
            'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        url: getUrl(baseURL, '/group/info/', {
            jsonerrors: 1,
            pub_key: publicKey,
            group_id: id,
            source
        }),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response) {
            throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
        }
        else {
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

/**
 * Returns a JSON dictionary holding file info.
 */
function info(uuid, { publicKey, baseURL = defaultSettings.baseURL, signal, source, integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => request({
        method: 'GET',
        headers: {
            'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        url: getUrl(baseURL, '/info/', {
            jsonerrors: 1,
            pub_key: publicKey,
            file_id: uuid,
            source
        }),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response) {
            throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
        }
        else {
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

/**
 * Start multipart uploading.
 */
function multipartStart(size, { publicKey, contentType, fileName, multipartChunkSize = defaultSettings.multipartChunkSize, baseURL = '', secureSignature, secureExpire, store, signal, source = 'local', integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => request({
        method: 'POST',
        url: getUrl(baseURL, '/multipart/start/', { jsonerrors: 1 }),
        headers: {
            'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        data: buildFormData([
            ['filename', fileName !== null && fileName !== void 0 ? fileName : defaultFilename],
            ['size', size],
            ['content_type', contentType !== null && contentType !== void 0 ? contentType : defaultContentType],
            ['part_size', multipartChunkSize],
            ['UPLOADCARE_STORE', store ? '' : 'auto'],
            ['UPLOADCARE_PUB_KEY', publicKey],
            ['signature', secureSignature],
            ['expire', secureExpire],
            ['source', source]
        ]),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response) {
            throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
        }
        else {
            // convert to array
            response.parts = Object.keys(response.parts).map((key) => response.parts[key]);
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

/**
 * Complete multipart uploading.
 */
function multipartUpload(part, url, { signal, onProgress }) {
    return request({
        method: 'PUT',
        url,
        data: part,
        onProgress,
        signal
    })
        .then((result) => {
        // hack for node ¯\_(ツ)_/¯
        if (onProgress)
            onProgress({ value: 1 });
        return result;
    })
        .then(({ status }) => ({ code: status }));
}

/**
 * Complete multipart uploading.
 */
function multipartComplete(uuid, { publicKey, baseURL = defaultSettings.baseURL, source = 'local', signal, integration, userAgent, retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes }) {
    return retryIfThrottled(() => request({
        method: 'POST',
        url: getUrl(baseURL, '/multipart/complete/', { jsonerrors: 1 }),
        headers: {
            'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        data: buildFormData([
            ['uuid', uuid],
            ['UPLOADCARE_PUB_KEY', publicKey],
            ['source', source]
        ]),
        signal
    }).then(({ data, headers, request }) => {
        const response = camelizeKeys(JSON.parse(data));
        if ('error' in response) {
            throw new UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
        }
        else {
            return response;
        }
    }), retryThrottledRequestMaxTimes);
}

class UploadcareFile {
    constructor(fileInfo, { baseCDN, defaultEffects, fileName }) {
        this.name = null;
        this.size = null;
        this.isStored = null;
        this.isImage = null;
        this.mimeType = null;
        this.cdnUrl = null;
        this.cdnUrlModifiers = null;
        this.originalUrl = null;
        this.originalFilename = null;
        this.imageInfo = null;
        this.videoInfo = null;
        const { uuid, s3Bucket } = fileInfo;
        const urlBase = s3Bucket
            ? `https://${s3Bucket}.s3.amazonaws.com/${uuid}/${fileInfo.filename}`
            : `${baseCDN}/${uuid}/`;
        const cdnUrlModifiers = defaultEffects ? `-/${defaultEffects}` : null;
        const cdnUrl = `${urlBase}${cdnUrlModifiers || ''}`;
        const originalUrl = uuid ? urlBase : null;
        this.uuid = uuid;
        this.name = fileName || fileInfo.filename;
        this.size = fileInfo.size;
        this.isStored = fileInfo.isStored;
        this.isImage = fileInfo.isImage;
        this.mimeType = fileInfo.mimeType;
        this.cdnUrl = cdnUrl;
        this.cdnUrlModifiers = cdnUrlModifiers;
        this.originalUrl = originalUrl;
        this.originalFilename = fileInfo.originalFilename;
        this.imageInfo = camelizeKeys(fileInfo.imageInfo);
        this.videoInfo = camelizeKeys(fileInfo.videoInfo);
    }
}

const DEFAULT_INTERVAL = 500;
const poll = ({ check, interval = DEFAULT_INTERVAL, signal }) => new Promise((resolve, reject) => {
    let timeoutId;
    onCancel(signal, () => {
        timeoutId && clearTimeout(timeoutId);
        reject(cancelError('Poll cancelled'));
    });
    const tick = () => {
        try {
            Promise.resolve(check(signal))
                .then((result) => {
                if (result) {
                    resolve(result);
                }
                else {
                    timeoutId = setTimeout(tick, interval);
                }
            })
                .catch((error) => reject(error));
        }
        catch (error) {
            reject(error);
        }
    };
    timeoutId = setTimeout(tick, 0);
});

function isReadyPoll({ file, publicKey, baseURL, source, integration, userAgent, retryThrottledRequestMaxTimes, signal, onProgress }) {
    return poll({
        check: (signal) => info(file, {
            publicKey,
            baseURL,
            signal,
            source,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes
        }).then((response) => {
            if (response.isReady) {
                return response;
            }
            onProgress && onProgress({ value: 1 });
            return false;
        }),
        signal
    });
}

const uploadFromObject = (file, { publicKey, fileName, baseURL, secureSignature, secureExpire, store, signal, onProgress, source, integration, userAgent, retryThrottledRequestMaxTimes, baseCDN }) => {
    return base(file, {
        publicKey,
        fileName,
        baseURL,
        secureSignature,
        secureExpire,
        store,
        signal,
        onProgress,
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes
    })
        .then(({ file }) => {
        return isReadyPoll({
            file,
            publicKey,
            baseURL,
            source,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes,
            onProgress,
            signal
        });
    })
        .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN }));
};

/*globals self, window */

/*eslint-disable @mysticatea/prettier */
const { AbortController, AbortSignal } =
    typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window :
    /* otherwise */ undefined;

const race = (fns, { signal } = {}) => {
    let lastError = null;
    let winnerIndex = null;
    const controllers = fns.map(() => new AbortController());
    const createStopRaceCallback = (i) => () => {
        winnerIndex = i;
        controllers.forEach((controller, index) => index !== i && controller.abort());
    };
    onCancel(signal, () => {
        controllers.forEach((controller) => controller.abort());
    });
    return Promise.all(fns.map((fn, i) => {
        const stopRace = createStopRaceCallback(i);
        return Promise.resolve()
            .then(() => fn({ stopRace, signal: controllers[i].signal }))
            .then((result) => {
            stopRace();
            return result;
        })
            .catch((error) => {
            lastError = error;
            return null;
        });
    })).then((results) => {
        if (winnerIndex === null) {
            throw lastError;
        }
        else {
            return results[winnerIndex];
        }
    });
};

var WebSocket = window.WebSocket;

class Events {
    constructor() {
        this.events = Object.create({});
    }
    emit(event, data) {
        var _a;
        (_a = this.events[event]) === null || _a === void 0 ? void 0 : _a.forEach((fn) => fn(data));
    }
    on(event, callback) {
        this.events[event] = this.events[event] || [];
        this.events[event].push(callback);
    }
    off(event, callback) {
        if (callback) {
            this.events[event] = this.events[event].filter((fn) => fn !== callback);
        }
        else {
            this.events[event] = [];
        }
    }
}

const response = (type, data) => {
    if (type === 'success') {
        return Object.assign({ status: Status.Success }, data);
    }
    if (type === 'progress') {
        return Object.assign({ status: Status.Progress }, data);
    }
    return Object.assign({ status: Status.Error }, data);
};
class Pusher {
    constructor(pusherKey, disconnectTime = 30000) {
        this.ws = undefined;
        this.queue = [];
        this.isConnected = false;
        this.subscribers = 0;
        this.emmitter = new Events();
        this.disconnectTimeoutId = null;
        this.key = pusherKey;
        this.disconnectTime = disconnectTime;
    }
    connect() {
        this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId);
        if (!this.isConnected && !this.ws) {
            const pusherUrl = `wss://ws.pusherapp.com/app/${this.key}?protocol=5&client=js&version=1.12.2`;
            this.ws = new WebSocket(pusherUrl);
            this.ws.addEventListener('error', (error) => {
                this.emmitter.emit('error', new Error(error.message));
            });
            this.emmitter.on('connected', () => {
                this.isConnected = true;
                this.queue.forEach((message) => this.send(message.event, message.data));
                this.queue = [];
            });
            this.ws.addEventListener('message', (e) => {
                const data = JSON.parse(e.data.toString());
                switch (data.event) {
                    case 'pusher:connection_established': {
                        this.emmitter.emit('connected', undefined);
                        break;
                    }
                    case 'pusher:ping': {
                        this.send('pusher:pong', {});
                        break;
                    }
                    case 'progress':
                    case 'success':
                    case 'fail': {
                        this.emmitter.emit(data.channel, response(data.event, JSON.parse(data.data)));
                    }
                }
            });
        }
    }
    disconnect() {
        const actualDisconect = () => {
            var _a;
            (_a = this.ws) === null || _a === void 0 ? void 0 : _a.close();
            this.ws = undefined;
            this.isConnected = false;
        };
        if (this.disconnectTime) {
            this.disconnectTimeoutId = setTimeout(() => {
                actualDisconect();
            }, this.disconnectTime);
        }
        else {
            actualDisconect();
        }
    }
    send(event, data) {
        var _a;
        const str = JSON.stringify({ event, data });
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(str);
    }
    subscribe(token, handler) {
        this.subscribers += 1;
        this.connect();
        const channel = `task-status-${token}`;
        const message = {
            event: 'pusher:subscribe',
            data: { channel }
        };
        this.emmitter.on(channel, handler);
        if (this.isConnected) {
            this.send(message.event, message.data);
        }
        else {
            this.queue.push(message);
        }
    }
    unsubscribe(token) {
        this.subscribers -= 1;
        const channel = `task-status-${token}`;
        const message = {
            event: 'pusher:unsubscribe',
            data: { channel }
        };
        this.emmitter.off(channel);
        if (this.isConnected) {
            this.send(message.event, message.data);
        }
        else {
            this.queue = this.queue.filter((msg) => msg.data.channel !== channel);
        }
        if (this.subscribers === 0) {
            this.disconnect();
        }
    }
    onError(callback) {
        this.emmitter.on('error', callback);
        return () => this.emmitter.off('error', callback);
    }
}
let pusher = null;
const getPusher = (key) => {
    if (!pusher) {
        // no timeout for nodeJS and 30000 ms for browser
        const disconectTimeout = typeof window === 'undefined' ? 0 : 30000;
        pusher = new Pusher(key, disconectTimeout);
    }
    return pusher;
};
const preconnect = (key) => {
    getPusher(key).connect();
};

function pollStrategy({ token, publicKey, baseURL, integration, userAgent, retryThrottledRequestMaxTimes, onProgress, signal }) {
    return poll({
        check: (signal) => fromUrlStatus(token, {
            publicKey,
            baseURL,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes,
            signal
        }).then((response) => {
            switch (response.status) {
                case Status.Error: {
                    return new UploadClientError(response.error, response.errorCode);
                }
                case Status.Waiting: {
                    return false;
                }
                case Status.Unknown: {
                    return new UploadClientError(`Token "${token}" was not found.`);
                }
                case Status.Progress: {
                    if (onProgress)
                        onProgress({ value: response.done / response.total });
                    return false;
                }
                case Status.Success: {
                    if (onProgress)
                        onProgress({ value: response.done / response.total });
                    return response;
                }
                default: {
                    throw new Error('Unknown status');
                }
            }
        }),
        signal
    });
}
const pushStrategy = ({ token, pusherKey, signal, onProgress }) => new Promise((resolve, reject) => {
    const pusher = getPusher(pusherKey);
    const unsubErrorHandler = pusher.onError(reject);
    const destroy = () => {
        unsubErrorHandler();
        pusher.unsubscribe(token);
    };
    onCancel(signal, () => {
        destroy();
        reject(cancelError('pusher cancelled'));
    });
    pusher.subscribe(token, (result) => {
        switch (result.status) {
            case Status.Progress: {
                if (onProgress) {
                    onProgress({ value: result.done / result.total });
                }
                break;
            }
            case Status.Success: {
                destroy();
                if (onProgress)
                    onProgress({ value: result.done / result.total });
                resolve(result);
                break;
            }
            case Status.Error: {
                destroy();
                reject(new UploadClientError(result.msg, result.error_code));
            }
        }
    });
});
const uploadFromUrl = (sourceUrl, { publicKey, fileName, baseURL, baseCDN, checkForUrlDuplicates, saveUrlForRecurrentUploads, secureSignature, secureExpire, store, signal, onProgress, source, integration, userAgent, retryThrottledRequestMaxTimes, pusherKey = defaultSettings.pusherKey }) => Promise.resolve(preconnect(pusherKey))
    .then(() => fromUrl(sourceUrl, {
    publicKey,
    fileName,
    baseURL,
    checkForUrlDuplicates,
    saveUrlForRecurrentUploads,
    secureSignature,
    secureExpire,
    store,
    signal,
    source,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes
}))
    .catch((error) => {
    const pusher = getPusher(pusherKey);
    pusher === null || pusher === void 0 ? void 0 : pusher.disconnect();
    return Promise.reject(error);
})
    .then((urlResponse) => {
    if (urlResponse.type === TypeEnum.FileInfo) {
        return urlResponse;
    }
    else {
        return race([
            ({ signal }) => pollStrategy({
                token: urlResponse.token,
                publicKey,
                baseURL,
                integration,
                userAgent,
                retryThrottledRequestMaxTimes,
                onProgress,
                signal
            }),
            ({ signal }) => pushStrategy({
                token: urlResponse.token,
                pusherKey,
                signal,
                onProgress
            })
        ], { signal });
    }
})
    .then((result) => {
    if (result instanceof UploadClientError)
        throw result;
    return result;
})
    .then((result) => isReadyPoll({
    file: result.uuid,
    publicKey,
    baseURL,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes,
    onProgress,
    signal
}))
    .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN }));

const uploadFromUploaded = (uuid, { publicKey, fileName, baseURL, signal, onProgress, source, integration, userAgent, retryThrottledRequestMaxTimes, baseCDN }) => {
    return info(uuid, {
        publicKey,
        baseURL,
        signal,
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes
    })
        .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN, fileName }))
        .then((result) => {
        // hack for node ¯\_(ツ)_/¯
        if (onProgress)
            onProgress({ value: 1 });
        return result;
    });
};

/**
 * FileData type guard.
 */
const isFileData = (data) => {
    return (data !== undefined &&
        ((typeof Blob !== 'undefined' && data instanceof Blob) ||
            (typeof File !== 'undefined' && data instanceof File) ||
            (typeof Buffer !== 'undefined' && data instanceof Buffer)));
};
/**
 * Uuid type guard.
 */
const isUuid = (data) => {
    const UUID_REGEX = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
    const regExp = new RegExp(UUID_REGEX);
    return !isFileData(data) && regExp.test(data);
};
/**
 * Url type guard.
 *
 * @param {NodeFile | BrowserFile | Url | Uuid} data
 */
const isUrl = (data) => {
    const URL_REGEX = '^(?:\\w+:)?\\/\\/([^\\s\\.]+\\.\\S{2}|localhost[\\:?\\d]*)\\S*$';
    const regExp = new RegExp(URL_REGEX);
    return !isFileData(data) && regExp.test(data);
};

/**
 * Get file size.
 */
const getFileSize = (file) => {
    return file.length || file.size;
};
/**
 * Check if FileData is multipart data.
 */
const isMultipart = (fileSize, multipartMinFileSize = defaultSettings.multipartMinFileSize) => {
    return fileSize >= multipartMinFileSize;
};

const sliceChunk = (file, index, fileSize, chunkSize) => {
    const start = chunkSize * index;
    const end = Math.min(start + chunkSize, fileSize);
    return file.slice(start, end);
};

function prepareChunks(file, fileSize, chunkSize) {
    return (index) => sliceChunk(file, index, fileSize, chunkSize);
}

const runWithConcurrency = (concurrency, tasks) => {
    return new Promise((resolve, reject) => {
        const results = [];
        let rejected = false;
        let settled = tasks.length;
        const forRun = [...tasks];
        const run = () => {
            const index = tasks.length - forRun.length;
            const next = forRun.shift();
            if (next) {
                next()
                    .then((result) => {
                    if (rejected)
                        return;
                    results[index] = result;
                    settled -= 1;
                    if (settled) {
                        run();
                    }
                    else {
                        resolve(results);
                    }
                })
                    .catch((error) => {
                    rejected = true;
                    reject(error);
                });
            }
        };
        for (let i = 0; i < concurrency; i++) {
            run();
        }
    });
};

const uploadPartWithRetry = (chunk, url, { publicKey, onProgress, signal, integration, multipartMaxAttempts }) => retrier(({ attempt, retry }) => multipartUpload(chunk, url, {
    publicKey,
    onProgress,
    signal,
    integration
}).catch((error) => {
    if (attempt < multipartMaxAttempts) {
        return retry();
    }
    throw error;
}));
const uploadMultipart = (file, { publicKey, fileName, fileSize, baseURL, secureSignature, secureExpire, store, signal, onProgress, source, integration, userAgent, retryThrottledRequestMaxTimes, contentType, multipartChunkSize = defaultSettings.multipartChunkSize, maxConcurrentRequests = defaultSettings.maxConcurrentRequests, multipartMaxAttempts = defaultSettings.multipartMaxAttempts, baseCDN }) => {
    const size = fileSize || getFileSize(file);
    let progressValues;
    const createProgressHandler = (size, index) => {
        if (!onProgress)
            return;
        if (!progressValues) {
            progressValues = Array(size).fill(0);
        }
        const sum = (values) => values.reduce((sum, next) => sum + next, 0);
        return ({ value }) => {
            progressValues[index] = value;
            onProgress({ value: sum(progressValues) / size });
        };
    };
    return multipartStart(size, {
        publicKey,
        contentType,
        fileName: fileName !== null && fileName !== void 0 ? fileName : file.name,
        baseURL,
        secureSignature,
        secureExpire,
        store,
        signal,
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes
    })
        .then(({ uuid, parts }) => {
        const getChunk = prepareChunks(file, size, multipartChunkSize);
        return Promise.all([
            uuid,
            runWithConcurrency(maxConcurrentRequests, parts.map((url, index) => () => uploadPartWithRetry(getChunk(index), url, {
                publicKey,
                onProgress: createProgressHandler(parts.length, index),
                signal,
                integration,
                multipartMaxAttempts
            })))
        ]);
    })
        .then(([uuid]) => multipartComplete(uuid, {
        publicKey,
        baseURL,
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes
    }))
        .then((fileInfo) => {
        if (fileInfo.isReady) {
            return fileInfo;
        }
        else {
            return isReadyPoll({
                file: fileInfo.uuid,
                publicKey,
                baseURL,
                source,
                integration,
                userAgent,
                retryThrottledRequestMaxTimes,
                onProgress,
                signal
            });
        }
    })
        .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN }));
};

/**
 * Uploads file from provided data.
 */
function uploadFile(data, { publicKey, fileName, baseURL = defaultSettings.baseURL, secureSignature, secureExpire, store, signal, onProgress, source, integration, userAgent, retryThrottledRequestMaxTimes, contentType, multipartChunkSize, multipartMaxAttempts, maxConcurrentRequests, baseCDN = defaultSettings.baseCDN, checkForUrlDuplicates, saveUrlForRecurrentUploads, pusherKey }) {
    if (isFileData(data)) {
        const fileSize = getFileSize(data);
        if (isMultipart(fileSize)) {
            return uploadMultipart(data, {
                publicKey,
                contentType,
                multipartChunkSize,
                multipartMaxAttempts,
                fileName,
                baseURL,
                secureSignature,
                secureExpire,
                store,
                signal,
                onProgress,
                source,
                integration,
                userAgent,
                maxConcurrentRequests,
                retryThrottledRequestMaxTimes,
                baseCDN
            });
        }
        return uploadFromObject(data, {
            publicKey,
            fileName,
            baseURL,
            secureSignature,
            secureExpire,
            store,
            signal,
            onProgress,
            source,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes,
            baseCDN
        });
    }
    if (isUrl(data)) {
        return uploadFromUrl(data, {
            publicKey,
            fileName,
            baseURL,
            baseCDN,
            checkForUrlDuplicates,
            saveUrlForRecurrentUploads,
            secureSignature,
            secureExpire,
            store,
            signal,
            onProgress,
            source,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes,
            pusherKey
        });
    }
    if (isUuid(data)) {
        return uploadFromUploaded(data, {
            publicKey,
            fileName,
            baseURL,
            signal,
            onProgress,
            source,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes,
            baseCDN
        });
    }
    throw new TypeError(`File uploading from "${data}" is not supported`);
}

class UploadcareGroup {
    constructor(groupInfo, files) {
        this.storedAt = null;
        this.uuid = groupInfo.id;
        this.filesCount = groupInfo.filesCount;
        this.totalSize = Object.values(groupInfo.files).reduce((acc, file) => acc + file.size, 0);
        this.isStored = !!groupInfo.datetimeStored;
        this.isImage = !!Object.values(groupInfo.files).filter((file) => file.isImage).length;
        this.cdnUrl = groupInfo.cdnUrl;
        this.files = files;
        this.createdAt = groupInfo.datetimeCreated;
        this.storedAt = groupInfo.datetimeStored;
    }
}

/**
 * FileData type guard.
 */
const isFileDataArray = (data) => {
    for (const item of data) {
        if (!isFileData(item)) {
            return false;
        }
    }
    return true;
};
/**
 * Uuid type guard.
 */
const isUuidArray = (data) => {
    for (const item of data) {
        if (!isUuid(item)) {
            return false;
        }
    }
    return true;
};
/**
 * Url type guard.
 */
const isUrlArray = (data) => {
    for (const item of data) {
        if (!isUrl(item)) {
            return false;
        }
    }
    return true;
};

function uploadFileGroup(data, { publicKey, fileName, baseURL = defaultSettings.baseURL, secureSignature, secureExpire, store, signal, onProgress, source, integration, userAgent, retryThrottledRequestMaxTimes, contentType, multipartChunkSize = defaultSettings.multipartChunkSize, baseCDN = defaultSettings.baseCDN, jsonpCallback, defaultEffects }) {
    if (!isFileDataArray(data) && !isUrlArray(data) && !isUuidArray(data)) {
        throw new TypeError(`Group uploading from "${data}" is not supported`);
    }
    let progressValues;
    const filesCount = data.length;
    const createProgressHandler = (size, index) => {
        if (!onProgress)
            return;
        if (!progressValues) {
            progressValues = Array(size).fill(0);
        }
        const normalize = (values) => values.reduce((sum, next) => sum + next) / size;
        return ({ value }) => {
            progressValues[index] = value;
            onProgress({ value: normalize(progressValues) });
        };
    };
    return Promise.all(data.map((file, index) => uploadFile(file, {
        publicKey,
        fileName,
        baseURL,
        secureSignature,
        secureExpire,
        store,
        signal,
        onProgress: createProgressHandler(filesCount, index),
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes,
        contentType,
        multipartChunkSize,
        baseCDN
    }))).then((files) => {
        const uuids = files.map((file) => file.uuid);
        const addDefaultEffects = (file) => {
            const cdnUrlModifiers = defaultEffects ? `-/${defaultEffects}` : null;
            const cdnUrl = `${file.urlBase}${cdnUrlModifiers || ''}`;
            return Object.assign(Object.assign({}, file), { cdnUrlModifiers,
                cdnUrl });
        };
        const filesInGroup = defaultEffects ? files.map(addDefaultEffects) : files;
        return group(uuids, {
            publicKey,
            baseURL,
            jsonpCallback,
            secureSignature,
            secureExpire,
            signal,
            source,
            integration,
            userAgent,
            retryThrottledRequestMaxTimes
        }).then((groupInfo) => new UploadcareGroup(groupInfo, filesInGroup));
    });
}

/**
 * Populate options with settings.
 */
const populateOptionsWithSettings = (options, settings) => (Object.assign(Object.assign({}, settings), options));
class UploadClient {
    constructor(settings) {
        this.settings = Object.assign({}, defaultSettings, settings);
    }
    updateSettings(newSettings) {
        this.settings = Object.assign(this.settings, newSettings);
    }
    getSettings() {
        return this.settings;
    }
    base(file, options) {
        const settings = this.getSettings();
        return base(file, populateOptionsWithSettings(options, settings));
    }
    info(uuid, options) {
        const settings = this.getSettings();
        return info(uuid, populateOptionsWithSettings(options, settings));
    }
    fromUrl(sourceUrl, options) {
        const settings = this.getSettings();
        return fromUrl(sourceUrl, populateOptionsWithSettings(options, settings));
    }
    fromUrlStatus(token, options) {
        const settings = this.getSettings();
        return fromUrlStatus(token, populateOptionsWithSettings(options, settings));
    }
    group(uuids, options) {
        const settings = this.getSettings();
        return group(uuids, populateOptionsWithSettings(options, settings));
    }
    groupInfo(id, options) {
        const settings = this.getSettings();
        return groupInfo(id, populateOptionsWithSettings(options, settings));
    }
    multipartStart(size, options) {
        const settings = this.getSettings();
        return multipartStart(size, populateOptionsWithSettings(options, settings));
    }
    multipartUpload(part, url, options) {
        const settings = this.getSettings();
        return multipartUpload(part, url, populateOptionsWithSettings(options, settings));
    }
    multipartComplete(uuid, options) {
        const settings = this.getSettings();
        return multipartComplete(uuid, populateOptionsWithSettings(options, settings));
    }
    uploadFile(data, options) {
        const settings = this.getSettings();
        return uploadFile(data, populateOptionsWithSettings(options, settings));
    }
    uploadFileGroup(data, options) {
        const settings = this.getSettings();
        return uploadFileGroup(data, populateOptionsWithSettings(options, settings));
    }
}

export { AbortController, UploadClient, UploadClientError, UploadcareFile, UploadcareGroup, base, fromUrl, fromUrlStatus, group, groupInfo, info, multipartComplete, multipartStart, multipartUpload, uploadFromObject as uploadBase, uploadFile, uploadFileGroup, uploadFromUploaded, uploadFromUrl, uploadMultipart };
