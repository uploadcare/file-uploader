"use strict";
exports.__esModule = true;
exports.sliceChunk = void 0;
var sliceChunk = function (file, index, fileSize, chunkSize) {
    var start = chunkSize * index;
    var end = Math.min(start + chunkSize, fileSize);
    return file.slice(start, end);
};
exports.sliceChunk = sliceChunk;
