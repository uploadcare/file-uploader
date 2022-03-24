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
var defaultSettings_1 = require("./defaultSettings");
var base_1 = require("./api/base");
var info_1 = require("./api/info");
var fromUrl_1 = require("./api/fromUrl");
var fromUrlStatus_1 = require("./api/fromUrlStatus");
var group_1 = require("./api/group");
var groupInfo_1 = require("./api/groupInfo");
var multipartStart_1 = require("./api/multipartStart");
var multipartComplete_1 = require("./api/multipartComplete");
var multipartUpload_1 = require("./api/multipartUpload");
var uploadFile_1 = require("./uploadFile");
var uploadFileGroup_1 = require("./uploadFileGroup");
/**
 * Populate options with settings.
 */
var populateOptionsWithSettings = function (options, settings) { return (__assign(__assign({}, settings), options)); };
var UploadClient = /** @class */ (function () {
    function UploadClient(settings) {
        this.settings = Object.assign({}, defaultSettings_1["default"], settings);
    }
    UploadClient.prototype.updateSettings = function (newSettings) {
        this.settings = Object.assign(this.settings, newSettings);
    };
    UploadClient.prototype.getSettings = function () {
        return this.settings;
    };
    UploadClient.prototype.base = function (file, options) {
        var settings = this.getSettings();
        return (0, base_1["default"])(file, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.info = function (uuid, options) {
        var settings = this.getSettings();
        return (0, info_1["default"])(uuid, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.fromUrl = function (sourceUrl, options) {
        var settings = this.getSettings();
        return (0, fromUrl_1["default"])(sourceUrl, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.fromUrlStatus = function (token, options) {
        var settings = this.getSettings();
        return (0, fromUrlStatus_1["default"])(token, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.group = function (uuids, options) {
        var settings = this.getSettings();
        return (0, group_1["default"])(uuids, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.groupInfo = function (id, options) {
        var settings = this.getSettings();
        return (0, groupInfo_1["default"])(id, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.multipartStart = function (size, options) {
        var settings = this.getSettings();
        return (0, multipartStart_1["default"])(size, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.multipartUpload = function (part, url, options) {
        var settings = this.getSettings();
        return (0, multipartUpload_1["default"])(part, url, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.multipartComplete = function (uuid, options) {
        var settings = this.getSettings();
        return (0, multipartComplete_1["default"])(uuid, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.uploadFile = function (data, options) {
        var settings = this.getSettings();
        return (0, uploadFile_1.uploadFile)(data, populateOptionsWithSettings(options, settings));
    };
    UploadClient.prototype.uploadFileGroup = function (data, options) {
        var settings = this.getSettings();
        return (0, uploadFileGroup_1["default"])(data, populateOptionsWithSettings(options, settings));
    };
    return UploadClient;
}());
exports["default"] = UploadClient;
