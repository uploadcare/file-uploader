"use strict";
exports.__esModule = true;
exports.prepareChunks = void 0;
var sliceChunk_1 = require("./sliceChunk");
function prepareChunks(file, fileSize, chunkSize) {
    return function (index) {
        return (0, sliceChunk_1.sliceChunk)(file, index, fileSize, chunkSize);
    };
}
exports.prepareChunks = prepareChunks;
