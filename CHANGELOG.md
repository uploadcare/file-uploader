# [1.37.0](https://github.com/uploadcare/file-uploader/compare/v1.36.1...v1.37.0) (2026-11-24)


### Bug Fixes

* **a11y:** drop aria-modal from the uc-modal host and name its dialog ([306fad8](https://github.com/uploadcare/file-uploader/commit/306fad8aea37d9fdd3a865cae17f440bd2453c23))
* **a11y:** focus the dialog's first control when a modal opens ([8ba5003](https://github.com/uploadcare/file-uploader/commit/8ba5003edb54bc9f4cfdd6a5d1f0afe80dd305b7))
* **a11y:** make the clickable drop area keyboard-operable ([9688ca0](https://github.com/uploadcare/file-uploader/commit/9688ca050737f50c1753a0ac9614c91ff65abcfa))
* **a11y:** make the editor's tab toggles real tabs ([ce8b1fc](https://github.com/uploadcare/file-uploader/commit/ce8b1fcf55c14d98400e4c06d19ae09a8af7ea06))
* **a11y:** mark the uc-thumb preview as decorative ([2d9b53c](https://github.com/uploadcare/file-uploader/commit/2d9b53c02fe579f60f88f8fc9adcd880b0feb726))
* **a11y:** name the camera's icon-only buttons ([347fd1d](https://github.com/uploadcare/file-uploader/commit/347fd1d8475f99d025f3aa3e78c7b74dd3c00eae))
* **a11y:** name the dropdown trigger and the external-source iframe ([6592dda](https://github.com/uploadcare/file-uploader/commit/6592dda51df23f6489303d9eeb3f590e3433434a))
* **a11y:** name the editor's range slider after its operation ([274519a](https://github.com/uploadcare/file-uploader/commit/274519ae8a0e29fb321b6f35d280dc2c0004797a))
* **a11y:** put dynamic-button menuitem roles on the focusable button ([4802313](https://github.com/uploadcare/file-uploader/commit/4802313ca2eb314d1b7f63c0a977400f7451798b))
* **a11y:** restore 1.35's first focus stop when a modal opens ([e9489c0](https://github.com/uploadcare/file-uploader/commit/e9489c0e3febcf8fe65db2218a2c839bfcab3c4d))
* **a11y:** stop making every uc-file-item row a live region ([3a5d344](https://github.com/uploadcare/file-uploader/commit/3a5d34443bfe5f2cf8e1f0195782d60c8aeb18a8))
* **activity:** find the enclosing modal by its uc-modal attribute too ([c4c0947](https://github.com/uploadcare/file-uploader/commit/c4c0947b71aafd51c2f5813a5ce28568b4ac5f3f))
* **api:** accept a Blob in addFileFromObject, as documented ([abec9ab](https://github.com/uploadcare/file-uploader/commit/abec9aba37be8911528e793324c88c8da2cb2d73))
* **api:** bind the openSystemDialog file input to the ctx lifetime ([c8c4979](https://github.com/uploadcare/file-uploader/commit/c8c49795f78241b40dc194fe7e08fe83c52ff5d1))
* **api:** clear the activity params when setCurrentActivity gets none ([5a2d3c3](https://github.com/uploadcare/file-uploader/commit/5a2d3c38c8c0797789be95374ff4aa6d2d3429a8))
* **api:** don't start the batch again for a file whose upload failed ([edbb124](https://github.com/uploadcare/file-uploader/commit/edbb124935f00f122faba9c5193b36ffa06c1ff9))
* **api:** explain an OutputCollectionState read after its uploader is gone ([b5cc2f6](https://github.com/uploadcare/file-uploader/commit/b5cc2f6101a520f64303c2458587b74d51b73268))
* **api:** keep initFlow from opening the modal slot on the inline uploader ([f8267e3](https://github.com/uploadcare/file-uploader/commit/f8267e39ce4a9c26545fdd46ab9fb5162b2bdeba))
* **api:** let doneFlow land on the done activity without closing first ([a855e11](https://github.com/uploadcare/file-uploader/commit/a855e11e78538b41ea47fcb3071087129df9b869))
* **api:** let go of a replaced openSystemDialog input ([8fecf20](https://github.com/uploadcare/file-uploader/commit/8fecf205244296def6d9c4ae16b18b8bfa0be60a))
* **api:** let navigate() open an activity whose params are all optional ([ff32e96](https://github.com/uploadcare/file-uploader/commit/ff32e9658ae76d505e722aab93e279a6b63ed4fd))
* **api:** let setCurrentActivity switch an open modal, as in v1 ([ad62913](https://github.com/uploadcare/file-uploader/commit/ad62913e5bc464b1c0c78172288a7796a063bfd3))
* **api:** let uploadAll take a file whose validators are still running ([76a4aee](https://github.com/uploadcare/file-uploader/commit/76a4aee89c16e98a0a31ef8d9ba654884a3daaa9))
* **api:** make api.cfg read-only again ([e47c502](https://github.com/uploadcare/file-uploader/commit/e47c50222a1d36f8b681e22dec2180c5444d548b))
* **api:** make setModalState(false) a no-op for the inline uploader ([244b0ea](https://github.com/uploadcare/file-uploader/commit/244b0ead2c71919f5d73f87c99df41a47aee5d0b))
* **api:** make setModalState(true) a no-op on the inline uploader ([0ef8446](https://github.com/uploadcare/file-uploader/commit/0ef84462eb9418a7e85f08a6c2564d5dde9eba8b))
* **api:** open no modal for an activity minimal shows in place ([5557e56](https://github.com/uploadcare/file-uploader/commit/5557e56f6c7573b0a11b55b611413642cfede9f0))
* **api:** report a setCurrentActivity target only once its block is shown ([9cfa097](https://github.com/uploadcare/file-uploader/commit/9cfa0978d5a058e79c5f661162f79e662e524edd))
* **api:** reset the inline uploader to its start screen on setModalState(false) ([b14b690](https://github.com/uploadcare/file-uploader/commit/b14b69028966c440d8b24d5c2d097f5098957d56))
* **api:** resolve getAPI() on a detached provider through its live ctx ([50c6cf7](https://github.com/uploadcare/file-uploader/commit/50c6cf7e9b682daea1f663ba24a673147551a4da))
* **api:** resolve getOutputItem through the ctx's own collection ([38f4170](https://github.com/uploadcare/file-uploader/commit/38f41707d20194b27ff1db041f574cf8761ee727))
* **api:** throw for an invalid uuid in addFileFromUuid ([33fe80a](https://github.com/uploadcare/file-uploader/commit/33fe80a597767385fc55fcb8695eaf046fff0bc1))
* **blocks:** log the static template deprecation again ([956b70f](https://github.com/uploadcare/file-uploader/commit/956b70ff4a4453147d404e1817a5e717aa4cf726))
* **blocks:** reflect CSS-only flag properties to their host attributes ([e0c933b](https://github.com/uploadcare/file-uploader/commit/e0c933b5152fc159fe8d5f27e9e89c887153c635))
* bound file validators by validationTimeout and keep other errors ([0dcce9a](https://github.com/uploadcare/file-uploader/commit/0dcce9a9dcbbeab2cb1b889fa6ce7b9aa3f487cb))
* **build:** keep mangled names off native property names in web bundles ([c82bb04](https://github.com/uploadcare/file-uploader/commit/c82bb047b050377b2be63f8d4cc8d620b544cdb7))
* **build:** start dist's mangled names with a digit and declare the size-limit file plugin ([e53be4e](https://github.com/uploadcare/file-uploader/commit/e53be4e5a7d78a9fec716a9ad3792197bdb405ba))
* **build:** stop mangling properties in the npm build ([3ab383f](https://github.com/uploadcare/file-uploader/commit/3ab383fd583977ebbc8646b346edafb502e6eac7))
* **camera:** derive camera state in its owners and smooth the clip timeline ([4a8adc5](https://github.com/uploadcare/file-uploader/commit/4a8adc50fa9f283e56f01fcd0cd0c475c57af58c))
* **camera:** drop a preview play() interrupted by a new load or a pause ([e0d1cf0](https://github.com/uploadcare/file-uploader/commit/e0d1cf0df0d9685305593da00a52b037a4cf3428))
* **camera:** drop late recorder and photo results after release, and cover the flows before the split ([c904cad](https://github.com/uploadcare/file-uploader/commit/c904cad98ce06916c358c111a79221b36ade0042))
* **camera:** fix Lit and accessibility issues in the camera controls ([05da871](https://github.com/uploadcare/file-uploader/commit/05da871736514c1ecdba808a0145846a6d86317e))
* **camera:** fix recording, reopen and microphone races found in review ([d5a468c](https://github.com/uploadcare/file-uploader/commit/d5a468cfa1714db1cf3cd41aabe1096543f088fc))
* **camera:** forget the photo or clip under review when the camera reopens or is denied ([8feadfc](https://github.com/uploadcare/file-uploader/commit/8feadfc16f4075cb758b1b75f239b8f3ddd1fed9))
* **camera:** ignore a camera that fails after another one was picked ([5ca0b7b](https://github.com/uploadcare/file-uploader/commit/5ca0b7bbdefc5fc5094a9dd9f7f5f7e8483b2099))
* **camera:** keep focus in the controls after a shot, a recording and a retake ([6a67b83](https://github.com/uploadcare/file-uploader/commit/6a67b833369441d9dd10a1ea4e2e541621a74032))
* **camera:** keep the next adoption's permission watch when a released query settles ([831627e](https://github.com/uploadcare/file-uploader/commit/831627e338d8a9ec7e314ba653cd14f9d04b3bd4))
* **camera:** keep the selected camera across devicechange ([97a125d](https://github.com/uploadcare/file-uploader/commit/97a125dd8caf9afb9c6dea8c89871d5d000ec665))
* **camera:** keep the shutter disabled until the video has a frame ([13a7147](https://github.com/uploadcare/file-uploader/commit/13a71476bb4863cdd443e88df68a84edf483d005))
* **camera:** list the cameras after a failed first access check ([43d0d00](https://github.com/uploadcare/file-uploader/commit/43d0d0003f11c5e24d09cde943525081cdc53049))
* **camera:** name a microphone the browser gives no label for ([0f7d956](https://github.com/uploadcare/file-uploader/commit/0f7d95664ef9ca5e85906c28e0e80d2a6822013a))
* **camera:** open on a tab configured now, not before the permission prompt ([e9e95ff](https://github.com/uploadcare/file-uploader/commit/e9e95ff6a6742f664a7d1bed2a67fc940ebf82ef))
* **camera:** release the recorded clip's preview url ([0f7ff2e](https://github.com/uploadcare/file-uploader/commit/0f7ff2e56cd8d82eb5019cfde7396f46526fef12))
* **camera:** report a camera that fails to start with an AbortError ([fcaeba1](https://github.com/uploadcare/file-uploader/commit/fcaeba168e6ba8a6f6a717d6057cd72b007af5d1))
* **camera:** report a photo that cannot be taken ([7820678](https://github.com/uploadcare/file-uploader/commit/7820678ecb7eb41814df33fe5a0e20e641e94065))
* **camera:** report a photo the browser could not encode ([01e887f](https://github.com/uploadcare/file-uploader/commit/01e887fc40c37cc8ec2267cd350f5ea5b6a01ef3))
* **camera:** report one telemetry event per shutter press ([1888363](https://github.com/uploadcare/file-uploader/commit/1888363b39234116a6d35a4e450d48a4a602fbd6))
* **camera:** return the preview to live after a photo is accepted ([77ac430](https://github.com/uploadcare/file-uploader/commit/77ac4304ad2a8d7de9bca18c7d23e0353e3edfee))
* **camera:** send start-camera only when a recording starts ([fe822a1](https://github.com/uploadcare/file-uploader/commit/fe822a1d743ff5eae9bf7ea237355e4ac2d0acc2))
* **camera:** settle a stop asked of a recorder that is not recording ([c56e50c](https://github.com/uploadcare/file-uploader/commit/c56e50c0ce9c97150a0badd431e7fe8252c76393))
* **camera:** show the camera in use in the device selects ([16b8ce6](https://github.com/uploadcare/file-uploader/commit/16b8ce642b4a4e2e4bf2d88ec6807e3eb0935dea))
* **camera:** show the camera live again once a clip is accepted ([284f2c6](https://github.com/uploadcare/file-uploader/commit/284f2c69685f94f7adcdc92d0831184f4669061d))
* **camera:** show what a recorder that ended on its own recorded ([9665696](https://github.com/uploadcare/file-uploader/commit/9665696b2fdef01de3b7f003ce49b13ff654619a))
* **camera:** stop reporting access denied while switching cameras ([0ae36fe](https://github.com/uploadcare/file-uploader/commit/0ae36fe559e4eac30bee88c625f8bfa43b13f823))
* **camera:** stop the clip's clock when a recording is retaken ([8e70c2b](https://github.com/uploadcare/file-uploader/commit/8e70c2bc2c451d68b25cfd9280842c32d7f6a87f))
* **camera:** stop the permission probe stream ([0743eb3](https://github.com/uploadcare/file-uploader/commit/0743eb30d62e66fa44c673fbc5c0c71a24bb2af6))
* **camera:** stop the previous stream when the camera is switched ([285ea11](https://github.com/uploadcare/file-uploader/commit/285ea11fe4460d0990a8ed74e37cd4e41d4d2d89))
* **camera:** stop the streams a later capture overtook ([906c619](https://github.com/uploadcare/file-uploader/commit/906c61949bf70fe1c51c3ea23fe56ac7729f62b5))
* **camera:** take a picked setting only when it is one of the options offered ([e6707ed](https://github.com/uploadcare/file-uploader/commit/e6707eda1f8e6e42e929ce9f0798ad82aa41ab1f))
* **camera:** take the clip's revoked URL off the preview video ([6198947](https://github.com/uploadcare/file-uploader/commit/619894754e9e5b17ad133d57fcb7e254c16ff387))
* **camera:** tell a missing or busy camera apart from denied access ([d87ead7](https://github.com/uploadcare/file-uploader/commit/d87ead7d7c86197511e141e5d491229ed4a6d5f9))
* **camera:** test the task's own adoption when a camera request fails ([3833f4c](https://github.com/uploadcare/file-uploader/commit/3833f4c14c8720c267ff895e9ef23964606bb5d6))
* **cloud-image-editor:** add no attributes in the slider and fader constructors ([e7affba](https://github.com/uploadcare/file-uploader/commit/e7affbad6d985a1926601cb4dde14037dc0affa7))
* **cloud-image-editor:** close the slider on Escape, not the dialog around the editor ([fdf8b45](https://github.com/uploadcare/file-uploader/commit/fdf8b45e0e64e381b396059349db5b6fd50ece67))
* **cloud-image-editor:** cut operations the editor does not model, as v1 did ([61803e2](https://github.com/uploadcare/file-uploader/commit/61803e2080f252ebf524943a2cdd83159be1ebe7))
* **cloud-image-editor:** drop the network problems screen when a new image loads ([284204c](https://github.com/uploadcare/file-uploader/commit/284204c23e9101d9dc30bdcfb8fbaef4cc9680cc))
* **cloud-image-editor:** drop the previous image's crop box on a new cdn-url ([2553087](https://github.com/uploadcare/file-uploader/commit/255308722f5c3fdf6238ea6b9fc9e57488e62c42))
* **cloud-image-editor:** fall back to the editor's own strings when its uploader ctx goes away ([25ec1ee](https://github.com/uploadcare/file-uploader/commit/25ec1ee934613420927ef4c4419c7dc7c6c532cc))
* **cloud-image-editor:** fire change once per rotate, flip or mirror ([a815f6e](https://github.com/uploadcare/file-uploader/commit/a815f6e9af3093eae23ae7fedd3e752ecb09619a))
* **cloud-image-editor:** fire the first change with the new image's source operations ([7757842](https://github.com/uploadcare/file-uploader/commit/77578424ab0177007f9f8ac8595c2629508e73d9))
* **cloud-image-editor:** follow a sibling uc-config's iconHrefResolver in the standalone editor ([aaf9458](https://github.com/uploadcare/file-uploader/commit/aaf945892c99e081bfa8cde54ead05a6bb08f63c))
* **cloud-image-editor:** give each tab a panel, the control lists a name and the images an alt ([91572ed](https://github.com/uploadcare/file-uploader/commit/91572ed2d0c9bdf077b606969d9540b570bfe544))
* **cloud-image-editor:** give the standalone editor the theme font ([e9f70c3](https://github.com/uploadcare/file-uploader/commit/e9f70c346332daf2bbfc82623f6d7faf28915ae6))
* **cloud-image-editor:** ignore image info for an image that was replaced ([78d082c](https://github.com/uploadcare/file-uploader/commit/78d082c5d4786d466557ec5945040264d1feb0d8))
* **cloud-image-editor:** keep a filter the library does not list ([dba1cf0](https://github.com/uploadcare/file-uploader/commit/dba1cf0ae6c8120a6ca1fa7b9ca7490af5e7bd3e))
* **cloud-image-editor:** keep a superseded cropper activation's image out ([a5922e6](https://github.com/uploadcare/file-uploader/commit/a5922e6d88305b9b5b49b50b2594023800eeac6e))
* **cloud-image-editor:** keep focus in the toolbar as the slider or the ratio list opens and closes ([4b84b4c](https://github.com/uploadcare/file-uploader/commit/4b84b4c29bb51e2aad9efc0e5802e7532d24e330))
* **cloud-image-editor:** keep observing the slider's size after a DOM move ([48e0bbc](https://github.com/uploadcare/file-uploader/commit/48e0bbcd1d592bbb882889fbd9456134844f4255))
* **cloud-image-editor:** keep the classes on the cropper across activation ([5f2d04e](https://github.com/uploadcare/file-uploader/commit/5f2d04e98ac45254491ac76ce0fe94de6edf5c55))
* **cloud-image-editor:** keep the classes on the fader across activation ([f27e7be](https://github.com/uploadcare/file-uploader/commit/f27e7bea96996bb3aa3c532da3b3371a1e52e9ef))
* **cloud-image-editor:** keep the classes on uc-btn-ui when setting its theme ([91866f6](https://github.com/uploadcare/file-uploader/commit/91866f6b2d9eece06991d10997bf3dd087054738))
* **cloud-image-editor:** keep the crop when committing an unmeasured image box ([8195b0e](https://github.com/uploadcare/file-uploader/commit/8195b0ed40abf42ef812640eee9fc1c06351083e))
* **cloud-image-editor:** keep the previous image's crop off a new cdn-url ([5e7a58a](https://github.com/uploadcare/file-uploader/commit/5e7a58ad1cc7724088f7dbae6e7eac5738ba00ce))
* **cloud-image-editor:** keep the tab role off the uc-btn-ui host ([2cb61a8](https://github.com/uploadcare/file-uploader/commit/2cb61a84cdb8aa28abab964d51b38c3ddda68a3f))
* **cloud-image-editor:** let the uploader, not the editor, cancel on Escape ([700f357](https://github.com/uploadcare/file-uploader/commit/700f3576a0d2f5321ba367ce1807ea1de6013232))
* **cloud-image-editor:** load the image when the editor is moved while its info loads ([af8c12e](https://github.com/uploadcare/file-uploader/commit/af8c12eba74298f1e4c6c9c790d7c87dc39cdfd0))
* **cloud-image-editor:** name each corner of the crop box for screen readers ([295c24f](https://github.com/uploadcare/file-uploader/commit/295c24f164ec1da3cf42df93f55710257d665b39))
* **cloud-image-editor:** position the slider thumb and zero dot through CSSOM ([11344d4](https://github.com/uploadcare/file-uploader/commit/11344d47ef206eadab27eb5a7098c522396ae176))
* **cloud-image-editor:** re-activate cropper and fader after an aborted activation ([792a5f7](https://github.com/uploadcare/file-uploader/commit/792a5f7dcc2c16209595250a920cce14f87bbaca))
* **cloud-image-editor:** re-wire the editor root after a DOM move ([a4fae13](https://github.com/uploadcare/file-uploader/commit/a4fae138d3a961ae9bf88c6ae096ea42beebaf4b))
* **cloud-image-editor:** reload an unfinished image after a DOM move ([fb9bbd0](https://github.com/uploadcare/file-uploader/commit/fb9bbd0d07aa053a7184ee21fa014d6b762ccca2))
* **cloud-image-editor:** report the operation just picked, not the previous one ([46e30f5](https://github.com/uploadcare/file-uploader/commit/46e30f5c9ce2156ce40cec002b3d17e9be5f8fe0))
* **cloud-image-editor:** report the slider's own operation and value to telemetry ([45e7522](https://github.com/uploadcare/file-uploader/commit/45e752255de858bf2c82683f1787b6245ee71271))
* **cloud-image-editor:** resolve editor icons like uc-icon inside the uploader ([dc5f182](https://github.com/uploadcare/file-uploader/commit/dc5f1823f26fc63badf1a317ae9452035bdea8e6))
* **cloud-image-editor:** set the editor up without waiting for a size ([52e82da](https://github.com/uploadcare/file-uploader/commit/52e82dabb1b0425503f7eed8544bbfd46cd497f5))
* **cloud-image-editor:** show the error screen when the image info gets an error status ([a139996](https://github.com/uploadcare/file-uploader/commit/a139996acf0421715cb21fa7ac5cef7ebd25c4c4))
* **cloud-image-editor:** show the network problems screen when the image info fails ([d961ce9](https://github.com/uploadcare/file-uploader/commit/d961ce94374fd879bbb9aeb0987788f9d7982f1b))
* **cloud-image-editor:** stop a removed presence toggle's initial-state timer ([92af797](https://github.com/uploadcare/file-uploader/commit/92af797b258b588c223e8d37b508b149966e7fc4))
* **cloud-image-editor:** test the activation's own adoption on a failed load ([dd2a88f](https://github.com/uploadcare/file-uploader/commit/dd2a88f0e244d793ffba134370669c2a06fbbd6d))
* **cloud-image-editor:** treat a failed image info response as an error ([3aceff0](https://github.com/uploadcare/file-uploader/commit/3aceff035d1a04db874ba38fe0c05faf1e663267))
* **cloud-image-editor:** wait for a size again after the editor loses it ([82e0c5a](https://github.com/uploadcare/file-uploader/commit/82e0c5a29ee438d593554ed723ded437f66a1bd9))
* **collection:** drop queued property changes for a removed entry ([6f0c79c](https://github.com/uploadcare/file-uploader/commit/6f0c79ce9ab41d593e765086568a7bd39218ca63)), closes [#1051](https://github.com/uploadcare/file-uploader/issues/1051)
* **collection:** keep FILE_ADDED ahead of an entry's property events ([51e1ea5](https://github.com/uploadcare/file-uploader/commit/51e1ea56251536d82789d025f767f9eb00721616))
* **collection:** scope property fan-out per observer + membership-first add order ([5e00b5d](https://github.com/uploadcare/file-uploader/commit/5e00b5db0bf573f8bbb6ed13ee927e81b7c8657f))
* **config:** accept a token provider as authToken ([#1096](https://github.com/uploadcare/file-uploader/issues/1096)) ([183602e](https://github.com/uploadcare/file-uploader/commit/183602e7ca9cce525e66fa33f7551f841b234d4e))
* **config:** drop the multipartMaxAttempts option ([98e5737](https://github.com/uploadcare/file-uploader/commit/98e573765b5f0e921022c408dee4a81943d7c30d))
* **config:** harden WithConfig debug compare and release reset ([535a4f2](https://github.com/uploadcare/file-uploader/commit/535a4f29ffb5087a33fa598de765900e816eb3bd))
* **config:** ignore removeAttribute of an absent config attribute ([435dbad](https://github.com/uploadcare/file-uploader/commit/435dbad8868fcabe14a8aa4c873a33679b29a75e))
* **config:** keep a cdnCname set while the pubkey resolution is in flight ([440c42a](https://github.com/uploadcare/file-uploader/commit/440c42ab23d2e8ff54fefa4715fcb6f36cd17064))
* **config:** keep config properties written while the host is detached ([418b87f](https://github.com/uploadcare/file-uploader/commit/418b87fd290a60c8f2dfc4017d6aaf5c817c5645))
* **config:** log function-valued config arrays legibly ([3c52d47](https://github.com/uploadcare/file-uploader/commit/3c52d47bcbfca3d848a04abf628f606adb042c4a))
* **config:** lowercase attr names in sync setAttribute path ([775e576](https://github.com/uploadcare/file-uploader/commit/775e5768f3fc9efaa3a57bb31567aa323f8a4b6c))
* **config:** parse boolean attributes as v1 did ([817c81f](https://github.com/uploadcare/file-uploader/commit/817c81f79a102d25736795045a4366bfdde72a7e))
* **config:** prevent setAttribute re-entry during attr flush ([23eb9dc](https://github.com/uploadcare/file-uploader/commit/23eb9dc5570fbd159ee108cd8130af2310560afa))
* **config:** read any boolean attribute value other than "false" as true ([7e5f35d](https://github.com/uploadcare/file-uploader/commit/7e5f35dccddde46170285f07e5975fab2a30d256))
* **config:** restore multipartMaxAttempts as a deprecated no-op ([67b594d](https://github.com/uploadcare/file-uploader/commit/67b594da992a25cf3ee244c8ab75bfebcaf9f384))
* **config:** safe detached attr writes; drop mode normalize ([0897af4](https://github.com/uploadcare/file-uploader/commit/0897af440d84fed90723bf25d74f9571449910ae))
* **config:** sync config attrs via setAttribute overrides ([1dbf4c1](https://github.com/uploadcare/file-uploader/commit/1dbf4c1f11c6c081c0358e3c36e7826ba4828e78))
* **copyright:** open the credits link in a real new tab without an opener ([7f9a472](https://github.com/uploadcare/file-uploader/commit/7f9a472ce11dab62112cc294292d8a4507b3c00c))
* **csp:** move static inline styles into stylesheets ([855a894](https://github.com/uploadcare/file-uploader/commit/855a894c11831f4bf2738a47d79afb765937d584))
* **csp:** set the remaining inline styles through CSSOM ([80a55b3](https://github.com/uploadcare/file-uploader/commit/80a55b327414e441d39532301a02ed07db3a9858))
* **demo:** point the custom icons demo at the icon sprite that exists ([3d91637](https://github.com/uploadcare/file-uploader/commit/3d916371706ab3c03464cbdd13a84540620cc1ed))
* **deps:** bump @uploadcare/cdn-url to 6.25.1 ([0e45d12](https://github.com/uploadcare/file-uploader/commit/0e45d121957929484ce1fa67cec6223d8bac7a67))
* **di:** throw on a read from a disposed ctx container ([6b72b1f](https://github.com/uploadcare/file-uploader/commit/6b72b1f468f336c8d76da31d3ec45c6832d32b9b))
* **drop-area:** attach the click and keydown listeners per adoption ([0008517](https://github.com/uploadcare/file-uploader/commit/0008517686a0e48909acedc8b039a56f59ce93ab))
* **drop-area:** hide the area once local uploads are not offered ([54027fc](https://github.com/uploadcare/file-uploader/commit/54027fc8bff32bec782520dbbf96d0505e9d84f4))
* **drop-area:** ignore work that finishes after the area is released ([8a1b8fb](https://github.com/uploadcare/file-uploader/commit/8a1b8fb37c53cb51c394a31468d95003c97a0649))
* **drop-area:** read every file of a dropped folder ([e2d57b5](https://github.com/uploadcare/file-uploader/commit/e2d57b569a9a369634688aec1115d24007c2b80e))
* **dynamic-btn:** default the view mode to plain again, as v1 did ([99f4b30](https://github.com/uploadcare/file-uploader/commit/99f4b306700dd63dade302f29ebf098f9f8d9abd))
* **dynamic-btn:** render its slots with plain conditionals, not cache() ([56bb406](https://github.com/uploadcare/file-uploader/commit/56bb406b3f2ecce2ebdd32dce33371c24b6a386b))
* **dynamic-btn:** stop uc-primary-action observing source/entries attributes ([0e81681](https://github.com/uploadcare/file-uploader/commit/0e816818626d42f5a54804f181655e0ca602909f))
* **dynamic-btn:** translate the mobile photo and video source names ([1ddf107](https://github.com/uploadcare/file-uploader/commit/1ddf1072e639c10cdd2d009dc8d8c5acb75e2b54))
* **dynamic-btn:** word the button header like the upload list's ([5e36ad0](https://github.com/uploadcare/file-uploader/commit/5e36ad0ba4146bb4d782c9bd17c003c0267dffc5))
* **editor-isolation:** editor self-owns a11y + self-attributes telemetry (PR review [10]) ([82bab06](https://github.com/uploadcare/file-uploader/commit/82bab06ff446ba9c397b10feeb6de2bce10e77ad))
* **editor-isolation:** fader stale-image guard + drop dead _lastTabId; PR review ([21b10a3](https://github.com/uploadcare/file-uploader/commit/21b10a3536c62f7ba812a86d22e1860cd49840ab))
* **editor-isolation:** guard cropper re-activation on image change; PR review ([ec27022](https://github.com/uploadcare/file-uploader/commit/ec270225f4eeabf9cea437acae5d7b7bb675761e))
* **editor-isolation:** harden compat bridge + whenCtx (Task 3 review follow-up) ([9ddf6ab](https://github.com/uploadcare/file-uploader/commit/9ddf6ab244df464d674a876d34ffb08bab8513af))
* **editor-isolation:** make ctx-name optional in the editor's JSX attributesMeta ([bf056dc](https://github.com/uploadcare/file-uploader/commit/bf056dc7434a13afa97d764d778d2896491066e1))
* **editor-isolation:** PR review — buffer early telemetry, notify on config change, resolver in attributesMeta ([f6973d3](https://github.com/uploadcare/file-uploader/commit/f6973d3c424d6359dc9bdcb226bcdb83701559fa)), closes [#1032](https://github.com/uploadcare/file-uploader/issues/1032)
* **editor-isolation:** restore icon centering/overflow lost in the uc-editor-icon rename ([4ac82fa](https://github.com/uploadcare/file-uploader/commit/4ac82fa0a91d1a62cf6a1c0e6a4c22267a8c645c))
* **editor-isolation:** route getConfig through controller own-config; unset restores default ([789b675](https://github.com/uploadcare/file-uploader/commit/789b6753aae43970dddc6e79a6ec423d699ab264))
* **editor-isolation:** update npm snapshot for EditorIcon export; PR review ([e36a234](https://github.com/uploadcare/file-uploader/commit/e36a234ae341bcc10b4eda388fbe4d5fc3372acd))
* **editor:** keep a source crop that an unmodelled operation follows ([b37af64](https://github.com/uploadcare/file-uploader/commit/b37af64d8709935d666078c7125aad6c0f0b38d8))
* **editor:** stop treating a cancelled image preload as loaded ([a76ee56](https://github.com/uploadcare/file-uploader/commit/a76ee56552fcd1bb14e8d61c71221d946706b9cd))
* emit file-upload-start before file-upload-progress, and run e2e against an emulator ([#1081](https://github.com/uploadcare/file-uploader/issues/1081)) ([60c3145](https://github.com/uploadcare/file-uploader/commit/60c3145b074235a10255b1c42940cdad85c911da)), closes [#1083](https://github.com/uploadcare/file-uploader/issues/1083) [#1088](https://github.com/uploadcare/file-uploader/issues/1088)
* emit no event and invoke no hook once the ctx is torn down ([54014ff](https://github.com/uploadcare/file-uploader/commit/54014ffb414d6f7c8f7ceb0c88e5a571d76f4600))
* **event-bus:** make api.on and whenAvailable unsubscribes idempotent ([979f87e](https://github.com/uploadcare/file-uploader/commit/979f87ea10cf264900f467a03c208fdace3d55ba))
* **events:** fire common-upload-failed once per failure, after the batch settles ([e701c30](https://github.com/uploadcare/file-uploader/commit/e701c308f96dba031864de80f8cf1f9718ffe622))
* **events:** fire common-upload-failed once, after the batch settles ([20d28fc](https://github.com/uploadcare/file-uploader/commit/20d28fc4c4897c921a92171ba4409b037f35db6e))
* **events:** fire common-upload-start once the first file is uploading ([160776f](https://github.com/uploadcare/file-uploader/commit/160776f3f696d75259e6583a6d384bcc1c4ea5a1))
* **events:** fire common-upload-success again after an uploaded image is edited ([e68679a](https://github.com/uploadcare/file-uploader/commit/e68679a8cf35e2c3c3397fbfd35003ed43b0dfa3))
* **events:** fire common-upload-success once per finished upload, not again per edit ([c7031b3](https://github.com/uploadcare/file-uploader/commit/c7031b36f87ca7544e28166565186da20f8e998a))
* **events:** fire file-url-changed once per URL with cropPreset ([622333d](https://github.com/uploadcare/file-uploader/commit/622333dec99d2ed62a8eb9a87b92c4d6331a92c0))
* **events:** guard group finalization against mid-flight unobserve ([a437645](https://github.com/uploadcare/file-uploader/commit/a4376455cdbc27bd290027e935a21c309710d479)), closes [#994](https://github.com/uploadcare/file-uploader/issues/994)
* **events:** report a standing collection error again after each uploadAll() batch ([6df0d69](https://github.com/uploadcare/file-uploader/commit/6df0d69f9b668d48d425e6c1bc65e6ef07a12de1))
* **events:** report a too-short collection once files are added ([92e69ac](https://github.com/uploadcare/file-uploader/commit/92e69acd299b2b97171fe943bfc2b106151cd23d))
* **events:** report a validation failure once, not again for the same verdict ([c69b19f](https://github.com/uploadcare/file-uploader/commit/c69b19f22f2a2ceb490f44b87d037a0044b77d3f))
* **events:** report the start screen after the mounting task, as v1 did ([cdfc267](https://github.com/uploadcare/file-uploader/commit/cdfc267bdaa9a7628203e2371cb11a846aecf8f7))
* **events:** report the start screen to a provider that joins after the uploader ([b11eb6f](https://github.com/uploadcare/file-uploader/commit/b11eb6ffa0b8ded59cf988cebc58f5d08f6b7853))
* **external-source:** go back to the source list from the header close button ([490180a](https://github.com/uploadcare/file-uploader/commit/490180a32582757975e350dcc6442055990c9afa)), closes [#42](https://github.com/uploadcare/file-uploader/issues/42)
* **external-sources:** escape regex metacharacters in preferred-type patterns ([c3a65f9](https://github.com/uploadcare/file-uploader/commit/c3a65f976c13a7c0c4ef11d62f18b35662eba77c))
* **file-item,upload-list:** activate focus style, fix grid spacer gap, single-source abort ([8568cf2](https://github.com/uploadcare/file-uploader/commit/8568cf2037ba53597867c17e65818b6394a83a7b))
* **file-item,upload-list:** review fixes — window clamp + restore remove telemetry ([d1c5dfd](https://github.com/uploadcare/file-uploader/commit/d1c5dfdad373ec906a6e592ef2dd36889a835d2f))
* **file-item:** draw the focus ring on the card, not around the row ([8f79184](https://github.com/uploadcare/file-uploader/commit/8f7918459b0557561b7c70630a5bc87a076f17d8))
* **file-item:** give the focus ring the colour the buttons' ring has ([bf9a4ec](https://github.com/uploadcare/file-uploader/commit/bf9a4eccb07bd618140a7250827d8cc1a3669a56))
* **file-item:** guard throttled hint/progress update against post-release tick ([8b301cc](https://github.com/uploadcare/file-uploader/commit/8b301cc6e841b04ca1300f80ac4267932ac96942))
* **file-item:** skip plugin actions for an entry the ctx no longer has ([04201a6](https://github.com/uploadcare/file-uploader/commit/04201a66f1d40d530c6b54e31a37586aef1c69c8))
* fire common-upload-success once when uploaded files are validated apart ([8786db6](https://github.com/uploadcare/file-uploader/commit/8786db68a8263e93c1ead290a0c5d51ef92dd7b0)), closes [#1081](https://github.com/uploadcare/file-uploader/issues/1081)
* fire file-upload-start for an upload that finishes within one change batch ([a506d6e](https://github.com/uploadcare/file-uploader/commit/a506d6e7e715d149820e799e2544e673cb304714)), closes [#1081](https://github.com/uploadcare/file-uploader/issues/1081)
* **focus:** fall back where the browser has no checkVisibility ([2f7be08](https://github.com/uploadcare/file-uploader/commit/2f7be085bdb1030a5aeaeedec4f48203060c13c0))
* **form-input:** keep the validation input's name and required current ([a3a3948](https://github.com/uploadcare/file-uploader/commit/a3a3948cf147206e4a2c930dbf02cf223e23b194))
* **form-input:** stop a late-mounted form input from logging the late-read warning ([f0ed4bf](https://github.com/uploadcare/file-uploader/commit/f0ed4bf4d292d48ca9e60c43519a29befa4e0367))
* **group:** create a collection's group once ([416d33f](https://github.com/uploadcare/file-uploader/commit/416d33f07ff8002ae558c7d47c0d8a4975a5735a))
* **group:** create one output group per collection, even when a flush lands mid-request ([03e5e90](https://github.com/uploadcare/file-uploader/commit/03e5e90002e2cb94ea38dd949eb11c3b5a7160c7))
* **group:** drop a group in flight when a file's URL changes ([d0beab3](https://github.com/uploadcare/file-uploader/commit/d0beab32179170453bed72b4c1644bb45281fbb2))
* **host-subscription:** isolate throwing listener on observe immediate fire ([a617988](https://github.com/uploadcare/file-uploader/commit/a6179880d0d632f19a6890f9236e031f8ef573f6))
* **image-shrink:** don't warn about an image already under the limit ([c40ba9b](https://github.com/uploadcare/file-uploader/commit/c40ba9bad1240ce7da9015577ab110a257bb2871))
* **image-shrink:** skip non-images and stay quiet on image-shrink's own skips ([0f9e997](https://github.com/uploadcare/file-uploader/commit/0f9e997f36bcd2d408f7efccfd4c3286dd23b8c2))
* **image-shrink:** stay quiet when the wrapped error says no shrink was needed ([863efbc](https://github.com/uploadcare/file-uploader/commit/863efbc0da4208c7d46f6a7c8c0f6ffa2929f521))
* **image-shrink:** warn when shrinking fails before uploading the original ([8b3fab5](https://github.com/uploadcare/file-uploader/commit/8b3fab54dd659a447e8187b5e0c2301c84bcac66))
* **img:** apply every pending attribute before notifying, so a late intersection is honoured ([ad02710](https://github.com/uploadcare/file-uploader/commit/ad0271072380b04eea208c97070c70800f8b4f8d))
* **img:** never emit "undefined" as a uc-img URL ([08e9bc6](https://github.com/uploadcare/file-uploader/commit/08e9bc6a09c26949c82b4dfd0bb3af7979cf9f86))
* **img:** render a group-element src again ([07af25a](https://github.com/uploadcare/file-uploader/commit/07af25a3a592f2c584247ea9d8a981cd1f0e09f8))
* isolate and warn in the remaining listener fan-out loops ([4e25373](https://github.com/uploadcare/file-uploader/commit/4e253732f1472495e9a7d7e8abdd654b897559a8))
* keep mangled members out of the published types ([498bde2](https://github.com/uploadcare/file-uploader/commit/498bde201e25f9d1b31120955d581077b442f36f))
* lay blocks out right-to-left for RTL locales again ([b4f4793](https://github.com/uploadcare/file-uploader/commit/b4f47931f9c419b6d34da563f37e0b2e421597f4))
* **lifetime:** treat an AbortError as the lifetime ending only once it has ended ([86b8f90](https://github.com/uploadcare/file-uploader/commit/86b8f9004c2e30e623b9739913477e2f1a389baa))
* **lit:** dispose [@effect](https://github.com/effect) copies on a same-task DOM move ([908f592](https://github.com/uploadcare/file-uploader/commit/908f59273622d9f85d88cb754ada60906698e3f6))
* **lit:** tear down the old ctx of a block moved and renamed in one task ([dad5d3a](https://github.com/uploadcare/file-uploader/commit/dad5d3a5029e178b1c01d5497f5063d0a0aefc0f))
* **locales:** let defineLocale take some keys and the declared custom ones ([d006014](https://github.com/uploadcare/file-uploader/commit/d006014533ad8d5047b3538414f0377bcf90dd30))
* **locales:** publish the English dictionary with string values ([87c2e9b](https://github.com/uploadcare/file-uploader/commit/87c2e9bdcbf25e94e11bcd7302b4745a4f4aeb22))
* **logging:** hide authToken and secureSignature in debug logs again ([783d82c](https://github.com/uploadcare/file-uploader/commit/783d82c1936a82e5616a32342db652d5af35192d))
* **m10a:** register *pluginManager via addCtxSharedInstance so it tears down ([1176312](https://github.com/uploadcare/file-uploader/commit/117631230921d53c792b043d54a41fc69caeb591))
* **m12:** address PR review — loadingOperations notify, cancel order, CropFrame reconnect ([deec96b](https://github.com/uploadcare/file-uploader/commit/deec96b954cc5b7f61299e87408097b1a08723cc))
* **m8:** address PR [#1045](https://github.com/uploadcare/file-uploader/issues/1045) review findings — isolate-and-warn + activity gating ([0e0270c](https://github.com/uploadcare/file-uploader/commit/0e0270c616b6b7c1f08deeb209e7c3d3587bd4bb))
* **m8:** review follow-ups — never-throw telemetry sink + plugin-hook teardown guard ([a6ae57e](https://github.com/uploadcare/file-uploader/commit/a6ae57ef6cc59feacdd9d77a1bd7eb4a322fa511))
* **m8:** review follow-ups — telemetry config redaction + clipboard lifecycle ([1a5527c](https://github.com/uploadcare/file-uploader/commit/1a5527cf6fb3841a31479483dc854803c7f4f576))
* **m8:** sensitive config values marked, not dropped; contain teardown telemetry race ([5424def](https://github.com/uploadcare/file-uploader/commit/5424def2f9f865ee9631b52ffedcfab81483e3df))
* **m9a:** ChildBlock — react to ctx-name arriving while the render gate is closed ([5c4fd5a](https://github.com/uploadcare/file-uploader/commit/5c4fd5ab61ddde6b30ef8c456bb695584ab3b86a))
* **m9a:** review follow-ups — release controller on ctx-name switch; warn on teardown errors ([d50c2fa](https://github.com/uploadcare/file-uploader/commit/d50c2faf970c8ecdc2878e8d10321d34529da6d2))
* **m9b:** reject empty parsed crop presets instead of falling through to 1:1 ([ae7692a](https://github.com/uploadcare/file-uploader/commit/ae7692a50ce79d800ab029701e157cacef43058f))
* **m9d:** SourceBtn re-derives source-driven state on controller adoption ([e9beb66](https://github.com/uploadcare/file-uploader/commit/e9beb66646f3c8a09d46265767898329aeb6fceb))
* **m9e:** guard remaining uploader-scope reads in FileItem; FileActionButton locale re-render ([2348681](https://github.com/uploadcare/file-uploader/commit/2348681ac040f1d93c4222a880c1cb936b405077))
* **m9e:** ProgressBar controllerReady re-derives progress value unconditionally ([82d13da](https://github.com/uploadcare/file-uploader/commit/82d13da0fbaa69d8068505fe8c57e553add919be))
* **m9e:** ProgressBar re-derives visibility on adoption; test-type and comment hardenings ([30a24c8](https://github.com/uploadcare/file-uploader/commit/30a24c8dc89c0571f58e2140cd173b2b733d789d))
* **m9e:** review follow-ups — bare encodeURIComponent in the abstract layer; Thumb drops stale entry on unresolvable uid ([53790fc](https://github.com/uploadcare/file-uploader/commit/53790fc6c2358a057f08fe5d854af45b426f46dc))
* **m9e:** Thumb/FileItem tolerate a missing uploader scope instead of throwing ([1bd2789](https://github.com/uploadcare/file-uploader/commit/1bd278974699a3283ca3fcf9c92ac2114bdcac33))
* **m9e:** type-check e2e fixtures — uc-thumb JSX intrinsic, partial allEntries in makeEntries ([64c6d39](https://github.com/uploadcare/file-uploader/commit/64c6d39c4e1adc505cb95ec6eee2634c54efd7eb))
* **m9f:** mounted-activity signal on the router — API activity waits cover ported blocks ([230d212](https://github.com/uploadcare/file-uploader/commit/230d212f3e5d9c46849fdc99dc0b8927795afe52))
* **m9f:** OrNull scope-guard seam on the bag; isolate controllerReady throws ([7ea86eb](https://github.com/uploadcare/file-uploader/commit/7ea86eb4184ce54f78dfab6619cff19b98c9b2a9))
* **m9f:** review follow-ups — settle waitForActivityBlock on timeout; truly-never-throw OrNull getters; single collection read in FileItem remove ([d359797](https://github.com/uploadcare/file-uploader/commit/d359797efa576e6129c379857e9bf0bb82f0059e))
* **m9f:** settle waitForActivityBlock before invoking onTimeout ([859d3f5](https://github.com/uploadcare/file-uploader/commit/859d3f509288a44a149fbc683ea9af8568c82258))
* **m9g:** descendant testid rewriting on ChildBlock — TestModeController host generalized ([f4c28d6](https://github.com/uploadcare/file-uploader/commit/f4c28d60864bae82f1d7f19b9cba7e5f78e89e1f))
* **m9g:** review follow-ups — ExternalSource mounts once via the deferred path; drop duplicate load listener; sync dedup assertion ([24173d3](https://github.com/uploadcare/file-uploader/commit/24173d341e268c0cbed447552b4dc8651bee2e1d))
* **m9h:** guard FormInput validation-input append on re-adoption; pin uploading precondition in the abort test ([20d7766](https://github.com/uploadcare/file-uploader/commit/20d77664b6b7bbb96eae34d560bcd69cfb388f7e))
* **m9h:** track DynamicBtn collection observers for release/re-adoption teardown ([1759284](https://github.com/uploadcare/file-uploader/commit/17592842ed8b840f39b0e5f4ad393e46cc790577))
* **m9i:** DynamicBtn's SourceListController re-entrant-safe too ([fdaf962](https://github.com/uploadcare/file-uploader/commit/fdaf96261a19b7d3ca14b05f98f43c160448e42d))
* **m9i:** registry unregistration signal — ChildBlock releases when its ctx dies ([3f8af16](https://github.com/uploadcare/file-uploader/commit/3f8af16be55fc962360c1428cb28c273a06865f2))
* **m9i:** review follow-ups — UploadList tick survives release-while-connected; SourceListController re-entrant-safe ([6f2017f](https://github.com/uploadcare/file-uploader/commit/6f2017f2aa0c2e31ba82f8af4e3f47a6d34b22ca))
* **m9j:** wire subRouter before the null-activity guard; assert real unsubscription in wait specs ([8a6fba9](https://github.com/uploadcare/file-uploader/commit/8a6fba9d1ebbcddf84233a1533b4d0c3ac740873))
* **m9k:** type the lifecycle pin's ctx reads via SharedState ([36c20b1](https://github.com/uploadcare/file-uploader/commit/36c20b1a3dd909ee2c13a427193ee20c8a17abc7))
* **m9k:** uniform stale-resolution guard in LocaleManager; spy hygiene in lifecycle specs ([eccacb2](https://github.com/uploadcare/file-uploader/commit/eccacb25d006f0a5602c73586ca0d9fb06d8bdc8))
* **m9m:** contain teardown-raced telemetry in the resolver and validator error sinks ([065287a](https://github.com/uploadcare/file-uploader/commit/065287a5288319a755decbd196f70ad59414f42e))
* **m9m:** inject the upload-stack constructors so editor-only bundles stay slim ([e3738b2](https://github.com/uploadcare/file-uploader/commit/e3738b2b07a245f2de76170a9e5c493764be2f26))
* **m9n:** ensureUploaderCtx forces the controller on every path; stable default uploadTrigger set ([f2419ef](https://github.com/uploadcare/file-uploader/commit/f2419efffdf4673d7a8dc5fb645d349d651f3652))
* **m9n:** restore UploadCtxProvider.uploadCollection getter (documented type surface) ([ff443db](https://github.com/uploadcare/file-uploader/commit/ff443dbf2f4da60129d3678c910e87262d157bea))
* **m9o:** rewrite progress-bar gated-adoption test for the self-bootstrap window ([36edf5c](https://github.com/uploadcare/file-uploader/commit/36edf5c558e56d4b18d4738ec5f53de856f5ac46))
* **m9o:** robust consumer refcount, unconditional ctx bootstrap, consistent teardown ctxName (review) ([7227678](https://github.com/uploadcare/file-uploader/commit/72276784a58040ffa9a31211e5c0c2bf2dc4dc71))
* **m9o:** tear down an abandoned self-bootstrapped ctx on ChildBlock ctx-name switch ([3ec17bf](https://github.com/uploadcare/file-uploader/commit/3ec17bf93f8e168db1a2c6576e60e5bb657f10e4))
* **m9p:** guard Config custom-config attr handling on ctx existence (WIP — needs the ctx-scope-keys seam prerequisite) ([e8796b5](https://github.com/uploadcare/file-uploader/commit/e8796b519c51f8d13bd77a0a42dcfb9898fbe068))
* **m9p:** null-tolerant plugin-manager reads in Config custom-config paths ([a8e6731](https://github.com/uploadcare/file-uploader/commit/a8e6731766b649da40872405db8bf02f72c020cb))
* **m9r:** keep LitSolutionBlock export + restore attributesMeta JSX typing ([aee555e](https://github.com/uploadcare/file-uploader/commit/aee555ee20124facb95927029810a48e82021152))
* **minimal:** close an open source modal when files are added through the API ([b79c62a](https://github.com/uploadcare/file-uploader/commit/b79c62a8c436dfd9fa0554ad463637186eff22ea))
* **minimal:** close the modal when the API targets an empty upload list ([c42b304](https://github.com/uploadcare/file-uploader/commit/c42b304a4ad5d9d902619c96f5bd90372831a90b))
* **minimal:** close the source picker when files are added through the API ([17606b6](https://github.com/uploadcare/file-uploader/commit/17606b676f2effd183da01df6ec0e190534a317f))
* **minimal:** keep consumer inline --uc-grid-col and source-list display ([fa8e136](https://github.com/uploadcare/file-uploader/commit/fa8e1366f446f2d20c36bdfd3ecbcfd89f7aaab8))
* **minimal:** keep the trigger in place behind a modal opened with setModalState ([b05f9c1](https://github.com/uploadcare/file-uploader/commit/b05f9c1ffaeaf181b2cfca0db3b2ce4dec2c0e47))
* **modal:** apply modalPresentation 'inline' to a dialog already open ([7861856](https://github.com/uploadcare/file-uploader/commit/7861856e02108f3d0e5a7da444ab92eb46f583af))
* **modal:** clear the staged activity when the user closes its modal ([c9b4873](https://github.com/uploadcare/file-uploader/commit/c9b487316a99414479968121afc531f2a6e439b3))
* **modal:** draw the backdrop strokes again ([7aa61b4](https://github.com/uploadcare/file-uploader/commit/7aa61b46c93aadf7fd5793686d9b994392eccd2c))
* **modal:** ignore native dialog close arriving after ctx teardown ([25f9804](https://github.com/uploadcare/file-uploader/commit/25f980488d37a480dd8ab4e5bb6dbdc6e684715e))
* **modal:** ignore the stale close event of a modal reopened before it lands ([f5a18f9](https://github.com/uploadcare/file-uploader/commit/f5a18f99b14e0bebf18c7356428e29d27b05a747))
* **modal:** keep the inline uploader open on an Escape the page handled ([5c3431e](https://github.com/uploadcare/file-uploader/commit/5c3431e211d7d1c1e336ee62dbac70d484d4181c))
* **modal:** move focus into an inline dialog and back to its opener ([72d7453](https://github.com/uploadcare/file-uploader/commit/72d7453349c0dc7b26d2815592bb19132be2db6f))
* **modal:** open on the first control again after closing from another screen ([d9d7891](https://github.com/uploadcare/file-uploader/commit/d9d7891adda4af25d374fec80b4ae14d560494f2))
* **modal:** refcounted per-document scroll lock owned outside Modal ([0cf5a12](https://github.com/uploadcare/file-uploader/commit/0cf5a120051bc8a8b8293e966f0087900a8df865))
* **modal:** return focus to the control that led to another screen ([c781cd5](https://github.com/uploadcare/file-uploader/commit/c781cd5ea8d5ec6d922a2d15cdf9aacfed3f4f73))
* **modal:** stay a top-layer modal after the uploader is moved ([a4c1dff](https://github.com/uploadcare/file-uploader/commit/a4c1dffa8142eecab76045cb93b8d3e51a942d36))
* **output:** make OutputCollectionState.snapshot non-enumerable ([6e9eb30](https://github.com/uploadcare/file-uploader/commit/6e9eb308c9dc85d1e38accbe2baef67ea17d2e6a))
* **plugin:** put logger on PluginApi and use it for config override warn ([eb91e89](https://github.com/uploadcare/file-uploader/commit/eb91e895c63491335fbb320263af5687c80c6c35))
* **plugins:** abort a file hook that times out and clear its timer ([631a601](https://github.com/uploadcare/file-uploader/commit/631a6010c3e030089a3e3fc8429486d52f80b3ab))
* **plugins:** accept plain-string labels again, with a warning ([0d221a9](https://github.com/uploadcare/file-uploader/commit/0d221a9695d0c418ca08c5c3d99eb4a2dbec5d75))
* **plugins:** default a file hook's timeout when it is passed as undefined ([fafcc50](https://github.com/uploadcare/file-uploader/commit/fafcc5079c0a1b8eda33d6849846cb80b8185d7c))
* **plugins:** dispose a plugin whose setup outlives the ctx ([d02e042](https://github.com/uploadcare/file-uploader/commit/d02e0426b7b2f793236ad0b044e98dd9013d6883))
* **plugins:** isolate dispose failures + keep the sync queue resilient ([d5f424e](https://github.com/uploadcare/file-uploader/commit/d5f424ebfe852f3036e81b8a2c5dcafde8d5ca0e)), closes [#995](https://github.com/uploadcare/file-uploader/issues/995)
* **plugins:** keep plugin translations of built-in strings on locale switch ([8ee55e1](https://github.com/uploadcare/file-uploader/commit/8ee55e1370e0981b1106da57333e46116fc3a811))
* **plugins:** let an activity's render return nothing ([7b48915](https://github.com/uploadcare/file-uploader/commit/7b489154dc4cfbc08d0b77b3c8f164f0643eb185))
* **plugins:** re-check file actions when an option shouldRender reads changes ([5e33b3e](https://github.com/uploadcare/file-uploader/commit/5e33b3ec41f34b636776c90247ff4e87cd2d54d1))
* **plugins:** restore built-in strings when a plugin's l10n is removed ([0e4dcf6](https://github.com/uploadcare/file-uploader/commit/0e4dcf6e80c5acde190e1b8526e577a44158a185))
* **plugins:** scope PluginController debug output to the controller ([f75b40f](https://github.com/uploadcare/file-uploader/commit/f75b40f6d9d6617c12f6bc421ac63353d0bb066c)), closes [#995](https://github.com/uploadcare/file-uploader/issues/995)
* **plugins:** skip a file hook when its file was already removed ([aa4bd8d](https://github.com/uploadcare/file-uploader/commit/aa4bd8d6aa2d3e656f64b0bcaecb4bd673fd9682))
* **plugins:** stay quiet about a file hook its own signal aborted ([0188049](https://github.com/uploadcare/file-uploader/commit/018804980b6fef328b0e02ed9e0bb43194245c6c))
* **plugins:** stop publishing pluginLabelKey as a value the bundle lacks ([3040b59](https://github.com/uploadcare/file-uploader/commit/3040b59ff320940e393b6d819cbc2500f8c2356c))
* **plugins:** warn when a plugins-change subscriber throws ([6908714](https://github.com/uploadcare/file-uploader/commit/6908714ceb93773ed367778e1a76c438254b60a3))
* **progress-bar-common:** reflect the active attribute ([d514060](https://github.com/uploadcare/file-uploader/commit/d514060d92d7193f822a9b101859e4fafb8e5207))
* read a block boolean attribute of "false" as off, as <uc-config> does ([c3d005e](https://github.com/uploadcare/file-uploader/commit/c3d005e964abe97dde9b786d17d05922ad955acb))
* read the latest entry in the lazy intersection observers ([0486cf7](https://github.com/uploadcare/file-uploader/commit/0486cf7d62265069067af649203dda06f356e4bf))
* register *publicApi before *validationManager (PR [#991](https://github.com/uploadcare/file-uploader/issues/991) review) ([67ca5e0](https://github.com/uploadcare/file-uploader/commit/67ca5e03d5f72a7b4fce70e85d2654e05dae0b9f))
* reject a failed image preload with an Error naming the url ([8da91c2](https://github.com/uploadcare/file-uploader/commit/8da91c27b585cbc86b6863be1567fa4356195000))
* reject loadFileUploaderFrom with an Error and load the script once ([a2858d8](https://github.com/uploadcare/file-uploader/commit/a2858d8e96f49689acbafe8bf16895a46d65b6c7))
* restore missing-key warning for faceted config/locale reads (PR [#987](https://github.com/uploadcare/file-uploader/issues/987) review) ([b45faeb](https://github.com/uploadcare/file-uploader/commit/b45faeb222b9d16bb2f15f27d6b21b16467f420c)), closes [PubSub#read](https://github.com/PubSub/issues/read)
* **review-2:** address grok/codex/copilot/coderabbit findings ([201f626](https://github.com/uploadcare/file-uploader/commit/201f626009f894b9d4352621eef369e2f144b53d)), closes [#1053](https://github.com/uploadcare/file-uploader/issues/1053)
* **router:** close a modal opened on the list when the list empties, as 1.35 did ([d5d5859](https://github.com/uploadcare/file-uploader/commit/d5d58593c4c9bdcb9f240003a2db7fe7b369fcd4))
* **router:** correct param handling, hook context, and modal scroll-lock ([cfa3013](https://github.com/uploadcare/file-uploader/commit/cfa30132898beb018128d001e302ac246f409621))
* **router:** fire modal-open/modal-close per activity, as in v1 ([2ee4dc4](https://github.com/uploadcare/file-uploader/commit/2ee4dc48dfbeb659cf4362346b723b0d0ca30a5d))
* **router:** isolate throwing guards/hooks and make back() guard-aware ([be167ef](https://github.com/uploadcare/file-uploader/commit/be167efcc97e054281da7bbc2f536df9c2633f5c)), closes [#3](https://github.com/uploadcare/file-uploader/issues/3)
* **router:** keep history when back() is redirected to the current activity; clear guards on destroy ([5bc3802](https://github.com/uploadcare/file-uploader/commit/5bc38020c32d4e58847e6cd5814f3e6dc74358da))
* **router:** let back() skip earlier entries of the activity showing ([fecd54f](https://github.com/uploadcare/file-uploader/commit/fecd54f82b67a9f87b0a810d9f5a394f29a8f9c9))
* **router:** mutate history only at navigation commit + review follow-ups ([28c933d](https://github.com/uploadcare/file-uploader/commit/28c933d66cfded39821599ffba369f8d9804718e))
* **router:** open the start screen when an empty upload list is asked for ([05b6f75](https://github.com/uploadcare/file-uploader/commit/05b6f75d420bf33e5d30372feed7f89a11cf7c3a))
* **router:** re-enter the previous activity with its params on back ([cd34744](https://github.com/uploadcare/file-uploader/commit/cd34744df7a61835562a55641550edb956497aa6))
* **router:** report the activity on doneFlow when the flow is already there ([a7bc8a3](https://github.com/uploadcare/file-uploader/commit/a7bc8a335ab384d4ce11ab25c9057f65479478bf))
* **router:** restart at the start screen when the upload list empties ([b2edbf2](https://github.com/uploadcare/file-uploader/commit/b2edbf2bf01442a05435a24336c6e35d2429a327))
* **router:** restore strict ActivityId union ([79271c3](https://github.com/uploadcare/file-uploader/commit/79271c31c1049fc47736ca80a3f46c47eb7b2157))
* **router:** start-from Cancel + external close go back, not close ([0bafcd2](https://github.com/uploadcare/file-uploader/commit/0bafcd2ecf8a47dde2b80090f74b72d7617ff72c))
* run a throttled call immediately once its window has passed ([761d551](https://github.com/uploadcare/file-uploader/commit/761d55179186f6673384f3f984709319b33bf8d8))
* **secure-uploads:** drop a signature resolver result that outlives the ctx ([73c0bcb](https://github.com/uploadcare/file-uploader/commit/73c0bcb8b0af01994b90f3e6b8aabbc40b206c0f))
* **select:** draw the theme's dropdown arrow in place of the browser's ([815edbd](https://github.com/uploadcare/file-uploader/commit/815edbda8e79d2956051b83091d7557ed7522ebb))
* **select:** end a name too long to fit with an ellipsis, and show it whole on hover ([9f92f88](https://github.com/uploadcare/file-uploader/commit/9f92f881003a5c4fd2698a2fc24ea23c61ae4567))
* **select:** mirror the dropdown arrow in right-to-left layouts ([e18e7c4](https://github.com/uploadcare/file-uploader/commit/e18e7c43cedb260e032cf30a5813acd94cdf9460))
* **select:** show the passed value in uc-select ([67a4877](https://github.com/uploadcare/file-uploader/commit/67a48770f02d0b76c517d36ae69f14e6b343961d))
* send nothing once the uploader is destroyed ([8361f10](https://github.com/uploadcare/file-uploader/commit/8361f1059b510d78d4755fa170030bcb1da35bc9))
* **sources:** label an aliased source with the name it shares ([5969e77](https://github.com/uploadcare/file-uploader/commit/5969e773f1d750cf6a1f56c3257367cccf94e9a3))
* **sources:** show the Dropbox icon for the dropboxchooser source ([46655fa](https://github.com/uploadcare/file-uploader/commit/46655fade40f806035f21ca0b78ada227c3d64f3))
* **store:** setMany/observe must not drop explicit undefined (clear a field) ([55bb477](https://github.com/uploadcare/file-uploader/commit/55bb477b9e17c578c718826c0a0bf88c703975dd))
* **telemetry:** attribute the standalone editor's events to it ([2b2be1e](https://github.com/uploadcare/file-uploader/commit/2b2be1e8d1d65423cc8e39db3b5d35d1daf2f2d5))
* **telemetry:** keep common-upload-start and collection-only failures out, as 1.35 did ([8f5fea3](https://github.com/uploadcare/file-uploader/commit/8f5fea3c3420506a49e634d6838cd6df26dc75c7))
* **telemetry:** keep the old source and camera events for existing consumers ([2d20760](https://github.com/uploadcare/file-uploader/commit/2d207602de6d0001723b8dd3c5aabb87516caac7))
* **telemetry:** re-check the opt-out after the queue yields ([5fa448c](https://github.com/uploadcare/file-uploader/commit/5fa448c7d113866fcc488d0e94a2f8efccd8a9ab))
* **telemetry:** redact file names, URLs and metadata in event payloads ([dc64e72](https://github.com/uploadcare/file-uploader/commit/dc64e72374a2c3f20d00f77658adec439c5ed205))
* **telemetry:** report a picked source like every other action event ([e9ba278](https://github.com/uploadcare/file-uploader/commit/e9ba278cc2941611528f4fe3c6b79deaa9612430))
* **telemetry:** send what v1 sent, redacting only the credentials ([6c74c40](https://github.com/uploadcare/file-uploader/commit/6c74c40fde11b1f32948b854c933b648eb6800a5))
* **telemetry:** tag file-item removal and plugin actions as action events ([e063291](https://github.com/uploadcare/file-uploader/commit/e063291bc30b50c76ff77712b70a6fc9a2debad1))
* **theme:** draw scrollbars and native controls in the theme's colour scheme ([d75a813](https://github.com/uploadcare/file-uploader/commit/d75a81395a84554aa2b8e5c141efb082a27bc682))
* **thumb:** draw a local thumbnail once per entry, not once per thumb ([4fa31e5](https://github.com/uploadcare/file-uploader/commit/4fa31e5777815c1a0908c914525b87f74f25bd22))
* **thumb:** draw a very elongated image without an upscaled bitmap ([2e1bb15](https://github.com/uploadcare/file-uploader/commit/2e1bb15ab337e4aa55cb6a61fc2ff5d41546bfa7))
* **thumb:** keep the CDN thumbnail when the local drawing finishes after it ([5792c08](https://github.com/uploadcare/file-uploader/commit/5792c082b813a634709a98cab93808bc93cfcab7))
* **thumb:** reject a thumbnail the canvas could not encode with an Error ([fdb7458](https://github.com/uploadcare/file-uploader/commit/fdb7458d615fa54cb58d1341691dfe897916efa8))
* **thumb:** release a thumbnail that finishes drawing after its file was removed ([d0e8a26](https://github.com/uploadcare/file-uploader/commit/d0e8a26ffea7028297cdfe753ee32016e1b6b881))
* **thumb:** release the source image url after generating a thumbnail ([c766527](https://github.com/uploadcare/file-uploader/commit/c7665274c9b15b0481971417dcc971d6da506e5b))
* **thumb:** revoke thumbnail object URLs when the uploader is destroyed ([a053c1c](https://github.com/uploadcare/file-uploader/commit/a053c1ca3ce74f2794f3001d8c962cf4ed33b796))
* **types:** align modal event payload type test with narrowed modalId ([cd296d2](https://github.com/uploadcare/file-uploader/commit/cd296d228f3a2a15292cea23d3f60024bc8e955f))
* **types:** allow a uuid and CDN URL on idle and uploading entries ([80d34ed](https://github.com/uploadcare/file-uploader/commit/80d34ede3540f8d79a9b36b11b9e3be6ef19fd7c))
* **types:** export EventType as a value from the package entry ([abbd418](https://github.com/uploadcare/file-uploader/commit/abbd41897da75c1d11b390eb6bfa4e503da212b6))
* **types:** export the upload-client error classes as values ([23c40c8](https://github.com/uploadcare/file-uploader/commit/23c40c80d47e94dceb5d2a25cbdd40c5baf1a878))
* **types:** let iconHrefResolver return undefined ([4ccbc8a](https://github.com/uploadcare/file-uploader/commit/4ccbc8a6e35789eda3a7b3783e49a34d24a86288))
* **types:** publish the modalPresentation config option ([83e9fab](https://github.com/uploadcare/file-uploader/commit/83e9fabbb19aa3d88c8112de0a7a09545fdb9f2a))
* **types:** stop ConfigController built-in keys falling through to the untyped overloads ([0496744](https://github.com/uploadcare/file-uploader/commit/04967441e12787cbe38d276fa8b585dee29e6c19))
* **types:** type common-upload-progress with any collection status ([702fde4](https://github.com/uploadcare/file-uploader/commit/702fde46c33685ecc04041efad3d850fa875395d))
* **types:** type ConfigController keys against ConfigType & CustomConfig ([0f8fcc5](https://github.com/uploadcare/file-uploader/commit/0f8fcc5fd2b34d3c148cf19dea6b6044d70eb924))
* **types:** type file-added as idle or success ([42b534e](https://github.com/uploadcare/file-uploader/commit/42b534e563aee737d394c417ead2d64cbb3066f7))
* **types:** type file-url-changed with any entry status ([6c4affb](https://github.com/uploadcare/file-uploader/commit/6c4affbb144b27c034ab1cfcc779bd9248b42a29))
* **types:** type file-url-changed's cdnUrl as always set ([641d16e](https://github.com/uploadcare/file-uploader/commit/641d16e62f1ab7aeb56c9464a333dfc462eaf1e8))
* **types:** type the uploader's JSX tags under React 19 ([7312ec7](https://github.com/uploadcare/file-uploader/commit/7312ec778a921864b90b4396dbd926387abb6ca1))
* **uc-img:** let number flags be switched off by attribute ([671288d](https://github.com/uploadcare/file-uploader/commit/671288d1d880314f0f5e00fe0e0162369575f6e0))
* **uc-img:** read number-flag attributes as strings again, as v1 did ([151124c](https://github.com/uploadcare/file-uploader/commit/151124c68c9257c5aa9bfb32d1754823e7758ea1))
* **unsplash:** guard the define, stop shadowing accessKey, drop stale searches, make tiles buttons ([ea050b7](https://github.com/uploadcare/file-uploader/commit/ea050b7729802f19932456d3aa7570ecf6892a64))
* **upload-list:** drop a pending focus handoff when the list is released ([323578b](https://github.com/uploadcare/file-uploader/commit/323578b5c025a6377f16a43e7a720175bfc5d67c))
* **upload-list:** drop the gap below the last file, as 1.35 did ([90aefc9](https://github.com/uploadcare/file-uploader/commit/90aefc94ed07a22c8231ca247ee2d87440fb3df1))
* **upload-list:** drop the row focus highlight, as v1 shows none ([f3f0f9b](https://github.com/uploadcare/file-uploader/commit/f3f0f9b7e7f24be516782a944ea2fa043c9fd356))
* **upload-list:** keep row focus per list instead of per page ([5e33b87](https://github.com/uploadcare/file-uploader/commit/5e33b8736c16340351aa56d635626077ef62588b))
* **upload-list:** leave focus on a row's button when a key has no further row ([efa06b2](https://github.com/uploadcare/file-uploader/commit/efa06b2ca927ef3bd7058066f8509a36ef67ff0d))
* **upload-list:** move by the grid's current columns with the arrow keys ([fb7cabd](https://github.com/uploadcare/file-uploader/commit/fb7cabde302faa26abf8b3a99fa2820da9b80f9f))
* **upload-list:** name the icon-only add-more button ([ce10953](https://github.com/uploadcare/file-uploader/commit/ce10953d08a83837a636b38688a6fa5547e4f3b6))
* **upload-list:** render every row when the list does not scroll ([96a3b6d](https://github.com/uploadcare/file-uploader/commit/96a3b6dfc3e829ee85c2019ea19212f349dd9d6f))
* **upload-list:** settle on the row End jumps to in a long list ([609c6aa](https://github.com/uploadcare/file-uploader/commit/609c6aaea32263b6476783d80e0bebe98f35d894))
* **upload-list:** size the list spacers from the rows it renders ([ade4ce1](https://github.com/uploadcare/file-uploader/commit/ade4ce1e7d05244fd74414d4a8a988d99c3aef29))
* **upload-list:** size the virtual-list spacers through CSSOM ([c7c8c29](https://github.com/uploadcare/file-uploader/commit/c7c8c2974f43ffbfed5966ec1b6aef7523fd2fa6))
* **upload:** cancel the upload of a file its start listener removes ([7c65f2e](https://github.com/uploadcare/file-uploader/commit/7c65f2eafd4665d1adf42785204822801678e401))
* **upload:** clamp maxConcurrentRequests to a positive integer ([87c83bc](https://github.com/uploadcare/file-uploader/commit/87c83bcf39a0e9475878ca3b30226a434eae1218)), closes [#992](https://github.com/uploadcare/file-uploader/issues/992)
* **upload:** don't send a file again after its upload failed ([e54155c](https://github.com/uploadcare/file-uploader/commit/e54155cbf79130a7c2ba982fe8f412e9a5492407))
* **upload:** drop each upload's teardown listener once it settles ([2584b3b](https://github.com/uploadcare/file-uploader/commit/2584b3b1829f8b9e37c7183fd12945c60c32ebfe))
* **upload:** end the upload task of a file removed while queued or in a hook ([af8087f](https://github.com/uploadcare/file-uploader/commit/af8087fde62544b0bcf65fcef0b8c88b9f76e39d))
* **uploader:** don't export or register the undocumented <uc-uploader> in 1.x ([5c822cb](https://github.com/uploadcare/file-uploader/commit/5c822cb3a6ff05e9930bcc64d4e31d759850515b))
* **uploader:** don't leave a minted ctx-name over a ctxName set before upgrade ([ade6d5b](https://github.com/uploadcare/file-uploader/commit/ade6d5b50fbc8e9c2f6ebe15768902a0215ecc7e))
* **upload:** leave files rejected by validation out of the common progress ([187d30a](https://github.com/uploadcare/file-uploader/commit/187d30ac7b2ac67f878012d6d15a26c5a707be77))
* **upload:** pass cdnCnamePrefixed to upload-client ([15d8f00](https://github.com/uploadcare/file-uploader/commit/15d8f005cc47e7a09beeafde65a76bafea687725))
* **upload:** start a new common-progress batch once the previous one settled ([cb8ac0e](https://github.com/uploadcare/file-uploader/commit/cb8ac0eeaa3fa3d95a94598002857c08dd112797))
* **upload:** type-check the options handed to upload-client ([5f77aa6](https://github.com/uploadcare/file-uploader/commit/5f77aa62bab71788f5c079ea69bec4807426fc08))
* **upload:** wait for a file's validators before uploading it ([ed5df70](https://github.com/uploadcare/file-uploader/commit/ed5df70403fdb9a59593baeeb528f01b2d745f03))
* **v2-m11:** cancel pending WindowHeightTracker flush on detach (CodeRabbit) ([ef994f4](https://github.com/uploadcare/file-uploader/commit/ef994f440fb7dd5869181db075e6b5ffd6d13980))
* **v2:** address PR [#1039](https://github.com/uploadcare/file-uploader/issues/1039) review (container robustness, SignalMap/routing edges, LocaleController tracking, comment/fallback fixes) ([018b748](https://github.com/uploadcare/file-uploader/commit/018b748959340946208eca88c52ab88c9a438c90))
* **v2:** address PR [#1041](https://github.com/uploadcare/file-uploader/issues/1041) review (container/registry robustness, doc + test-hygiene fixes) ([d5ce1cd](https://github.com/uploadcare/file-uploader/commit/d5ce1cd5196f1c66efa994a998e95540af54c66c))
* **v2:** address PR [#1042](https://github.com/uploadcare/file-uploader/issues/1042) review (LocaleManager rewire isolate-and-warn + doc reword) ([c44eee8](https://github.com/uploadcare/file-uploader/commit/c44eee8b07907e81018ca394fee36fe558ef9109))
* **v2:** keep Copyright [hidden] on the host so inline :has() CSS still applies (M-god step 6a review) ([1f6500f](https://github.com/uploadcare/file-uploader/commit/1f6500f68df36939c07b27370001b336a95434dd))
* **v2:** logger review fixes — real editor debug gate, lazy() brand, hook-unregister log, tests + docs ([de6f0ae](https://github.com/uploadcare/file-uploader/commit/de6f0ae731007c5b78021644acd162e1ea55e7cd)), closes [#1044](https://github.com/uploadcare/file-uploader/issues/1044)
* **v2:** logger review follow-ups (debug via console.log; sync teardown hardening) ([a78c426](https://github.com/uploadcare/file-uploader/commit/a78c426e46eef02f2ee0bf12c65ef9815bd23095))
* **v2:** logger round-2 review — group() returns a matched closer ([528d94d](https://github.com/uploadcare/file-uploader/commit/528d94d6323949ac0d8c10daba96f188baf59874))
* **v2:** preserve v1 cancel-button recompute semantics in FileUploaderInline (M-god step 6b-4 review) ([b18ae13](https://github.com/uploadcare/file-uploader/commit/b18ae135315dde8e83bc8d76c2a94b4f9056d352))
* **v2:** redact secureSignature from debug logs; non-throwing config-log fallback (CodeRabbit) ([66dfccf](https://github.com/uploadcare/file-uploader/commit/66dfccfbc6ca4149649bcb083df5e6707d6ae8d5))
* **v2:** restore NUL delimiter in ValidationController rerun snapshot ([6e27502](https://github.com/uploadcare/file-uploader/commit/6e27502f87a265a3064e102a8c4781b4af09a655))
* **v2:** SignalMap.seed keeps materialized signal in sync (M-god step 3a review) ([f1ec989](https://github.com/uploadcare/file-uploader/commit/f1ec989296939156de5e83b748384634a4851f86))
* **validation:** call no validator for a file removed while its run was queued ([b599831](https://github.com/uploadcare/file-uploader/commit/b599831d10d65912afdaddf3d3229e3f16f96af6))
* **validation:** drop the earlier error of a validator that throws ([a38cab2](https://github.com/uploadcare/file-uploader/commit/a38cab2d46939172703ced09131230bdf18a440f))
* **validation:** mark an entry pending when its validation is requested ([74e2dcf](https://github.com/uploadcare/file-uploader/commit/74e2dcf0c848e3c26e40a6ca3db1a5f4c8e096de))
* **validation:** skip an empty slot in fileValidators ([8dad5a5](https://github.com/uploadcare/file-uploader/commit/8dad5a5ea54256c2838756e503d4849af710adc2))
* **validation:** throttle the validation queue instead of debouncing it ([e4f1b58](https://github.com/uploadcare/file-uploader/commit/e4f1b58edc10e6f1f64eeccc92d9557783b36e81))
* **validation:** wait for every validator and log a failure that escapes its task ([48f1d96](https://github.com/uploadcare/file-uploader/commit/48f1d96cddb267be9eeee7529e0a15e378e736f0))
* warn once that both secure delivery proxy options are set ([2344c3d](https://github.com/uploadcare/file-uploader/commit/2344c3d99106d42fd49559a0f74cf23da8415674))


### Features

* **a11y:** add A11y.unregisterBlock with disarm-on-last-scope ([420201b](https://github.com/uploadcare/file-uploader/commit/420201b9327ecbee15e8ebec17bc9787c73d382e))
* add DOM-free UploadCollectionController (M3b-1) ([56e1185](https://github.com/uploadcare/file-uploader/commit/56e11858a192fd43c3ca36655112bb163efdd0e2))
* add DOM-free ValidationController (M3c-1) ([d573db2](https://github.com/uploadcare/file-uploader/commit/d573db21943496a5b68a21717501eeec55cc2219))
* add OutputCollectionState.snapshot() ([6b97bbb](https://github.com/uploadcare/file-uploader/commit/6b97bbba4632cbaa5ee861f9b2fb710215189c72))
* add v2 controller primitives (M0 foundations) ([0764c4d](https://github.com/uploadcare/file-uploader/commit/0764c4d3e2aa56dfe54592888557c893a061364a))
* **api:** return the added files' internal IDs from addFilesFromObjects ([58f4d92](https://github.com/uploadcare/file-uploader/commit/58f4d92853542bf1f735c70ac17377709be7f698))
* **camera:** open the camera without sound when only the microphone is refused ([6f1a7a4](https://github.com/uploadcare/file-uploader/commit/6f1a7a404ba2f32bd9f7ac8d4288d96c1038343e))
* **cloud-image-editor:** announce the crop's size and position after an arrow key ([8e780c6](https://github.com/uploadcare/file-uploader/commit/8e780c613342115bf4b997da54f4dd1fbb369a42))
* **cloud-image-editor:** bind an editor block's async work to its adoption ([8d1d946](https://github.com/uploadcare/file-uploader/commit/8d1d9463438090e8176bf51b96e3f8dcbad23dd6))
* **cloud-image-editor:** drag the crop box's corners from the keyboard ([ce19c89](https://github.com/uploadcare/file-uploader/commit/ce19c8967c7ea8ee219c613a5086fa060775c57e))
* **cloud-image-editor:** Escape cancels the editor inside the uploader's dialog ([288c558](https://github.com/uploadcare/file-uploader/commit/288c558d148016a56486d4f40d4964423855c0de))
* **cloud-image-editor:** localize the network problems screen ([e7fe790](https://github.com/uploadcare/file-uploader/commit/e7fe79070fe179a4f581c5139705c8fa79697b7a))
* **cloud-image-editor:** move and resize the crop box from the keyboard ([9cfbd6a](https://github.com/uploadcare/file-uploader/commit/9cfbd6ac7383d42a47b2f2feccc27d709eb05581))
* **collection-state:** CollectionStateController implements ReactiveStore (+ setMany, notify, values) ([33e988d](https://github.com/uploadcare/file-uploader/commit/33e988dbf1148bdb0831365407639a32cf797062))
* **config:** atomic per-key ConfigController.observe ([228d691](https://github.com/uploadcare/file-uploader/commit/228d6911047b58897dc1df71e63e6bbc56510513))
* **config:** ConfigController implements ReactiveStore (+ setMany) ([d45793e](https://github.com/uploadcare/file-uploader/commit/d45793e1a5745cef208054cd8ab1b2c0148a0767))
* **config:** ConfigController owns the descriptor registry + schema signal ([653c9de](https://github.com/uploadcare/file-uploader/commit/653c9de58e37088667b0d18db921e891797d903e))
* **config:** ConfigKeyDescriptor model + built-in descriptors ([c029cb9](https://github.com/uploadcare/file-uploader/commit/c029cb9d175317a1dc4355ed1ed44541fb7abed8))
* **config:** derive config host type surface from ConfigType ([0384bd6](https://github.com/uploadcare/file-uploader/commit/0384bd67b5bbc50a1fef299375a15d7c12f86dc0))
* **config:** DOM-free config-writer registry on ConfigController ([e824987](https://github.com/uploadcare/file-uploader/commit/e82498759f1e807e639c4bcd2d69708b20477994))
* **config:** plugin-agnostic, descriptor-driven config (L1+L2 + serialization) ([f724aaf](https://github.com/uploadcare/file-uploader/commit/f724aafe615a2d5678e99df5180d274172cf4097))
* **config:** WithConfig mixin — block-agnostic config hosting ([a0a1bd4](https://github.com/uploadcare/file-uploader/commit/a0a1bd4b9db17a36c6b3fbf7691e87e64cb499c8))
* **controllers:** clipboard + telemetry on the v2 architecture (M8) ([1b153cc](https://github.com/uploadcare/file-uploader/commit/1b153cca4cea9f93e6dc8dcfecb88c915998671d))
* **controllers:** extract upload mechanics into UploadController (M4b) ([d9c2b76](https://github.com/uploadcare/file-uploader/commit/d9c2b76051b8a42696050d975be01a5f612b1c8f))
* **controllers:** port SecureUploadsManager to SecureUploadsController (M4a) ([54ea84d](https://github.com/uploadcare/file-uploader/commit/54ea84d56f170e87a266a399820d2daa0b5ae2d4))
* **di:** give each controller container a lifetime ([59b68f0](https://github.com/uploadcare/file-uploader/commit/59b68f0e434b89ab608d978eafab945932feb874))
* **di:** injectOrNull — null-tolerant field form of useOrNull ([2464d12](https://github.com/uploadcare/file-uploader/commit/2464d126afe8e69f1c2e6f550e1df6a5fb01e020))
* **di:** whenController callback may return teardowns ([feb1dec](https://github.com/uploadcare/file-uploader/commit/feb1dec4d312f4eaf49e0c055ad3e810364c2d57))
* **dynamic-btn:** show when a dragged file is over the button ([cc6c8c3](https://github.com/uploadcare/file-uploader/commit/cc6c8c374cdbd382e3ca8de6c18337c46d7972ca))
* **editor-isolation:** editor controller owns config + element props ([c17a506](https://github.com/uploadcare/file-uploader/commit/c17a50628196d232cb7bd186b8154fc5735aab68))
* **editor-isolation:** removable uc-config compat bridge; drop ensureUploaderCtx ([5403e39](https://github.com/uploadcare/file-uploader/commit/5403e39f7adeef2b9fb6332b6d7708533d2744a9)), closes [#3](https://github.com/uploadcare/file-uploader/issues/3)
* **editor-isolation:** vendored standalone locale + standalone init ([d7c995c](https://github.com/uploadcare/file-uploader/commit/d7c995ccb91d48642250d4b78f40ceb57bfb1721))
* **editor-state:** StateController implements ReactiveStore (Listeners-backed) ([f7f9dcd](https://github.com/uploadcare/file-uploader/commit/f7f9dcd20f8c17411c1d67fc1b806e3995b528e7))
* **events:** EventBus backbone + reactive DOM bridge (M5a) ([39b0320](https://github.com/uploadcare/file-uploader/commit/39b0320d87092d9869d64d1f4b9a0177202e36fb))
* **events:** extract collection→events derivation into a controller (M5b) ([05d31f1](https://github.com/uploadcare/file-uploader/commit/05d31f14c02f4fa9ad8e2f840fe7d828343f4f0f))
* **lit:** [@effect](https://github.com/effect) + [@subscription](https://github.com/subscription) auto-disposed reactive-method decorators ([6059dce](https://github.com/uploadcare/file-uploader/commit/6059dceb2bd16e758c9c3afc736bc810f120b525))
* **lit:** [@subscription](https://github.com/subscription) may return a disposer array; CollectionStateController.observe ([6fe16ab](https://github.com/uploadcare/file-uploader/commit/6fe16abdcd7a087c03790e4bdb8c46b508a92eb1))
* **lit:** @throttled/[@debounced](https://github.com/debounced) adoption-scoped method decorators ([63ce78f](https://github.com/uploadcare/file-uploader/commit/63ce78f8cf4006d015dfa7a491abb7c5af433177))
* **lit:** bind a block's async work to its adoption ([4435edf](https://github.com/uploadcare/file-uploader/commit/4435edfbbfc3896ab52103abc2f1b037588c1e3c))
* **locale:** LocaleController implements ReactiveStore (+ observe/setMany/notify) ([ae64954](https://github.com/uploadcare/file-uploader/commit/ae64954b3a83faf9199e5d35bda0cc1fc000047f))
* **m10a:** construct *pluginManager in a ChildBlock-reachable seam ([d3c2b1b](https://github.com/uploadcare/file-uploader/commit/d3c2b1b479bd7e8cb7a73b94237b71c444b86b71))
* **m12:** CloudImageEditorController + editor @lit/context + EditorChildBlock base ([147a863](https://github.com/uploadcare/file-uploader/commit/147a863827f772422391542127001ec17b41af71))
* **m9a:** ChildBlock — v2 UI adapter base for blocks ported off SymbioteCompatMixin ([64a7adf](https://github.com/uploadcare/file-uploader/commit/64a7adfe668bdcf229cce160584f42769ffde2bf))
* **m9c:** l10n helper on ChildBlock over the ctx locale facade ([64f763f](https://github.com/uploadcare/file-uploader/commit/64f763f8d3f604a32f626f98fc855f2947026b6a))
* **m9f:** subRouter/subActivity on ChildBlock; ActivityChildBlock base ([2cd0046](https://github.com/uploadcare/file-uploader/commit/2cd004680d762d81db78fd716fe3b5c846c8a422))
* **m9i:** ChildBlock.emit + routerOrNull; container coverage gaps ([0a97d96](https://github.com/uploadcare/file-uploader/commit/0a97d96779f0997fcf0f1a094e41887eec1359a5))
* **m9k:** UploaderController constructs and owns the ctx-scope managers; controller-level emit ([bbe24ee](https://github.com/uploadcare/file-uploader/commit/bbe24eef64704d848157b29dda85e249f6b01fe2))
* **m9l:** UploaderController constructs and owns a11y and clipboard ([07ae771](https://github.com/uploadcare/file-uploader/commit/07ae77166e621c7acc9cc9bc50edcac4c5cb9de8))
* **m9m:** UploaderController.attachUploaderScope owns the upload stack behind the uploader-present gate ([df35be9](https://github.com/uploadcare/file-uploader/commit/df35be903be27b021e65ec25342e81bfe9ac9b99))
* **m9n:** ensureUploaderCtx — one controller-side ctx creation seam with owned seeds ([9b3c638](https://github.com/uploadcare/file-uploader/commit/9b3c638fb0001b6132b694e80436afcee3123f40))
* **m9o:** ChildBlock self-bootstraps its ctx when no block has created it yet ([e915a53](https://github.com/uploadcare/file-uploader/commit/e915a53255a765fafa553dd68732a2a595b456f2))
* **m9o:** unified consumer-refcount ctx teardown (v1 blocksRegistry + v2 whenAvailable consumers) ([502594b](https://github.com/uploadcare/file-uploader/commit/502594b18c980ebb247d0dc68eb6be25ff612c4d))
* **m9q:** ensureUploaderCtx registers controller-owned ctx-scope keys + activates locale ([ac064ff](https://github.com/uploadcare/file-uploader/commit/ac064ff971fbddd52351f50b6a0cd86620c58145))
* **m9r:** SolutionChildBlock base on the v2 ChildBlock architecture ([4b416a9](https://github.com/uploadcare/file-uploader/commit/4b416a9eeb4e7675b5787619764eecece2c6133f))
* **modal:** add internal modalPresentation option to open modals inline ([5c29ab0](https://github.com/uploadcare/file-uploader/commit/5c29ab0a20b981e80f0b7ea406578246a95be506))
* **observe:** add { immediate } option; drop manual eager-then-observe ([ede3aac](https://github.com/uploadcare/file-uploader/commit/ede3aac366f436ec2ae468246347c00f0869ff55))
* own the upload collection on UploaderController (M3b-2) ([039ab78](https://github.com/uploadcare/file-uploader/commit/039ab785c823585e7d30d480529c93ec803599b2))
* **plugins:** let an activity name its dialog with a label ([dcc21c7](https://github.com/uploadcare/file-uploader/commit/dcc21c75cb6522d2e34628a815f2fa043e26ad2d))
* **plugins:** make PluginManager DOM-free as PluginController (M6) ([064b862](https://github.com/uploadcare/file-uploader/commit/064b8624a58e89047b5347bc5c45333382a180a7))
* **plugins:** minimal pluginApi.router with afterFileAdd intent ([6261209](https://github.com/uploadcare/file-uploader/commit/6261209b3a1398c7aba950c90fee499a950b9050))
* **plugins:** pluginApi.router exposes traverse instead of afterFileAdd ([78bf76d](https://github.com/uploadcare/file-uploader/commit/78bf76d22f3042504d5974af51ea4e5ee51b083a))
* **plugins:** type plugin labels as declared l10n keys or plainText() ([2f1a4c7](https://github.com/uploadcare/file-uploader/commit/2f1a4c7a720b1bfd64c82e091862b529a1b25b76))
* **readme.md:** updated logo ([#1098](https://github.com/uploadcare/file-uploader/issues/1098)) ([f0e43c0](https://github.com/uploadcare/file-uploader/commit/f0e43c0a4472f503b0ac4802957513dcfb001543))
* replace ValidationManager with ValidationController (M3c-2) ([73e68fe](https://github.com/uploadcare/file-uploader/commit/73e68fea1fbf67e195dc42ed2df9c2d9c01c1ebb))
* route config state through ConfigController (M1) ([87560e3](https://github.com/uploadcare/file-uploader/commit/87560e38dcd0c7d97831fa0af9b380f9bd2847c3))
* route locale state through LocaleController (M2) ([c709342](https://github.com/uploadcare/file-uploader/commit/c709342bf8e83cc451cc2ed14ab99cc098a6f859))
* **router:** activity guards replace the imperative empty-list redirect ([1496137](https://github.com/uploadcare/file-uploader/commit/1496137b011a9f051c38ff04b1e75b672aef11c0))
* **router:** add `navigate()` public API; deprecate setCurrentActivity/setModalState ([2481ca9](https://github.com/uploadcare/file-uploader/commit/2481ca90560c6658d0ab4921b2cda54a693d9cd3))
* **router:** adopt the v2 spike RouterController (RouteTable + history) ([15cb028](https://github.com/uploadcare/file-uploader/commit/15cb0281f345482ae47cbe0a59d1164cd7ab993b))
* **router:** DOM-free dual-slot RouterController foundation (M7, step 1) ([b856bca](https://github.com/uploadcare/file-uploader/commit/b856bca6828dd9a6ad0ce22d04906c81784f0c0b))
* **router:** intent-based navigation via traverse() + edge hooks ([e13591a](https://github.com/uploadcare/file-uploader/commit/e13591af12ee37d3cbeffc604ae777dd931c6469))
* **router:** route-table navigation hooks; drop undocumented activity config ([80457be](https://github.com/uploadcare/file-uploader/commit/80457be2e6d665f6b554acecdd44737f98dacebd))
* **router:** swap the activity/modal engine to the v2 RouterController ([7efd789](https://github.com/uploadcare/file-uploader/commit/7efd78994d3f350fda2cfa506ad3265d998ed196))
* **store:** ReactiveStore contract + SignalMap.getTracked/setMany ([35bf2bd](https://github.com/uploadcare/file-uploader/commit/35bf2bd2d0c3af3412ba8579bb1db6944c469208))
* **telemetry:** report the files picked in an external source ([76a66d2](https://github.com/uploadcare/file-uploader/commit/76a66d2c28f268045277559e0d046e2a39e6bf1a))
* **upload-list:** move through the files with the keyboard ([1b12442](https://github.com/uploadcare/file-uploader/commit/1b124429d595bb34c0ff9e20410e9a0f5bd27de8))
* **uploader:** unified <uc-uploader> host + MO-only WithConfig attrs ([8b6ff0f](https://github.com/uploadcare/file-uploader/commit/8b6ff0f0a2514994ddb704fd383736c2b22e1e2d))
* **v2:** 3-color logger badge (uc/ctx/scope) + per-plugin scoped logger in setup() ([8e29ba2](https://github.com/uploadcare/file-uploader/commit/8e29ba2ac7edb22befb9ebd96f8ecba556aeeea3))
* **v2:** ChildBlock static uses + this.use() + SignalWatcher; migrate Copyright (M-god step 6a) ([a5dfef7](https://github.com/uploadcare/file-uploader/commit/a5dfef7599eea78ccb458f94f2d5e53db1427d97))
* **v2:** DI container + @inject/[@signal](https://github.com/signal)State/mixins foundation (M-god step 1) ([62b17b5](https://github.com/uploadcare/file-uploader/commit/62b17b5e8eb86effec93e2596c572ae504bfb2f3))
* **v2:** expand router debug logs — hooks, strategy, configure, per-slot activities ([416a5bb](https://github.com/uploadcare/file-uploader/commit/416a5bb73ad9eb8dab1b6ba72194cd5be8906147))
* **v2:** shared editor `_log` + guard-unregister log ([d3e2a0c](https://github.com/uploadcare/file-uploader/commit/d3e2a0c60a23716472a0f5f7ba20744fc92239a2))


### Performance Improvements

* **build:** give dist's reserved mangled names a shorter prefix ([980212b](https://github.com/uploadcare/file-uploader/commit/980212b75f891f1fbc18be535a06bf8fb6001aeb))
* **build:** mangle internal props in the npm build too ([3f2ec15](https://github.com/uploadcare/file-uploader/commit/3f2ec15a0767356d6555bc4d3e0a37d4ddb4f5bf))
* **build:** minify the web bundles with terser and measure them as shipped ([895cf2a](https://github.com/uploadcare/file-uploader/commit/895cf2a7bc1a0437ab13fcf3f23a0522ccda1631))
* **build:** shrink web bundles via SVGO + WithConfig attr flush ([faa9445](https://github.com/uploadcare/file-uploader/commit/faa94451c2c02a0d5955e56b3da17dffa284eb39))
* **child-block:** skip the test-id subtree scan while testMode is off ([cfe5f2b](https://github.com/uploadcare/file-uploader/commit/cfe5f2bba7be9792e26ee70851e622caa10c6e91))
* **cloud-image-editor:** fetch the image alongside its info request ([ab42878](https://github.com/uploadcare/file-uploader/commit/ab42878b073746de8303eaa4fbf4bde797b80a21))
* **cloud-image-editor:** keep the plugin stack out of the editor bundle ([072a687](https://github.com/uploadcare/file-uploader/commit/072a68736f38311d3b118bbaa34d04f98d747848))
* **cloud-image-editor:** trim the editor bundle ([4d444a7](https://github.com/uploadcare/file-uploader/commit/4d444a7f767c6efeb337e9365374df3b9988194c))
* **file-item:** collapse ~15 per-key entry observers into one keyed subscription ([b8b8a0e](https://github.com/uploadcare/file-uploader/commit/b8b8a0efb5826322524db295cc0e9590463ddee1))
* **file-item:** derive row state from tracked entry reads instead of [@state](https://github.com/state) mirrors ([d1a2c57](https://github.com/uploadcare/file-uploader/commit/d1a2c57ce6a2fccf3000f6943e93f081b0ea84bd))
* **file-item:** O(1) focus, one-shot intersection observer, unsubscribe on disconnect ([0498ccf](https://github.com/uploadcare/file-uploader/commit/0498ccf77386b549c5c9b8da82a5f0f042ddf51e))
* **icons:** dedupe identical gradient defs in svg sprites ([6b4acf2](https://github.com/uploadcare/file-uploader/commit/6b4acf293b0ff4e93b1ad332dbd6fa357cb89457))
* **icons:** drop eight icons nothing uses ([aaddefe](https://github.com/uploadcare/file-uploader/commit/aaddefea84e50606f548fa37ea0349c9fa6eb9de)), closes [#965](https://github.com/uploadcare/file-uploader/issues/965)
* **list:** bulk-add debounce + inline virtualization follow-ups ([#1054](https://github.com/uploadcare/file-uploader/issues/1054)) ([912980a](https://github.com/uploadcare/file-uploader/commit/912980a0344cb87275f613235f695a0e02787285))
* **output-state:** partition entries by status in one pass ([d5f37aa](https://github.com/uploadcare/file-uploader/commit/d5f37aa6e14a3cbfd415cb6ff68c39b99f9d9517))
* **plugins:** parse sourceList once when checking the external sources ([bffd86d](https://github.com/uploadcare/file-uploader/commit/bffd86d9d489208d5afb927f78cb19013c09ca13))
* **thumb:** arm no second generation pass when binding to an entry ([77d0dec](https://github.com/uploadcare/file-uploader/commit/77d0dec8c03c40cf3f89f275af6e41cd6cd62b04))
* **thumb:** decode local thumbnails off the main thread ([0fbcb72](https://github.com/uploadcare/file-uploader/commit/0fbcb72d8289177cf9b6319c639b112d5a1b3a0e))
* **thumb:** draw four local thumbnails at a time, newest request first ([68d7d7d](https://github.com/uploadcare/file-uploader/commit/68d7d7d3255218c0922cfd25819e7bb385a3e221))
* **thumb:** generate each thumbnail once ([fa33ede](https://github.com/uploadcare/file-uploader/commit/fa33eded6785405c663cc713cbf2cbfbbecab5b8))
* **thumb:** skip measuring a local file that has its thumbnail ([65d598b](https://github.com/uploadcare/file-uploader/commit/65d598ba739bff5802a9a2374b7ec3d224d076ad))
* **upload-events:** drop wasted O(N) output build + fold error scans ([1bf2303](https://github.com/uploadcare/file-uploader/commit/1bf230385017f32258ba72e63cfc43807d5a2351))
* **upload-list:** compute toolbar summary from raw entries, drop per-render layout read ([e6f4b0c](https://github.com/uploadcare/file-uploader/commit/e6f4b0cf490a1b62df65b55589b25a9c2f4451d5))
* **upload-list:** fill in rows and thumbnails a screen before they scroll in ([5356838](https://github.com/uploadcare/file-uploader/commit/5356838dc21bd875acd749f344bb9d5af48f66f9))
* **upload-list:** keep the list windowed while it is hidden ([dbab470](https://github.com/uploadcare/file-uploader/commit/dbab4703002371a4e677c6c91e44f7622972ef25))
* **upload-list:** virtualize the file list with a shared VirtualListController ([307cedc](https://github.com/uploadcare/file-uploader/commit/307cedc5330e44709535110198c57a933238bb24))


### Reverts

* Revert "chore(build): raise the uploader bundle limits by 1 kB" ([ceea33c](https://github.com/uploadcare/file-uploader/commit/ceea33c075fcaaf5a7c3cdc9311c8eaf5e897e3f))
* Revert "refactor(upload-list): move roving focus into a RovingRowController" ([e75b168](https://github.com/uploadcare/file-uploader/commit/e75b1680596a84a5d9a1abdc6576967b34d0768e))
* Revert "fix(telemetry): keep common-upload-start and collection-only failures out, as 1.35 did" ([73fe5d1](https://github.com/uploadcare/file-uploader/commit/73fe5d15f67cb884a2469fe108d673ed38cbf1bd))
## [1.36.1](https://github.com/uploadcare/file-uploader/compare/v1.36.0...v1.36.1) (2026-11-09)


### Bug Fixes

* **upload:** pass cdnCnamePrefixed to upload-client ([#1116](https://github.com/uploadcare/file-uploader/issues/1116)) ([0513be7](https://github.com/uploadcare/file-uploader/commit/0513be7fb7f9461ded403c47cc0f8e43ae0434d9))
# [1.36.0](https://github.com/uploadcare/file-uploader/compare/v1.35.1...v1.36.0) (2026-11-04)


### Bug Fixes

* emit file-upload-start before file-upload-progress, and run e2e against an emulator ([#1081](https://github.com/uploadcare/file-uploader/issues/1081)) ([401f6fe](https://github.com/uploadcare/file-uploader/commit/401f6fe6aeff94b8709e92b40ddf2dddca724959))


### Features

* **camera:** capture settings for aspect ratio, resolution, audio, video format and constraints ([#1109](https://github.com/uploadcare/file-uploader/issues/1109)) ([43b701c](https://github.com/uploadcare/file-uploader/commit/43b701cf0b8fceec4756a97317b078970a8db79b))
* **readme.md:** updated logo ([#1098](https://github.com/uploadcare/file-uploader/issues/1098)) ([0b9d4c6](https://github.com/uploadcare/file-uploader/commit/0b9d4c6bad185572235a6433b7f00a094376cbc6))
## [1.35.1](https://github.com/uploadcare/file-uploader/compare/v1.35.0...v1.35.1) (2026-10-06)


### Bug Fixes

* **config:** accept a token provider as authToken ([#1096](https://github.com/uploadcare/file-uploader/issues/1096)) ([47e76b6](https://github.com/uploadcare/file-uploader/commit/47e76b68af013afdc80da80226960c912ccfb9ee))
# [1.35.0](https://github.com/uploadcare/file-uploader/compare/v1.34.1...v1.35.0) (2026-10-05)


### Features

* an upload whose auth token is refused as expired, or out of operations, is retried once with a fresh token. The uploader hands upload-client 6.23.0 a token provider, which is what lets it drop the refused token and ask for another ([#1094](https://github.com/uploadcare/file-uploader/issues/1094)) ([f2ace58](https://github.com/uploadcare/file-uploader/commit/f2ace587c5362b09ea9827a7e6fd84fa49f4095f))
* `authToken` also accepts a provider (`{ getToken, invalidate }`), for an app that runs its own token cache. It is passed through as is, rather than cached a second time ([#1094](https://github.com/uploadcare/file-uploader/issues/1094)) ([f2ace58](https://github.com/uploadcare/file-uploader/commit/f2ace587c5362b09ea9827a7e6fd84fa49f4095f))
* `getAuthToken()` returns that provider rather than a bare function. Forwarding it, which is what it is for, is unchanged; code that called the result directly should call `getToken()` on it ([#1094](https://github.com/uploadcare/file-uploader/issues/1094)) ([f2ace58](https://github.com/uploadcare/file-uploader/commit/f2ace587c5362b09ea9827a7e6fd84fa49f4095f))


## [1.34.1](https://github.com/uploadcare/file-uploader/compare/v1.34.0...v1.34.1) (2026-09-30)


### Bug Fixes

* **dropdown:** updated style based on --uc-radius ([#1092](https://github.com/uploadcare/file-uploader/issues/1092)) ([d5a84ea](https://github.com/uploadcare/file-uploader/commit/d5a84ead74ea2be730c90adbeade3904c6d2577d))
# [1.34.0](https://github.com/uploadcare/file-uploader/compare/v1.33.2...v1.34.0) (2026-09-22)


### Bug Fixes

* use video-camera icon for camera plugin video mode ([#1084](https://github.com/uploadcare/file-uploader/issues/1084)) ([9c4d24a](https://github.com/uploadcare/file-uploader/commit/9c4d24a8209da3651598bb4c95d41f03201e8af0))


### Features

* JWT auth token for the Upload API ([#1083](https://github.com/uploadcare/file-uploader/issues/1083)) ([7213195](https://github.com/uploadcare/file-uploader/commit/721319549f4072652963de177322c408580f565d)). Set [`authToken`](https://uploadcare.com/docs/file-uploader/options/#auth-token) to a token or to a function returning one, and the uploader sends it with every upload, caching it and replacing it before it expires. See [Upload control with auth tokens](https://uploadcare.com/docs/security/secure-uploads-auth-token/).
## [1.33.2](https://github.com/uploadcare/file-uploader/compare/v1.33.1...v1.33.2) (2026-08-26)


### Bug Fixes

* **modal:** keep an activity that a closing modal doesn't own ([#1073](https://github.com/uploadcare/file-uploader/issues/1073)) ([c95ea8e](https://github.com/uploadcare/file-uploader/commit/c95ea8ee3fee5f8d067a97b240c042177d0942ff))
## [1.33.1](https://github.com/uploadcare/file-uploader/compare/v1.33.0...v1.33.1) (2026-07-29)


### Bug Fixes

* **dynamic-btn:** compute dropdown icon in willUpdate and refine plain mode ([#1065](https://github.com/uploadcare/file-uploader/issues/1065)) ([f2c6b91](https://github.com/uploadcare/file-uploader/commit/f2c6b91af2e6ed2d58e9afa06009d8511b006594))
# [1.33.0](https://github.com/uploadcare/file-uploader/compare/v1.32.1...v1.33.0) (2026-07-28)


### Features

* **dynamic-btn:** added `plain` view mode with default icon ([#1061](https://github.com/uploadcare/file-uploader/issues/1061)) ([a82dd0e](https://github.com/uploadcare/file-uploader/commit/a82dd0e68e10e169f2af1ca98ef57b4a9bbd9713))
## [1.32.1](https://github.com/uploadcare/file-uploader/compare/v1.32.0...v1.32.1) (2026-07-24)


### Bug Fixes

* use location.ancestorOrigins to detect top-level origin ([91d39cd](https://github.com/uploadcare/file-uploader/commit/91d39cd353422955020c287d5a32c9baacbab647))
# [1.32.0](https://github.com/uploadcare/file-uploader/compare/v1.31.2...v1.32.0) (2026-07-13)


### Features

* **config:** add tags option for file uploads ([#998](https://github.com/uploadcare/file-uploader/issues/998)) ([586d5e0](https://github.com/uploadcare/file-uploader/commit/586d5e0332932088dd4734bfa6ec7585f4dbffd3)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#tags) for details.
## [1.31.2](https://github.com/uploadcare/file-uploader/compare/v1.31.1...v1.31.2) (2026-07-07)

### Internal features

* **api:** add `replaceFile` method — swap a file in place via remove + add at position ([bb739bb](https://github.com/uploadcare/file-uploader/commit/bb739bb9))
* **types:** expose augmentable CustomLocaleDefinition for locale overrides ([04ff43b](https://github.com/uploadcare/file-uploader/commit/04ff43b7))

## [1.31.1](https://github.com/uploadcare/file-uploader/compare/v1.31.0...v1.31.1) (2026-06-08)


### Bug Fixes

* **dynamic-button:** refined loading UI, snippets, and source variants ([44201fa](https://github.com/uploadcare/file-uploader/commit/44201fa0fdb72b108815c0e1558942f8340024f4))
* **thumb:** added support for rounding size values using Math.round ([#982](https://github.com/uploadcare/file-uploader/issues/982)) ([57c111b](https://github.com/uploadcare/file-uploader/commit/57c111b8b528cb856b5a5ef53d5e70179ce98ab7))
# [1.31.0](https://github.com/uploadcare/file-uploader/compare/v1.30.2...v1.31.0) (2026-06-03)


### Bug Fixes

* **plugins:** make plugin registry changes reactive (batched) ([ce5034a](https://github.com/uploadcare/file-uploader/commit/ce5034aab2640ee5caee6868c31daf630165b97d))


### Features

* add addFileFromUploadcareFile to the uploader public API ([34e4b5e](https://github.com/uploadcare/file-uploader/commit/34e4b5e53bd24b8f63df5650c183705e816c1f1b))
## [1.30.2](https://github.com/uploadcare/file-uploader/compare/v1.30.1...v1.30.2) (2026-05-28)
## [1.30.1](https://github.com/uploadcare/file-uploader/compare/v1.30.0...v1.30.1) (2026-05-27)
# [1.30.0](https://github.com/uploadcare/file-uploader/compare/v1.29.1...v1.30.0) (2026-05-27)


### Features

* added smart dynamic button ([#964](https://github.com/uploadcare/file-uploader/issues/964)) ([2eac447](https://github.com/uploadcare/file-uploader/commit/2eac447b47f92e92d280aa1af5a60baa2ca6724b))
## [1.29.1](https://github.com/uploadcare/file-uploader/compare/v1.29.0...v1.29.1) (2026-04-30)


### Bug Fixes

* **config:** preserve pre-existing values when registering custom configs ([#960](https://github.com/uploadcare/file-uploader/issues/960)) ([9e06f98](https://github.com/uploadcare/file-uploader/commit/9e06f98a9a91bdbe6999b768ab3745d5cfd26947))

### Features

* **theme:** add shorthand radius classes (`.uc-radius-none`, `.uc-radius-small`, `.uc-radius-medium`, `.uc-radius-large`) ([df9f112](https://github.com/uploadcare/file-uploader/commit/df9f112fd8e2db72f9cb6efcb2946d7805f5bc22))

# [1.29.0](https://github.com/uploadcare/file-uploader/compare/v1.28.0...v1.29.0) (2026-04-22)

This release introduces the [Plugin API](https://uploadcare.com/docs/file-uploader/plugins/) — extend the File Uploader with custom upload sources, activities, file actions, and hooks.

All documented public API remains the same, but some internal/undocumented APIs may break. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-1.29.0/) for details.

### Features

* add Plugin API ([55c1e27](https://github.com/uploadcare/file-uploader/commit/55c1e270d91e3bb3e192a55bb91af301890ee3a0))

# [1.28.0](https://github.com/uploadcare/file-uploader/compare/v1.27.3...v1.28.0) (2026-04-03)


### Features

* add dropboxchooser as external upload source ([#953](https://github.com/uploadcare/file-uploader/issues/953)) ([bf0b1b1](https://github.com/uploadcare/file-uploader/commit/bf0b1b1cdfcc8b5f331c12a64cbb92c81533b02d))



## [1.27.3](https://github.com/uploadcare/file-uploader/compare/v1.27.2...v1.27.3) (2026-04-02)


### Bug Fixes

* **types:** add fallback types for addEventListener/removeEventListener on UploadCtxProvider ([6b25c17](https://github.com/uploadcare/file-uploader/commit/6b25c178620018fd9427642afdd17957eae06e45))



## [1.27.2](https://github.com/uploadcare/file-uploader/compare/v1.27.1...v1.27.2) (2026-03-20)


### Bug Fixes

* implemented correct text rendering for **minimal** and **inline** modes when multiple selection is enabled. ([#948](https://github.com/uploadcare/file-uploader/issues/948)) ([37ba6c8](https://github.com/uploadcare/file-uploader/commit/37ba6c840876cdafe24614cc239942bea9e720a5))



## [1.27.1](https://github.com/uploadcare/file-uploader/compare/v1.27.0...v1.27.1) (2026-02-16)



# [1.27.0](https://github.com/uploadcare/file-uploader/compare/v1.26.3...v1.27.0) (2026-02-11)


### Features
* **clipboard:** added handling of clipboard-based file input, enabling reliable processing of pasted files. See the [documentation](https://uploadcare.com/docs/file-uploader/options/#paste-scope) for details.

### Bug Fixes

* **api/initFlow:** `initFlow` doesn't work right after `sourceList` config update ([#937](https://github.com/uploadcare/file-uploader/issues/937)) ([ab51f07](https://github.com/uploadcare/file-uploader/commit/ab51f07afd2009f2cd0c1b10d369e0ba1802f4ba))



## [1.26.3](https://github.com/uploadcare/file-uploader/compare/v1.26.2...v1.26.3) (2026-02-04)



## [1.26.2](https://github.com/uploadcare/file-uploader/compare/v1.26.1...v1.26.2) (2026-02-02)


### Bug Fixes

* **droparea:** icon transition on fullscreen droparea ([#931](https://github.com/uploadcare/file-uploader/issues/931)) ([ddb90ef](https://github.com/uploadcare/file-uploader/commit/ddb90ef2e8241567f10509044aabd5a0d72cdc50))



## [1.26.1](https://github.com/uploadcare/file-uploader/compare/v1.26.0...v1.26.1) (2026-01-29)


### Bug Fixes

* bump @uploadcare/quality-insights to fix zod types import errors ([#920](https://github.com/uploadcare/file-uploader/issues/920)) ([fc6cc37](https://github.com/uploadcare/file-uploader/commit/fc6cc37adf70abd050e3a804bb148581043fa3a4))
* config ctx initialization order ([#923](https://github.com/uploadcare/file-uploader/issues/923)) ([f90466c](https://github.com/uploadcare/file-uploader/commit/f90466c4a2c66241af8196d30146e989b5218dc8))
* **config:** prevent overwriting existing property descriptors in Config class ([#922](https://github.com/uploadcare/file-uploader/issues/922)) ([71d8da0](https://github.com/uploadcare/file-uploader/commit/71d8da0ecb40631b61be59304e3a49602c3a2e2a))



# [1.26.0](https://github.com/uploadcare/file-uploader/compare/v1.25.0...v1.26.0) (2026-01-27)

## Highlights

* [SymbioteJS](https://symbiotejs.org/) was replaced with [Lit Element](https://lit.dev/).
* All documented public API remains the same.

## Potential Breaking Changes (Minor Release)

Some internal / undocumented APIs may break.

In particular, the undocumented static `template` setter that could be used for template overrides is deprecated and has no effect.

See [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-1.26.0/) for details.

### Bug Fixes

* Fixed thumbnail flicker
* Fixed progress bar flicker

# [1.25.0](https://github.com/uploadcare/file-uploader/compare/v1.24.8...v1.25.0) (2026-01-15)


### Features

* **uc-form-input:** allow to override `name` attribute on native inputs ([#913](https://github.com/uploadcare/file-uploader/issues/913)) ([ca4c7fc](https://github.com/uploadcare/file-uploader/commit/ca4c7fc99de4522d47ea97518b60b069671f4347))



## [1.24.8](https://github.com/uploadcare/file-uploader/compare/v1.24.7...v1.24.8) (2026-01-13)


### Bug Fixes

* **thumb:** alt added to thumb ([#909](https://github.com/uploadcare/file-uploader/issues/909)) ([4aa57bf](https://github.com/uploadcare/file-uploader/commit/4aa57bf7f41885f106580dca96a804e3cac371bf))
* **upload-list:** adjusted upload button visibility ([#911](https://github.com/uploadcare/file-uploader/issues/911)) ([ca6e213](https://github.com/uploadcare/file-uploader/commit/ca6e213eac05e41d406ae62573cfca7a799798b9))



## [1.24.7](https://github.com/uploadcare/file-uploader/compare/v1.24.6...v1.24.7) (2025-12-25)


### Bug Fixes

* **uploader-public-api:** adjusted activityParams ([#906](https://github.com/uploadcare/file-uploader/issues/906)) ([7e808bd](https://github.com/uploadcare/file-uploader/commit/7e808bd071e31577056ea8843ecfd8274ac83b1f))



## [1.24.6](https://github.com/uploadcare/file-uploader/compare/v1.24.5...v1.24.6) (2025-12-23)


### Bug Fixes

* **activity-header:** align header with icon by center ([#904](https://github.com/uploadcare/file-uploader/issues/904)) ([c74675a](https://github.com/uploadcare/file-uploader/commit/c74675a03ef4fa67f8c1388ab7f901ad373be7b7))
* prevent progress bar from resetting to 0 during validation ([#900](https://github.com/uploadcare/file-uploader/issues/900)) ([c52ec43](https://github.com/uploadcare/file-uploader/commit/c52ec435214b81bf18be80f391bc7eb60e773cc8))
* reduced the number of retries ([#902](https://github.com/uploadcare/file-uploader/issues/902)) ([bdece2a](https://github.com/uploadcare/file-uploader/commit/bdece2a9f5eec8511c57563dba980a16aa754fd8))



## [1.24.5](https://github.com/uploadcare/file-uploader/compare/v1.24.4...v1.24.5) (2025-12-01)


### Bug Fixes

* **l10n:** fix "drop-files-here" translation ([#891](https://github.com/uploadcare/file-uploader/issues/891)) ([cc990a2](https://github.com/uploadcare/file-uploader/commit/cc990a287320a3c9f4de38a462cb9bba3b9c4e41))
* use unlayered css by default & add separate layered bundle ([#893](https://github.com/uploadcare/file-uploader/issues/893)) ([d039026](https://github.com/uploadcare/file-uploader/commit/d039026f1eaf7d87ccc26cd2e169df3611cd48b3))



## [1.24.4](https://github.com/uploadcare/file-uploader/compare/v1.24.3...v1.24.4) (2025-11-21)


### Bug Fixes

* **deps:** bump @uploadcare/quality-insights package to fix unneeded dependencies leak ([#889](https://github.com/uploadcare/file-uploader/issues/889)) ([cbba698](https://github.com/uploadcare/file-uploader/commit/cbba69881e8c09f421f452b5701448ea73faf5d6))



## [1.24.3](https://github.com/uploadcare/file-uploader/compare/v1.24.2...v1.24.3) (2025-11-06)


### Bug Fixes

* generate unique svg id for the backdrop mask ([#884](https://github.com/uploadcare/file-uploader/issues/884)) ([3b092ff](https://github.com/uploadcare/file-uploader/commit/3b092ff75df10020a65b928d75f4c7fa5c856aba))



## [1.24.2](https://github.com/uploadcare/file-uploader/compare/v1.24.1...v1.24.2) (2025-11-05)


### Bug Fixes

* **config:** moved abortControllers to block scope to prevent cross-cancellation ([#880](https://github.com/uploadcare/file-uploader/issues/880)) ([37cb841](https://github.com/uploadcare/file-uploader/commit/37cb8416929958b616b0643135eccaab83d4d9ad))
* **quality-insights:** added improved event display ([#879](https://github.com/uploadcare/file-uploader/issues/879)) ([a0d7b2d](https://github.com/uploadcare/file-uploader/commit/a0d7b2db8773b8a80819a92e3ed60df82e8cfb12))



## [1.24.1](https://github.com/uploadcare/file-uploader/compare/v1.24.0...v1.24.1) (2025-10-30)

### Bug Fixes

- **file-item:** hide "waiting for social source" hint after successful upload ([#876](https://github.com/uploadcare/file-uploader/issues/876))
- **social-source:** use specified `targetOrigin` for `postMessage` calls ([#876](https://github.com/uploadcare/file-uploader/issues/876))
- **social-source:** toggle "Done" button visibility together with selection status block ([#876](https://github.com/uploadcare/file-uploader/issues/876))
- **config:** run initial configuration side effects after all config keys have been processed ([#875](https://github.com/uploadcare/file-uploader/issues/875))

# [1.24.0](https://github.com/uploadcare/file-uploader/compare/v1.23.1...v1.24.0) (2025-10-28)

## Highlights
* Fully rewritten to TypeScript
* Added support for CSS Layers (more predictable style overrides)

## Potential Breaking Changes (Minor Release)

Some type definitions and imports were cleaned up:

### Type updates
```diff
- type MyCfg = InstanceOf<Config>
+ type MyCfg = Config
```

```diff
- type MyProvider = InstanceOf<UploadCtxProvider>
+ type MyProvider = UploadCtxProvider
```

### CSS import change

```diff
- import '@uploadcare/file-uploader/blocks/themes/uc-basic/index.css'
+ import '@uploadcare/file-uploader/index.css'
```

We've preserved the NPM package exports API, so most setups should work without changes.

## Migration Checklist

* Replace `InstanceOf<>` usage
* Update CSS import path
* If you override styles, verify nothing shifts with CSS layers

## Need help?

If you hit unexpected issues, please open an issue - we'll take a look!


## [1.23.1](https://github.com/uploadcare/file-uploader/compare/v1.23.0...v1.23.1) (2025-10-24)

### Bug Fixes

- **external sources:** hide spinner button until external source authentication done ([#869](https://github.com/uploadcare/file-uploader/issues/869)) ([ed0aa7a](https://github.com/uploadcare/file-uploader/commit/ed0aa7a3d18031e806fb22c8b45c6c2ac7a38080))

# [1.23.0](https://github.com/uploadcare/file-uploader/compare/v1.22.0...v1.23.0) (2025-10-07)

### Bug Fixes

- **cloud-image-editor:** ResizeObserver loop completed with undelivered notifications error ([aca1331](https://github.com/uploadcare/file-uploader/commit/aca13310efa38d110e66957420bf058952cc0b3f))
- **locales:** correct capitalization from "Onedrive" to "OneDrive" ([#863](https://github.com/uploadcare/file-uploader/issues/863)) ([5b22196](https://github.com/uploadcare/file-uploader/commit/5b221969df47b36bc77dbdebce692c0ebafb46ec))

### Features

- **validation:** add support for async file validation ([a184ff1](https://github.com/uploadcare/file-uploader/commit/a184ff167a7072ccbed76e3e9e108e4e980a8f56)). See [File Validation docs](https://uploadcare.com/docs/file-uploader/file-validators/) for details.

# [1.22.0](https://github.com/uploadcare/file-uploader/compare/v1.21.0...v1.22.0) (2025-09-25)

### Features

- **cloud-editor:** added improved UX for crop presets ([#861](https://github.com/uploadcare/file-uploader/issues/861)) ([b35ef61](https://github.com/uploadcare/file-uploader/commit/b35ef61f38d9af76b5d6a01fb29da5fedc72a6b7))

# [1.21.0](https://github.com/uploadcare/file-uploader/compare/v1.20.1...v1.21.0) (2025-09-10)

### Features

- **quality-insights:** implemented manager for quality-insights ([c8e1941](https://github.com/uploadcare/file-uploader/commit/c8e1941c018b0529f76b5401019a8281f7e7980f)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#quality-insights) for details.

## [1.20.1](https://github.com/uploadcare/file-uploader/compare/v1.20.0...v1.20.1) (2025-08-27)

### Bug Fixes

- prevent event duplication when uploader is remounted multiple times ([#849](https://github.com/uploadcare/file-uploader/issues/849)) ([dde4566](https://github.com/uploadcare/file-uploader/commit/dde4566f88f51aacd80d8a559ebcfe0f2f71bfc8))

# [1.20.0](https://github.com/uploadcare/file-uploader/compare/v1.19.5...v1.20.0) (2025-08-25)

### Features

- **cloud-editor:** added multiple crop presets ([#845](https://github.com/uploadcare/file-uploader/issues/845)) ([720c2e3](https://github.com/uploadcare/file-uploader/commit/720c2e3004d2e574b5eff3c59fb0039584f704b8)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#crop-preset) for details.

## [1.19.5](https://github.com/uploadcare/file-uploader/compare/v1.19.4...v1.19.5) (2025-08-21)

### Bug Fixes

- **api:** allow to use both configured cdnBase and ucarecdn.com as host when calling `addFileFromCdnUrl` ([#844](https://github.com/uploadcare/file-uploader/issues/844)) ([7cac4c3](https://github.com/uploadcare/file-uploader/commit/7cac4c3b7cd2b1e8339c7fe69f7e460de7064fb2))

## [1.19.4](https://github.com/uploadcare/file-uploader/compare/v1.19.3...v1.19.4) (2025-07-30)

### Bug Fixes

- resolve TypeScript compilation error in Angular app ([#841](https://github.com/uploadcare/file-uploader/issues/841)) ([1c09279](https://github.com/uploadcare/file-uploader/commit/1c0927994b0af7e7f896ed62ea1de348004e27e7))

## [1.19.3](https://github.com/uploadcare/file-uploader/compare/v1.19.2...v1.19.3) (2025-07-15)

### Bug Fixes

- check promises with duck-typing ([#838](https://github.com/uploadcare/file-uploader/issues/838)) ([6ba891e](https://github.com/uploadcare/file-uploader/commit/6ba891e89b83eb4640c46557cb83e30ff17cdbff))

## [1.19.2](https://github.com/uploadcare/file-uploader/compare/v1.19.1...v1.19.2) (2025-07-10)

### Bug Fixes

- **config:** update prefixed cname on every pubkey change & skip empty pubkeys ([9e5c4b0](https://github.com/uploadcare/file-uploader/commit/9e5c4b0d6df16ddc2be30e22928030e1bf9cc79e))
- **file-item:** show `waiting for` hints for social sources only ([34ae28a](https://github.com/uploadcare/file-uploader/commit/34ae28a3bd4bef93a9fff86c9775df1f3be6a892))

## [1.19.1](https://github.com/uploadcare/file-uploader/compare/v1.19.0...v1.19.1) (2025-07-08)

### Bug Fixes

- subdomain prefix wrong calculation ([#834](https://github.com/uploadcare/file-uploader/issues/834)) ([964da65](https://github.com/uploadcare/file-uploader/commit/964da6541163367f59083a819be3b38a9b50bff3))

# [1.19.0](https://github.com/uploadcare/file-uploader/compare/v1.18.0...v1.19.0) (2025-07-07)

### Features

- **a11y:** added outline-offeset and label for input ([#832](https://github.com/uploadcare/file-uploader/issues/832)) ([463a7cc](https://github.com/uploadcare/file-uploader/commit/463a7cc8769305dd8b5b452c72b9db7b91c5df06))
- add support for prefixed cdn subdomains ([#826](https://github.com/uploadcare/file-uploader/issues/826)) ([63a687f](https://github.com/uploadcare/file-uploader/commit/63a687f7426ff5d78818fe1c163d2925f5bf254f))

# [1.18.0](https://github.com/uploadcare/file-uploader/compare/v1.17.2...v1.18.0) (2025-06-23)

### Features

- add `retryNetworkErrorMaxTimes` option ([#827](https://github.com/uploadcare/file-uploader/issues/827)) ([20dfdea](https://github.com/uploadcare/file-uploader/commit/20dfdea1200fd3f50c2f7dc4df9d56596039c6d2))

## [1.17.2](https://github.com/uploadcare/file-uploader/compare/v1.17.1...v1.17.2) (2025-06-18)

### Bug Fixes

- set position absolute on hidden file input to prevent host page layout issues ([#823](https://github.com/uploadcare/file-uploader/issues/823)) ([fd7fb11](https://github.com/uploadcare/file-uploader/commit/fd7fb117445709c73b81f62171814a18a2182789))

## [1.17.1](https://github.com/uploadcare/file-uploader/compare/v1.17.0...v1.17.1) (2025-06-18)

### Bug Fixes

- missing css custom properties config on uc-upload-ctx-provider ([#819](https://github.com/uploadcare/file-uploader/issues/819)) ([911d9c6](https://github.com/uploadcare/file-uploader/commit/911d9c6b4cb5eacbbcb50b7c522895ff765c8161))

# [1.17.0](https://github.com/uploadcare/file-uploader/compare/v1.16.2...v1.17.0) (2025-06-16)

### Features

- **external-sources:** use Google Drive Picker for Google Drive social source ([#818](https://github.com/uploadcare/file-uploader/issues/818)) ([5ac0479](https://github.com/uploadcare/file-uploader/commit/5ac0479f93a91b58b8d72bfb763bc74bb00eb2d2))

## [1.16.2](https://github.com/uploadcare/file-uploader/compare/v1.16.1...v1.16.2) (2025-05-07)

### Bug Fixes

- **modal:** added hasActiveModals in emit for close modal ([#813](https://github.com/uploadcare/file-uploader/issues/813)) ([808b74e](https://github.com/uploadcare/file-uploader/commit/808b74e92b3db0e5cece5bb0c46eb130178d430a))

## [1.16.1](https://github.com/uploadcare/file-uploader/compare/v1.16.0...v1.16.1) (2025-05-05)

### Bug Fixes

- **events:** added emit events for open/close modal ([#811](https://github.com/uploadcare/file-uploader/issues/811)) ([d1ef03a](https://github.com/uploadcare/file-uploader/commit/d1ef03a32af1645a18f90e8e0a871fe5218cd031))

# [1.16.0](https://github.com/uploadcare/file-uploader/compare/v1.15.0...v1.16.0) (2025-04-28)

### Features

- **cloud-editor:** added image mask ([#779](https://github.com/uploadcare/file-uploader/issues/779)) ([1863a5d](https://github.com/uploadcare/file-uploader/commit/1863a5d729956cc93ac5e66a1d13c8a41815124b)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#cloud-image-editor-mask-href) for details.

# [1.15.0](https://github.com/uploadcare/file-uploader/compare/v1.14.0...v1.15.0) (2025-04-22)

### Bug Fixes

- increased the retry count for throttled requests to 10 ([#800](https://github.com/uploadcare/file-uploader/issues/800)) ([1f039b1](https://github.com/uploadcare/file-uploader/commit/1f039b10d11d7eb8511e8ae501c0da3ba0929d49))
- prevented HEIC to JPEG conversion on Desktop Safari ([#805](https://github.com/uploadcare/file-uploader/issues/805)) ([cf3b713](https://github.com/uploadcare/file-uploader/commit/cf3b7133ef5231998bc667703bd22e8ac509797f))
- **types:** made the `headless` attribute optional ([#807](https://github.com/uploadcare/file-uploader/issues/807)) ([579e88d](https://github.com/uploadcare/file-uploader/commit/579e88de2f50153d064a63880ce6a292448b23fe))

### Features

- **file item** added a "Queued" hint ([#803](https://github.com/uploadcare/file-uploader/issues/803)) ([3b08242](https://github.com/uploadcare/file-uploader/commit/3b08242df64f00d672aacb6b337db7094728af4b))
- **upload list** added grid mode in upload list ([#797](https://github.com/uploadcare/file-uploader/pull/797)) ([a302461](https://github.com/uploadcare/file-uploader/commit/a30246114b7c170140787eeec2d0bc9f21495e8f)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#files-view-mode) for details.
- **minimal mode** added cloudImageEditor and sources in minimal mode ([#797](https://github.com/uploadcare/file-uploader/pull/797)) ([a302461](https://github.com/uploadcare/file-uploader/commit/a30246114b7c170140787eeec2d0bc9f21495e8f))
- **cloud editor** added cloudImageEditorAutoOpen prop ([#797](https://github.com/uploadcare/file-uploader/pull/797)) ([a302461](https://github.com/uploadcare/file-uploader/commit/a30246114b7c170140787eeec2d0bc9f21495e8f)). See the [documentation](https://uploadcare.com/docs/file-uploader/options/#cloud-image-editor-auto-open) for details.

# [1.14.0](https://github.com/uploadcare/file-uploader/compare/v1.13.2...v1.14.0) (2025-03-12)

### Features

- **camera** added a check for mobile devices when capturing media. Now, instead of using a single camera source, separate cameras are rendered for photo and video capture. ([#795](https://github.com/uploadcare/file-uploader/issues/795)) ([0e7383c](https://github.com/uploadcare/file-uploader/commit/0e7383cc222a99c6bc3eec778ffca6228383926a))

## [1.13.2](https://github.com/uploadcare/file-uploader/compare/v1.13.1...v1.13.2) (2025-02-13)

### Bug Fixes

- **a11y** added `role` and `aria-label` for screen readers ([#788](https://github.com/uploadcare/file-uploader/issues/788)) ([5a5c28a](https://github.com/uploadcare/file-uploader/commit/5a5c28a33fd1fc2e5f08b8d84cc725fcc7ff162b))
- **cloud-editor** close ui slider when click on the editor toolbar ([#790](https://github.com/uploadcare/file-uploader/issues/790)) ([6d59f25](https://github.com/uploadcare/file-uploader/commit/6d59f254b94b5389d1c990e7641b80972646665c))

## [1.13.1](https://github.com/uploadcare/file-uploader/compare/v1.13.0...v1.13.1) (2025-02-03)

### Bug Fixes

- **file-item:** improve progressbar ui when uploading from external URLs ([#784](https://github.com/uploadcare/file-uploader/issues/784)) ([86dfbb1](https://github.com/uploadcare/file-uploader/commit/86dfbb13daed4d244658b1097160eeecfa2eae08))

# [1.13.0](https://github.com/uploadcare/file-uploader/compare/v1.12.1...v1.13.0) (2025-01-30)

### Features

- add `cameraModes` option, deprecate `enableVideoRecording` and `defaultCameraMode` options ([#781](https://github.com/uploadcare/file-uploader/issues/781)) ([7fbe522](https://github.com/uploadcare/file-uploader/commit/7fbe5227081da7a4515a93b61e122ea1d7e850f9))

## [1.12.1](https://github.com/uploadcare/file-uploader/compare/v1.12.0...v1.12.1) (2025-01-28)

### Bug Fixes

- **drop-area:** added position:relative for upload-list ([#782](https://github.com/uploadcare/file-uploader/issues/782)) ([8c7fa63](https://github.com/uploadcare/file-uploader/commit/8c7fa6345c4cdcc992c96e61155fc822ad551cb7))

# [1.12.0](https://github.com/uploadcare/file-uploader/compare/v1.11.3...v1.12.0) (2025-01-08)

### Bug Fixes

- **external-sources:** done button loading state behaviour ([#770](https://github.com/uploadcare/file-uploader/issues/770)) ([77b545e](https://github.com/uploadcare/file-uploader/commit/77b545e445f2acd358e0ce849b211ce8c451d02e))

### Features

- **external-sources:** add `externalSourcesEmbedCss` config option to set embed css on external sources iframe ([#769](https://github.com/uploadcare/file-uploader/issues/769)) ([8cbbdb3](https://github.com/uploadcare/file-uploader/commit/8cbbdb3db3e111f49927bd2afe9df34a9d12cac8))
- **social-source:** deprecate instagram source ([#767](https://github.com/uploadcare/file-uploader/issues/767)) ([ed239a0](https://github.com/uploadcare/file-uploader/commit/ed239a00cfc9bc63d1ecb470e57dd2103e0f6b6a))

## [1.11.3](https://github.com/uploadcare/file-uploader/compare/v1.11.2...v1.11.3) (2024-12-12)

### Bug Fixes

- **camera-tab:** added check removeEventListener ([#765](https://github.com/uploadcare/file-uploader/issues/765)) ([31cb01a](https://github.com/uploadcare/file-uploader/commit/31cb01a6ba9f5c56601f0858ab13e4cfeefe64a3))

## [1.11.2](https://github.com/uploadcare/file-uploader/compare/v1.11.1...v1.11.2) (2024-12-12)

### Bug Fixes

- **camera-tab:** added mimeType fallback for safari ([#763](https://github.com/uploadcare/file-uploader/issues/763)) ([bd45833](https://github.com/uploadcare/file-uploader/commit/bd45833805c4e0b71067dca41ae013d0534dc07e))

# [1.11.0](https://github.com/uploadcare/file-uploader/compare/v1.10.0...v1.11.1) (2024-12-04)

### Features

- **camera-tab:** video recording ([#755](https://github.com/uploadcare/file-uploader/issues/755)) ([8173852](https://github.com/uploadcare/file-uploader/commit/81738528adc76d19cb3ad24030dec96dcba9dc1d))
- **social-sourcesЖ** redesign & batch file selection ([#750](https://github.com/uploadcare/file-uploader/issues/750)) ([db836e0](https://github.com/uploadcare/file-uploader/commit/db836e0060ac29af67987288f1d488d1df711111))

# [1.10.0](https://github.com/uploadcare/file-uploader/compare/v1.9.0...v1.10.0) (2024-11-02)

### Features

- **locale** added support for Finnish locale, enabling full application functionality in Finnish. ([#753](https://github.com/uploadcare/file-uploader/issues/753)) ([d6aecca](https://github.com/uploadcare/file-uploader/commit/d6aecca66ebb68ddaf2d1a69d0bf8c97d7de6e28))

# [1.9.0](https://github.com/uploadcare/file-uploader/compare/v1.8.1...v1.9.0) (2024-10-04)

### Features

- **a11y:** added accessible titles to buttons in `uc-activity-header` ([#748](https://github.com/uploadcare/file-uploader/issues/748)) ([97f13e3](https://github.com/uploadcare/file-uploader/commit/97f13e32442bbc33080365f6febf7e0d031cd68e))

## [1.8.1](https://github.com/uploadcare/file-uploader/compare/v1.8.0...v1.8.1) (2024-10-02)

### Bug Fixes

- **svg-sprite:** unneeded icons leak to the uc-basic sprite ([#746](https://github.com/uploadcare/file-uploader/issues/746)) ([f4decff](https://github.com/uploadcare/file-uploader/commit/f4decff895e174b70f9f394d7d67c59f14d9cf76))

# [1.8.0](https://github.com/uploadcare/file-uploader/compare/v1.7.0...v1.8.0) (2024-09-24)

### Features

- **cloud-editor** increased the capture area for dragging ([#741](https://github.com/uploadcare/file-uploader/issues/741)) ([47cc087](https://github.com/uploadcare/file-uploader/commit/47cc0871fc503a8a74ec598651053a92a2f54e49))

# [1.7.0](https://github.com/uploadcare/file-uploader/compare/v1.6.0...v1.7.0) (2024-09-19)

### Features

- **a11y:** added WCAG AAA contrast and high-contrast theme ([#739](https://github.com/uploadcare/file-uploader/issues/739)) ([82c29e1](https://github.com/uploadcare/file-uploader/commit/82c29e17cd84fb23f71a3e43e259ba5edd82173d))

# [1.6.0](https://github.com/uploadcare/file-uploader/compare/v1.5.2...v1.6.0) (2024-09-02)

### Features

- **a11y:** add `aria-live` attribute to the file item elements to make the uploading status observable by the screen readers ([#733](https://github.com/uploadcare/file-uploader/issues/733)) ([649db3b](https://github.com/uploadcare/file-uploader/commit/649db3bcdbc81e5fc2dfea1fcb34b4051bbd7e3b))
- **output-file-entry:** add `source` property to the `OutputFileEntry` object. This property indicated from which upload source the file was added: local, camera, dropbox etc. ([#736](https://github.com/uploadcare/file-uploader/issues/736)) ([6fe5bcd](https://github.com/uploadcare/file-uploader/commit/6fe5bcd8c95894c26b0e747db5817a2247347dfe))

## [1.5.2](https://github.com/uploadcare/file-uploader/compare/v1.5.1...v1.5.2) (2024-08-26)

### Bug Fixes

- system file dialog on safari ([#730](https://github.com/uploadcare/file-uploader/issues/730)) ([cfdd43a](https://github.com/uploadcare/file-uploader/commit/cfdd43a5306b1e492b673665d52fc1dfc6d52d41))

## [1.5.1](https://github.com/uploadcare/file-uploader/compare/v1.5.0...v1.5.1) (2024-08-21)

### Bug Fixes

- **styles:** compatibility issues with tailwindcss/forms ([#728](https://github.com/uploadcare/file-uploader/issues/728)) ([2fb5ca0](https://github.com/uploadcare/file-uploader/commit/2fb5ca0eacaba4b430c08e0b8bcac4946bec2eea))

# [1.5.0](https://github.com/uploadcare/file-uploader/compare/v1.4.0...v1.5.0) (2024-08-15)

### Bug Fixes

- **cloud-image-editor:** little memory leak where cloud image editor was holding some references that prevents from context destroying ([70a9b2b](https://github.com/uploadcare/file-uploader/commit/70a9b2b1e2ee3c7de9b9c4ffe46bb7da7d7c8d7c))

### Features

- **a11y:** Added title to button ([#723](https://github.com/uploadcare/file-uploader/issues/723)) ([3090304](https://github.com/uploadcare/file-uploader/commit/30903047df63f39b5e199c404cc10e6ac6439504))
- **public-upload-api:** add method `getCurrentActivity` ([3f5b127](https://github.com/uploadcare/file-uploader/commit/3f5b1279c49ffc9efd58486e0fb1f160e64389b3))
- **public-upload-api:** allow to switch activity to the cloud image editor with predefined file opened ([ef663fa](https://github.com/uploadcare/file-uploader/commit/ef663fae8ea7af06dfc66eecd1c0f6a19e5b7e3b))

# [1.4.0](https://github.com/uploadcare/file-uploader/compare/v1.3.0...v1.4.0) (2024-08-14)

### Features

- **theme:** add predefined color presets classes ([#715](https://github.com/uploadcare/file-uploader/issues/715)) ([3dc0b46](https://github.com/uploadcare/file-uploader/commit/3dc0b467c3738cc4284b7ca35fb2944eb51b6ad8))

# [1.3.0](https://github.com/uploadcare/file-uploader/compare/v1.2.0...v1.3.0) (2024-08-08)

### Features

- remove common progress bar from the regular and inline modes ([#721](https://github.com/uploadcare/file-uploader/issues/721)) ([f7b8fa7](https://github.com/uploadcare/file-uploader/commit/f7b8fa756d93c99b1541c874a8bc87a9b1b85b5f))

# [1.2.0](https://github.com/uploadcare/blocks/compare/v1.0.0...v1.2.0) (2024-08-01)

### Bug Fixes

- **regular-mode:** disable done button until group created ([#710](https://github.com/uploadcare/blocks/issues/710)) ([3e30f63](https://github.com/uploadcare/blocks/commit/3e30f638804062e80e683097f3dd0813e14eca15))

### Features

- add cloud-image-editor telemetry ([#703](https://github.com/uploadcare/blocks/issues/703)) ([cbd69b8](https://github.com/uploadcare/blocks/commit/cbd69b852e85b73c21cdbaea228f19529c23183c))

### BREAKING CHANGES:

- rename package `@uploadcare/blocks` to `@uploadcare/file-uploader`
- method `connectBlocksFrom` renamed to `loadFileUploaderFrom` ([d083cb7](https://github.com/uploadcare/blocks/commit/d083cb7bac5fd223ef322c851a9629e38eb4541f))
- method `registerBlocks` renamed to `defineComponents` ([606f8fc](https://github.com/uploadcare/blocks/commit/606f8fc1bf8b8f8242515c1da12ab9f3ec396b0b))
- rename all prefixes from `lr` to `uc` (https://github.com/uploadcare/blocks/issues/698) ([e28f2af](https://github.com/uploadcare/blocks/commit/e28f2af9c48704c49fb115769c01c9e82b300f39))

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-1.x/) for details.

## [0.50.1](https://github.com/uploadcare/blocks/compare/v0.50.0...v0.50.1) (2024-07-16)

### Bug Fixes

- **styles:** added prefix uc- to className in the js ([#700](https://github.com/uploadcare/blocks/issues/700)) ([672c5c3](https://github.com/uploadcare/blocks/commit/672c5c3f15ce7bb54027ae2ba77217c3aa622824))

# [0.50.0](https://github.com/uploadcare/blocks/compare/v0.49.0...v0.50.0) (2024-07-16)

### Features

- async `secureDeliveryProxyUrlResolver` ([#677](https://github.com/uploadcare/blocks/issues/677)) ([60f06be](https://github.com/uploadcare/blocks/commit/60f06be2ac903d3901eded42cc6ccaaaff41a97a))

See the [`secureDeliveryProxyUrlResolver` docs](https://uploadcare.com/docs/file-uploader/options/#secure-delivery-proxy-url-resolver) for details.

# [0.49.0](https://github.com/uploadcare/blocks/compare/v0.48.1...v0.49.0) (2024-07-03)

### BEAKING CHANGES

- **styles:** Added the `uc-` prefix to all class selectors ([#683](https://github.com/uploadcare/blocks/issues/683)) ([a3929d5](https://github.com/uploadcare/blocks/commit/a3929d599e23e221b2fe88b2d2489a35c8ee7899)).

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.49.0/) for details.

## [0.48.1](https://github.com/uploadcare/blocks/compare/v0.48.0...v0.48.1) (2024-07-02)

### Bug Fixes

- **a11y:** Added a type for the button ([#695](https://github.com/uploadcare/blocks/issues/695)) ([af1d6b6](https://github.com/uploadcare/blocks/commit/af1d6b63112cc383bcad52d099d84460da937ffa))

## [0.48.0](https://github.com/uploadcare/blocks/compare/v0.47.0...v0.48.0) (2024-07-02)

# [0.47.0](https://github.com/uploadcare/blocks/compare/v0.46.3...v0.47.0) (2024-07-02)

### BEAKING CHANGES

- Extract public api to the composition class at the Uploader API instance that you can get using `getAPI()` method of the `lr-upload-ctx-provider` block. ([#676](https://github.com/uploadcare/blocks/issues/676)) ([ea29dd2](https://github.com/uploadcare/blocks/commit/ea29dd2ebfc5b5897c7db8f6dbda608604eea86c)).

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.47.0/) for details.

## [0.46.3](https://github.com/uploadcare/blocks/compare/v0.46.2...v0.46.3) (2024-07-01)

### Bug Fixes

- **icons:** Added currentColor to icon edit-file ([#689](https://github.com/uploadcare/blocks/issues/689)) ([617d3cd](https://github.com/uploadcare/blocks/commit/617d3cd8e0cde8ecadd6024ce321b7ba507009f1))

## [0.46.2](https://github.com/uploadcare/blocks/compare/v0.46.1...v0.46.2) (2024-07-01)

### Bug Fixes

- **icons:** added icon edit file ([#687](https://github.com/uploadcare/blocks/issues/687)) ([2a869ab](https://github.com/uploadcare/blocks/commit/2a869abfdbe571aff52ccc5687a8c66e0d829cb5))

## [0.46.1](https://github.com/uploadcare/blocks/compare/v0.46.0...v0.46.1) (2024-06-28)

### Bug Fixes

- **events:** Added status after deleting files in idle ([#684](https://github.com/uploadcare/blocks/issues/684)) ([0e07ee3](https://github.com/uploadcare/blocks/commit/0e07ee3d82a326e56cab343dafdf7472f2d73216))

# [0.46.0](https://github.com/uploadcare/blocks/compare/v0.45.0...v0.46.0) (2024-06-24)

### Features

- Significant improvements to accessibility and keyboard navigation, enhancing user experience and inclusivity ([#671](https://github.com/uploadcare/blocks/issues/671)) ([4acb8a0](https://github.com/uploadcare/blocks/commit/4acb8a0b7ea9c7a95be415627f7d4e1eb748fcf2))

# [0.45.0](https://github.com/uploadcare/blocks/compare/v0.44.0...v0.45.0) (2024-06-23)

### BEAKING CHANGES

- The previously deprecated API method `setUploadMetadata` has been removed. Use `metadata` instance property on `lr-config` block instead. See [metadata](https://uploadcare.com/docs/file-uploader/options/#metadata) for more details.
- The previously deprecated API method `addFiles` has been removed. Use `addFileFromObject`, `addFileFromUrl` or `addFileFromUuid` instead. See [File Uploader API](https://uploadcare.com/docs/file-uploader/api/#add-file-from-object) for more details.

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.45.0/) for details.

# [0.44.0](https://github.com/uploadcare/blocks/compare/v0.43.0...v0.44.0) (2024-06-21)

### BEAKING CHANGES

- All theme variables of the previous version are deprecated and won't affect the look anymore.
- The default button that opens the uploader dialog (SimpleBtn) component now uses independent variables.
- By default, the theme now uses OKLCH color space. You can still override it using other color spaces, but we recommend converting your colors to OKLCH.

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.44.0/) for details.

Full styling docs are available [here](https://uploadcare.com/docs/file-uploader/styling/).

### Features

- updated theming mechanics with oklch colors and reworked css properties ([#662](https://github.com/uploadcare/blocks/issues/662)) ([ee90e66](https://github.com/uploadcare/blocks/commit/ee90e66c076e21e1ee92b2f4c60f8eb955a7d5bc))

# [0.43.0](https://github.com/uploadcare/blocks/compare/v0.42.1...v0.43.0) (2024-06-14)

### Features

- added `collectionValidators` and `fileValidators`: Custom validators are now supported for collections and files. This enhancement allows for the addition of necessary checks for uploaded files and collections, providing flexibility and control over compliance with requirements ([#667](https://github.com/uploadcare/blocks/issues/667)) ([d3260b0](https://github.com/uploadcare/blocks/commit/d3260b0cce5ac6ca7cfd0aeb8aff0c9fc35036ed)). See docs [here](https://uploadcare.com/docs/file-uploader/validators).

## [0.42.1](https://github.com/uploadcare/blocks/compare/v0.42.0...v0.42.1) (2024-05-30)

# [0.42.0](https://github.com/uploadcare/blocks/compare/v0.41.1...v0.42.0) (2024-05-30)

### Features

- **lr-file-uploader-regular:** added attribute headless ([5e58ff4](https://github.com/uploadcare/blocks/commit/5e58ff4c666ff13a69bc69429090f0d691c3af0c)). See docs [here](https://uploadcare.com/docs/file-uploader/installation/#choose-a-solution).

## [0.41.1](https://github.com/uploadcare/blocks/compare/v0.41.0...v0.41.1) (2024-05-27)

### Bug Fixes

- **styles-readme:** updated connect style in the project ([#663](https://github.com/uploadcare/blocks/issues/663)) ([2ee913f](https://github.com/uploadcare/blocks/commit/2ee913f93ee44ffbd440c66f9ab6b0c92276faa2))

# [0.41.0](https://github.com/uploadcare/blocks/compare/v0.40.0...v0.41.0) (2024-05-24)

### Features

- add `secureDeliveryProxyUrlResolver` option ([c7cfcd0](https://github.com/uploadcare/blocks/commit/c7cfcd00563dc377b0368f1e2adc0ad973bcb20b)). See docs [here](https://uploadcare.com/docs/file-uploader/options/#secure-delivery-proxy-url-resolver).
- add `secureUploadsExpireThreshold` option ([0d9205d](https://github.com/uploadcare/blocks/commit/0d9205d0391f7c703069ac77efd62b0709bde626)). See docs [here](https://uploadcare.com/docs/file-uploader/options/#secure-uploads-expire-threshold).
- add `secureUploadsSignatureResolver` option ([226d36f](https://github.com/uploadcare/blocks/commit/226d36f691803801fcc15aa014aefa9e57959d50)). See docs [here](https://uploadcare.com/docs/file-uploader/options/#secure-uploads-signature-resolver).

# [0.40.0](https://github.com/uploadcare/blocks/compare/v0.39.1...v0.40.0) (2024-05-17)

### BREAKING CHANGES

- Icons are moved from CSS custom properties to SVG sprites. Overriding icons is
  now done via the `iconHrefResolver` option. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.40.0/) for details.

### Bug Fixes

- **image-editor:** check for imageSize before commit ([cdb87b4](https://github.com/uploadcare/blocks/commit/cdb87b47b5580b25696944c864e451881f99bcb6))
- **image-editor:** define icons size via css ([080439f](https://github.com/uploadcare/blocks/commit/080439f2bad5a602982f94cf5cc0bdfab22d8609))

### Features

- load svg icons as sprite ([9cf4c07](https://github.com/uploadcare/blocks/commit/9cf4c074895b2bfa76f7a2ea8801b85ba1ea48be))

## [0.39.1](https://github.com/uploadcare/blocks/compare/v0.39.0...v0.39.1) (2024-05-15)

### Bug Fixes

- **l10n:** add l10n key to the state if it's not present ([#656](https://github.com/uploadcare/blocks/issues/656)) ([227a88f](https://github.com/uploadcare/blocks/commit/227a88f14571b3945ce6f622b20ee21e4f6f8664))

# [0.39.0](https://github.com/uploadcare/blocks/compare/v0.38.3...v0.39.0) (2024-05-07)

### Features

- **shadow-styles:** eliminating shadow styles ([#646](https://github.com/uploadcare/blocks/issues/646)) ([984dbda](https://github.com/uploadcare/blocks/commit/984dbda990fb4403b1a0629b5ff8440aff843103))

## [0.38.3](https://github.com/uploadcare/blocks/compare/v0.38.2...v0.38.3) (2024-05-07)

### Bug Fixes

- **lr-config:** normalize DOM property values ([#653](https://github.com/uploadcare/blocks/issues/653)) ([5aa55c2](https://github.com/uploadcare/blocks/commit/5aa55c2c5e543857813e330251faa83206d2992a))

## [0.38.2](https://github.com/uploadcare/blocks/compare/v0.38.1...v0.38.2) (2024-04-29)

### Bug Fixes

- **config:** dont bind complex config options to the attributes ([#650](https://github.com/uploadcare/blocks/issues/650)) ([310c728](https://github.com/uploadcare/blocks/commit/310c728e60ee3560fb751e8e75233d67c498f3c4))

## [0.38.1](https://github.com/uploadcare/blocks/compare/v0.38.0...v0.38.1) (2024-04-29)

### Bug Fixes

- **upload-list:** set fixed modal container width to avoid bouncy width (could lead to some l10n ui width glitches but we're ok with them) ([#648](https://github.com/uploadcare/blocks/issues/648)) ([167af55](https://github.com/uploadcare/blocks/commit/167af555d6bf44f59e1c63323d7f9dc55ba43b47))

# [0.38.0](https://github.com/uploadcare/blocks/compare/v0.37.0...v0.38.0) (2024-04-25)

### BREAKING CHANGES

- CSS configuration deprecated in v0.25.0 is removed. See the [migration guide for v0.25.0][uc-uploader-docs-migration-0-25-0] for more details.
- Localizations are removed from CSS. <br/>Now we have a special API `defineLocale`, and `locale-name` and `locale-definition-override` options. See the [migration guide][uc-uploader-docs-migration-0-38-0] for more details.

[uc-uploader-docs-migration-0-25-0]: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/
[uc-uploader-docs-migration-0-38-0]: https://uploadcare.com/docs/file-uploader/migration-to-0.38.0/

# [0.37.0](https://github.com/uploadcare/blocks/compare/v0.36.0...v0.37.0) (2024-04-15)

### Bug Fixes

- activity switch races ([#643](https://github.com/uploadcare/blocks/issues/643)) ([fe365da](https://github.com/uploadcare/blocks/commit/fe365dadea7a720b1f349de336aacc0d515f39cf))
- define config DOM property accessors on the class prototype to make it compatible with framework bindings ([#638](https://github.com/uploadcare/blocks/issues/638)) ([d47baf0](https://github.com/uploadcare/blocks/commit/d47baf0bb91355cd30411b5f2a8910606d5a1fe0))

### Features

- added export UID from @symbiotejs/symbiote ([#636](https://github.com/uploadcare/blocks/issues/636)) ([9666f21](https://github.com/uploadcare/blocks/commit/9666f21ce2b97f283839ec39b5d480dd298f3415))

# [0.36.0](https://github.com/uploadcare/blocks/compare/v0.35.2...v0.36.0) (2024-03-21)

### Bug Fixes

- don't try to open empty modal on mobile when camera is the only source ([#634](https://github.com/uploadcare/blocks/issues/634)) ([1bc4f5d](https://github.com/uploadcare/blocks/commit/1bc4f5dde831f69f7dc86c2ed7a60aa2c1537506))

### Features

- added export event type ([#632](https://github.com/uploadcare/blocks/issues/632)) ([c292d16](https://github.com/uploadcare/blocks/commit/c292d16b4e4accde65af853e21f9804981e8a4ac))

## [0.35.2](https://github.com/uploadcare/blocks/compare/v0.35.1...v0.35.2) (2024-03-08)

### Bug Fixes

- **image-shrink:** fallback algo on Firefox and iOS ([#630](https://github.com/uploadcare/blocks/issues/630)) ([066cfca](https://github.com/uploadcare/blocks/commit/066cfca3306c65f0c4e67332311763a2bf2ea4ef))

## [0.35.1](https://github.com/uploadcare/blocks/compare/v0.35.0...v0.35.1) (2024-03-07)

### Bug Fixes

- improve uploading progress animation ([#628](https://github.com/uploadcare/blocks/issues/628)) ([a1db063](https://github.com/uploadcare/blocks/commit/a1db063234a8227614d446e32aa2b5edf149d7f4))

# [0.35.0](https://github.com/uploadcare/blocks/compare/v0.34.0...v0.35.0) (2024-03-07)

### Bug Fixes

- **minimal:** open system dialog on `add more` button ([#626](https://github.com/uploadcare/blocks/issues/626)) ([0098600](https://github.com/uploadcare/blocks/commit/00986000d61b9550ce2bfba3368bf523e91fdcfd))

### Features

- add `removeAllFiles` API method ([#624](https://github.com/uploadcare/blocks/issues/624)) ([85ef970](https://github.com/uploadcare/blocks/commit/85ef97018548ff13ec49f3aa76bf5cf3019f6c79))

# [0.34.0](https://github.com/uploadcare/blocks/compare/v0.33.2...v0.34.0) (2024-03-05)

### Bug Fixes

- show camera system dialog when camera is the only source ([95f0287](https://github.com/uploadcare/blocks/commit/95f02872f2e4b60bf7e4558b28cceb25d727a346))
- specify camera input accept attribute value as simple `image/*` to prevent OS to show unrelated sources (video/audio) ([5ecacba](https://github.com/uploadcare/blocks/commit/5ecacba610143f1336b2fde2b6cf67a7f17c1edb))
- switch camera source output format to JPEG to make it shrinkable ([6da4212](https://github.com/uploadcare/blocks/commit/6da4212358146c8414443fff9698a53657891f23))

### Features

- add `cameraCapture` option to specify inpit capture attribute value ([9a77057](https://github.com/uploadcare/blocks/commit/9a7705701ea60dd407af8284f72b4e57f8272e04))
- **lr-upload-ctx-provider:** add method `addFileFromCdnUrl` to add already uploaded files with predefined cdn url modifiers ([#617](https://github.com/uploadcare/blocks/issues/617)) ([8043d08](https://github.com/uploadcare/blocks/commit/8043d085a996086b52f0205f07438d67d5e8acbe))
- **lr-upload-ctx-provider:** add method `removeFileByInternalId` ([#618](https://github.com/uploadcare/blocks/issues/618)) ([c2492eb](https://github.com/uploadcare/blocks/commit/c2492eb1a15ce36fc4db3352665d05f9674076bc))

## [0.33.2](https://github.com/uploadcare/blocks/compare/v0.33.1...v0.33.2) (2024-02-20)

### Bug Fixes

- set `cdnUrlModifers` default to empty string after file upload ([#613](https://github.com/uploadcare/blocks/issues/613)) ([7113058](https://github.com/uploadcare/blocks/commit/7113058d2293760225c032eaf32ee93399a422cf))

## [0.33.1](https://github.com/uploadcare/blocks/compare/v0.33.0...v0.33.1) (2024-02-20)

### Bug Fixes

- **shadow-wrapper:** wait for `shadowStyles` load before calling `shadowReadyCallback` ([#611](https://github.com/uploadcare/blocks/issues/611)) ([42b73b7](https://github.com/uploadcare/blocks/commit/42b73b7de129999da9ad61148c0599b5fa81964e))

# [0.33.0](https://github.com/uploadcare/blocks/compare/v0.32.4...v0.33.0) (2024-02-16)

### Bug Fixes

- progress calculation errors when file is removed during uploading ([#606](https://github.com/uploadcare/blocks/issues/606)) ([74769ce](https://github.com/uploadcare/blocks/commit/74769ce3ead25bfbc72b5aecf3448702e417c373))

### Features

- Add image shrink to the uploader ([e2b0896](https://github.com/uploadcare/blocks/commit/e2b0896ea02a4f959e02fbcfba84cdb7c8031368)). See docs [here](https://uploadcare.com/docs/file-uploader/feature-shrink/)

## [0.32.4](https://github.com/uploadcare/blocks/compare/v0.32.3...v0.32.4) (2024-02-15)

### Bug Fixes

- **cloud-image-editor:** disable image enter transition ([2abe55f](https://github.com/uploadcare/blocks/commit/2abe55f0b6d1ae4f46dc895fdf00646d81a11011))
- **cloud-image-editor:** weird ui glitches when updating `cdnUrl` on change ([c264c64](https://github.com/uploadcare/blocks/commit/c264c6494f88cb1307ac83f5e811da8ac334a54b))

## [0.32.3](https://github.com/uploadcare/blocks/compare/v0.32.2...v0.32.3) (2024-02-13)

### Bug Fixes

- server validation error rendering ([#604](https://github.com/uploadcare/blocks/issues/604)) ([3e9835b](https://github.com/uploadcare/blocks/commit/3e9835bafb5ba16c1853a68f395428b31a8093f0))

## [0.32.2](https://github.com/uploadcare/blocks/compare/v0.32.1...v0.32.2) (2024-02-12)

### Bug Fixes

- **form-input:** do not append `[]` postfix to input name when `multiple` is falsy ([#602](https://github.com/uploadcare/blocks/issues/602)) ([4722c4d](https://github.com/uploadcare/blocks/commit/4722c4d0eb1890013d6693376ff655dd871798d1))

## [0.32.1](https://github.com/uploadcare/blocks/compare/v0.32.0...v0.32.1) (2024-02-06)

### Bug Fixes

- bump upload-client to fix large groups uploading ([#599](https://github.com/uploadcare/blocks/issues/599)) ([cb61448](https://github.com/uploadcare/blocks/commit/cb61448a2ae85c3076d41bcae85ee1fe7b6d2659))

# [0.32.0](https://github.com/uploadcare/blocks/compare/v0.31.1...v0.32.0) (2024-02-05)

### Breaking changes

- Global events are removed. I.e. `window.addEventListener('LR_UPLOAD_FINISH', ...)` will not work anymore. Now you need to use `lr-upload-ctx-provider` block to subscribe to the events. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.32.0/) for more details.
- All existing events and their payloads are changed. See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.32.0/) for more details.
- `lr-data-output` block is removed.
  - To handle HTML forms you need to use `lr-form-input` block.
  - Groups output moved to the `lr-upload-ctx-provider` events
  - Console debugging output now enabled with the `debug` attribute on `lr-config`
- `lr-message-box` block is removed.

See the [migration guide](https://uploadcare.com/docs/file-uploader/migration-to-0.32.0/) for more details.

## [0.31.1](https://github.com/uploadcare/blocks/compare/v0.31.0...v0.31.1) (2024-01-30)

### Bug Fixes

- **image-editor:** fix flip operation serialization ([#595](https://github.com/uploadcare/blocks/issues/595)) ([140df3a](https://github.com/uploadcare/blocks/commit/140df3a71df6008faa363c99767c87c0640d492b))

# [0.31.0](https://github.com/uploadcare/blocks/compare/v0.30.9...v0.31.0) (2024-01-29)

### Bug Fixes

- **file-item:** file status icon align ([#593](https://github.com/uploadcare/blocks/issues/593)) ([1539abe](https://github.com/uploadcare/blocks/commit/1539abe5a75b2673415e999a8ad63aaff664776f))

### Features

- **lr-img:** preview blur ([f42967a](https://github.com/uploadcare/blocks/commit/f42967aec0b77c454750286dae74f4aa00124d3f))

## [0.30.9](https://github.com/uploadcare/blocks/compare/v0.30.8...v0.30.9) (2024-01-18)

### Bug Fixes

- **cloud-image-editor:** ignore unsupported cdn operations and print console warning ([#587](https://github.com/uploadcare/blocks/issues/587)) ([503eaae](https://github.com/uploadcare/blocks/commit/503eaaed216d2f8aa3c84cd5bead2d27136b3a5f))
- **external-source:** disallow to select multiple files when multiple mode is off ([#589](https://github.com/uploadcare/blocks/issues/589)) ([d5c43cd](https://github.com/uploadcare/blocks/commit/d5c43cd565c7391c998a7ee6941f5fab6fe90c63))

## [0.30.8](https://github.com/uploadcare/blocks/compare/v0.30.7...v0.30.8) (2023-12-29)

### Bug Fixes

- **shadow-wrapper:** do not call success callback on the second `css-src` attribute change ([#583](https://github.com/uploadcare/blocks/issues/583)) ([eb9618a](https://github.com/uploadcare/blocks/commit/eb9618a3c3b579c5440c25444fb2a61bfbd55d6e))

## [0.30.7](https://github.com/uploadcare/blocks/compare/v0.30.6...v0.30.7) (2023-12-27)

### Features

- **lr-img:** Do not append `-/format/auto/` and `-/quality/smart/` by default to the resulting CDN URL. Now, the defaults of these settings are preserved within the project settings on the dashboard. See the release notes for the [Auto formatting](https://uploadcare.com/docs/changelog/#2023-12-21) and [CDN updates](https://uploadcare.com/docs/changelog/#2023-10-09).

### Bug fixes

- **lr-img:**: Ignore breakpoints config when applying `image-set` for the background image using `is-background-for` option.

## [0.30.6](https://github.com/uploadcare/blocks/compare/v0.30.5...v0.30.6) (2023-12-20)

### Bug Fixes

- **upload-ctx-provider:** execute destroy context callback async to ensure all sync callbacks are run ([#575](https://github.com/uploadcare/blocks/issues/575)) ([cbb9a21](https://github.com/uploadcare/blocks/commit/cbb9a2136c3079d98cd2db2474cf955cf9b9631e))

## [0.30.5](https://github.com/uploadcare/blocks/compare/v0.30.4...v0.30.5) (2023-12-07)

### Bug Fixes

- **activity-block:** check for the `*modalActive` key presence in state before subscribing it ([0e50b4f](https://github.com/uploadcare/blocks/commit/0e50b4f6dc2664eea7a7f12742660385a50610fd))
- destroy upload collection when the last block in context is being destroyed ([42e501a](https://github.com/uploadcare/blocks/commit/42e501a85d089b4863950482fd89d240102aeb7d))

## [0.30.4](https://github.com/uploadcare/blocks/compare/v0.30.3...v0.30.4) (2023-12-06)

### Bug Fixes

- **activity:** run activity deactivation callback when modal became closed ([2e84268](https://github.com/uploadcare/blocks/commit/2e842681cfac68594a5c85ce92969597d9302081))
- **cloud-image-editor:** do no try to update image when element is disconnected from DOM ([1b417a9](https://github.com/uploadcare/blocks/commit/1b417a93476da224c407ea60e95fa13ba4eefd1d))
- **cloud-image-editor:** init `*tabId` global state key in the main editor block instead of deeper toolbar block ([511d3e1](https://github.com/uploadcare/blocks/commit/511d3e1301c6fe0b4e0d4fdbf70b2484e38f88d0))
- **start-from:** add missing scroll area ([680a282](https://github.com/uploadcare/blocks/commit/680a28222f1107523bf3453cc8930bf4a399e8da))
- **window-height-tracker:** prevent infinite loop ([7576ece](https://github.com/uploadcare/blocks/commit/7576ece24a7254cc6d3985925db4ae56133fa790))

## [0.30.3](https://github.com/uploadcare/blocks/compare/v0.30.2...v0.30.3) (2023-12-04)

### Bug Fixes

- **block:** destroy both local and global contexts ([bdd4a33](https://github.com/uploadcare/blocks/commit/bdd4a330583e57cf9eda798453d4815cfe4f9d84))
- **cloud-image-editor:** destroy context ([deb9d25](https://github.com/uploadcare/blocks/commit/deb9d25e6ea60e17fa2682a077a1a74e2de77645))
- **config:** do not overwrite config values inside context ([c1f6a0f](https://github.com/uploadcare/blocks/commit/c1f6a0f1bfe5ec509e66a1a55603fed82f4f3175))
- **drop-area:** destroy global registry context if there are no items inside ([ad89e56](https://github.com/uploadcare/blocks/commit/ad89e56e0771ae064df9fb00996de69f2fe35323))
- **img:** destroy context ([05ba451](https://github.com/uploadcare/blocks/commit/05ba451ba139c860e701fe57195883c0f104534a))
- **typed-collection:** destroy context ([a7c136d](https://github.com/uploadcare/blocks/commit/a7c136d9d5a79eff68874c559276c1a0d84d658b))
- **upload-collection:** destroy upload collection ([bcc4d46](https://github.com/uploadcare/blocks/commit/bcc4d460fd7724a0d84cd4c40a065c67a6479d18))

## [0.30.2](https://github.com/uploadcare/blocks/compare/v0.30.1...v0.30.2) (2023-12-01)

### Bug Fixes

- **start-from:** styles ([#566](https://github.com/uploadcare/blocks/issues/566)) ([7367b1d](https://github.com/uploadcare/blocks/commit/7367b1d914b044cbce2c4fdb6a15e03cf68a9e61))
- **upload-ctx-provider:** run parent init callback before accessing event emitter ([#565](https://github.com/uploadcare/blocks/issues/565)) ([a313c5c](https://github.com/uploadcare/blocks/commit/a313c5c3b61f4749c6919a6d078e18e7eaa73419))

## [0.30.1](https://github.com/uploadcare/blocks/compare/v0.30.0...v0.30.1) (2023-11-30)

### Bug Fixes

- improve event types ([#563](https://github.com/uploadcare/blocks/issues/563)) ([7d4097d](https://github.com/uploadcare/blocks/commit/7d4097db83f2cd4afef6375406e92afb0eba4c09))

# [0.30.0](https://github.com/uploadcare/blocks/compare/v0.29.1...v0.30.0) (2023-11-14)

- **drop-area:** show pointer on clickable drop areas ([6990cd4](https://github.com/uploadcare/blocks/commit/6990cd495ac535fcb9586e3148dcf5a4705035ae))

### Features

- add `cancel` button on the start from activity ([#554](https://github.com/uploadcare/blocks/issues/554)) ([44bd845](https://github.com/uploadcare/blocks/commit/44bd8452a1f720d2c21444f64b5a74c0ffe26880))
- move global events to the `lr-upload-ctx-provider` scope ([c452eeb](https://github.com/uploadcare/blocks/commit/c452eeb4e90b2969409046116fa8786da66ec811))

## [0.29.1](https://github.com/uploadcare/blocks/compare/v0.29.0...v0.29.1) (2023-10-31)

### Bug Fixes

- **modal:** buggy click handlers to close modal on outside click ([#551](https://github.com/uploadcare/blocks/issues/551)) ([8949948](https://github.com/uploadcare/blocks/commit/8949948cebbe84e9d29d6537321c6520caa567d1))
- **types:** bump @uploadcare/upload-client with fixed types for `imageInfo.datetimeOriginal` ([#550](https://github.com/uploadcare/blocks/issues/550)) ([8babfab](https://github.com/uploadcare/blocks/commit/8babfab3b2f3ae021ab69340570547f565711e6e))

# [0.29.0](https://github.com/uploadcare/blocks/compare/v0.28.0...v0.29.0) (2023-10-27)

### Features

- add property `fullPath` to the output entry ([9e4707f](https://github.com/uploadcare/blocks/commit/9e4707fef14df91d29c5172585d23ac912115c71))
- pass output entry to the metadata callback ([9153826](https://github.com/uploadcare/blocks/commit/915382619280fdadedac474ee4167cd52982685b))

```ts
config.metadata = (fileEntry) => ({
  type: 'cat',
  fileName: fileEntry.name,
  fullPath: fileEntry.fullPath,
});
```

# [0.28.0](https://github.com/uploadcare/blocks/compare/v0.27.6...v0.28.0) (2023-10-26)

### BREAKING CHANGES

#### `LR_DATA_OUTPUT` event on window

Before: The `LR_DATA_OUTPUT` event only contained uploaded files and fired only when a file was uploaded, deleted, or edited.

Now: The `LR_DATA_OUTPUT` event now includes all the files in the upload list, including those not yet uploaded, and it fires whenever there is any change in the file list.
The event firing is debounced with a 100ms delay. So, in this event, you receive a complete snapshot of the upload list's state. \*_Please note_ that if the file hasn't been uploaded yet, the data will be incomplete. Properties such as `uuid`, `cdnUrl` and others will not be accessible. Before accessing them, you should check the `isUploaded` flag, which is described below.

```js
window.addEventListener('LR_DATA_OUTPUT', (e) => {
  const entries = e.detail.data;
  for (const entry of entries) {
    if (entry.isUploaded) {
      console.log('Uploaded', entry.uuid);
    } else {
      console.log('Not uploaded', entry.uploadProgress);
    }
  }
});
```

- make `LR_DATA_OUTPUT` event frequent and contain all the files ([69105e4](https://github.com/uploadcare/blocks/commit/69105e4806e9ca2d4254bce297c48e0990663212))

#### `lr-data-output` event on `lr-data-output` block (tag)

Before: The `lr-data-output` event mirrors the `LR_DATA_OUTPUT` event. When the `group-output` option is enabled or the `use-group` attribute is present, it always creates a group for the file list.

Now: The `lr-data-output` event mirrors the `LR_DATA_OUTPUT` event. When the `group-output` option is enabled or the `use-group` attribute is present, a group is only created if all files are uploaded, and there are no validation errors.
Otherwise, the event contains undefined `groupData` and a list of files.

### Features

#### New file properties for the events payload

The following events are affected:

- `LR_DATA_OUTPUT`
- `LR_UPLOAD_FINISH`
- `LR_REMOVE`
- `LR_UPLOAD_START`
- `lr-data-output`

What file properties have been added:

```ts
validationErrorMessage: string | null; // message with the validation error
uploadError: Error | null; // error object with the upload error
file: File | Blob | null; // file object
externalUrl: string | null; // external URL for the file (when uploading from URL or external source)
isValid: boolean; // is file valid (passed validation checks)
isUploaded: boolean; // is file uploaded
uploadProgress: number; // upload progress in percents
```

- add new properties to the output file entry ([2821bf3](https://github.com/uploadcare/blocks/commit/2821bf381b7ed32c1ffe8908d8c71a86eaef9fde))

#### `lr-data-output` now uses native validation to show errors

- **lr-data-output:** improve native form validation ([c329d4c](https://github.com/uploadcare/blocks/commit/c329d4c89b6735af373e234e6580a80fc830e320))

### Bug Fixes

- **lr-config:** validate passed settings ([6012581](https://github.com/uploadcare/blocks/commit/60125813b6b4d6ff16fbecf96e0b6178c4ef106f))
- show inline validation message for the `multiple-min` requirement check fail ([8af0fec](https://github.com/uploadcare/blocks/commit/8af0fec7015516a94791f30be48863fa10488a8b))

## [0.27.6](https://github.com/uploadcare/blocks/compare/v0.27.5...v0.27.6) (2023-10-20)

### Bug Fixes

- **minimal-mode:** add file button should open system dialog ([#544](https://github.com/uploadcare/blocks/issues/544)) ([366d524](https://github.com/uploadcare/blocks/commit/366d524487d19a7d5b46bc39b023ea904fe6d835))

## [0.27.5](https://github.com/uploadcare/blocks/compare/v0.27.4...v0.27.5) (2023-10-19)

### Bug Fixes

- **types:** add missing `LR_CLOUD_MODIFICATION` JSX type ([#542](https://github.com/uploadcare/blocks/issues/542)) ([3307b25](https://github.com/uploadcare/blocks/commit/3307b25ff8948fd87292839664765533df8ed40b))

## [0.27.4](https://github.com/uploadcare/blocks/compare/v0.27.3...v0.27.4) (2023-10-12)

### Bug Fixes

- require `ctx-name` attribute for all the public blocks and wait for it with 300ms timeout ([11d5a94](https://github.com/uploadcare/blocks/commit/11d5a94c9131398138eda27011616745ee4b45fe))

## [0.27.3](https://github.com/uploadcare/blocks/compare/v0.27.2...v0.27.3) (2023-10-10)

### Bug Fixes

- **cloud-image-editor:** make `crop-preset` and `tabs` attributes reactive ([8545c71](https://github.com/uploadcare/blocks/commit/8545c716f4b1e0a6adf55fcdb4c0c921f8cfd852))
- **uploader:** append `preview` operation when setting initial crop with `crop-preset` defined ([5f1036c](https://github.com/uploadcare/blocks/commit/5f1036c5cafa3b7293f214b51a604a3ea53822e5))

## [0.27.2](https://github.com/uploadcare/blocks/compare/v0.27.1...v0.27.2) (2023-10-10)

### Bug Fixes

- capture and store file's full path while getting drag'n'dropped ([#536](https://github.com/uploadcare/blocks/issues/536)) ([3ba168e](https://github.com/uploadcare/blocks/commit/3ba168ee955a3b3231ca42c7112963fa2ff240cb))

## [0.27.1](https://github.com/uploadcare/blocks/compare/v0.27.0...v0.27.1) (2023-10-06)

### Bug Fixes

- **init-flow:** fix sync `initFlow` calls right after upload collection ([#532](https://github.com/uploadcare/blocks/issues/532)) ([f4f4dea](https://github.com/uploadcare/blocks/commit/f4f4dea6014275faf7d6e50b6cf8c7dbdad449aa))

# [0.27.0](https://github.com/uploadcare/blocks/compare/v0.26.0...v0.27.0) (2023-10-06)

### Bug Fixes

- **drag-n-drop:** do not show drop cursor when it's not over the drop target ([05a08dc](https://github.com/uploadcare/blocks/commit/05a08dc7206b451e0d4fcd14599d4415f317631b))

### Features

- **simple-btn:** add flag to toggle drop-zone ([5f4fae2](https://github.com/uploadcare/blocks/commit/5f4fae27738e77dfeb11284ab8f38b4cdf3c57d5))

Example:

```js
class CustomSimpleBtn extends LR.SimpleBtn {
  dropzone = false;
}

LR.registerBlocks({ ...LR, SimpleBtn: CustomSimpleBtn });
```

or

```html
<lr-simple-btn dropzone="false"></lr-simple-btn>
```

# [0.26.0](https://github.com/uploadcare/blocks/compare/v0.25.6...v0.26.0) (2023-10-03)

### Features

#### New option `cloudImageEditorTabs`

Defines the list of tabs in the cloud image editor. See the [configuration reference](https://uploadcare.com/docs/file-uploader/options/#cloud-image-editor-tabs) for more details.

- **cloud-image-editor:** add ability to hide unnecessary editor tabs (crop, tuning or filters) ([af15f51](https://github.com/uploadcare/blocks/commit/af15f514f8eb787d25409efbd392e8c17deae0db))

#### New option `cropPreset`

Defines the crop behavior. When uploading images, your users can select a crop area with defined aspect ratio. See the [configuration reference](https://uploadcare.com/docs/file-uploader/options/#crop-preset) for more details.

- **cloud-image-editor:** add crop preset setting ([923f4ca](https://github.com/uploadcare/blocks/commit/923f4ca975c6829fc5ca02271c053b2c427ba72c))
- **uploader:** force defined aspect ration for the output images ([26eda66](https://github.com/uploadcare/blocks/commit/26eda66729e230e2197a8c6a2d879cc9220e850b))

### Fixes

- **external-sources:** add files to the upload list after done button click ([0089370](https://github.com/uploadcare/blocks/commit/00893706332ab1a9de4d62e1fc9c51fba952ae08))

## [0.25.6](https://github.com/uploadcare/blocks/compare/v0.25.5...v0.25.6) (2023-09-01)

### Bug Fixes

- **types:** shadow wrapper static fields mixin ([#522](https://github.com/uploadcare/blocks/issues/522)) ([a65435c](https://github.com/uploadcare/blocks/commit/a65435cd1fc1ecc109a23af306b50d10323693d9))

## [0.25.5](https://github.com/uploadcare/blocks/compare/v0.25.4...v0.25.5) (2023-08-28)

### Bug Fixes

- **types:** events types export for angular projects ([#518](https://github.com/uploadcare/blocks/issues/518)) ([daf3c2c](https://github.com/uploadcare/blocks/commit/daf3c2c822bf90d0981efab1636bf8457d0fd417))

## [0.25.4](https://github.com/uploadcare/blocks/compare/v0.25.3...v0.25.4) (2023-08-08)

### Bug Fixes

- **add-file-from:** handle upload collection initial state when called before initialization ([6f932d3](https://github.com/uploadcare/blocks/commit/6f932d32327bffd9622e3a6e41cf383efe00d355))
- **inline:** show upload list if there are any file in the list ([96e44e6](https://github.com/uploadcare/blocks/commit/96e44e6dc7cbf10328eabd66c1a8bbb1032a007d))
- **minimal:** show upload list if there are any file in the list ([174c4a7](https://github.com/uploadcare/blocks/commit/174c4a77f0acd297add06e6e01de1a7db100ac64))

## [0.25.3](https://github.com/uploadcare/blocks/compare/v0.25.2...v0.25.3) (2023-08-08)

### Bug Fixes

- **minimal:** add exports of `lr-config` and `upload-ctx-provider` ([#506](https://github.com/uploadcare/blocks/issues/506)) ([8049e6f](https://github.com/uploadcare/blocks/commit/8049e6fdee1abb7f1fdae2c81acb413b8bfb02db))

## [0.25.2](https://github.com/uploadcare/blocks/compare/v0.25.1...v0.25.2) (2023-08-07)

## [0.25.1](https://github.com/uploadcare/blocks/compare/v0.25.0...v0.25.1) (2023-07-24)

### Bug Fixes

- **cloud-image-editor:** fix `initEditor` type ([#502](https://github.com/uploadcare/blocks/issues/502)) ([6c222d5](https://github.com/uploadcare/blocks/commit/6c222d595e9a0e578473af616a45ba1d5fda9884))

## [0.25.0](https://github.com/uploadcare/blocks/compare/v0.24.2...v0.25.0) (2023-07-24)

### BREAKING CHANGES

1. Configuration in CSS is now deprecated.
   Although it currently works, it will be removed shortly.
   In lieu of this, we are introducing a new lr-config block for configuration definitions.

2. The `css-src` attribute is now required on solution blocks.
   This implies that the use of Shadow DOM is enforced.

3. The `ctx-name` attribute is required for the each block on the page.

4. Method `setUploadMetadata` is deprecated in favour of `metadata` DOM property
   on the `lr-config` block.

5. `CloudEditor` (`lr-cloud-editor`) solution block is renamed to
   `CloudImageEditor` (`lr-cloud-image-editor`).

6. `CloudImageEditor` (`lr-cloud-image-editor`) activity is was renamed to
   `CloudImageEditorActivity` (`lr-cloud-image-editor-activity`).

7. All solution bundles are prefixed with `lr-` prefix:

- `file-uploader-regular.min.js` -> `lr-file-uploader-regular.min.js`
- `file-uploader-regular.min.css` -> `lr-file-uploader-regular.min.css`
- `file-uploader-inline.min.js` -> `lr-file-uploader-inline.min.js`
- `file-uploader-inline.min.css` -> `lr-file-uploader-inline.min.css`
- `file-uploader-minimal.min.js` -> `lr-file-uploader-minimal.min.js`
- `file-uploader-minimal.min.css` -> `lr-file-uploader-minimal.min.css`

8. Solution bundles do not automatically register blocks.
   You will need to manually register them:

```js
import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.js';

LR.registerBlocks(LR);
```

9. Bundle `blocks.iife.js` is renamed to `blocks.iife.min.js`.

10. Bundle `blocks-browser.min.js` is deprecated. Use `blocks.iife.min.js`
    instead.

### How to migrate

This migration guide is also available at: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/

#### Configuration

First and foremost, you need to shift all the configuration from CSS to the `lr-config` block.
For instance, if you have the following CSS:

```css
.config {
  --ctx-name: 'my-uploader';
  --cfg-pubkey: 'YOUR_PUBLIC_KEY';
  --cfg-multiple-min: 0;
  --cfg-multiple-max: 3;
}
```

Move it to the `lr-config` block:

```html
<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY" multiple-min="0" multiple-max="3"></lr-config>
```

Subsequently, you should link your solution block to the `lr-config` block using the `ctx-name` attribute:

```html
<lr-file-uploader-regular
  ctx-name="my-uploader"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

The property names remain the same but without the `--cfg` prefix. For example,
`--cfg-pubkey` becomes simply `pubkey`.

See the [configuration reference][file-uploader-configuration] for more details.

#### Dynamic configuration updates

If you have dynamically updated CSS configuration like this:

```js
const uploader = document.querySelector('lr-file-uploader-regular');
uploader.style.setProperty('--cfg-pubkey', 'YOUR_PUBLIC_KEY');

const uploaderCtx = document.querySelector('lr-upload-ctx-provider');
uploaderCtx.updateCtxCssData();
```

You need to update it to the following:

```js
const config = document.querySelector('lr-config');
config.setAttribute('pubkey', 'YOUR_PUBLIC_KEY'); // using attribute
config.pubkey = 'YOUR_PUBLIC_KEY'; // or using DOM property
```

Both attributes and DOM properties are reactive so you don't need to call
`updateCtxCssData` anymore.

#### Shadow DOM and `css-src`

Shadow DOM is now enforced for all the solution blocks. It means that you need
to use `css-src` attribute to attach CSS to the block.

If you previously attached CSS to the global like this:

```html
<link href="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css" rel="stylesheet" />

<lr-file-uploader-regular class="lr-wgt-common"></lr-file-uploader-regular>
```

You need to use `css-src` attribute instead:

```html
<lr-file-uploader-regular
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

(Other attributes are omitted for brevity)

#### `ctx-name` attribute

`ctx-name` attribute is required for all the blocks now even if you have only
one block on the page. It's used to wire blocks to the `lr-config` block. For
example:

```html
<lr-config ctx-name="my-uploader"></lr-config>
<lr-file-uploader-regular ctx-name="my-uploader"></lr-file-uploader-regular>
<lr-upload-ctx-provider ctx-name="my-uploader"></lr-upload-ctx-provider>
<lr-data-output ctx-name="my-uploader"></lr-data-output>
```

(Other attributes are omitted for brevity)

#### Replace `setUploadMetadata` with `metadata` DOM property

If you was using `setUploadMetadata` method like this:

```js
uploaderCtxProvider.setUploadMetadata({ foo: 'bar' });
```

You need to replace it with `metadata` DOM property on the `lr-config` block:

```js
const config = document.querySelector('lr-config');
config.metadata = { foo: 'bar' };
// or
config.metadata = () => Promise.resolve({ foo: 'bar' });
```

See the [configuration reference][file-uploader-option-metadata] for more details.

#### Rename `CloudEditor` -> `CloudImageEditor`

If you was using standalone `lr-cloud-editor` solution block, you need to rename
it to `lr-cloud-image-editor` like this:

```html
<lr-cloud-image-editor
  uuid="7c167b79-9f27-4489-8032-3f3be1840605"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-cloud-image-editor.min.css"
  ctx-name="my-editor"
></lr-cloud-image-editor>
```

#### Rename `CloudImageEditor` -> `CloudImageEditorActivity`

If you was using `lr-cloud-image-editor` activity block inside your custom
Symbiote.js templates, you need to rename it to `lr-cloud-image-editor-activity`
like this:

```js
FileUploaderRegular.template = /* HTML */ `
  <lr-simple-btn></lr-simple-btn>

  <lr-modal strokes block-body-scrolling>
    <lr-start-from>
      <lr-drop-area with-icon clickable></lr-drop-area>
      <lr-source-list wrap></lr-source-list>
      <lr-copyright></lr-copyright>
    </lr-start-from>
    <lr-upload-list></lr-upload-list>
    <lr-camera-source></lr-camera-source>
    <lr-url-source></lr-url-source>
    <lr-external-source></lr-external-source>
    <lr-cloud-image-editor-activity></lr-cloud-image-editor-activity>
    <!-- here it is -->
  </lr-modal>

  <lr-message-box></lr-message-box>
  <lr-progress-bar-common></lr-progress-bar-common>
`;
```

#### Rename imported JS and CSS bundles

Just rename all the imports according to the following table:

| Old name                        | New name                           |
| ------------------------------- | ---------------------------------- |
| `file-uploader-regular.min.js`  | `lr-file-uploader-regular.min.js`  |
| `file-uploader-regular.min.css` | `lr-file-uploader-regular.min.css` |
| `file-uploader-inline.min.js`   | `lr-file-uploader-inline.min.js`   |
| `file-uploader-inline.min.css`  | `lr-file-uploader-inline.min.css`  |
| `file-uploader-minimal.min.js`  | `lr-file-uploader-minimal.min.js`  |
| `file-uploader-minimal.min.css` | `lr-file-uploader-minimal.min.css` |

For example:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/file-uploader-regular.min.js';
  LR.registerBlocks(LR);
</script>

<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY"></lr-config>

<lr-file-uploader-regular
  ctx-name="my-uploader"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

Became:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.js';
  LR.registerBlocks(LR);
</script>

<lr-config ctx-name="my-uploader" pubkey="YOUR_PUBLIC_KEY"></lr-config>

<lr-file-uploader-regular
  ctx-name="my-uploader"
  css-src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.css"
></lr-file-uploader-regular>
```

#### Call `registerBlocks` manually

If you have installed blocks using `min.js` bundles, you need to call
`registerBlocks` manually:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/lr-file-uploader-regular.min.js';
  LR.registerBlocks(LR);
</script>
```

#### Rename `blocks.iife.js` to `blocks.iife.min.js`

If you previously used the `blocks.iife.js` bundle, you need to rename it to
`blocks.iife.min.js` as follows:

```html
<script src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.iife.min.js" async />
```

#### Rename `blocks-browser.min.js` to `blocks.iife.min.js`

If you were using the `connectBlocksFrom` method in conjunction with the
`blocks-browser.min.js` bundle, you need to rename it to `blocks.iife.min.js`,
as shown below:

```js
connectBlocksFrom('https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.iife.min.js').then((LR) => {
  LR.registerBlocks(LR);
  //  ...
});
```

If you were using `blocks-browser.min.js` via a `script` tag with `type="module"`,
you need to rename it to `blocks.min.js`, as shown below:

```html
<script type="module">
  import * as LR from 'https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.min.js';

  LR.registerBlocks(LR);
</script>
```

If you were using `blocks-browser.min.js` via a `script` tag without
`type="module"`, you need to rename it to `blocks.iife.min.js`, as shown below:

```html
<script src="https://cdn.jsdelivr.net/npm/@uploadcare/blocks/web/blocks.iife.min.js" async />
```

## [0.24.2](https://github.com/uploadcare/blocks/compare/v0.24.1...v0.24.2) (2023-07-20)

### Changes

- update readme

## [0.24.1](https://github.com/uploadcare/blocks/compare/v0.24.0...v0.24.1) (2023-06-27)

### Bug Fixes

- **url-source:** enable input autofocus, form submit, value clear on submit ([#495](https://github.com/uploadcare/blocks/issues/495)) ([552cad3](https://github.com/uploadcare/blocks/commit/552cad3ed9470c904e5f0d3c123aad3e8cb932d6))

# [0.24.0](https://github.com/uploadcare/blocks/compare/v0.23.0...v0.24.0) (2023-06-21)

### Bug Fixes

- **drag-n-drop:** copy `type` value from `DataTransferItem` to `FileSystemFileEntry` when doing drag'n'drop because `FileSystemFileEntry` don't resolve type for HEIC ([832ed55](https://github.com/uploadcare/blocks/commit/832ed55814b58bf133a6881caef223f1a0d7a446))
- get `mimeType` from upload API from both `contentInfo` and provided type ([33cf2f7](https://github.com/uploadcare/blocks/commit/33cf2f77291c70cd065fd7b9c3c9f174688590d0))
- **validation:** skip client validation if mime type or file name aren't available ([0d7a96f](https://github.com/uploadcare/blocks/commit/0d7a96ff27535f4f24449796d73b1b3acd9fde34))

### Features

- add icons for flickr, evernote, box, onedrive, huddle ([#490](https://github.com/uploadcare/blocks/issues/490)) ([30ae37d](https://github.com/uploadcare/blocks/commit/30ae37db5823f509764b019e0bdc3c8c254ffbea))

# [0.23.0](https://github.com/uploadcare/blocks/compare/v0.22.13...v0.23.0) (2023-06-14)

### Features

- add `uploadAll` method to trigger upload ([db69508](https://github.com/uploadcare/blocks/commit/db69508d84838937440d3fb119ff20d0dc6575f6))
- add separate `addFileFromUrl`, `addFileFromUuid` and `addFileFromObject` ([b5a89c4](https://github.com/uploadcare/blocks/commit/b5a89c4d51d68527c61a69cd55d96dcba892ee70))

### Deprecations

- method `addFiles` is deprecated in favour of `addFileFromUrl`, `addFileFromUuid` and `addFileFromObject` above

### API

```js
// `silent` option supresses `LR_UPLOAD_FINISH` event
// `fileName` options specifies file name
uploaderCtx.addFileFromUrl(url: string, { silent?: boolean, fileName?: string } = {});
uploaderCtx.addFileFromUuid(uuid: string, { silent?: boolean, fileName?: string } = {});
uploaderCtx.addFileFromObject(file: File, { silent?: boolean, fileName?: string } = {});

// Trigger uploading. Useful with `--cfg-confirm-upload: 1;` to force uploading predefined files.
uploaderCtx.uploadAll();
```

## [0.22.13](https://github.com/uploadcare/blocks/compare/v0.22.12...v0.22.13) (2023-06-14)

### Bug Fixes

- **external-source:** safari iframe height ([#479](https://github.com/uploadcare/blocks/issues/479)) ([88b54d8](https://github.com/uploadcare/blocks/commit/88b54d8eaacc4f4ff40f6d8a89ed2c3b71ece48e))
- **instagram:** scaled & cropped photos ([#484](https://github.com/uploadcare/blocks/issues/484)) ([9f71221](https://github.com/uploadcare/blocks/commit/9f712217983e4a25dffbd2740e80a92fb2132fdd))

## [0.22.12](https://github.com/uploadcare/blocks/compare/v0.22.11...v0.22.12) (2023-06-09)

### Features

- add IIFE bundle `web/blocks.iife.js` ([#480](https://github.com/uploadcare/blocks/pull/480))

## [0.22.11](https://github.com/uploadcare/blocks/compare/v0.22.10...v0.22.11) (2023-06-08)

### Bug Fixes

- skip validation if no allowed file types provided ([#477](https://github.com/uploadcare/blocks/issues/477)) ([e241993](https://github.com/uploadcare/blocks/commit/e241993f46d57840abf287eb47314cace1ba1058))

## [0.22.10](https://github.com/uploadcare/blocks/compare/v0.22.9...v0.22.10) (2023-06-08)

### Bug Fixes

- **file-item:** `--cfg-img-only` for external sources causing error ([#475](https://github.com/uploadcare/blocks/issues/475)) ([479db7b](https://github.com/uploadcare/blocks/commit/479db7b5ea7bf467a4a29819628347a31992acdc))

## [0.22.9](https://github.com/uploadcare/blocks/compare/v0.22.8...v0.22.9) (2023-06-05)

### Bug Fixes

- **copyright:** not working --cfg-remove-copyright config option ([#473](https://github.com/uploadcare/blocks/issues/473)) ([e925c7b](https://github.com/uploadcare/blocks/commit/e925c7b2e03c9833c12f7e2a54baa0b23f11fe2e))

## [0.22.8](https://github.com/uploadcare/blocks/compare/v0.22.7...v0.22.8) (2023-05-31)

### Bug Fixes

- make file extension validation case-insensitive ([#471](https://github.com/uploadcare/blocks/issues/471)) ([ae87b6b](https://github.com/uploadcare/blocks/commit/ae87b6be883de9e95e9afe0592b4a14a9f3d873c))

## [0.22.7](https://github.com/uploadcare/blocks/compare/v0.22.6...v0.22.7) (2023-05-29)

### Bug Fixes

- **cloud-editor:** double init ([#469](https://github.com/uploadcare/blocks/issues/469)) ([aae43ee](https://github.com/uploadcare/blocks/commit/aae43ee8b04e5a9c8a49d1eb49bc949c3af26080))

## [0.22.6](https://github.com/uploadcare/blocks/compare/v0.22.5...v0.22.6) (2023-05-26)

### Bug Fixes

- **cloud-editor:** init editor on initCallback instead of connectedCallback to prevent cases when editor init is going before the block init ([#467](https://github.com/uploadcare/blocks/issues/467)) ([f6d92fd](https://github.com/uploadcare/blocks/commit/f6d92fda5fc3c495111526b97f283b63a5cd3117))

## [0.22.5](https://github.com/uploadcare/blocks/compare/v0.22.4...v0.22.5) (2023-05-26)

### Bug Fixes

- do not use host-context unsupported in firefox and safari ([7ab7a98](https://github.com/uploadcare/blocks/commit/7ab7a985e17d6f3becff5c67c0ae7bb3e5bdb8ae))

## [0.22.4](https://github.com/uploadcare/blocks/compare/v0.22.3...v0.22.4) (2023-05-23)

### Bug Fixes

- **file-item:** do not validate local files if no mime type provided (this is the case for drag'n'dropped HEICs) ([e47497e](https://github.com/uploadcare/blocks/commit/e47497e3cfa72a415c24d9d28362b6a0b3c50738))
- **file-item:** validate file extensions along with the mime types ([b89ea0e](https://github.com/uploadcare/blocks/commit/b89ea0ed7ce81ab0f0f6071934f8fb3d4af71c0c))

## [0.22.3](https://github.com/uploadcare/blocks/compare/v0.22.2...v0.22.3) (2023-05-19)

### Features

- **external-source**: configurable social base url ([0cd7f94](https://github.com/uploadcare/blocks/commit/0cd7f94f1eef24b3ce0e346eb1ed5773e82c090e))

### Bug Fixes

- **drop-area:** fix detection of the active dropzone ([97dbb32](https://github.com/uploadcare/blocks/commit/97dbb3272a36e4ae97441a044ac5c260c2018829))
- **drop-area:** prevent flickering on file being dragged before init ([72b76a7](https://github.com/uploadcare/blocks/commit/72b76a7959881613866850f4cf56758624b93741))
- **file-uploader-inline:** update missing `init$` usage that was leading to crash ([51a7b10](https://github.com/uploadcare/blocks/commit/51a7b109df66e4fe654c46078a03b24474589d71))

## [0.22.2](https://github.com/uploadcare/blocks/compare/v0.22.1...v0.22.2) (2023-05-17)

### Bug Fixes

- add empty export to the blocks-browser bundle to fix working under isolatedModules ([#451](https://github.com/uploadcare/blocks/issues/451)) ([683fb2b](https://github.com/uploadcare/blocks/commit/683fb2b359d96550eee1c6e0ccf8873278c207ea))
- **cloud-editor:** extend from ShadowWrapper ([3c518a5](https://github.com/uploadcare/blocks/commit/3c518a55c3006efc8dba9a8c7e6d0aec1ee1649b))
- **cloud-editor:** solution bundle ([89ad5af](https://github.com/uploadcare/blocks/commit/89ad5afd2be4291f5abf85f179ec2d044136e2ef))

## [0.22.1](https://github.com/uploadcare/blocks/compare/v0.22.0...v0.22.1) (2023-05-15)

### Bug Fixes

- **copyright:** hide whole `lr-copyright` block if it's disabled ([2550d20](https://github.com/uploadcare/blocks/commit/2550d2009d2bf8819e9b7c0d4d2f8bdd7665d9a6))
- get rid of `ctxOwner` flag due to it's buggy behaviour ([6c5f374](https://github.com/uploadcare/blocks/commit/6c5f37442cec5b23f0f532854e28948e81129c51))

# [0.22.0](https://github.com/uploadcare/blocks/compare/v0.21.7...v0.22.0) (2023-05-12)

### Bug Fixes

- **file-item:** error while rewoke thumb ([9dc73ff](https://github.com/uploadcare/blocks/commit/9dc73ff956c7ac39b2cfc2ee97c686e3c33847b1))
- **progress-bar-common:** ignore pointer events when not active ([e6ddbf6](https://github.com/uploadcare/blocks/commit/e6ddbf611f9cc418f414d7489564cadf56097df1))
- Don't show block re-registration warnings for the same block components

### Features

- Run upload requests in the queue ([ed9d6de](https://github.com/uploadcare/blocks/commit/ed9d6de5c098b9433c9a4ad4c6c8d48bb1617737))

## [0.21.7](https://github.com/uploadcare/blocks/compare/v0.21.6...v0.21.7) (2023-05-03)

### Bug Fixes

- bump @uploadcare/upload-client to fix issues with Buffer polyfilling by CDNs (esm.sh, skypack) ([#442](https://github.com/uploadcare/blocks/issues/442)) ([afd1d7d](https://github.com/uploadcare/blocks/commit/afd1d7dcd48005c77a4487057fcb4c96133098a9))

## [0.21.6](https://github.com/uploadcare/blocks/compare/v0.21.5...v0.21.6) (2023-04-28)

### Bug Fixes

- **file-uploader-inline:** add `flex: 1` css property to fill all available space inside flex column container ([#439](https://github.com/uploadcare/blocks/issues/439)) ([a781d20](https://github.com/uploadcare/blocks/commit/a781d20217a923b02cd58bc5b093379a5e3b21a4))
- **package.json:** add types to exports field ([#440](https://github.com/uploadcare/blocks/issues/440)) ([718f432](https://github.com/uploadcare/blocks/commit/718f43214105f2b15c36b8d8344c5b723115295c))

## [0.21.5](https://github.com/uploadcare/blocks/compare/v0.21.4...v0.21.5) (2023-04-27)

### Bug Fixes

- **file-uploader-inline:** set init context ([#437](https://github.com/uploadcare/blocks/issues/437)) ([81031a7](https://github.com/uploadcare/blocks/commit/81031a7212b17ffe588d8d4e829734c59055aec8))

## [0.21.4](https://github.com/uploadcare/blocks/compare/v0.21.3...v0.21.4) (2023-04-27)

### Bug Fixes

- **file-uploader-inline:** do not try to hide drop area because it's hides itself ([#435](https://github.com/uploadcare/blocks/issues/435)) ([4f11007](https://github.com/uploadcare/blocks/commit/4f110071ba8b7709fcf6fe0f8f727224d5d3763f))

## [0.21.3](https://github.com/uploadcare/blocks/compare/v0.21.2...v0.21.3) (2023-04-27)

### Bug Fixes

- **modal:** restore scroll lock on modal destroy ([#433](https://github.com/uploadcare/blocks/issues/433)) ([70fad11](https://github.com/uploadcare/blocks/commit/70fad116fe1845b1ff590e765748a770d4f8ee12))

## [0.21.2](https://github.com/uploadcare/blocks/compare/v0.21.1...v0.21.2) (2023-04-27)

### Bug Fixes

- **jsx:** add missing lr-file-uploader-inline tag ([#431](https://github.com/uploadcare/blocks/issues/431)) ([a15cc28](https://github.com/uploadcare/blocks/commit/a15cc286fa0f09fb21248d425a0223b31ad77154))

## [0.21.1](https://github.com/uploadcare/blocks/compare/v0.21.0...v0.21.1) (2023-04-25)

### Bug Fixes

- **activity-block:** reset current activity ([e72f15c](https://github.com/uploadcare/blocks/commit/e72f15cfdd49d439e95644999cb160b3629c1009))
- **activity-header:** button colors in the darkmode ([6c29b47](https://github.com/uploadcare/blocks/commit/6c29b47bc515783927b1421ecbac1d04a1bb3d74))
- **block:** update css data when block is connected to the DOM only ([23a99e2](https://github.com/uploadcare/blocks/commit/23a99e220706ddd7fa5cdd2a48332ec3cb649c45))
- **drop-area:** disable and hide drop area if local sources are not allowed ([cf6bc8a](https://github.com/uploadcare/blocks/commit/cf6bc8a3c5ec1cea4dfd405d7d80c8d678c43d09))
- **external-source:** reactive style updates ([bb6838b](https://github.com/uploadcare/blocks/commit/bb6838b2f057fcfa5336ee8be1eaae8eb01d6a3a))
- **message-box:** reduce background lightness in the darkmode ([221bd05](https://github.com/uploadcare/blocks/commit/221bd05e86c62d8a75f7eb4f802f7fbbf58eaef5))
- **shadow-wrapper:** prepend css-src style instead of append to make easier to override styles via `shadowStyles` ([7941e40](https://github.com/uploadcare/blocks/commit/7941e4077a0ad15fed4af5acf8229257eba971d0))
- **simple-btn:** safari icon fractional scaling ([4400acd](https://github.com/uploadcare/blocks/commit/4400acd75d500df16b7f6067416f596e074e0114))
- **solutions:** export LR from web bundles ([d5e718c](https://github.com/uploadcare/blocks/commit/d5e718c935b5d238fb5a642444c46565b890e874))
- **source-list:** update children when source list is empty ([75cbbd4](https://github.com/uploadcare/blocks/commit/75cbbd414bc7d5e95125da9a77e6515aaba2c8c3))
- stub package exports for SSR ([d528184](https://github.com/uploadcare/blocks/commit/d528184093366efef61468b3342fdce5a18327f5))
- **upload-list:** do not try to handle file collection update while being disconnected from DOM ([ef6f101](https://github.com/uploadcare/blocks/commit/ef6f101eede0c9fffe9be52f31a04b1521eefad6))

# [0.21.0](https://github.com/uploadcare/blocks/compare/v0.20.1...v0.21.0) (2023-04-19)

### Features

- add `--cfg-external-sources-preferred-types` option to configure preferred mime types for the external sources ([1d4e645](https://github.com/uploadcare/blocks/commit/1d4e64583e7ab58670f2f094f691ad54175749d7))

## [0.20.1](https://github.com/uploadcare/blocks/compare/v0.20.0...v0.20.1) (2023-04-11)

### Bug Fixes

- bundle stubbed jsx types to npm package ([#414](https://github.com/uploadcare/blocks/issues/414)) ([98de315](https://github.com/uploadcare/blocks/commit/98de3150181556b8ade97d948ae4aa345adae8ee))

# [0.20.0](https://github.com/uploadcare/blocks/compare/v0.19.0...v0.20.0) (2023-04-10)

### Bug Fixes

- **file-item:** make ui reactive to css data ([5d64a05](https://github.com/uploadcare/blocks/commit/5d64a05a3ba5beb1919b98e9c1009cae27b5e616))
- **simple-btn:** prevent dropzone flickering on initial render ([82d9c1d](https://github.com/uploadcare/blocks/commit/82d9c1d6af67f115e276775d751ead280d211740))
- **types:** add type stub for `lr-upload-ctx-provider` ([560502f](https://github.com/uploadcare/blocks/commit/560502f82adb8604d1d61958046533bc5ec4f362))
- **uploader-block:** add missing external source types to the UploaderBlock's `sourceTypes` static property ([0a7c2fc](https://github.com/uploadcare/blocks/commit/0a7c2fcc573943a85dc875d51dfa79302ccc0ea0))

### Features

- add `--cfg-remove-copyright` option ([e128953](https://github.com/uploadcare/blocks/commit/e128953bf042b52cf5727f73f7321f4b23f6c60e))
- **block:** add method `updateCtxCssData` to update css data for all the blocks in the context ([5a89749](https://github.com/uploadcare/blocks/commit/5a8974972de401ca35873fb4f44b6e12768520f1))

# [0.19.0](https://github.com/uploadcare/blocks/compare/v0.18.1...v0.19.0) (2023-03-10)

### Bug Fixes

- **cloud-editor:** refetch image on container resize ([67ea66f](https://github.com/uploadcare/blocks/commit/67ea66f394cdbf43831e0410b9fc36e3406d1a4f))

### Features

- **cloud-editor:** use resize observer to wait for non-zero container size ([5686965](https://github.com/uploadcare/blocks/commit/56869653037dc0a6f7a140df34b5e0a56e347585))

## [0.18.1](https://github.com/uploadcare/blocks/compare/v0.18.0...v0.18.1) (2023-03-09)

### Bug Fixes

- **docs:** set cloud-editor examples body height ([#398](https://github.com/uploadcare/blocks/issues/398)) ([690760e](https://github.com/uploadcare/blocks/commit/690760e47903ee693b456c398dab4c165cec3fed))
- **lr-data-output:** create dynamic inputs container even if `input-required` is not defined ([#401](https://github.com/uploadcare/blocks/issues/401)) ([cdfce56](https://github.com/uploadcare/blocks/commit/cdfce567e888ecedec08d8c3d1dec13e07b7a671))

# [0.18.0](https://github.com/uploadcare/blocks/compare/v0.17.1...v0.18.0) (2023-02-17)

### Bug Fixes

- **modal:** backdrop color definition ([d8fcf51](https://github.com/uploadcare/blocks/commit/d8fcf51a93aef72250b1e3e0149f6557c34ad149))
- **modal:** do not manipulate `open` attr if dialog is supported ([4a286b9](https://github.com/uploadcare/blocks/commit/4a286b9e72236300a0f00d82ac53ce2db4619f81))

### Features

- **data-output:** add `input-required` attribute ([0fb1370](https://github.com/uploadcare/blocks/commit/0fb13702143dffd1f7cc4c6eeb4249cccba14721))
- **file-uploader-minimal:** include `lr-data-output` to the bundle ([a6e7802](https://github.com/uploadcare/blocks/commit/a6e78028e2369bf6e6c4ccf197f02a938b50a7a3))

## [0.17.1](https://github.com/uploadcare/blocks/compare/v0.17.0...v0.17.1) (2023-02-14)

### Bug Fixes

- **cloud-image-editor:** get rid of `change` event double initial calling ([#386](https://github.com/uploadcare/blocks/issues/386)) ([0cc0b00](https://github.com/uploadcare/blocks/commit/0cc0b0089c8f897c0ba3e4e951dd20188b21cf86))

# [0.17.0](https://github.com/uploadcare/blocks/compare/v0.16.1...v0.17.0) (2023-02-08)

### Bug Fixes

- **cloud-image-editor:** dispatch events with `bubble` and `composed` flags ([58733c4](https://github.com/uploadcare/blocks/commit/58733c49505d623dee0ac4aed53fb31df251f530))
- **cloud-image-editor:** fix extraction of `filter` operation with undefined value ([351b080](https://github.com/uploadcare/blocks/commit/351b0801a7356550ebfde5e2ee5b6b89851cdbf9))
- **cloud-image-editor:** pause render until container get non-zero size ([1e5a4a8](https://github.com/uploadcare/blocks/commit/1e5a4a8210f73c8a163ae363b6f7e7c993c83061))

### Features

- **cloud-image-editor:** Add `change` event ([1fff5fb](https://github.com/uploadcare/blocks/commit/1fff5fb95ca6bcd4661844fab956888e974531b6))

## [0.16.1](https://github.com/uploadcare/blocks/compare/v0.16.0...v0.16.1) (2023-02-06)

### Bug Fixes

- do not call init flow without user interaction ([#380](https://github.com/uploadcare/blocks/issues/380)) ([be100a5](https://github.com/uploadcare/blocks/commit/be100a5ef0bc254d62f89ad776482b07bda27d3f))
- **file-uploader-inline:** show back button ([#381](https://github.com/uploadcare/blocks/issues/381)) ([cb83ebe](https://github.com/uploadcare/blocks/commit/cb83ebe7b399cee80af00489b0b1a7c4b4aa77bb))

# [0.16.0](https://github.com/uploadcare/blocks/compare/v0.15.2...v0.16.0) (2023-02-03)

### Bug Fixes

- **file-uploader-inline:** hide close button ([4026508](https://github.com/uploadcare/blocks/commit/4026508265e9202dd10ecca9441e2ce7dd0d19e9))

### Features

- add `LR_DONE_FLOW` and `LR_INIT_FLOW` events ([b5828ad](https://github.com/uploadcare/blocks/commit/b5828ad1f9b0c9222afb48fb9f440aa303d31ddb))

## [0.15.2](https://github.com/uploadcare/blocks/compare/v0.15.1...v0.15.2) (2023-02-03)

### Bug Fixes

- **upload-list:** undefined files count in the header ([#376](https://github.com/uploadcare/blocks/issues/376)) ([c897986](https://github.com/uploadcare/blocks/commit/c8979864c6fe1a3ac1231caff1538263356ecf66))

## [0.15.1](https://github.com/uploadcare/blocks/compare/v0.15.0...v0.15.1) (2023-02-02)

### Bug Fixes

- **file-item:** dont show edit button if `--cfg-use-cloud-image-editor` flag is false ([#374](https://github.com/uploadcare/blocks/issues/374)) ([85d79bb](https://github.com/uploadcare/blocks/commit/85d79bb30cfbd751471e9186ec65cedd468fcd75))

# [0.15.0](https://github.com/uploadcare/blocks/compare/v0.14.3...v0.15.0) (2023-01-31)

We are excited to announce the launch of a brand-new design. This new design offers a more modern look and feels, making it easier and faster to use. We have also made several other UI improvements, such as improved navigation and a better overall user experience. We hope you enjoy the new design and experience.

### Breaking changes

If you haven't used custom templates, then there shouldn't be any breaking changes for you.

If you're using custom templates, you will need to update them to comply with the new version's default template.

- Content of `<lr-start-from />` component was modified
- `<lr-confirmation-dialog />` was removed

Here is the basic template for the `<lr-file-uploader-regular />` component:

```html
<lr-simple-btn></lr-simple-btn>

<lr-modal strokes block-body-scrolling>
  <lr-start-from>
    <lr-drop-area with-icon clickable></lr-drop-area>
    <lr-source-list wrap></lr-source-list>
    <lr-copyright></lr-copyright>
  </lr-start-from>
  <lr-upload-list></lr-upload-list>
  <lr-camera-source></lr-camera-source>
  <lr-url-source></lr-url-source>
  <lr-external-source></lr-external-source>
  <lr-cloud-image-editor></lr-cloud-image-editor>
</lr-modal>

<lr-message-box></lr-message-box>
<lr-progress-bar-common></lr-progress-bar-common>
```

### Bug Fixes

- **image-editor:** restore transformations state from the cdn url ([32b1858](https://github.com/uploadcare/blocks/commit/32b18580e780bd55b18cfa2f0d31aa4d0b5b8742))
- **shadow-wrapper:** hide container until css load ([ef9c552](https://github.com/uploadcare/blocks/commit/ef9c552c925a2c35689a4cdfe4bbd83e46e741db))
- specify image types for file input capture accept, fixes Firefox on Android ([99b5f4f](https://github.com/uploadcare/blocks/commit/99b5f4f20bad0573cc7ee81a567c52cd88ca3f7c))

### Features

- allow custom pluralizers ([62ecffb](https://github.com/uploadcare/blocks/commit/62ecffb387b2b912b061f43b3e9f7cd7903aee13))
- do not confirm upload list clearing ([c90c57a](https://github.com/uploadcare/blocks/commit/c90c57a9d1d4ab3e335fbd7a6486195d02b15de8))
- show `cloud editor` instead of `upload details` ([036be6c](https://github.com/uploadcare/blocks/commit/036be6c9ede40d81414c4aafa0a7c5ce244ced2f))
- **drop-area**: fullscreen mode
- **upload-list**: show upload errors inside file item

## [0.14.3](https://github.com/uploadcare/blocks/compare/v0.14.2...v0.14.3) (2022-12-20)

### Bug Fixes

- **data-output:** pass files or group URL to the hidden input ([160b08f](https://github.com/uploadcare/blocks/commit/160b08f174d605d3b499784c26793b3bebdfcf62))
- **events:** emit `LR_DATA_OUTPUT` on image edit ([fa30140](https://github.com/uploadcare/blocks/commit/fa30140c34dd6d46842d569c2654e7b330358bab))
- **events:** pass the whole file info object to to the `LR_CLOUD_MODIFICATION` event ([38440bd](https://github.com/uploadcare/blocks/commit/38440bdcd12ff64163662d0b4ae4ffa05f775d20))
- single source behaviour ([#343](https://github.com/uploadcare/blocks/issues/343)) ([d2929de](https://github.com/uploadcare/blocks/commit/d2929de53e4352fee815f95124796cd20f930838))

## [0.14.2](https://github.com/uploadcare/blocks/compare/v0.14.1...v0.14.2) (2022-11-22)

### Bug Fixes

- wrap `::backdrop` with `:is` to prevent ignoring from unsupported browsers ([#332](https://github.com/uploadcare/blocks/issues/332)) ([e3ef691](https://github.com/uploadcare/blocks/commit/e3ef6919f3154c7d0017df73c1a5ba63c0a0e996))

## [0.14.1](https://github.com/uploadcare/blocks/compare/v0.14.0...v0.14.1) (2022-10-26)

### Bug Fixes

- fix processing escaped css property values in Firefox

# [0.14.0](https://github.com/uploadcare/blocks/compare/v0.13.0...v0.14.0) (2022-10-26)

### Bug Fixes

- **external-source:** prevent iframe height overflow ([4fc669b](https://github.com/uploadcare/blocks/commit/4fc669b0d4f132c73a5cf533f01f06e2ac129bbc))
- **store:** set store to `auto` by default ([464a5ce](https://github.com/uploadcare/blocks/commit/464a5ce0273cdac55dc7f9457ce60d234dcc2c56))

### Features

- **Block:** use real window height instead of 100vh ([577981e](https://github.com/uploadcare/blocks/commit/577981e8ddeb5a55729dcae16a0f198a312c5f16))
- **camera-source:** show user media denied error to the user ([b4d167d](https://github.com/uploadcare/blocks/commit/b4d167d76fc80d213beb376c6e7a5b99685c4c30))
- **modal:** use native `dialog` element & close modal on outside click ([5ec02e0](https://github.com/uploadcare/blocks/commit/5ec02e0a948de90370e838f2ee107bc1a7ede8e1))

# [0.13.0](https://github.com/uploadcare/blocks/compare/v0.12.4...v0.13.0) (2022-10-17)

### Bug Fixes

- **drop-area:** open modal on files drop ([6c112a8](https://github.com/uploadcare/blocks/commit/6c112a88f02bbb5278e223f6f13f2d8b649c777d))

### Features

- **simple-button:** show drop area on files drag ([25fa023](https://github.com/uploadcare/blocks/commit/25fa023a997dca0c940bda55d3202cebf29db8b8))

## [0.12.4](https://github.com/uploadcare/blocks/compare/v0.12.3...v0.12.4) (2022-10-11)

### Bug Fixes

- **modal:** disable stroked backdrop by default ([970b590](https://github.com/uploadcare/blocks/commit/970b590a2b08e62713034d05082c81be9b699d11))

## [0.12.3](https://github.com/uploadcare/blocks/compare/v0.12.2...v0.12.3) (2022-10-10)

### Bug Fixes

- **register-blocks:** remove optional chaining usage ([935c8f3](https://github.com/uploadcare/blocks/commit/935c8f3e7d656d51b7b8fd0940c23d14c872491e))

## [0.12.2](https://github.com/uploadcare/blocks/compare/v0.12.1...v0.12.2) (2022-10-08)

### Bug Fixes

- **connect-blocks-from:** remove optional chaining usage ([f93ab07](https://github.com/uploadcare/blocks/commit/f93ab07cc376a1201735163bdfa100f6cba7203b))

## [0.12.1](https://github.com/uploadcare/blocks/compare/v0.12.0...v0.12.1) (2022-10-05)

### Bug Fixes

- **file-item:** cancel debounced thumb generation on element disconnect ([#294](https://github.com/uploadcare/blocks/issues/294)) ([7371335](https://github.com/uploadcare/blocks/commit/7371335b1df55a5b4fdd1ca3e4880986d7b159cf))

# [0.12.0](https://github.com/uploadcare/blocks/compare/v0.11.1...v0.12.0) (2022-10-03)

### Bug Fixes

- count blocks number in the registry and unobserve upload collection when there are no any registred blocks ([9134f9b](https://github.com/uploadcare/blocks/commit/9134f9b261f09d2090230bf7c082befe28af94e3))
- **file-uploader-minimal:** add missing translations ([#291](https://github.com/uploadcare/blocks/issues/291)) ([2ee8964](https://github.com/uploadcare/blocks/commit/2ee8964f62343d4460640e29cefa0ba74de24695))

### Features

- add export of `ShadowWrapper` ([6fedc7c](https://github.com/uploadcare/blocks/commit/6fedc7c6035d50171d06f1956a32de38b81becaa))

## [0.11.1](https://github.com/uploadcare/blocks/compare/v0.11.0...v0.11.1) (2022-09-28)

### Bug Fixes

- **file-item:** check file mime type before upload ([0ced1ef](https://github.com/uploadcare/blocks/commit/0ced1ef6b082b6bb3f2089f20dbe59de3db5f680))
- **file-item:** check for allowed mime types list length before match ([16cabec](https://github.com/uploadcare/blocks/commit/16cabec53d3cb5b8bde059b8ee739709118cd354))
- **file-item:** do not handle empty mime types ([3ce3e95](https://github.com/uploadcare/blocks/commit/3ce3e9575742936433eefb1cb7338544f7ae0d0e))
- **file-item:** skip `isImage` check for the external files before upload ([7f19457](https://github.com/uploadcare/blocks/commit/7f19457173e004e52882362cd3d75dd967f29fce))
- **uploader-block:** fix array destructuring mistake ([09d57f6](https://github.com/uploadcare/blocks/commit/09d57f664b6be4bb42a992486c26fbca248f9b0c))

# [0.11.0](https://github.com/uploadcare/blocks/compare/v0.10.3...v0.11.0) (2022-09-26)

### Bug Fixes

- **lr-image:** return data: and blob: sources as is ([e83518b](https://github.com/uploadcare/blocks/commit/e83518bfbbfd69bdf259ca0f5b8b3473cff5c7ae))
- **lr-image:** set provided custom `cdn-cname` when uuid attr passed ([ff04d93](https://github.com/uploadcare/blocks/commit/ff04d93ff8f4a9e71d8ee3fe8e54678e1316db73))
- svg image preview rendering in firefox ([1231951](https://github.com/uploadcare/blocks/commit/12319512296afc2576326094fad3a7a59b3cdcca))

### Features

- **lr-image:** don't proxify already uploaded images ([4d0dc0d](https://github.com/uploadcare/blocks/commit/4d0dc0da5d0a4e4a919911791f845913a23377d8))

## [0.10.3](https://github.com/uploadcare/blocks/compare/v0.10.2...v0.10.3) (2022-09-23)

### Bug Fixes

- **file-item:** uploading from external url (typo) ([#281](https://github.com/uploadcare/blocks/issues/281)) ([ed5c741](https://github.com/uploadcare/blocks/commit/ed5c741e0dc1f37fa6a58b073cd3df9e05a3168c))
- unobserve upload collection on destroy ([#282](https://github.com/uploadcare/blocks/issues/282)) ([2c871e1](https://github.com/uploadcare/blocks/commit/2c871e1a1f77d82731b48374cef2713be90f3d64))

## [0.10.2](https://github.com/uploadcare/blocks/compare/v0.10.1...v0.10.2) (2022-09-22)

### Bug Fixes

- **external-source:** disable `done` button when no files selected ([#278](https://github.com/uploadcare/blocks/issues/278)) ([7ae584f](https://github.com/uploadcare/blocks/commit/7ae584fc5dc1cab7e9718ea0ae2f4340b331a2dd))

## [0.10.1](https://github.com/uploadcare/blocks/compare/v0.10.0...v0.10.1) (2022-09-20)

### Bug Fixes

- **file-item:** prevent flickering ([d04ec9d](https://github.com/uploadcare/blocks/commit/d04ec9d8ddf893410025adb49c262c24399d7fa3))
- **file-item:** regenerate thumb on image edit ([15e567d](https://github.com/uploadcare/blocks/commit/15e567dddd5af05ffc7b3d76f02db25d31067516))
- rework history ([f7e39f9](https://github.com/uploadcare/blocks/commit/f7e39f9234f384f40f50cb211268f319d3a5b3d5))
- **upload-list:** do not close modal automatically if `--cfg-confirm-upload` enabled ([68f3e93](https://github.com/uploadcare/blocks/commit/68f3e931ffd37a37b2622653fb3a65ee78530a48))

# [0.10.0](https://github.com/uploadcare/blocks/compare/v0.9.4...v0.10.0) (2022-09-19)

### Bug Fixes

- **file-item:** calculate state in the single place ([8eb5f6e](https://github.com/uploadcare/blocks/commit/8eb5f6e1b53b4c1e03d39a7c8bda792110a11dc6))
- **file-item:** proper request abort, restore state on new entry, optimize thumb generation ([60038f2](https://github.com/uploadcare/blocks/commit/60038f2afabe37723f263cda506ffc846b13118f))
- **upload-list:** enable `Upload` button if any file isn't started uploading ([9b980c4](https://github.com/uploadcare/blocks/commit/9b980c4600b7dbedf73a31c6f4294a63cea216ee))
- **uploader-block:** do not history back if no any files in the collection ([34bbb7e](https://github.com/uploadcare/blocks/commit/34bbb7eac0e3ccfd1ec20bb768fc0649897e733c))

### Features

- **typed-collection:** check type with instanceof ([409feec](https://github.com/uploadcare/blocks/commit/409feec27c775ae235270cb47fec0d735712da4f))
- **typed-collection:** notify subscribers about added and removed items ([624c282](https://github.com/uploadcare/blocks/commit/624c282839ecf7c621e01aafd2107f9f10d3cbf4))

## [0.9.4](https://github.com/uploadcare/blocks/compare/v0.9.3...v0.9.4) (2022-09-13)

### Bug Fixes

- do not use `structuredClone` due to unsupport in safari <= 15.3 ([#257](https://github.com/uploadcare/blocks/issues/257)) ([8708b08](https://github.com/uploadcare/blocks/commit/8708b08483b220e69d8a58be3b9ebad68664fc75))
- **message-box:** specify text-align for message ([#254](https://github.com/uploadcare/blocks/issues/254)) ([2561eb6](https://github.com/uploadcare/blocks/commit/2561eb6b2441082826082ac7353892dd1b81130d))

## [0.9.3](https://github.com/uploadcare/blocks/compare/v0.9.2...v0.9.3) (2022-09-09)

### Bug Fixes

- abort uploading on item remove ([c53d730](https://github.com/uploadcare/blocks/commit/c53d73008297c6645d997fa869ecf8ac85317495))
- **core:** deep clone shared initial state before use it ([f48e7f3](https://github.com/uploadcare/blocks/commit/f48e7f3e61722eb5b4d3206565d7d8c9e49971a0))
- **file-uploader-minimal:** add missing icons ([91f08b4](https://github.com/uploadcare/blocks/commit/91f08b40a79717a490a961c46a8e145fc6526c97))
- **file-uploader-minimal:** do not show empty list ([15c1fb4](https://github.com/uploadcare/blocks/commit/15c1fb4c9396725519100b3a4fb23feb4f034c1a))
- **upload-list:** do not call upload done callback on empty list ([522a8cb](https://github.com/uploadcare/blocks/commit/522a8cb682f30a7a095872cb7cb490a69a49aef7))
- **upload-list:** wrong scrollable content height on safari 15.3 ([#248](https://github.com/uploadcare/blocks/issues/248)) ([60573d8](https://github.com/uploadcare/blocks/commit/60573d8e6c452e7cb295c0b4cf019c181fe42eb5))

## [0.9.2](https://github.com/uploadcare/blocks/compare/v0.9.1...v0.9.2) (2022-09-02)

## [0.9.1](https://github.com/uploadcare/uc-blocks/compare/v0.9.0...v0.9.1) (2022-08-31)

### Bug Fixes

- DropArea > prevent activity change on empty list ([f65806e](https://github.com/uploadcare/uc-blocks/commit/f65806ed40ce25ec200ee0dfc85bf9ce709b6c9b))

# [0.9.0](https://github.com/uploadcare/uc-blocks/compare/v0.8.1...v0.9.0) (2022-08-31)

### Bug Fixes

- gitignore exception fro types ([98acdeb](https://github.com/uploadcare/uc-blocks/commit/98acdeb7777277e910c27c947e7b016f26d795b4))
- types ([8fdcd59](https://github.com/uploadcare/uc-blocks/commit/8fdcd591b4a103f53d8cf04f802693545b178e67))

## [0.8.1](https://github.com/uploadcare/uc-blocks/compare/v0.8.0...v0.8.1) (2022-08-26)

### Bug Fixes

- **cloud-image-editor:** errors while edit image multiple times ([#232](https://github.com/uploadcare/uc-blocks/issues/232)) ([743220d](https://github.com/uploadcare/uc-blocks/commit/743220d08ec5da0687a6c85438d615cf0ab5a7ee))
- ctx-owner rendering issue (React) ([0365765](https://github.com/uploadcare/uc-blocks/commit/0365765caf861f02112149ef30c338c274bae248))

# [0.8.0](https://github.com/uploadcare/uc-blocks/compare/v0.7.2...v0.8.0) (2022-08-23)

### Bug Fixes

- #BLOCKS-130 ([165d9d2](https://github.com/uploadcare/uc-blocks/commit/165d9d28dbc04c199962d0eec30dd4233fe838e7)), closes [#BLOCKS-130](https://github.com/uploadcare/uc-blocks/issues/BLOCKS-130)
- data output call bound to upload state and uploaded items removal + lr-img fix ([863fe99](https://github.com/uploadcare/uc-blocks/commit/863fe9956a605e3f5d88e674802e76160293f759))
- double slash bug with --cfg-cdn-cname trailing slash ([6a121c9](https://github.com/uploadcare/uc-blocks/commit/6a121c9101b7d0bcc30c5d70c5b05cadeda3061a))
- merge issues ([ba48502](https://github.com/uploadcare/uc-blocks/commit/ba48502a9d44a7ed32ba79b47abc6632ca38d07e))
- modal layout in Safari ([52bbc4a](https://github.com/uploadcare/uc-blocks/commit/52bbc4aa8b5b1ff8d63b4ecbcc9237112a0adb1e))
- TS error ([f0babf1](https://github.com/uploadcare/uc-blocks/commit/f0babf16e99556e58b1cd647b189b87c4fa64dcb))

### Features

- add clickable attribute to DropArea ([d486788](https://github.com/uploadcare/uc-blocks/commit/d48678897b589893ddd4d706e85f2afbd38ee2b6))
- connectBlocksFrom added ([4c80a97](https://github.com/uploadcare/uc-blocks/commit/4c80a978dcc21db34b19077d63d7d3f14f45cdd9))
- custom base upload URL support ([6d03fd1](https://github.com/uploadcare/uc-blocks/commit/6d03fd1624263cc61e3de73277d6ee9bc009637e))
- drag-n-drop page img ([0ec0e69](https://github.com/uploadcare/uc-blocks/commit/0ec0e69a14d4682b0cc72d001affc5f6873c1c78))
- lr-drop-area is-image validation support ([3bc8ae5](https://github.com/uploadcare/uc-blocks/commit/3bc8ae5343ba90e5ee585ce194e7a4a296f8d68f))
- workflow evens ([7709a1d](https://github.com/uploadcare/uc-blocks/commit/7709a1df16892b9194b0d2386fe195d4586e0cab))

## [0.7.2](https://github.com/uploadcare/uc-blocks/compare/v0.7.1...v0.7.2) (2022-08-11)

## [0.7.1](https://github.com/uploadcare/uc-blocks/compare/v0.7.0...v0.7.1) (2022-08-04)

### Bug Fixes

- **file-uploader-minimal:** ensure current activity is always present ([33ee804](https://github.com/uploadcare/uc-blocks/commit/33ee80486b689d414bc8c08bf30c0aa09f33d27b))

# [0.7.0](https://github.com/uploadcare/uc-blocks/compare/v0.6.0...v0.7.0) (2022-08-04)

### Bug Fixes

- **cloud-editor:** create own context ([db97b19](https://github.com/uploadcare/uc-blocks/commit/db97b1981bfb08bcbb5851c9fac068d79edcf41d))
- **data-output:** do not set value property ([88c5deb](https://github.com/uploadcare/uc-blocks/commit/88c5debccc5f23915baf4446e3322b9c50a20711))
- **file-item:** call IntersectionObserver.unobserve in the right places ([3216ad7](https://github.com/uploadcare/uc-blocks/commit/3216ad767a2198a00ea9cdbb5f308b3b5c6c4275))
- move TypedCollection and TypedData from symbiote to our repo ([#211](https://github.com/uploadcare/uc-blocks/issues/211)) ([eb99ce7](https://github.com/uploadcare/uc-blocks/commit/eb99ce7186d9e2f4e53921bcd1fc0c07eb5a447a))
- specify side-effects for .css files ([#210](https://github.com/uploadcare/uc-blocks/issues/210)) ([30d7e51](https://github.com/uploadcare/uc-blocks/commit/30d7e51de5c91ffcc5f68d4326c2b9f99910f19f))
- use zero specific css selectors for common classes to allow user to override styles ([#209](https://github.com/uploadcare/uc-blocks/issues/209)) ([959931b](https://github.com/uploadcare/uc-blocks/commit/959931bf7cd15c3a15d992d0a8e6c9c24d33aa5f))
- volume range behavior ([aede13b](https://github.com/uploadcare/uc-blocks/commit/aede13b1fbacbcb25ce1b5dd75a17f9d7540cce6))

### Features

- add `--cfg-user-agent-integration` option ([75eebf0](https://github.com/uploadcare/uc-blocks/commit/75eebf018faec79d2a5c7d94f059136456de1c4f))
- lr-video stage 1 ([626d5b6](https://github.com/uploadcare/uc-blocks/commit/626d5b66e1c685ee69247666fdb49289d827d939))

# [0.6.0](https://github.com/uploadcare/uc-blocks/compare/v0.5.2...v0.6.0) (2022-07-14)

### Bug Fixes

- blocks test refs ([3f72272](https://github.com/uploadcare/uc-blocks/commit/3f7227263a7e94743478bcd2d00d3650cb6bcc2c))
- irRef in CameraSource ref ([881fbb8](https://github.com/uploadcare/uc-blocks/commit/881fbb8110adb74111a5855ecade731ebcda12be))

### Features

- **img:** proxify image load and error events ([#202](https://github.com/uploadcare/uc-blocks/issues/202)) ([7350c97](https://github.com/uploadcare/uc-blocks/commit/7350c9775b3cd04f6e3689360955a3eb0be8d837))

## [0.5.2](https://github.com/uploadcare/uc-blocks/compare/v0.5.1...v0.5.2) (2022-07-07)

### Bug Fixes

- camera label ([287700f](https://github.com/uploadcare/uc-blocks/commit/287700f26ddb6fe98e55f8edbf1423d0e1e364e4))
- empty camera labels return on some platforms ([d66b471](https://github.com/uploadcare/uc-blocks/commit/d66b471feb6be7f1dcc67d687cabfe2ce758becc))

## [0.5.1](https://github.com/uploadcare/uc-blocks/compare/v0.5.0...v0.5.1) (2022-07-06)

### Bug Fixes

- camera-source with symbiote updated ([5d136e4](https://github.com/uploadcare/uc-blocks/commit/5d136e481258edc4bca270d03b33422195a55dda))

# [0.5.0](https://github.com/uploadcare/uc-blocks/compare/v0.4.1...v0.5.0) (2022-07-06)

### Bug Fixes

- TS fix ([ed631f8](https://github.com/uploadcare/uc-blocks/commit/ed631f8980ef184d38819b56de23169f81fd0f48))

### Features

- camera selector ([18dbd99](https://github.com/uploadcare/uc-blocks/commit/18dbd993460923f2802993079d040179dc52d48e))
- lr-select + camera selector WIP ([aad6e9b](https://github.com/uploadcare/uc-blocks/commit/aad6e9bcd059493bf75b9f3bf5c94a7b30af9499))

## [0.4.1](https://github.com/uploadcare/uc-blocks/compare/v0.4.0...v0.4.1) (2022-06-29)

### Bug Fixes

- add missing FileUploaderInline export ([1fa0888](https://github.com/uploadcare/uc-blocks/commit/1fa088891eb6b102558b8891552cfbb4f467c1a1))
- bump upload-client version ([5b1df67](https://github.com/uploadcare/uc-blocks/commit/5b1df679920bee22814539a2faf1d3f0706ac358))
- **cloud-editor:** do not initialize --cfg-cdn-cname with empty string ([07a770b](https://github.com/uploadcare/uc-blocks/commit/07a770b3622b9e05e9963f71774bbc3510f1312b))

# [0.4.0](https://github.com/uploadcare/uc-blocks/compare/v0.3.0...v0.4.0) (2022-06-22)

### Bug Fixes

- camera settings not depends to activity ([7cd54c0](https://github.com/uploadcare/uc-blocks/commit/7cd54c061f9348b43153bb917ae8f2ebec116b34))
- symbiote path ([1e06783](https://github.com/uploadcare/uc-blocks/commit/1e06783f1ae0d99e64d3f1489e015992da03cfe6))
- ts error ([55aae04](https://github.com/uploadcare/uc-blocks/commit/55aae04393456549199cef1074a17f53a8346048))
- ts error ([46fbfcf](https://github.com/uploadcare/uc-blocks/commit/46fbfcf61ac724b9311a05bfbdcbfdca756398c6))
- ts errors in node_modules =( ([a0ce5b5](https://github.com/uploadcare/uc-blocks/commit/a0ce5b5b67d45ddbcc26a7791e3e797db9c77848))

### Features

- add `setUploadMetadata` public api method ([#172](https://github.com/uploadcare/uc-blocks/issues/172)) ([d3b7301](https://github.com/uploadcare/uc-blocks/commit/d3b73011290ed274a6cc5a7945abc0e1d78891ca))
- static docs generation ([d8cf4e1](https://github.com/uploadcare/uc-blocks/commit/d8cf4e150dd6bc13c1111f54e935b3a1b7ad43e5))
- test:light ([29106de](https://github.com/uploadcare/uc-blocks/commit/29106de13aad3b2fcf7151d10153b673115af64d))

# [0.3.0](https://github.com/uploadcare/uc-blocks/compare/v0.2.0...v0.3.0) (2022-06-15)

### Bug Fixes

- add `type=button` to all the buttons to prevent form submit ([e681ca5](https://github.com/uploadcare/uc-blocks/commit/e681ca5e244e4a484cedca5941974ad16696f5e2))
- **FileItem:** error icon ([094eb7b](https://github.com/uploadcare/uc-blocks/commit/094eb7bb8a8a1bb9f8ff2c7a6cb5be6f628c0b92))
- TS fix ([72f6a91](https://github.com/uploadcare/uc-blocks/commit/72f6a915e820446f3affd137d428712c2a47fcfb))
- **upload-details:** handle not-uploaded images and clear canvase before preview render ([d522818](https://github.com/uploadcare/uc-blocks/commit/d522818133bd175b7c3767635923d8cc2cf87fbe))
- **upload-details:** render preview image with `format/auto` and `preview` operations ([7c30d29](https://github.com/uploadcare/uc-blocks/commit/7c30d290fa08fc62826109a880ea916ebd5e6500))
- **upload-details:** show/hide `cloud edit` button properly ([b2efe40](https://github.com/uploadcare/uc-blocks/commit/b2efe4044c9f90351146bc6040237901204d873f))

### Features

- add `--cfg-cdn-cname` option ([#154](https://github.com/uploadcare/uc-blocks/pull/154))
- add `--cfg-preview-proxy` option state ([#157](https://github.com/uploadcare/uc-blocks/pull/157))
- add `--cfg-secure-expire` and `--cfg-secure-signature` ([#156](https://github.com/uploadcare/uc-blocks/pull/156))
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
