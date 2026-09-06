/**
 * Panda JL Studio — Google Drive Cloud Sync Manager
 * Uses Google Identity Services with restricted 'drive.file' scope
 * (only touches files and folders created by Panda JL Studio, never personal Drive files).
 */

export interface IDriveFile {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  sha256?: string;
  deviceId?: string;
  deviceName?: string;
  appProperties?: Record<string, string>;
  isValidated?: boolean;
  notesCount?: number;
  tagsCount?: number;
  playlistsCount?: number;
  bookmarksCount?: number;
}

export interface IJlibArchiveBackup {
  fileId: string;
  fileName: string;
  sha256: string;
  size?: number;
  deviceId?: string;
  deviceName?: string;
  uploadedAt: string;
  notesCount?: number;
  tagsCount?: number;
  playlistsCount?: number;
  bookmarksCount?: number;
}

export type IJwSyncIndexBackup = IJlibArchiveBackup;

export interface IJlibArchiveIndex {
  version: number;
  lastUpdated: string;
  backups: IJlibArchiveBackup[];
}

export type IJwSyncIndex = IJlibArchiveIndex;

export function getLocalDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'device_unknown';
  let id = localStorage.getItem('jlib_device_id') || localStorage.getItem('jwsync_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('jlib_device_id', id);
  }
  return id;
}

export function getLocalDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Web Browser';
}

declare global {
  interface Window {
    google?: any;
    __ENV__?: {
      GOOGLE_CLIENT_ID?: string;
      VITE_GOOGLE_CLIENT_ID?: string;
    };
  }
}

// Retrieve Client ID from runtime Docker env, or fallback to build-time Vite env
export const getGoogleClientId = (): string => {
  if (typeof window !== 'undefined' && window.__ENV__) {
    if (window.__ENV__.GOOGLE_CLIENT_ID) return window.__ENV__.GOOGLE_CLIENT_ID;
    if (window.__ENV__.VITE_GOOGLE_CLIENT_ID) return window.__ENV__.VITE_GOOGLE_CLIENT_ID;
  }
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
};

export class GoogleDriveManager {
  private get clientId(): string {
    return getGoogleClientId();
  }
  private accessToken: string | null = null;
  private folderId: string | null = null;
  private folderName = 'Panda JL Studio';
  private jlibLegacyFolderName = 'Panda JLib Studio';
  private legacyFolderName = 'JW Sync';
  private indexFileName = '.jlib_archive_index.json';
  private legacyIndexFileName = '.jwsync_index.json';
  private tokenClient: any = null;
  private baseUrl = 'https://www.googleapis.com/drive/v3';
  private scope = 'https://www.googleapis.com/auth/drive.file';

  async loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }
      const existing = document.getElementById('google-gsi-script');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity SDK.'));
      document.head.appendChild(script);
    });
  }

  private authSuccessCallback?: (token: string) => void;
  private sessionExpiredCallback?: () => void;
  private isInitializing = false;
  private isInitialized = false;

  private saveToken(token: string, expiresInSec = 3599): void {
    this.accessToken = token;
    // Set expiry with a 2-minute safety buffer
    const expiresAt = Date.now() + Math.max(0, expiresInSec - 120) * 1000;
    try {
      localStorage.setItem('jlib_drive_token', token);
      localStorage.setItem('jlib_drive_token_expires_at', expiresAt.toString());
      localStorage.setItem('jlib_drive_connected', 'true');
    } catch (_) {}
  }

  private clearStoredToken(): void {
    this.accessToken = null;
    this.folderId = null;
    try {
      localStorage.removeItem('jlib_drive_token');
      localStorage.removeItem('jlib_drive_token_expires_at');
      localStorage.removeItem('jlib_drive_connected');
      localStorage.removeItem('jwsync_drive_token');
      localStorage.removeItem('jwsync_drive_token_expires_at');
      localStorage.removeItem('jwsync_drive_connected');
    } catch (_) {}
  }

  handleSessionExpired(): void {
    this.accessToken = null;
    this.folderId = null;
    try {
      localStorage.removeItem('jlib_drive_token');
      localStorage.removeItem('jlib_drive_token_expires_at');
      localStorage.removeItem('jwsync_drive_token');
      localStorage.removeItem('jwsync_drive_token_expires_at');
      // Intentionally keep 'jlib_drive_connected' = 'true' so the UI displays the reconnect prompt
    } catch (_) {}
    this.sessionExpiredCallback?.();
  }

  wasPreviouslyConnected(): boolean {
    try {
      return (
        localStorage.getItem('jlib_drive_connected') === 'true' ||
        localStorage.getItem('jwsync_drive_connected') === 'true'
      );
    } catch (_) {
      return false;
    }
  }

  isSessionExpired(): boolean {
    if (this.isConnected()) return false;
    if (!this.wasPreviouslyConnected()) return false;
    return this.getStoredToken() === null;
  }

  getStoredToken(): string | null {
    try {
      const token =
        localStorage.getItem('jlib_drive_token') ||
        localStorage.getItem('jwsync_drive_token');
      const expiresAtStr =
        localStorage.getItem('jlib_drive_token_expires_at') ||
        localStorage.getItem('jwsync_drive_token_expires_at');
      if (token && expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (Date.now() < expiresAt) {
          return token;
        }
      }
    } catch (_) {}
    return null;
  }

  hasTokenClient(): boolean {
    return !!this.tokenClient;
  }

  isConfigured(): boolean {
    return !!this.clientId;
  }

  async init(onAuthSuccess?: (token: string) => void, onSessionExpired?: () => void): Promise<void> {
    if (onAuthSuccess) {
      this.authSuccessCallback = onAuthSuccess;
    }
    if (onSessionExpired) {
      this.sessionExpiredCallback = onSessionExpired;
    }
    if (this.isInitialized) {
      const savedToken = this.getStoredToken();
      if (savedToken) {
        this.accessToken = savedToken;
        this.authSuccessCallback?.(savedToken);
      } else if (this.wasPreviouslyConnected()) {
        this.sessionExpiredCallback?.();
      }
      return;
    }
    if (this.isInitializing) {
      return;
    }
    if (!this.clientId) {
      return;
    }
    this.isInitializing = true;
    try {
      await this.loadGoogleScript();

      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google Identity Services not ready.');
      }

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.scope,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            if (tokenResponse.type === 'no_session' || tokenResponse.error === 'user_logged_out' || tokenResponse.error === 'access_denied') {
              this.handleSessionExpired();
              return;
            }
            throw tokenResponse;
          }
          const expiresIn = Number(tokenResponse.expires_in) || 3599;
          this.saveToken(tokenResponse.access_token, expiresIn);
          this.authSuccessCallback?.(this.accessToken!);
        },
      });

      this.isInitialized = true;

      // Check if we have an active, non-expired token in localStorage
      const savedToken = this.getStoredToken();
      if (savedToken) {
        this.accessToken = savedToken;
        this.authSuccessCallback?.(savedToken);
      } else if (this.wasPreviouslyConnected()) {
        // Token is expired, but user was previously connected.
        // DO NOT open any automatic popup! Just notify state.
        this.handleSessionExpired();
      }
    } finally {
      this.isInitializing = false;
    }
  }

  async login(onAuthSuccess?: (token: string) => void): Promise<void> {
    if (onAuthSuccess) {
      this.authSuccessCallback = onAuthSuccess;
    }
    if (!this.clientId) {
      throw new Error('Google Client ID is missing. Please configure VITE_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID in your .env file or Docker environment.');
    }
    if (!this.tokenClient) {
      await this.init(this.authSuccessCallback, this.sessionExpiredCallback);
    }
    if (!this.tokenClient) {
      throw new Error('Google Drive client is not initialized. Please ensure Google services are accessible.');
    }
    // Explicit user gesture: request access token with prompt: '' (select account/confirm without re-consent if already granted)
    this.tokenClient.requestAccessToken({ prompt: '' });
  }

  logout(): void {
    const token = this.accessToken;
    this.clearStoredToken();
    if (token && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {});
      } catch (_) {}
    }
  }

  isConnected(): boolean {
    return !!this.accessToken;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Google Drive: Not authenticated.');
    }
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) {
        this.handleSessionExpired();
        throw new Error('Session expired. Please reconnect to Google Drive.');
      }
      throw new Error(`Google Drive API error (${response.status}): ${response.statusText}`);
    }
    return response.status === 204 ? null : await response.json();
  }

  async findSyncFolder(): Promise<string | null> {
    // 1. Search for primary folder: 'Panda JL Studio'
    const query = encodeURIComponent(
      `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const data = await this.request(`/files?q=${query}&fields=files(id,name)`);
    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
      return this.folderId;
    }
    // 2. Backward compatibility: check if user previously had 'Panda JLib Studio'
    const jlibLegacyQuery = encodeURIComponent(
      `name='${this.jlibLegacyFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const jlibLegacyData = await this.request(`/files?q=${jlibLegacyQuery}&fields=files(id,name)`);
    if (jlibLegacyData.files && jlibLegacyData.files.length > 0) {
      this.folderId = jlibLegacyData.files[0].id;
      return this.folderId;
    }
    // 3. Backward compatibility: check if user previously had backups in legacy folder
    const legacyQuery = encodeURIComponent(
      `name='${this.legacyFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const legacyData = await this.request(`/files?q=${legacyQuery}&fields=files(id,name)`);
    if (legacyData.files && legacyData.files.length > 0) {
      this.folderId = legacyData.files[0].id;
      return this.folderId;
    }
    return null;
  }

  async createSyncFolder(): Promise<string> {
    const metadata = {
      name: this.folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    const data = await this.request('/files', {
      method: 'POST',
      body: JSON.stringify(metadata),
    });
    this.folderId = data.id;
    return this.folderId!;
  }

  async ensureSyncFolder(): Promise<string> {
    let id = await this.findSyncFolder();
    if (!id) id = await this.createSyncFolder();
    return id;
  }

  async findIndexFile(): Promise<string | null> {
    if (!this.folderId) await this.ensureSyncFolder();
    // 1. Primary index: .jlib_archive_index.json
    const query = encodeURIComponent(
      `name='${this.indexFileName}' and '${this.folderId}' in parents and trashed=false`
    );
    const data = await this.request(`/files?q=${query}&fields=files(id,name)`);
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    // 2. Backward compatibility: check legacy index file
    const legacyQuery = encodeURIComponent(
      `name='${this.legacyIndexFileName}' and '${this.folderId}' in parents and trashed=false`
    );
    const legacyData = await this.request(`/files?q=${legacyQuery}&fields=files(id,name)`);
    if (legacyData.files && legacyData.files.length > 0) {
      return legacyData.files[0].id;
    }
    return null;
  }

  async fetchIndex(): Promise<IJwSyncIndex | null> {
    try {
      const fileId = await this.findIndexFile();
      if (!fileId) return null;
      const buffer = await this.downloadBackup(fileId);
      const text = new TextDecoder().decode(buffer);
      return JSON.parse(text) as IJwSyncIndex;
    } catch (_) {
      return null;
    }
  }

  async saveIndex(index: IJwSyncIndex): Promise<void> {
    if (!this.folderId) await this.ensureSyncFolder();
    index.lastUpdated = new Date().toISOString();
    const content = JSON.stringify(index, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    const fileId = await this.findIndexFile();
    if (fileId) {
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: blob,
      });
    } else {
      const metadata = { name: this.indexFileName, parents: [this.folderId] };
      const fileInfo = await this.request('/files', {
        method: 'POST',
        body: JSON.stringify(metadata),
      });
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileInfo.id}?uploadType=media`;
      await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: blob,
      });
    }
  }

  async listBackups(): Promise<IDriveFile[]> {
    if (!this.folderId) await this.ensureSyncFolder();
    const query = encodeURIComponent(
      `'${this.folderId}' in parents and trashed=false and name!='${this.indexFileName}'`
    );
    const data = await this.request(
      `/files?q=${query}&fields=files(id,name,size,createdTime,appProperties)&orderBy=createdTime desc`
    );
    const driveFiles: IDriveFile[] = data.files || [];

    // Filter out 0-byte or empty stubs and queue them for background cleanup
    const validDriveFiles: IDriveFile[] = [];
    const zeroByteIds: string[] = [];

    for (const f of driveFiles) {
      const byteSize = f.size ? parseInt(f.size, 10) : 0;
      if (byteSize === 0) {
        zeroByteIds.push(f.id);
      } else {
        validDriveFiles.push(f);
      }
    }

    if (zeroByteIds.length > 0) {
      // Clean up orphaned 0-byte stubs in the background without blocking the listing
      this.batchDeleteBackups(zeroByteIds).catch((err) => {
        console.warn('Background cleanup of empty stubs failed:', err);
      });
    }

    // Also fetch index to supplement metadata
    let index: IJwSyncIndex | null = null;
    try {
      index = await this.fetchIndex();
    } catch (_) {}

    const indexMap = new Map<string, IJwSyncIndexBackup>();
    if (index && index.backups) {
      for (const b of index.backups) {
        indexMap.set(b.fileId, b);
      }
    }

    const parseCount = (val?: string | number) => {
      if (val === undefined || val === null || val === '') return undefined;
      const n = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(n) ? undefined : n;
    };

    return validDriveFiles.map((f) => {
      const idx = indexMap.get(f.id);
      const sha256 = f.appProperties?.sha256 || idx?.sha256 || '';
      const hasSha = !!sha256 && sha256.trim().length > 0;
      return {
        ...f,
        sha256: hasSha ? sha256 : undefined,
        deviceId: f.appProperties?.deviceId || idx?.deviceId,
        deviceName: f.appProperties?.deviceName || idx?.deviceName,
        isValidated: hasSha,
        notesCount: parseCount(f.appProperties?.notesCount ?? idx?.notesCount),
        tagsCount: parseCount(f.appProperties?.tagsCount ?? idx?.tagsCount),
        playlistsCount: parseCount(f.appProperties?.playlistsCount ?? idx?.playlistsCount),
        bookmarksCount: parseCount(f.appProperties?.bookmarksCount ?? idx?.bookmarksCount),
      };
    });
  }

  async renameBackup(fileId: string, newName: string): Promise<IDriveFile> {
    const updated = await this.request(`/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });

    try {
      const index = await this.fetchIndex();
      if (index && index.backups) {
        const item = index.backups.find((b) => b.fileId === fileId);
        if (item) {
          item.fileName = newName;
          await this.saveIndex(index);
        }
      }
    } catch (err) {
      console.warn(`Failed to update cloud index for file ${fileId}:`, err);
    }

    return updated;
  }

  async deleteBackup(fileId: string): Promise<void> {
    await this.request(`/files/${fileId}`, { method: 'DELETE' });
    try {
      const index = await this.fetchIndex();
      if (index && index.backups) {
        index.backups = index.backups.filter((b) => b.fileId !== fileId);
        await this.saveIndex(index);
      }
    } catch (_) {}
  }

  async batchDeleteBackups(fileIds: string[]): Promise<void> {
    const set = new Set(fileIds);
    for (const id of fileIds) {
      try {
        await this.request(`/files/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn(`Failed to delete file ${id}:`, err);
      }
    }
    try {
      const index = await this.fetchIndex();
      if (index && index.backups) {
        index.backups = index.backups.filter((b) => !set.has(b.fileId));
        await this.saveIndex(index);
      }
    } catch (_) {}
  }

  async uploadBackup(
    name: string,
    blob: Blob,
    extraMetadata?: {
      sha256?: string;
      deviceId?: string;
      deviceName?: string;
      notesCount?: number;
      tagsCount?: number;
      playlistsCount?: number;
      bookmarksCount?: number;
    },
    onProgress?: (percent: number) => void
  ): Promise<IDriveFile> {
    if (!this.folderId) await this.ensureSyncFolder();

    const appProperties: Record<string, string> = {
      uploadedAt: new Date().toISOString(),
    };
    if (extraMetadata?.sha256) appProperties.sha256 = extraMetadata.sha256;
    if (extraMetadata?.deviceId) appProperties.deviceId = extraMetadata.deviceId;
    if (extraMetadata?.deviceName) appProperties.deviceName = extraMetadata.deviceName;
    if (extraMetadata?.notesCount !== undefined) appProperties.notesCount = String(extraMetadata.notesCount);
    if (extraMetadata?.tagsCount !== undefined) appProperties.tagsCount = String(extraMetadata.tagsCount);
    if (extraMetadata?.playlistsCount !== undefined) appProperties.playlistsCount = String(extraMetadata.playlistsCount);
    if (extraMetadata?.bookmarksCount !== undefined) appProperties.bookmarksCount = String(extraMetadata.bookmarksCount);

    const metadata = {
      name,
      parents: [this.folderId],
      appProperties,
    };
    const fileInfo = await this.request('/files', {
      method: 'POST',
      body: JSON.stringify(metadata),
    });

    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileInfo.id}?uploadType=media`;

    let uploadedFile: any;
    try {
      if (typeof XMLHttpRequest !== 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PATCH', uploadUrl);
          xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
          xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');

          if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable && e.total > 0) {
                const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
                onProgress(percent);
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                uploadedFile = JSON.parse(xhr.responseText);
                onProgress?.(100);
                resolve();
              } catch (e) {
                reject(new Error('Failed to parse Google Drive response'));
              }
            } else {
              reject(new Error(`Upload to Google Drive failed: ${xhr.statusText || xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during Google Drive upload'));
          xhr.onabort = () => reject(new Error('Upload aborted'));
          xhr.send(blob);
        });
      } else {
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': blob.type || 'application/octet-stream',
          },
          body: blob,
        });

        if (!response.ok) {
          throw new Error(`Upload to Google Drive failed: ${response.statusText}`);
        }
        uploadedFile = await response.json();
        onProgress?.(100);
      }
    } catch (uploadErr) {
      // Auto-delete incomplete/aborted file draft on Google Drive
      try {
        await this.request(`/files/${fileInfo.id}`, { method: 'DELETE' });
      } catch (cleanupErr) {
        console.warn('Failed to delete incomplete upload draft:', cleanupErr);
      }
      throw uploadErr;
    }

    // Update .jwsync_index.json
    try {
      let index = await this.fetchIndex();
      if (!index) {
        index = { version: 1, lastUpdated: new Date().toISOString(), backups: [] };
      }
      index.backups = index.backups.filter((b) => b.fileId !== fileInfo.id);
      index.backups.unshift({
        fileId: fileInfo.id,
        fileName: name,
        sha256: extraMetadata?.sha256 || '',
        size: blob.size,
        deviceId: extraMetadata?.deviceId || getLocalDeviceId(),
        deviceName: extraMetadata?.deviceName || getLocalDeviceName(),
        uploadedAt: new Date().toISOString(),
        notesCount: extraMetadata?.notesCount,
        tagsCount: extraMetadata?.tagsCount,
        playlistsCount: extraMetadata?.playlistsCount,
        bookmarksCount: extraMetadata?.bookmarksCount,
      });
      await this.saveIndex(index);
    } catch (err) {
      console.warn('Failed to update cloud index:', err);
    }

    return {
      ...uploadedFile,
      sha256: extraMetadata?.sha256,
      deviceId: extraMetadata?.deviceId || getLocalDeviceId(),
      deviceName: extraMetadata?.deviceName || getLocalDeviceName(),
      isValidated: !!extraMetadata?.sha256,
      notesCount: extraMetadata?.notesCount,
      tagsCount: extraMetadata?.tagsCount,
      playlistsCount: extraMetadata?.playlistsCount,
      bookmarksCount: extraMetadata?.bookmarksCount,
    };
  }

  async downloadBackup(
    fileId: string,
    onProgress?: (percent: number) => void
  ): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Download from Google Drive failed: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!onProgress || !response.body || !total || total <= 0) {
      const buffer = await response.arrayBuffer();
      onProgress?.(100);
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        const pct = Math.min(99, Math.round((received / total) * 100));
        onProgress(pct);
      }
    }

    onProgress(100);
    const fullBytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      fullBytes.set(chunk, offset);
      offset += chunk.length;
    }
    return fullBytes.buffer;
  }
}

export const driveManager = new GoogleDriveManager();
