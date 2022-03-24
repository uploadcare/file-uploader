export type GeoLocation = {
  latitude: number
  longitude: number
}

export type ImageInfo = {
  height: number
  width: number
  geoLocation: GeoLocation | null
  datetimeOriginal: string
  format: string
  colorMode: string
  dpi: {
    '0': number
    '1': number
  } | null
  orientation: number | null
  sequence: boolean | null
}

export type AudioInfo = {
  bitrate: number | null
  codec: string | null
  sampleRate: number | null
  channels: string | null
}

export type VideoInfo = {
  duration: number
  format: string
  bitrate: number
  audio: AudioInfo | null
  video: {
    height: number
    width: number
    frameRate: number
    bitrate: number
    codec: string
  }
}

export type FileInfo = {
  size: number
  done: number
  total: number

  uuid: Uuid
  fileId: Uuid
  originalFilename: string
  filename: string
  mimeType: string
  isImage: boolean
  isStored: boolean
  isReady: string
  imageInfo: ImageInfo | null
  videoInfo: VideoInfo | null
  s3Bucket: string | null
}

export type GroupInfo = {
  datetimeCreated: string
  datetimeStored: string | null
  filesCount: string
  cdnUrl: string
  files: FileInfo[]
  url: string
  id: GroupId
}

export type Token = string

export type Uuid = string

export type GroupId = string

export type Url = string

export type ComputableProgressInfo = {
  isComputable: true
  value: number
}

export type UnknownProgressInfo = {
  isComputable: false
}

export type ProgressCallback<
  T = ComputableProgressInfo | UnknownProgressInfo
> = (arg: T) => void
