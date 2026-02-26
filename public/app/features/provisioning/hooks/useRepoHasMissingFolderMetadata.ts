import { useMemo } from 'react';

import { useGetRepositoryFilesQuery, useGetRepositoryResourcesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { buildTree, hasMissingFolderMetadata, mergeFilesAndResources } from '../utils/treeUtils';

export function useRepoHasMissingFolderMetadata(repoName: string) {
  const filesQuery = useGetRepositoryFilesQuery({ name: repoName });
  const resourcesQuery = useGetRepositoryResourcesQuery({ name: repoName });

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;

  const hasMissing = useMemo(() => {
    if (isLoading) {
      return false;
    }

    const files = filesQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];
    const merged = mergeFilesAndResources(files, resources);
    const tree = buildTree(merged);
    return hasMissingFolderMetadata(tree);
  }, [filesQuery.data?.items, resourcesQuery.data?.items, isLoading]);

  return { hasMissing, isLoading };
}
