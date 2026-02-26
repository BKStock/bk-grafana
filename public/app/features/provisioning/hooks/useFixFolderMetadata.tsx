import { Trans } from '@grafana/i18n';
import { Spinner } from '@grafana/ui';
import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { useGetActiveJob } from '../useGetActiveJob';

export function useFixFolderMetadata(repositoryName: string) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
  const activeJob = useGetActiveJob(repositoryName);
  const isJobRunning = jobQuery.isLoading || activeJob?.status?.state === 'working';

  const onFixFolderMetadata = () => {
    if (!repositoryName || isJobRunning) {
      return;
    }
    createJob({ name: repositoryName, jobSpec: { action: 'fixFolderMetadata', fixFolderMetadata: {} } });
  };

  const buttonContent = isJobRunning ? (
    <>
      <Spinner size="xs" inline /> <Trans i18nKey="provisioning.fix-folder-metadata.fixing">Fixing...</Trans>
    </>
  ) : (
    <Trans i18nKey="provisioning.fix-folder-metadata.button">Fix folder IDs</Trans>
  );

  return { onFixFolderMetadata, buttonContent, isJobRunning };
}
