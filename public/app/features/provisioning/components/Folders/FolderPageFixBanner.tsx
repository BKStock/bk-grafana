import { config } from '@grafana/runtime';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';

import { MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

interface FolderPageFixBannerProps {
  folderUID?: string;
  isProvisionedFolder: boolean;
}

export function FolderPageFixBanner({ folderUID, isProvisionedFolder }: FolderPageFixBannerProps) {
  const shouldCheck = Boolean(
    config.featureToggles.provisioning &&
      config.featureToggles.provisioningFolderMetadata &&
      folderUID &&
      isProvisionedFolder
  );

  const { status, repositoryName } = useFolderMetadataStatus(shouldCheck ? folderUID! : '');

  if (!shouldCheck || status !== 'missing') {
    return null;
  }

  return <MissingFolderMetadataBanner repositoryName={repositoryName} />;
}
