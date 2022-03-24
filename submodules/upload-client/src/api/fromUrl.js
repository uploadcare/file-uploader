"use strict";
exports.__esModule = true;
exports.isFileInfoResponse = exports.isTokenResponse = exports.TypeEnum = void 0;
var request_node_1 = require("../request/request.node");
var getUrl_1 = require("../tools/getUrl");
var defaultSettings_1 = require("../defaultSettings");
var userAgent_1 = require("../tools/userAgent");
var camelizeKeys_1 = require("../tools/camelizeKeys");
var errors_1 = require("../tools/errors");
var retryIfThrottled_1 = require("../tools/retryIfThrottled");
var TypeEnum;
(function (TypeEnum) {
    TypeEnum["Token"] = "token";
    TypeEnum["FileInfo"] = "file_info";
})(TypeEnum = exports.TypeEnum || (exports.TypeEnum = {}));
/**
 * TokenResponse Type Guard.
 */
var isTokenResponse = function (response) {
    return response.type !== undefined && response.type === TypeEnum.Token;
};
exports.isTokenResponse = isTokenResponse;
/**
 * FileInfoResponse Type Guard.
 */
var isFileInfoResponse = function (response) {
    return response.type !== undefined && response.type === TypeEnum.FileInfo;
};
exports.isFileInfoResponse = isFileInfoResponse;
/**
 * Uploading files from URL.
 */
function fromUrl(sourceUrl, _a) {
    var publicKey = _a.publicKey, _b = _a.baseURL, baseURL = _b === void 0 ? defaultSettings_1["default"].baseURL : _b, store = _a.store, fileName = _a.fileName, checkForUrlDuplicates = _a.checkForUrlDuplicates, saveUrlForRecurrentUploads = _a.saveUrlForRecurrentUploads, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, _c = _a.source, source = _c === void 0 ? 'url' : _c, signal = _a.signal, integration = _a.integration, userAgent = _a.userAgent, _d = _a.retryThrottledRequestMaxTimes, retryThrottledRequestMaxTimes = _d === void 0 ? defaultSettings_1["default"].retryThrottledRequestMaxTimes : _d;
    return (0, retryIfThrottled_1["default"])(function () {
        return (0, request_node_1["default"])({
            method: 'POST',
            headers: {
                'X-UC-User-Agent': (0, userAgent_1.getUserAgent)({ publicKey: publicKey, integration: integration, userAgent: userAgent })
            },
            url: (0, getUrl_1["default"])(baseURL, '/from_url/', {
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
            signal: signal
        }).then(function (_a) {
            var data = _a.data, headers = _a.headers, request = _a.request;
            var response = (0, camelizeKeys_1["default"])(JSON.parse(data));
            if ('error' in response) {
                throw new errors_1.UploadClientError(response.error.content, response.error.errorCode, request, response, headers);
            }
            else {
                return response;
            }
        });
    }, retryThrottledRequestMaxTimes);
}
exports["default"] = fromUrl;
