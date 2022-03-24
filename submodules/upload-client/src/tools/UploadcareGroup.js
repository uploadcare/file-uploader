"use strict";
exports.__esModule = true;
exports.UploadcareGroup = void 0;
var UploadcareGroup = /** @class */ (function () {
    function UploadcareGroup(groupInfo, files) {
        this.storedAt = null;
        this.uuid = groupInfo.id;
        this.filesCount = groupInfo.filesCount;
        this.totalSize = Object.values(groupInfo.files).reduce(function (acc, file) { return acc + file.size; }, 0);
        this.isStored = !!groupInfo.datetimeStored;
        this.isImage = !!Object.values(groupInfo.files).filter(function (file) { return file.isImage; }).length;
        this.cdnUrl = groupInfo.cdnUrl;
        this.files = files;
        this.createdAt = groupInfo.datetimeCreated;
        this.storedAt = groupInfo.datetimeStored;
    }
    return UploadcareGroup;
}());
exports.UploadcareGroup = UploadcareGroup;
