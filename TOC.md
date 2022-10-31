# Table of contents

- [blocks](/) — repository root

  - [solutions](/solutions/) — ready made solutions

    - [uploader](/solutions/file-uploader/) — uploader implementations for the most frequent cases

      - [regular](/solutions/file-uploader/regular/) — overall case
      - [inline](/solutions/file-uploader/inline/) — without modal
      - [minimal](/solutions/file-uploader/minimal/) — minimal and compact

    - [adaptive-image](/solutions/adaptive-image/) — efficient image rendering automation
    - [cloud-image-editor](/solutions/cloud-image-editor/) — rich UI for CDN transformations API

  - [blocks](/blocks/) — building blocks for the custom integrations

    - docs:

      - [Configuration](/docs/configuration/) — common settings
      - [Texts & localization](/docs/texts/) — custom texts and translations
      - [Icons](/docs/icons/) — custom icons
      - [Styling](/docs/styling/) — themes and styles for components
        <!-- - [Blocks](/docs/blocks/) — custom blocks and deeper workflow tuning -->
        <!-- - [Contexts](/docs/contexts/) — how to unite blocks into common workflows and share common data -->
      - [Events](/docs/events/) — events description
      - [Activities](/docs/activities/) — how to set and switch user focused activities
        <!-- - [BlockComponent](/docs/block-component/) — all about blocks base class -->
        <!-- - [TypeScript](/docs/typescript/) — using types in TypeScript and JavaScript projects -->

    - blocks:
      - [ActivityCaption](/blocks/ActivityCaption/) — shows heading text for the current activity
      - [ActivityIcon](/blocks/ActivityIcon/) — shows actual icon for the current activity
      - [CameraSource](/blocks/CameraSource/) — getting image for upload from the device camera
      - [CloudImageEditor](/blocks/CloudImageEditor/) — image editing via Uploadcare cloud functions
      - [Color](/blocks/Color/) — simple wrapper for the native color selector in browser
      - [ComfirmationDialog](/blocks/ConfirmationDialog/) — user confirmations for the most sensitive actions
      - [DataOutput](/blocks/DataOutput/) — dedicated element for the upload data extraction in host application
      - [DropArea](/blocks/DropArea/) — wrapper element for the the drag-n-drop feature adding
      - [EditableCanvas](/blocks/EditableCanvas/) — minimalistic in-browser image editing
      - [FilePreview](/blocks/FilePreview/) — show file preview
      - [ExternalSource](/blocks/ExternalSource/) — common wrapper for external file sources
      - [FileItem](/blocks/FileItem/) — basic UI for the each uploading file entry
      - [Icon](/blocks/Icon/) — displays an icon
      - [Img](/blocks/Img/) — adaptive image
      - [MessageBox](/blocks/MessageBox/) — common container for the application messages
      - [Modal](/blocks/Modal/) — common pop-up window
      - [ProgressBar](/blocks/ProgressBar/) — abstract progress bar
      - [ProgressBarCommon](/blocks/ProgressBarCommon/) — displays uploading progress for the all files selected
      - [Range](/blocks/Range/) — customizable wrapper for the range input element
      - [Select](/blocks/Select/) — customizable selector
      - [ShadowWrapper](/blocks/ShadowWrapper/) — Shadow DOM wrapper to encapsulate your solution
      - [SimpleBtn](/blocks/SimpleBtn/) — button for the file uploading workflow start
      - [SourceBtn](/blocks/SourceBtn/) — button for the certain source activation
      - [SourceList](/blocks/SourceList/) — renders the list of file sources basing on configuration provided
      - [StartFrom](/blocks/StartFrom/) — wrapper element for the uploading workflow initiation
      - [Tabs](/blocks/Tabs/) — implements tabbing UI
      - [UploadDetails](/blocks/UploadDetails/) — displays file details and adittional features
      - [UploadList](/blocks/UploadList/) — shows the list of uploads
      - [UrlSource](/blocks/UrlSource/) — file uploading from the external URL
      - [Video](/blocks/Video/) — wrapper element for the browser video tag

  - [abstract](/abstract/) — common code abstractions (abstract classes)

## External resources

- [Symbiote.js](https://github.com/symbiotejs/symbiote.js) — core library for the Web Components creation and data-flow management
- [Integration examples](https://github.com/uploadcare/blocks-examples) — for the most popular front-end libraries and frameworks
