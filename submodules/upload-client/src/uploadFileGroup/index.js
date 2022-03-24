"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
var uploadFile_1 = require("../uploadFile");
var defaultSettings_1 = require("../defaultSettings");
var group_1 = require("../api/group");
var UploadcareGroup_1 = require("../tools/UploadcareGroup");
/* Types */
var types_1 = require("./types");
function uploadFileGroup(data, _a) {
    var publicKey = _a.publicKey, fileName = _a.fileName, _b = _a.baseURL, baseURL = _b === void 0 ? defaultSettings_1["default"].baseURL : _b, secureSignature = _a.secureSignature, secureExpire = _a.secureExpire, store = _a.store, signal = _a.signal, onProgress = _a.onProgress, source = _a.source, integration = _a.integration, userAgent = _a.userAgent, retryThrottledRequestMaxTimes = _a.retryThrottledRequestMaxTimes, contentType = _a.contentType, _c = _a.multipartChunkSize, multipartChunkSize = _c === void 0 ? defaultSettings_1["default"].multipartChunkSize : _c, _d = _a.baseCDN, baseCDN = _d === void 0 ? defaultSettings_1["default"].baseCDN : _d, jsonpCallback = _a.jsonpCallback, defaultEffects = _a.defaultEffects;
    if (!(0, types_1.isFileDataArray)(data) && !(0, types_1.isUrlArray)(data) && !(0, types_1.isUuidArray)(data)) {
        throw new TypeError("Group uploading from \"".concat(data, "\" is not supported"));
    }
    var progressValues;
    var isStillComputable = true;
    var filesCount = data.length;
    var createProgressHandler = function (size, index) {
        if (!onProgress)
            return;
        if (!progressValues) {
            progressValues = Array(size).fill(0);
        }
        var normalize = function (values) {
            return values.reduce(function (sum, next) { return sum + next; }) / size;
        };
        return function (info) {
            if (!info.isComputable || !isStillComputable) {
                isStillComputable = false;
                onProgress({ isComputable: false });
                return;
            }
            progressValues[index] = info.value;
            onProgress({ isComputable: true, value: normalize(progressValues) });
        };
    };
    return Promise.all(data.map(function (file, index) {
        return (0, uploadFile_1.uploadFile)(file, {
            publicKey: publicKey,
            fileName: fileName,
            baseURL: baseURL,
            secureSignature: secureSignature,
            secureExpire: secureExpire,
            store: store,
            signal: signal,
            onProgress: createProgressHandler(filesCount, index),
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes,
            contentType: contentType,
            multipartChunkSize: multipartChunkSize,
            baseCDN: baseCDN
        });
    })).then(function (files) {
        var uuids = files.map(function (file) { return file.uuid; });
        var addDefaultEffects = function (file) {
            var cdnUrlModifiers = defaultEffects ? "-/".concat(defaultEffects) : null;
            var cdnUrl = "".concat(file.urlBase).concat(cdnUrlModifiers || '');
            return __assign(__assign({}, file), { cdnUrlModifiers: cdnUrlModifiers, cdnUrl: cdnUrl });
        };
        var filesInGroup = defaultEffects ? files.map(addDefaultEffects) : files;
        return (0, group_1["default"])(uuids, {
            publicKey: publicKey,
            baseURL: baseURL,
            jsonpCallback: jsonpCallback,
            secureSignature: secureSignature,
            secureExpire: secureExpire,
            signal: signal,
            source: source,
            integration: integration,
            userAgent: userAgent,
            retryThrottledRequestMaxTimes: retryThrottledRequestMaxTimes
        })
            .then(function (groupInfo) { return new UploadcareGroup_1.UploadcareGroup(groupInfo, filesInGroup); })
            .then(function (group) {
            onProgress && onProgress({ isComputable: true, value: 1 });
            return group;
        });
    });
}
exports["default"] = uploadFileGroup;
