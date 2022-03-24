"use strict";
exports.__esModule = true;
exports.poll = void 0;
var errors_1 = require("./errors");
var onCancel_1 = require("../tools/onCancel");
var DEFAULT_INTERVAL = 500;
var poll = function (_a) {
    var check = _a.check, _b = _a.interval, interval = _b === void 0 ? DEFAULT_INTERVAL : _b, signal = _a.signal;
    return new Promise(function (resolve, reject) {
        var timeoutId;
        (0, onCancel_1.onCancel)(signal, function () {
            timeoutId && clearTimeout(timeoutId);
            reject((0, errors_1.cancelError)('Poll cancelled'));
        });
        var tick = function () {
            try {
                Promise.resolve(check(signal))
                    .then(function (result) {
                    if (result) {
                        resolve(result);
                    }
                    else {
                        timeoutId = setTimeout(tick, interval);
                    }
                })["catch"](function (error) { return reject(error); });
            }
            catch (error) {
                reject(error);
            }
        };
        timeoutId = setTimeout(tick, 0);
    });
};
exports.poll = poll;
