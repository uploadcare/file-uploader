"use strict";
exports.__esModule = true;
exports.getUserAgent = void 0;
var version_1 = require("../version");
/**
 * Returns User Agent based on version and settings.
 */
function getUserAgent(_a) {
    var _b = _a === void 0 ? {} : _a, userAgent = _b.userAgent, _c = _b.publicKey, publicKey = _c === void 0 ? '' : _c, _d = _b.integration, integration = _d === void 0 ? '' : _d;
    var libraryName = 'UploadcareUploadClient';
    var libraryVersion = version_1["default"];
    var languageName = 'JavaScript';
    if (typeof userAgent === 'string') {
        return userAgent;
    }
    if (typeof userAgent === 'function') {
        return userAgent({
            publicKey: publicKey,
            libraryName: libraryName,
            libraryVersion: libraryVersion,
            languageName: languageName,
            integration: integration
        });
    }
    var mainInfo = [libraryName, libraryVersion, publicKey]
        .filter(Boolean)
        .join('/');
    var additionInfo = [languageName, integration].filter(Boolean).join('; ');
    return "".concat(mainInfo, " (").concat(additionInfo, ")");
}
exports.getUserAgent = getUserAgent;
