/**
 * Panda JWL-Sync — Google Drive Cloud Sync Manager
 * Uses Google Identity Services with restricted 'drive.file' scope
 * (only touches files and folders created by Panda JWL-Sync, never personal Drive files).
 */

export interface IDriveFile {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
}

// Use Google Cloud OAuth Client ID from environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

declare global {
  interface Window {
    google?: any;
  }
}

export class GoogleDriveManager {
  private clientId = GOOGLE_CLIENT_ID;
  private accessToken: string | null = null;
  private folderId: string | null = null;
  private folderName = 'JW Sync';
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

  async init(onAuthSuccess?: (token: string) => void): Promise<void> {
    await this.loadGoogleScript();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services not ready.');
    }

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: this.scope,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          if (tokenResponse.type === 'no_session' || tokenResponse.error === 'user_logged_out') {
            localStorage.removeItem('jwsync_drive_connected');
            return;
          }
          throw tokenResponse;
        }
        this.accessToken = tokenResponse.access_token;
        localStorage.setItem('jwsync_drive_connected', 'true');
        onAuthSuccess?.(this.accessToken!);
      },
    });
  }

  login(): void {
    if (!this.tokenClient) {
      throw new Error('Google Drive client is not initialized.');
    }
    this.tokenClient.requestAccessToken({ prompt: '' });
  }

  trySilentReconnect(onAuthSuccess?: (token: string) => void): void {
    if (!this.tokenClient) return;
    const wasConnected = localStorage.getItem('jwsync_drive_connected');
    if (wasConnected === 'true') {
      try {
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (_) {
        // silent token failed
      }
    }
  }

  logout(): void {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        this.accessToken = null;
        this.folderId = null;
        localStorage.removeItem('jwsync_drive_connected');
      });
    } else {
      this.accessToken = null;
      this.folderId = null;
      localStorage.removeItem('jwsync_drive_connected');
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
        this.logout();
        throw new Error('Session expired. Please reconnect to Google Drive.');
      }
      throw new Error(`Google Drive API error (${response.status}): ${response.statusText}`);
    }
    return response.status === 204 ? null : await response.json();
  }

  async findSyncFolder(): Promise<string | null> {
    const query = encodeURIComponent(
      `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const data = await this.request(`/files?q=${query}&fields=files(id,name)`);
    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
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

  async listBackups(): Promise<IDriveFile[]> {
    if (!this.folderId) await this.ensureSyncFolder();
    const query = encodeURIComponent(`'${this.folderId}' in parents and trashed=false`);
    const data = await this.request(
      `/files?q=${query}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`
    );
    return data.files || [];
  }

  async deleteBackup(fileId: string): Promise<void> {
    await this.request(`/files/${fileId}`, { method: 'DELETE' });
  }

  async batchDeleteBackups(fileIds: string[]): Promise<void> {
    for (const id of fileIds) {
      try {
        await this.deleteBackup(id);
      } catch (err) {
        console.warn(`Failed to delete file ${id}:`, err);
      }
    }
  }

  async uploadBackup(name: string, blob: Blob): Promise<IDriveFile> {
    if (!this.folderId) await this.ensureSyncFolder();
    const metadata = { name, parents: [this.folderId] };
    const fileInfo = await this.request('/files', {
      method: 'POST',
      body: JSON.stringify(metadata),
    });

    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileInfo.id}?uploadType=media`;
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
    return await response.json();
  }

  async downloadBackup(fileId: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Download from Google Drive failed: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }
}

export const driveManager = new GoogleDriveManager();
