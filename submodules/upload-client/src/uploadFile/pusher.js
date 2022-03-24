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
exports.preconnect = exports.getPusher = void 0;
var sockets_node_1 = require("../tools/sockets.node");
var fromUrlStatus_1 = require("../api/fromUrlStatus");
var events_1 = require("./events");
var response = function (type, data) {
    if (type === 'success') {
        return __assign({ status: fromUrlStatus_1.Status.Success }, data);
    }
    if (type === 'progress') {
        return __assign({ status: fromUrlStatus_1.Status.Progress }, data);
    }
    return __assign({ status: fromUrlStatus_1.Status.Error }, data);
};
var Pusher = /** @class */ (function () {
    function Pusher(pusherKey, disconnectTime) {
        if (disconnectTime === void 0) { disconnectTime = 30000; }
        this.ws = undefined;
        this.queue = [];
        this.isConnected = false;
        this.subscribers = 0;
        this.emmitter = new events_1.Events();
        this.disconnectTimeoutId = null;
        this.key = pusherKey;
        this.disconnectTime = disconnectTime;
    }
    Pusher.prototype.connect = function () {
        var _this = this;
        this.disconnectTimeoutId && clearTimeout(this.disconnectTimeoutId);
        if (!this.isConnected && !this.ws) {
            var pusherUrl = "wss://ws.pusherapp.com/app/".concat(this.key, "?protocol=5&client=js&version=1.12.2");
            this.ws = new sockets_node_1["default"](pusherUrl);
            this.ws.addEventListener('error', function (error) {
                _this.emmitter.emit('error', new Error(error.message));
            });
            this.emmitter.on('connected', function () {
                _this.isConnected = true;
                _this.queue.forEach(function (message) { return _this.send(message.event, message.data); });
                _this.queue = [];
            });
            this.ws.addEventListener('message', function (e) {
                var data = JSON.parse(e.data.toString());
                switch (data.event) {
                    case 'pusher:connection_established': {
                        _this.emmitter.emit('connected', undefined);
                        break;
                    }
                    case 'pusher:ping': {
                        _this.send('pusher:pong', {});
                        break;
                    }
                    case 'progress':
                    case 'success':
                    case 'fail': {
                        _this.emmitter.emit(data.channel, response(data.event, JSON.parse(data.data)));
                    }
                }
            });
        }
    };
    Pusher.prototype.disconnect = function () {
        var _this = this;
        var actualDisconect = function () {
            var _a;
            (_a = _this.ws) === null || _a === void 0 ? void 0 : _a.close();
            _this.ws = undefined;
            _this.isConnected = false;
        };
        if (this.disconnectTime) {
            this.disconnectTimeoutId = setTimeout(function () {
                actualDisconect();
            }, this.disconnectTime);
        }
        else {
            actualDisconect();
        }
    };
    Pusher.prototype.send = function (event, data) {
        var _a;
        var str = JSON.stringify({ event: event, data: data });
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(str);
    };
    Pusher.prototype.subscribe = function (token, handler) {
        this.subscribers += 1;
        this.connect();
        var channel = "task-status-".concat(token);
        var message = {
            event: 'pusher:subscribe',
            data: { channel: channel }
        };
        this.emmitter.on(channel, handler);
        if (this.isConnected) {
            this.send(message.event, message.data);
        }
        else {
            this.queue.push(message);
        }
    };
    Pusher.prototype.unsubscribe = function (token) {
        this.subscribers -= 1;
        var channel = "task-status-".concat(token);
        var message = {
            event: 'pusher:unsubscribe',
            data: { channel: channel }
        };
        this.emmitter.off(channel);
        if (this.isConnected) {
            this.send(message.event, message.data);
        }
        else {
            this.queue = this.queue.filter(function (msg) { return msg.data.channel !== channel; });
        }
        if (this.subscribers === 0) {
            this.disconnect();
        }
    };
    Pusher.prototype.onError = function (callback) {
        var _this = this;
        this.emmitter.on('error', callback);
        return function () { return _this.emmitter.off('error', callback); };
    };
    return Pusher;
}());
var pusher = null;
var getPusher = function (key) {
    if (!pusher) {
        // no timeout for nodeJS and 30000 ms for browser
        var disconectTimeout = typeof window === 'undefined' ? 0 : 30000;
        pusher = new Pusher(key, disconectTimeout);
    }
    return pusher;
};
exports.getPusher = getPusher;
var preconnect = function (key) {
    getPusher(key).connect();
};
exports.preconnect = preconnect;
exports["default"] = Pusher;
