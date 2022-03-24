"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
var runWithConcurrency = function (concurrency, tasks) {
    return new Promise(function (resolve, reject) {
        var results = [];
        var rejected = false;
        var settled = tasks.length;
        var forRun = __spreadArray([], tasks, true);
        var run = function () {
            var index = tasks.length - forRun.length;
            var next = forRun.shift();
            if (next) {
                next()
                    .then(function (result) {
                    if (rejected)
                        return;
                    results[index] = result;
                    settled -= 1;
                    if (settled) {
                        run();
                    }
                    else {
                        resolve(results);
                    }
                })["catch"](function (error) {
                    rejected = true;
                    reject(error);
                });
            }
        };
        for (var i = 0; i < concurrency; i++) {
            run();
        }
    });
};
exports["default"] = runWithConcurrency;
