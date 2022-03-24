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
exports.cancelError = exports.UploadClientError = void 0;
var UploadClientError = /** @class */ (function (_super) {
    __extends(UploadClientError, _super);
    function UploadClientError(message, code, request, response, headers) {
        var _this = _super.call(this) || this;
        _this.name = 'UploadClientError';
        _this.message = message;
        _this.code = code;
        _this.request = request;
        _this.response = response;
        _this.headers = headers;
        Object.setPrototypeOf(_this, UploadClientError.prototype);
        return _this;
    }
    return UploadClientError;
}(Error));
exports.UploadClientError = UploadClientError;
var cancelError = function (message) {
    if (message === void 0) { message = 'Request canceled'; }
    var error = new UploadClientError(message);
    error.isCancel = true;
    return error;
};
exports.cancelError = cancelError;
