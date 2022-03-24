"use strict";
exports.__esModule = true;
exports.UploadcareFile = void 0;
var camelizeKeys_1 = require("./camelizeKeys");
var UploadcareFile = /** @class */ (function () {
    function UploadcareFile(fileInfo, _a) {
        var baseCDN = _a.baseCDN, defaultEffects = _a.defaultEffects, fileName = _a.fileName;
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
        var uuid = fileInfo.uuid, s3Bucket = fileInfo.s3Bucket;
        var urlBase = s3Bucket
            ? "https://".concat(s3Bucket, ".s3.amazonaws.com/").concat(uuid, "/").concat(fileInfo.filename)
            : "".concat(baseCDN, "/").concat(uuid, "/");
        var cdnUrlModifiers = defaultEffects ? "-/".concat(defaultEffects) : null;
        var cdnUrl = "".concat(urlBase).concat(cdnUrlModifiers || '');
        var originalUrl = uuid ? urlBase : null;
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
        this.imageInfo = (0, camelizeKeys_1["default"])(fileInfo.imageInfo);
        this.videoInfo = (0, camelizeKeys_1["default"])(fileInfo.videoInfo);
    }
    return UploadcareFile;
}());
exports.UploadcareFile = UploadcareFile;
