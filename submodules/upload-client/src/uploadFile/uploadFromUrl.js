"use strict";
exports.__esModule = true;
var fromUrlStatus_1 = require("../api/fromUrlStatus");
var fromUrl_1 = require("../api/fromUrl");
var errors_1 = require("../tools/errors");
var poll_1 = require("../tools/poll");
var race_1 = require("../tools/race");
var isReadyPoll_1 = require("../tools/isReadyPoll");
var defaultSettings_1 = require("../defaultSettings");
var onCancel_1 = require("../tools/onCancel");
var pusher_1 = require("./pusher");
var UploadcareFile_1 = require("../tools/UploadcareFile");
function pollStrategy(_a) {
    var token = _a.token, publicKey = _a.publicKey, baseURL = _a.baseURL, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, onProgress = _a.onProgress, signal = _a.signal;
    return (0, poll_1.poll)({
        check: function (signal) {
            return (0, fromUrlStatus_1["default"])(token, {
                publicKey: publicKey,
                baseURL: baseURL,
                integration: integration,
                userAgent: userAgent,
                retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
                signal: signal
            }).then(function (response) {
                switch (response.status) {
                    case fromUrlStatus_1.Status.Error: {
                        return new errors_1.UploadClientError(response.error, response.errorCode);
                    }
                    case fromUrlStatus_1.Status.Waiting: {
                        return false;
                    }
                    case fromUrlStatus_1.Status.Unknown: {
                        return new errors_1.UploadClientError("Token \"".concat(token, "\" was not found."));
                    }
                    case fromUrlStatus_1.Status.Progress: {
                        if (onProgress) {
                            if (response.total === 'unknown') {
                                onProgress({ isComputable: false });
                            }
                            else {
                                onProgress({
                                    isComputable: true,
                                    value: response.done / response.total
                                });
                            }
                        }
                        return false;
                    }
                    case fromUrlStatus_1.Status.Success: {
                        if (onProgress)
                            onProgress({
                                isComputable: true,
                                value: response.done / response.total
                            });
                        return response;
                    }
                    default: {
                        throw new Error('Unknown status');
                    }
                }
            });
        },
        signal: signal
    });
}
var pushStrategy = function (_a) {
    var token = _a.token, pusherKey = _a.pusherKey, signal = _a.signal, onProgress = _a.onProgress;
    return new Promise(function (resolve, reject) {
        var pusher = (0, pusher_1.getPusher)(pusherKey);
        var unsubErrorHandler = pusher.onError(reject);
        var destroy = function () {
            unsubErrorHandler();
            pusher.unsubscribe(token);
        };
        (0, onCancel_1.onCancel)(signal, function () {
            destroy();
            reject((0, errors_1.cancelError)('pusher cancelled'));
        });
        pusher.subscribe(token, function (result) {
            switch (result.status) {
                case fromUrlStatus_1.Status.Progress: {
                    if (onProgress) {
                        if (result.total === 'unknown') {
                            onProgress({ isComputable: false });
                        }
                        else {
                            onProgress({
                                isComputable: true,
                                value: result.done / result.total
                            });
                        }
                    }
                    break;
                }
                case fromUrlStatus_1.Status.Success: {
                    destroy();
                    if (onProgress)
                        onProgress({
                            isComputable: true,
                            value: result.done / result.total
                        });
                    resolve(result);
                    break;
                }
                case fromUrlStatus_1.Status.Error: {
                    destroy();
                    reject(new errors_1.UploadClientError(result.msg, result.error_code));
                }
            }
        });
    });
};
var uploadFromUrl = function (sourceUrl, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, baseURL = _a.baseURL, baseCDN = _a.baseCDN, checkForUrlDuplicates = _a.checkForUrlDuplicates, saveUrlForRecurrentUploads = _a.saveUrlForRecurrentUploads, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, onProgress = _a.onProgress, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, _b = _a.pusherKey, pusherKey = _b === void 0 ? defaultSettings_1["default"].pusherKey : _b;
    return Promise.resolve((0, pusher_1.preconnect)(pusherKey))
        .then(function () {
        return (0, fromUrl_1["default"])(sourceUrl, {
            publicKey: publicKey,
            fileName: fileName,
            baseURL: baseURL,
            checkForUrlDuplicates: checkForUrlDuplicates,
            saveUrlForRecurrentUploads: saveUrlForRecurrentUploads,
            secureSignature: secureSignature,
            secureExpire: secureExpire,
            store: store,
            signal: signal,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
        });
    })["catch"](function (error) {
        var pusher = (0, pusher_1.getPusher)(pusherKey);
        pusher === null || pusher === void 0 ? void 0 : pusher.disconnect();
        return Promise.reject(error);
    })
        .then(function (urlResponse) {
        if (urlResponse.type === fromUrl_1.TypeEnum.FileInfo) {
            return urlResponse;
        }
        else {
            return (0, race_1.race)([
                function (_a) {
                    var signal = _a.signal;
                    return pollStrategy({
                        token: urlResponse.token,
                        publicKey: publicKey,
                        baseURL: baseURL,
                        integration: integration,
                        userAgent: userAgent,
                        retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
                        onProgress: onProgress,
                        signal: signal
                    });
                },
                function (_a) {
                    var signal = _a.signal;
                    return pushStrategy({
                        token: urlResponse.token,
                        pusherKey: pusherKey,
                        signal: signal,
                        onProgress: onProgress
                    });
                }
            ], { signal: signal });
        }
    })
        .then(function (result) {
        if (result instanceof errors_1.UploadClientError)
            throw result;
        return result;
    })
        .then(function (result) {
        return (0, isReadyPoll_1.isReadyPoll)({
            file: result.uuid,
            publicKey: publicKey,
            baseURL: baseURL,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
            onProgress: onProgress,
            signal: signal
        });
    })
        .then(function (fileInfo) { return new UploadcareFile_1.UploadcareFile(fileInfo, { baseCDN: baseCDN }); });
};
exports["default"] = uploadFromUrl;
