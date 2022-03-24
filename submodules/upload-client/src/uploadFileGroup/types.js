"use strict";
exports.__esModule = true;
exports.isUrlArray = exports.isUuidArray = exports.isFileDataArray = void 0;
var types_1 = require("../uploadFile/types");
/**
 * FileData type guard.
 */
var isFileDataArray = function (data) {
    for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
        var item = data_1[_i];
        if (!(0, types_1.isFileData)(item)) {
            return false;
        }
    }
    return true;
};
exports.isFileDataArray = isFileDataArray;
/**
 * Uuid type guard.
 */
var isUuidArray = function (data) {
    for (var _i = 0, data_2 = data; _i < data_2.length; _i++) {
        var item = data_2[_i];
        if (!(0, types_1.isUuid)(item)) {
            return false;
        }
    }
    return true;
};
exports.isUuidArray = isUuidArray;
/**
 * Url type guard.
 */
var isUrlArray = function (data) {
    for (var _i = 0, data_3 = data; _i < data_3.length; _i++) {
        var item = data_3[_i];
        if (!(0, types_1.isUrl)(item)) {
            return false;
        }
    }
    return true;
};
exports.isUrlArray = isUrlArray;
