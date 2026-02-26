import { skipToken } from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';

import { isFetchError } from '@grafana/runtime';
import { useGetRepositoryFilesQuery, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { checkFilesForMissingMetadata, getFolderMetadataPath } from '../utils/folderMetadata';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type FolderMetadataStatus = 'loading' | 'missing' | 'error' | 'ok';

export interface FolderMetadataResult {
  status: FolderMetadataStatus;
  repositoryName: string;
}

interface RepoLevelArgs {
  repositoryName: string;
}

/**
 * Checks whether provisioned folders have a `_folder.json` metadata file.
 *
 * Two call patterns:
 * - `useFolderMetadataStatus(folderUID)` — single-folder check via repository view + file path query
 * - `useFolderMetadataStatus({ repositoryName })` — repo-level check using the full files listing
 */
export function useFolderMetadataStatus(args: string | RepoLevelArgs): FolderMetadataResult {
  const isRepoLevel = typeof args === 'object';
  const folderUID = isRepoLevel ? '' : args;
  const repoLevelName = isRepoLevel ? args.repositoryName : '';

  // --- Folder-level path (active when args is a string) ---
  const {
    repository,
    folder,
    isLoading: isRepoViewLoading,
  } = useGetResourceRepositoryView({
    folderName: folderUID || undefined,
    skipQuery: isRepoLevel,
  });

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath]?.replace(/\/+$/, '');
  const folderRepoName = repository?.name ?? '';
  const folderJsonPath = getFolderMetadataPath(sourcePath);

  const { error: filePathError, isLoading: isFilePathLoading } = useGetRepositoryFilesWithPathQuery(
    !isRepoLevel && folderRepoName ? { name: folderRepoName, path: folderJsonPath } : skipToken
  );

  // --- Repo-level path (active when args is an object) ---
  const {
    data: filesData,
    isLoading: isFilesLoading,
    error: filesError,
  } = useGetRepositoryFilesQuery(repoLevelName ? { name: repoLevelName } : skipToken);

  const hasMissing = useMemo(() => {
    if (!isRepoLevel || isFilesLoading || !filesData?.items) {
      return false;
    }
    return checkFilesForMissingMetadata(filesData.items);
  }, [isRepoLevel, filesData?.items, isFilesLoading]);

  // --- Return based on which path is active ---
  if (isRepoLevel) {
    if (isFilesLoading) {
      return { status: 'loading', repositoryName: repoLevelName };
    }
    if (filesError) {
      return { status: 'error', repositoryName: repoLevelName };
    }
    return { status: hasMissing ? 'missing' : 'ok', repositoryName: repoLevelName };
  }

  if (isRepoViewLoading || isFilePathLoading) {
    return { status: 'loading', repositoryName: folderRepoName };
  }

  if (isFetchError(filePathError) && filePathError.status === 404) {
    return { status: 'missing', repositoryName: folderRepoName };
  }

  if (filePathError) {
    return { status: 'error', repositoryName: folderRepoName };
  }

  return { status: 'ok', repositoryName: folderRepoName };
}
