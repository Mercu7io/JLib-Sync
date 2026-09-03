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
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
};

export class GoogleDriveManager {
  private get clientId(): string {
    return getGoogleClientId();
  }
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

  private saveToken(token: string, expiresInSec = 3599): void {
    this.accessToken = token;
    // Set expiry with a 2-minute safety buffer
    const expiresAt = Date.now() + Math.max(0, expiresInSec - 120) * 1000;
    try {
      localStorage.setItem('jwsync_drive_token', token);
      localStorage.setItem('jwsync_drive_token_expires_at', expiresAt.toString());
      localStorage.setItem('jwsync_drive_connected', 'true');
    } catch (_) {}
  }

  private clearStoredToken(): void {
    this.accessToken = null;
    this.folderId = null;
    try {
      localStorage.removeItem('jwsync_drive_token');
      localStorage.removeItem('jwsync_drive_token_expires_at');
      localStorage.removeItem('jwsync_drive_connected');
    } catch (_) {}
  }

  getStoredToken(): string | null {
    try {
      const token = localStorage.getItem('jwsync_drive_token');
      const expiresAtStr = localStorage.getItem('jwsync_drive_token_expires_at');
      if (token && expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        if (Date.now() < expiresAt) {
          return token;
        }
      }
    } catch (_) {}
    return null;
  }

  private authSuccessCallback?: (token: string) => void;

  hasTokenClient(): boolean {
    return !!this.tokenClient;
  }

  isConfigured(): boolean {
    return !!this.clientId;
  }

  async init(onAuthSuccess?: (token: string) => void): Promise<void> {
    if (onAuthSuccess) {
      this.authSuccessCallback = onAuthSuccess;
    }
    if (!this.clientId) {
      return;
    }
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
            this.clearStoredToken();
            return;
          }
          throw tokenResponse;
        }
        const expiresIn = Number(tokenResponse.expires_in) || 3599;
        this.saveToken(tokenResponse.access_token, expiresIn);
        this.authSuccessCallback?.(this.accessToken!);
      },
    });

    // Check if we have an active, non-expired token in localStorage
    const savedToken = this.getStoredToken();
    if (savedToken) {
      this.accessToken = savedToken;
      this.authSuccessCallback?.(savedToken);
    } else {
      // If token is expired but user was previously connected, attempt a silent token refresh
      const wasConnected = localStorage.getItem('jwsync_drive_connected');
      if (wasConnected === 'true') {
        try {
          this.tokenClient.requestAccessToken({ prompt: '' });
        } catch (_) {}
      }
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
      await this.init(this.authSuccessCallback);
    }
    if (!this.tokenClient) {
      throw new Error('Google Drive client is not initialized. Please ensure Google services are accessible.');
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
