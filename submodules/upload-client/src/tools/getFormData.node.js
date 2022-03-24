"use strict";
exports.__esModule = true;
exports.transformFile = void 0;
var form_data_1 = require("form-data");
var identity_1 = require("./identity");
exports.transformFile = identity_1.identity;
exports["default"] = (function () { return new form_data_1["default"](); });
