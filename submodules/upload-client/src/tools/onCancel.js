"use strict";
exports.__esModule = true;
exports.onCancel = void 0;
var onCancel = function (signal, callback) {
    if (signal) {
        if (signal.aborted) {
            Promise.resolve().then(callback);
        }
        else {
            signal.addEventListener('abort', function () { return callback(); }, { once: true });
        }
    }
};
exports.onCancel = onCancel;
