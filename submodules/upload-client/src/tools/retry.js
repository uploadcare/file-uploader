"use strict";
exports.__esModule = true;
var delay_1 = require("./delay");
var defaultOptions = {
    factor: 2,
    time: 100
};
function retrier(fn, options) {
    if (options === void 0) { options = defaultOptions; }
    var attempts = 0;
    function runAttempt(fn) {
        var defaultDelayTime = Math.round(options.time * Math.pow(options.factor, attempts));
        var retry = function (ms) {
            return (0, delay_1.delay)(ms !== null && ms !== void 0 ? ms : defaultDelayTime).then(function () {
                attempts += 1;
                return runAttempt(fn);
            });
        };
        return fn({
            attempt: attempts,
            retry: retry
        });
    }
    return runAttempt(fn);
}
exports["default"] = retrier;
