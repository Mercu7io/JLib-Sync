/**
 * Panda JL Studio — Google Drive Cloud Backup Rename Schema & Validator
 * Enforces typed schema validation, sanitization, and extension preservation.
 */

export interface RenameBackupInput {
  newName: string;
  originalName: string;
}

export type RenameErrorCode =
  | 'EMPTY'
  | 'INVALID_CHARS'
  | 'TOO_LONG'
  | 'SAME_NAME';

export interface RenameValidationResult {
  isValid: boolean;
  errorCode?: RenameErrorCode;
  sanitizedName?: string;
}

const INVALID_FILENAME_CHARS_REGEX = /[/\\:*?"<>|]/;
const MAX_FILENAME_LENGTH = 255;

/**
 * Validates and formats a new name for a Google Drive backup file.
 * Automatically guarantees retention of required .jwlibrary and .enc extensions.
 */
export function validateBackupName(input: RenameBackupInput): RenameValidationResult {
  const rawNewName = (input.newName || '').trim();
  const originalName = (input.originalName || '').trim();

  if (!rawNewName) {
    return { isValid: false, errorCode: 'EMPTY' };
  }

  if (INVALID_FILENAME_CHARS_REGEX.test(rawNewName)) {
    return { isValid: false, errorCode: 'INVALID_CHARS' };
  }

  const isEncrypted = originalName.endsWith('.enc');

  // Strip known extensions from the raw input to isolate the base name
  let baseName = rawNewName;
  if (baseName.endsWith('.enc')) {
    baseName = baseName.slice(0, -4);
  }
  if (baseName.endsWith('.jwlibrary')) {
    baseName = baseName.slice(0, -10);
  }
  baseName = baseName.trim();

  if (!baseName) {
    return { isValid: false, errorCode: 'EMPTY' };
  }

  // Re-append standard extensions
  let finalName = `${baseName}.jwlibrary`;
  if (isEncrypted) {
    finalName += '.enc';
  }

  if (finalName.length > MAX_FILENAME_LENGTH) {
    return { isValid: false, errorCode: 'TOO_LONG' };
  }

  if (finalName === originalName) {
    return { isValid: false, errorCode: 'SAME_NAME' };
  }

  return {
    isValid: true,
    sanitizedName: finalName,
  };
}

/**
 * Extracts a user-friendly editable base name (stripping .jwlibrary and .enc).
 */
export function getEditableBaseName(fileName: string): string {
  let name = (fileName || '').trim();
  if (name.endsWith('.enc')) {
    name = name.slice(0, -4);
  }
  if (name.endsWith('.jwlibrary')) {
    name = name.slice(0, -10);
  }
  return name;
}
