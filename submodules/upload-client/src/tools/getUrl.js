"use strict";
exports.__esModule = true;
var serializePair = function (key, value) {
    return typeof value !== 'undefined' ? "".concat(key, "=").concat(encodeURIComponent(value)) : null;
};
var createQuery = function (query) {
    return Object.entries(query)
        .reduce(function (params, _a) {
        var key = _a[0], value = _a[1];
        return params.concat(Array.isArray(value)
            ? value.map(function (value) { return serializePair("".concat(key, "[]"), value); })
            : serializePair(key, value));
    }, [])
        .filter(function (x) { return !!x; })
        .join('&');
};
var getUrl = function (base, path, query) {
    return [
        base,
        path,
        query && Object.keys(query).length > 0 ? '?' : '',
        query && createQuery(query)
    ]
        .filter(Boolean)
        .join('');
};
exports["default"] = getUrl;
