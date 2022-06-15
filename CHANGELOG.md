# [0.3.0](https://github.com/uploadcare/uc-blocks/compare/v0.2.0...v0.3.0) (2022-06-15)

### Bug Fixes

- add `type=button` to all the buttons to prevent form submit ([e681ca5](https://github.com/uploadcare/uc-blocks/commit/e681ca5e244e4a484cedca5941974ad16696f5e2))
- **cloud-image-editor:** cropper typo ([3e5d150](https://github.com/uploadcare/uc-blocks/commit/3e5d150d15be22e7501a6aba794ca54df3402bd7))
- **FileItem:** error icon ([094eb7b](https://github.com/uploadcare/uc-blocks/commit/094eb7bb8a8a1bb9f8ff2c7a6cb5be6f628c0b92))
- TS fix ([72f6a91](https://github.com/uploadcare/uc-blocks/commit/72f6a915e820446f3affd137d428712c2a47fcfb))
- **upload-details:** handle not-uploaded images and clear canvase before preview render ([d522818](https://github.com/uploadcare/uc-blocks/commit/d522818133bd175b7c3767635923d8cc2cf87fbe))
- **upload-details:** render preview image with `format/auto` and `preview` operations ([7c30d29](https://github.com/uploadcare/uc-blocks/commit/7c30d290fa08fc62826109a880ea916ebd5e6500))
- **upload-details:** show/hide `cloud edit` button properly ([b2efe40](https://github.com/uploadcare/uc-blocks/commit/b2efe4044c9f90351146bc6040237901204d873f))

### Features

- add `--cfg-cdn-base` option ([97880d4](https://github.com/uploadcare/uc-blocks/commit/97880d4e217dec5603b79be28ca1633bc744d297))
- add `--cfg-preview-proxy` and `*previewUrlCallback` state ([633651a](https://github.com/uploadcare/uc-blocks/commit/633651a84c7361823717a22d810b60d5ed7f756f))
- add `--cfg-secure-expire` and `--cfg-secure-signature` ([0a73ab4](https://github.com/uploadcare/uc-blocks/commit/0a73ab47e28617e6b74e6f1aea4fc0687463af2c))
- add `uc-configuration` block ([a8d3c27](https://github.com/uploadcare/uc-blocks/commit/a8d3c276c8d400632dbcbaa30357d2c40a6026ef))
- **cloud-image-editor:** add separate config for the solution ([f6b1726](https://github.com/uploadcare/uc-blocks/commit/f6b172602f8b260e0c018ffc95457df64acff6e1))
- **Img:** secure delivery support ([a14baa1](https://github.com/uploadcare/uc-blocks/commit/a14baa13a6ec0512825af6b2409f9ab2d1b818f5))
- optional grouping output support ([3f9b23c](https://github.com/uploadcare/uc-blocks/commit/3f9b23cec283fe221bb790672876e4d3724ee97c))
- passthrough upload-client options ([80c2226](https://github.com/uploadcare/uc-blocks/commit/80c222679ad5a0f0fb7f8adb7cef057bbbf4b19b))

# [0.2.0](https://github.com/uploadcare/uc-blocks/compare/v0.1.3...v0.2.0) (2022-05-17)

### Bug Fixes

- app-shell backdrop fallback for Firefox ([f18ecc5](https://github.com/uploadcare/uc-blocks/commit/f18ecc5d838b996085bcfea839b40627c01a45ee))
- minor bugs ([#149](https://github.com/uploadcare/uc-blocks/issues/149)) ([d88aff7](https://github.com/uploadcare/uc-blocks/commit/d88aff71a100379af319ef6a2601720e489342d4))
- pass `cdnUrlModifiers` to the output ([#125](https://github.com/uploadcare/uc-blocks/issues/125)) ([c521c72](https://github.com/uploadcare/uc-blocks/commit/c521c72c9f2b1928191ea32b2296011bafeae78c))

### Features

- `current-activity` attr ([#124](https://github.com/uploadcare/uc-blocks/issues/124)) ([134adeb](https://github.com/uploadcare/uc-blocks/commit/134adeb1c94a8ecefbe575ca4915bbc22ff9ef92))
- `remote-tab-session-key` ([#127](https://github.com/uploadcare/uc-blocks/issues/127)) ([66ca253](https://github.com/uploadcare/uc-blocks/commit/66ca253d4045f59ef4023e48730d46ab78677e93))
- file-max-size ([#152](https://github.com/uploadcare/uc-blocks/issues/152)) ([e626a82](https://github.com/uploadcare/uc-blocks/commit/e626a82d435680ac25ce065ffe4dc51a0db89b2f))
- implement minmax files count limitation ([#143](https://github.com/uploadcare/uc-blocks/issues/143)) ([dd46f04](https://github.com/uploadcare/uc-blocks/commit/dd46f0446d79795be7075dfaed9a6a977d91b2ec))
- make `--cfg-img-only` option work ([#151](https://github.com/uploadcare/uc-blocks/issues/151)) ([fd3ff99](https://github.com/uploadcare/uc-blocks/commit/fd3ff9941e94ab43bfa24d00e4140e58f04b8dbf))
- uc-img src ([dc4bae3](https://github.com/uploadcare/uc-blocks/commit/dc4bae373a496b2faec0cd742b1f4788796b5a1b))

## [0.1.3](https://github.com/uploadcare/uc-blocks/compare/v0.1.2...v0.1.3) (2022-04-27)

### Bug Fixes

- uc-image breakpoint duplicates ([8d3b542](https://github.com/uploadcare/uc-blocks/commit/8d3b542bc870ee1a84c61f2a9be47e77b92d8d96))

## [0.1.2](https://github.com/uploadcare/uc-blocks/compare/v0.1.1...v0.1.2) (2022-04-25)

## [0.1.1](https://github.com/uploadcare/uc-blocks/compare/v0.1.0...v0.1.1) (2022-04-21)

# [0.1.0](https://github.com/uploadcare/uc-blocks/compare/v0.0.6...v0.1.0) (2022-04-21)

### Bug Fixes

- blocks page navigation ([aba948f](https://github.com/uploadcare/uc-blocks/commit/aba948f690b72645d180be7160caaea9582fd80d))
- **camera-source:** l10n fix ([ddc1abd](https://github.com/uploadcare/uc-blocks/commit/ddc1abd6ecf7103206c3224c0d92568f15e304d1))
- closing slash for uc-img src + common test updates ([7dc5e17](https://github.com/uploadcare/uc-blocks/commit/7dc5e17cfa12347c615a6fc1cee4e815aa71cd78))
- closing slash for uc-img src 2 ([50d3ce0](https://github.com/uploadcare/uc-blocks/commit/50d3ce0584d1e4336ed2b4a7348b32939b9e538d))
- cloud editor styles and behaviour ([5a3fcec](https://github.com/uploadcare/uc-blocks/commit/5a3fcecbc70bd87de0654318af128d82f093ce8d))
- **cloud-image-editor:** retry network button ([b2ff5e0](https://github.com/uploadcare/uc-blocks/commit/b2ff5e07b71ff8ec58f85a762c786786a0fb9bd9))
- edit button visibility ([c45c60f](https://github.com/uploadcare/uc-blocks/commit/c45c60f32bacbc23fc7d276cd029d4a0c22f4804))
- excess render calls for the FileItem on "Add more" ([655747a](https://github.com/uploadcare/uc-blocks/commit/655747a92fa102c91ba9a831a55ff914c0e0a58f))
- external source type ([832d269](https://github.com/uploadcare/uc-blocks/commit/832d2692c3110509670d9e9bd52698ca2c458e00))
- live-html indents ([137d6a8](https://github.com/uploadcare/uc-blocks/commit/137d6a8d9e94bd4a3bca4170326ee337442ec119))
- regular uploader demo ([149d0c2](https://github.com/uploadcare/uc-blocks/commit/149d0c2031de3eac89a6aa2e461add1ba80fc11c))
- single source flow + minimal case activity ([ff8c335](https://github.com/uploadcare/uc-blocks/commit/ff8c33542cc0ac732ffeef56317d66b1f360e4d6))
- styles for modal sizes & content scrolls ([892e3ea](https://github.com/uploadcare/uc-blocks/commit/892e3eaa7a6ab88f64496443b5bcaf5c99447105))

### Features

- app-shell (test) ([be01d8a](https://github.com/uploadcare/uc-blocks/commit/be01d8acbe04578acc65bf7d31620ecef6461989))
- app-shell (test) ([0fd91bc](https://github.com/uploadcare/uc-blocks/commit/0fd91bcc2426c43a4062d5085fc7fdec4628e533))
- github contribution templates and conditions added ([7c75ead](https://github.com/uploadcare/uc-blocks/commit/7c75eadfa3f376ad5d6354bd6a7288a543878e0f))
- single source flow handle ([a899c15](https://github.com/uploadcare/uc-blocks/commit/a899c15749b5de41dd7a790fa7fd53d90376d9d7))
- single source handle ([ad7b8ce](https://github.com/uploadcare/uc-blocks/commit/ad7b8ce41ba0bcb58a415a26f7bb3f91ccb23761))
- single source handle WIP ([5f19625](https://github.com/uploadcare/uc-blocks/commit/5f19625d962265d83e7d574ee300b809daef4a86))
- uc-image solution ([340349a](https://github.com/uploadcare/uc-blocks/commit/340349a52742c56d63e82df75dfb03f39ecd2db5))
- uc-live-html - remove excess tree indents for innerHTML ([920cbd4](https://github.com/uploadcare/uc-blocks/commit/920cbd45ba36014fae71e64c7812dcc0c15d20e1))
