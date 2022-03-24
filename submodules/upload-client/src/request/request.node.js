"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var http_1 = require("http");
var https_1 = require("https");
var url_1 = require("url");
var stream_1 = require("stream");
var errors_1 = require("../tools/errors");
var onCancel_1 = require("../tools/onCancel");
// ProgressEmitter is a simple PassThrough-style transform stream which keeps
// track of the number of bytes which have been piped through it and will
// invoke the `onprogress` function whenever new number are available.
var ProgressEmitter = /** @class */ (function (_super) {
    __extends(ProgressEmitter, _super);
    function ProgressEmitter(onProgress, size) {
        var _this = _super.call(this) || this;
        _this._onprogress = onProgress;
        _this._position = 0;
        _this.size = size;
        return _this;
    }
    ProgressEmitter.prototype._transform = function (chunk, encoding, callback) {
        this._position += chunk.length;
        this._onprogress({
            isComputable: true,
            value: this._position / this.size
        });
        callback(null, chunk);
    };
    return ProgressEmitter;
}(stream_1.Transform));
var getLength = function (formData) {
    return new Promise(function (resolve, reject) {
        formData.getLength(function (error, length) {
            if (error)
                reject(error);
            else
                resolve(length);
        });
    });
};
function isFormData(formData) {
    if (formData && formData.toString() === '[object FormData]') {
        return true;
    }
    return false;
}
function isReadable(data, isFormData) {
    if (data && (data instanceof stream_1.Readable || isFormData)) {
        return true;
    }
    return false;
}
var request = function (params) {
    var _a = params.method, method = _a === void 0 ? 'GET' : _a, url = params.url, data = params.data, _b = params.headers, headers = _b === void 0 ? {} : _b, signal = params.signal, onProgress = params.onProgress;
    return Promise.resolve()
        .then(function () {
        if (isFormData(data)) {
            return getLength(data);
        }
        else {
            return undefined;
        }
    })
        .then(function (length) {
        return new Promise(function (resolve, reject) {
            var isFormData = !!length;
            var aborted = false;
            var options = (0, url_1.parse)(url);
            options.method = method;
            options.headers = isFormData
                ? Object.assign(data.getHeaders(), headers)
                : headers;
            if (isFormData || (data && data.length)) {
                options.headers['Content-Length'] =
                    length || data.length;
            }
            var req = options.protocol !== 'https:'
                ? http_1["default"].request(options)
                : https_1["default"].request(options);
            (0, onCancel_1.onCancel)(signal, function () {
                aborted = true;
                req.abort();
                reject((0, errors_1.cancelError)());
            });
            req.on('response', function (res) {
                if (aborted)
                    return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                var resChunks = [];
                res.on('data', function (data) {
                    resChunks.push(data);
                });
                res.on('end', function () {
                    return resolve({
                        data: Buffer.concat(resChunks).toString('utf8'),
                        status: res.statusCode,
                        headers: res.headers,
                        request: params
                    });
                });
            });
            req.on('error', function (err) {
                if (aborted)
                    return;
                reject(err);
            });
            if (isReadable(data, isFormData)) {
                if (onProgress && length) {
                    data.pipe(new ProgressEmitter(onProgress, length)).pipe(req);
                }
                else {
                    data.pipe(req);
                }
            }
            else {
                req.end(data);
            }
        });
    });
};
exports["default"] = request;
