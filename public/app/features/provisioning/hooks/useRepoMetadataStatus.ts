import { skipToken } from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';

import { useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { checkFilesForMissingMetadata } from '../utils/folderMetadata';

import { type FolderMetadataResult } from './useFolderMetadataStatus';

/**
 * Checks whether any folder in a repository is missing its `_folder.json` metadata file.
 */
export function useRepoMetadataStatus(repositoryName: string): FolderMetadataResult {
  const { data, isLoading, error } = useGetRepositoryFilesQuery(repositoryName ? { name: repositoryName } : skipToken);

  const hasMissing = useMemo(() => {
    if (isLoading || !data?.items) {
      return false;
    }
    return checkFilesForMissingMetadata(data.items);
  }, [data?.items, isLoading]);

  if (isLoading) {
    return { status: 'loading', repositoryName };
  }

  if (error) {
    return { status: 'error', repositoryName };
  }

  return { status: hasMissing ? 'missing' : 'ok', repositoryName };
}
