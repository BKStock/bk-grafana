import { FOLDER_METADATA_FILE } from '../constants';

export function getFolderMetadataPath(sourcePath?: string): string {
  return sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;
}

/**
 * Given a flat list of file objects (each with a `path` string), returns true
 * if any inferred folder is missing its `_folder.json` metadata file.
 */
export function checkFilesForMissingMetadata(files: Array<{ path: string }>): boolean {
  const filePaths = new Set(files.map((f) => f.path));
  const folders = new Set<string>();

  for (const { path } of files) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }

  // Check root-level metadata
  if (folders.size > 0 && !filePaths.has(FOLDER_METADATA_FILE)) {
    return true;
  }

  for (const folder of folders) {
    if (!filePaths.has(`${folder}/${FOLDER_METADATA_FILE}`)) {
      return true;
    }
  }

  return false;
}
