# Table of contents

- [JSDK](./) - repository root

  - [uploader](./uploader/) - uploader implementations for the most frequent cases
    - [regular](./uploader/regular/) - overall case
    - [inline](./uploader/inline/) - without modal
    - [simplified](./uploader/simplified/) - minimal and compact

  - [upload-blocks](./upload-blocks/) - building blocks for the custom uploading solutions

    - docs
      - [Configuration](./upload-blocks/docs/configuration/) - common settings
      - [Texts & localization](./upload-blocks/docs/texts/) - custom texts and translations
      - [Icons](./upload-blocks/docs/icons/) - custom icons
      - [Styling](./upload-blocks/docs/styling/) - themes and styles for components
      - [Blocks](./upload-blocks/docs/blocks/) - custom blocks and deeper workflow tuning
      - [Contexts](./upload-blocks/docs/contexts/) - how to unite blocks into common workflows and share common data
      - [Activities](./upload-blocks/docs/activities/) - how to set and switch user focused activities
      - [BlockComponent](./upload-blocks/docs/block-component/) - all about blocks base class
      - [TypeScript](./upload-blocks/docs/typescript/) - using types in TypeScript and JavaScript projects

    - Library components
      - [ActivityCaption](./upload-blocks/ActivityCaption/) - shows heading text for the current activity
      - [ActivityIcon](./upload-blocks/ActivityIcon/) - shows actual icon for the current activity
      - [CameraSource](./upload-blocks/CameraSource/) - getting image for upload from the device camera
      - [CloudImageEditor](./upload-blocks/CloudImageEditor/) - image editing via Uploadcare cloud functions
      - [Color](./upload-blocks/Color/) - simple wrapper for the native color selector in browser
      - [ComfirmationDialog](./upload-blocks/ConfirmationDialog/) - user confirmations for the most sensitive actions
      - [DataOutput](./upload-blocks/DataOutput/) - dedicated element for the upload data extraction in host application
      - [DropArea](./upload-blocks/DropArea/) - wrapper element for the the drag-n-drop feature adding
      - [EditableCanvas](./upload-blocks/EditableCanvas/) - minimalistic in-browser image editing
      - [ExternalSource](./upload-blocks/ExternalSource/) - common wrapper for external file sources
      - [FileItem](./upload-blocks/FileItem/) - basic UI for the each uploading file entry
      - [Icon](./upload-blocks/Icon/) - displays an icon
      - [MessageBox](./upload-blocks/MessageBox/) - common container for the application messages
      - [Modal](./upload-blocks/Modal/) - common pop-up window
      - [ProgressBarCommon](./upload-blocks/ProgressBarCommon/) - displays uploading progress for the all files selected
      - [Range](./upload-blocks/Range/) - customizable wrapper for the range input element
      - [SimpleBtn](./upload-blocks/SimpleBtn/) - button for the file uploading workflow start
      - [SourceBtn](./upload-blocks/SourceBtn/) - button for the certain source activation
      - [SourceList](./upload-blocks/SourceList/) - renders the list of file sources basing on configuration provided
      - [StartFrom](./upload-blocks/StartFrom/) - wrapper element for the uploading workflow initiation
      - [Tabs](./upload-blocks/Tabs/) - implements tabbing UI
      - [UploadDetails](./upload-blocks/UploadDetails/) - displays file details and adittional features
      - [UploadList](./upload-blocks/UploadList/) - shows the list of uploads
      - [UrlSource](./upload-blocks/UrlSource/) - file uploading from the external URL
  - [cloud-image-editor]() - Image editing component based on Uploadcare image manipulations API
  - [live-html]() - "HTML as low-code platform" code editing tool

## External resources

* [Symbiote.js](https://github.com/symbiotejs/symbiote.js) - core library for the Web Components creation and data-flow management
* [Integration examples](https://github.com/uploadcare/upload-blocks-examples) - for the most popular front-end libraries and frameworks