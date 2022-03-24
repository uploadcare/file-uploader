"use strict";
exports.__esModule = true;
exports.Events = void 0;
var Events = /** @class */ (function () {
    function Events() {
        this.events = Object.create({});
    }
    Events.prototype.emit = function (event, data) {
        var _a;
        (_a = this.events[event]) === null || _a === void 0 ? void 0 : _a.forEach(function (fn) { return fn(data); });
    };
    Events.prototype.on = function (event, callback) {
        this.events[event] = this.events[event] || [];
        this.events[event].push(callback);
    };
    Events.prototype.off = function (event, callback) {
        if (callback) {
            this.events[event] = this.events[event].filter(function (fn) { return fn !== callback; });
        }
        else {
            this.events[event] = [];
        }
    };
    return Events;
}());
exports.Events = Events;
