"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.UploadClientError = exports.UploadcareGroup = exports.UploadcareFile = exports.AbortController = exports.UploadClient = exports.uploadFileGroup = exports.uploadMultipart = exports.uploadFromUploaded = exports.uploadBase = exports.uploadFromUrl = exports.uploadFile = exports.multipartComplete = exports.multipartUpload = exports.multipartStart = exports.info = exports.groupInfo = exports.group = exports.fromUrlStatus = exports.fromUrl = exports.base = void 0;
/* Low-Level API */
var base_1 = require("./api/base");
__createBinding(exports, base_1, "default", "base");
var fromUrl_1 = require("./api/fromUrl");
__createBinding(exports, fromUrl_1, "default", "fromUrl");
var fromUrlStatus_1 = require("./api/fromUrlStatus");
__createBinding(exports, fromUrlStatus_1, "default", "fromUrlStatus");
var group_1 = require("./api/group");
__createBinding(exports, group_1, "default", "group");
var groupInfo_1 = require("./api/groupInfo");
__createBinding(exports, groupInfo_1, "default", "groupInfo");
var info_1 = require("./api/info");
__createBinding(exports, info_1, "default", "info");
var multipartStart_1 = require("./api/multipartStart");
__createBinding(exports, multipartStart_1, "default", "multipartStart");
var multipartUpload_1 = require("./api/multipartUpload");
__createBinding(exports, multipartUpload_1, "default", "multipartUpload");
var multipartComplete_1 = require("./api/multipartComplete");
__createBinding(exports, multipartComplete_1, "default", "multipartComplete");
/* High-Level API */
var uploadFile_1 = require("./uploadFile");
__createBinding(exports, uploadFile_1, "uploadFile");
__createBinding(exports, uploadFile_1, "uploadFromUrl");
__createBinding(exports, uploadFile_1, "uploadBase");
__createBinding(exports, uploadFile_1, "uploadFromUploaded");
__createBinding(exports, uploadFile_1, "uploadMultipart");
var uploadFileGroup_1 = require("./uploadFileGroup");
__createBinding(exports, uploadFileGroup_1, "default", "uploadFileGroup");
/* Helpers */
var UploadClient_1 = require("./UploadClient");
__createBinding(exports, UploadClient_1, "default", "UploadClient");
var abort_controller_1 = require("abort-controller");
__createBinding(exports, abort_controller_1, "AbortController");
/* Types */
var UploadcareFile_1 = require("./tools/UploadcareFile");
__createBinding(exports, UploadcareFile_1, "UploadcareFile");
var UploadcareGroup_1 = require("./tools/UploadcareGroup");
__createBinding(exports, UploadcareGroup_1, "UploadcareGroup");
var errors_1 = require("./tools/errors");
__createBinding(exports, errors_1, "UploadClientError");
