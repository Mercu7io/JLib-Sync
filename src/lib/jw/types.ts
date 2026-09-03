/**
 * JW Sync v3 — Core Database & Manifest Interfaces
 * Matches schemaVersion 14-16+ of JW Library's userData.db
 */

export interface ILocation {
  LocationId: number;
  BookNumber: number | null;
  ChapterNumber: number | null;
  DocumentId: number | null;
  Track: number | null;
  IssueTagNumber: number;
  KeySymbol: string | null;
  MepsLanguage: number | null;
  Type: number;
  Title: string | null;
  Specialty?: string | null;
  Edition?: string | null;
}

export interface INote {
  NoteId: number;
  Guid: string;
  UserMarkId: number | null;
  LocationId: number | null;
  Title: string | null;
  Content: string | null;
  LastModified: string;
  Created: string;
  BlockType: number;
  BlockIdentifier: number | null;
}

export interface IUserMark {
  UserMarkId: number;
  ColorIndex: number;
  LocationId: number;
  StyleIndex: number;
  UserMarkGuid: string;
  Version: number;
}

export interface IBlockRange {
  BlockRangeId: number;
  BlockType: number;
  Identifier: number;
  StartToken: number;
  EndToken: number;
  UserMarkId: number;
}

export interface IBookmark {
  BookmarkId: number;
  LocationId: number;
  PublicationLocationId: number;
  Slot: number;
  Title: string;
  Snippet: string | null;
  BlockType: number;
  BlockIdentifier: number | null;
}

export interface ITag {
  TagId: number;
  Type: number;
  Name: string;
}

export interface ITagMap {
  TagMapId: number;
  PlaylistItemId: number | null;
  LocationId: number | null;
  NoteId: number | null;
  TagId: number;
  Position: number;
}

export interface IInputField {
  LocationId: number;
  TextTag: string;
  Value: string;
}

export interface IUserDataBackup {
  hash: string;
  lastModifiedDate: string;
  databaseName: string;
  deviceName: string;
  schemaVersion?: number;
}

export interface IManifest {
  name: string;
  creationDate: string;
  userDataBackupVersion: number;
  deviceName: string;
  type: number;
  version: number;
  userDataBackup: IUserDataBackup;
}

export interface ILibrarySummary {
  name: string;
  deviceName: string;
  lastModifiedDate: string;
  creationDate: string;
  notesCount: number;
  userMarksCount: number;
  tagsCount: number;
  bookmarksCount: number;
  inputFieldsCount: number;
  playlistsCount: number;
  fileSizeBytes: number;
}

export interface ITagActionRule {
  action: 'keep' | 'merge' | 'rename';
  targetName?: string;
  customName?: string;
}

export type TagManagerMap = Record<string, ITagActionRule>;

export interface IMergeOptions {
  primaryName?: string;
  deviceName?: string;
  doctorCheck?: boolean;
  colorRules?: Record<number, number>; // Map old ColorIndex -> new ColorIndex
  conflictResolutions?: Record<string, 'both' | 'a' | 'b'>;
}

export interface IMergeProgress {
  current: number;
  total: number;
  stage: string;
  details?: string;
}

export interface IHealthCheckResult {
  key: string;
  label: string;
  count: number;
  description: string;
  canFix: boolean;
  affectedIds: number[];
}
