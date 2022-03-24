"use strict";
exports.__esModule = true;
var getFormData_node_1 = require("./getFormData.node");
var isFileTuple = function (tuple) {
    return tuple[0] === 'file';
};
function buildFormData(body) {
    var formData = (0, getFormData_node_1["default"])();
    var _loop_1 = function (tuple) {
        if (Array.isArray(tuple[1])) {
            // refactor this
            tuple[1].forEach(function (val) { return val && formData.append(tuple[0] + '[]', "".concat(val)); });
        }
        else if (isFileTuple(tuple)) {
            var name_1 = tuple[2];
            var file = (0, getFormData_node_1.transformFile)(tuple[1], name_1); // lgtm[js/superfluous-trailing-arguments]
            formData.append(tuple[0], file, name_1);
        }
        else if (tuple[1] != null) {
            formData.append(tuple[0], "".concat(tuple[1]));
        }
    };
    for (var _i = 0, body_1 = body; _i < body_1.length; _i++) {
        var tuple = body_1[_i];
        _loop_1(tuple);
    }
    return formData;
}
exports["default"] = buildFormData;
