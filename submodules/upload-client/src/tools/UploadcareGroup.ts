import { GroupId, GroupInfo } from '../api/types'
import { UploadcareFile } from './UploadcareFile'

export class UploadcareGroup {
  readonly uuid: GroupId
  readonly filesCount: string
  readonly totalSize: number
  readonly isStored: boolean
  readonly isImage: boolean
  readonly cdnUrl: string
  readonly files: UploadcareFile[]
  readonly createdAt: string
  readonly storedAt: string | null = null

  constructor(groupInfo: GroupInfo, files: UploadcareFile[]) {
    this.uuid = groupInfo.id
    this.filesCount = groupInfo.filesCount
    this.totalSize = Object.values(groupInfo.files).reduce(
      (acc, file) => acc + file.size,
      0
    )
    this.isStored = !!groupInfo.datetimeStored
    this.isImage = !!Object.values(groupInfo.files).filter(
      (file) => file.isImage
    ).length
    this.cdnUrl = groupInfo.cdnUrl
    this.files = files
    this.createdAt = groupInfo.datetimeCreated
    this.storedAt = groupInfo.datetimeStored
  }
}
