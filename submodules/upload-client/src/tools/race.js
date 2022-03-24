"use strict";
exports.__esModule = true;
exports.race = void 0;
var abort_controller_1 = require("abort-controller");
var onCancel_1 = require("./onCancel");
var race = function (fns, _a) {
    var _b = _a === void 0 ? {} : _a, signal = _b.signal;
    var lastError = null;
    var winnerIndex = null;
    var controllers = fns.map(function () { return new abort_controller_1.AbortController(); });
    var createStopRaceCallback = function (i) { return function () {
        winnerIndex = i;
        controllers.forEach(function (controller, index) { return index !== i && controller.abort(); });
    }; };
    (0, onCancel_1.onCancel)(signal, function () {
        controllers.forEach(function (controller) { return controller.abort(); });
    });
    return Promise.all(fns.map(function (fn, i) {
        var stopRace = createStopRaceCallback(i);
        return Promise.resolve()
            .then(function () { return fn({ stopRace: stopRace, signal: controllers[i].signal }); })
            .then(function (result) {
            stopRace();
            return result;
        })["catch"](function (error) {
            lastError = error;
            return null;
        });
    })).then(function (results) {
        if (winnerIndex === null) {
            throw lastError;
        }
        else {
            return results[winnerIndex];
        }
    });
};
exports.race = race;
