import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder, Stack } from '@grafana/ui';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { Permissions } from 'app/core/components/AccessControl/Permissions';

import { useFolderMetadataStatus } from '../../hooks/useFolderMetadataStatus';
import { useGetActiveJob } from '../../useGetActiveJob';

interface MissingFolderMetadataBannerProps {
  repositoryName?: string;
}

export function MissingFolderMetadataBanner({ repositoryName }: MissingFolderMetadataBannerProps) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
  const activeJob = useGetActiveJob(repositoryName);
  const isJobRunning = jobQuery.isLoading || activeJob?.status?.state === 'working';

  const onClick = () => {
    if (!repositoryName) {
      return;
    }
    createJob({
      name: repositoryName,
      jobSpec: {
        action: 'fixFolderMetadata',
        fixFolderMetadata: {},
      },
    });
  };

  return (
    <Alert
      severity="warning"
      title={t('provisioning.missing-folder-metadata-banner.title', 'This folder is missing metadata.')}
    >
      <Stack direction="column" gap={1}>
        <span>
          <Trans i18nKey="provisioning.missing-folder-metadata-banner.message">
            Since this folder doesn&apos;t contain a metadata file, the folder ID is based on the folder path. If you
            move or rename the folder, the folder ID will change, and permissions may no longer apply to the folder.
          </Trans>
        </span>
        {repositoryName && (
          <div>
            <Button size="sm" icon="wrench" variant="secondary" disabled={isJobRunning} onClick={onClick}>
              {isJobRunning ? (
                <Trans i18nKey="provisioning.missing-folder-metadata-banner.fix-button-loading">Fixing...</Trans>
              ) : (
                <Trans i18nKey="provisioning.missing-folder-metadata-banner.fix-button">Fix folder IDs</Trans>
              )}
            </Button>
          </div>
        )}
      </Stack>
    </Alert>
  );
}

function MetadataErrorAlert() {
  return (
    <Alert
      severity="error"
      title={t('provisioning.missing-folder-metadata-banner.error-title', 'Unable to check folder metadata status.')}
    >
      <Trans i18nKey="provisioning.missing-folder-metadata-banner.error-message">
        Could not verify whether this folder has a metadata file. Please try again later.
      </Trans>
    </Alert>
  );
}

interface FolderPermissionsProps {
  folderUID: string;
  canSetPermissions: boolean;
  isProvisionedFolder: boolean;
}

export function FolderPermissions({ folderUID, canSetPermissions, isProvisionedFolder }: FolderPermissionsProps) {
  if (
    !isProvisionedFolder ||
    !config.featureToggles.provisioning ||
    !config.featureToggles.provisioningFolderMetadata
  ) {
    return <Permissions resource="folders" resourceId={folderUID} canSetPermissions={canSetPermissions} />;
  }

  return <FolderPermissionsWithMetadataCheck folderUID={folderUID} canSetPermissions={canSetPermissions} />;
}

function FolderPermissionsWithMetadataCheck({
  folderUID,
  canSetPermissions,
}: Omit<FolderPermissionsProps, 'isProvisionedFolder'>) {
  const { status, repositoryName } = useFolderMetadataStatus(folderUID);

  switch (status) {
    case 'loading':
      return <LoadingPlaceholder text={t('provisioning.folder-permissions.loading', 'Loading...')} />;
    case 'missing':
      return (
        <>
          <MissingFolderMetadataBanner repositoryName={repositoryName} />
          <Permissions resource="folders" resourceId={folderUID} canSetPermissions={false} />
        </>
      );
    case 'error':
      return <MetadataErrorAlert />;
    case 'ok':
    default:
      return <Permissions resource="folders" resourceId={folderUID} canSetPermissions={canSetPermissions} />;
  }
}
