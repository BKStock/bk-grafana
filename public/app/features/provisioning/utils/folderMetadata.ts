import { ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';

import { FOLDER_METADATA_FILE } from '../constants';

import { mergeFilesAndResources } from './treeUtils';

export function getFolderMetadataPath(sourcePath?: string): string {
  return sourcePath ? `${sourcePath}/${FOLDER_METADATA_FILE}` : FOLDER_METADATA_FILE;
}

/**
 * Returns true if any provisioned folder (resource type 'folders') is missing
 * its `_folder.json` metadata file. Only checks folders that have a resource
 * entry — no more inferring folders from file paths.
 */
export function checkFilesForMissingMetadata(files: unknown[], resources: ResourceListItem[]): boolean {
  const merged = mergeFilesAndResources(files, resources);
  const paths = new Set(merged.map((item) => item.path));

  return merged.some((item) => {
    if (item.resource?.resource !== 'folders') {
      return false;
    }
    return !paths.has(getFolderMetadataPath(item.path));
  });
}
