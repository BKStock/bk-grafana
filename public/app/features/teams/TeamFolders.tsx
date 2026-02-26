import { skipToken } from '@reduxjs/toolkit/query';
import memoizeOne from 'memoize-one';
import Skeleton from 'react-loading-skeleton';

import { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { t } from '@grafana/i18n';
import { Alert, Column, InteractiveTable, Text, TextLink } from '@grafana/ui';
import { useSearchDashboardsAndFoldersQuery } from 'app/api/clients/dashboard/v0alpha1';
import { FolderInfo, useGetFolderParentsQuery } from 'app/api/clients/folder/v1beta1';
import { GENERAL_FOLDER_TITLE } from 'app/features/search/constants';

import { extractErrorMessage } from '../../api/utils';

// We need getColumns and getSkeletonData to be functions because they use t() which cannot be called in global context.
const getColumns = memoizeOne((): Array<Column<DashboardHit>> => {
  return [
    {
      id: 'title',
      header: t('teams.team-pages.team-folders.table.name', 'Name'),
      cell: ({ row: { original } }) => (
        <TextLink
          color="primary"
          inline={false}
          href={`/dashboards/f/${original.name}`}
          title={t('teams.team-pages.team-folders.open-folder', 'Open folder')}
        >
          {original.title}
        </TextLink>
      ),
    },
    {
      id: 'folder',
      header: t('teams.team-pages.team-folders.table.path', 'Full path'),
      cell: ({ row: { original } }) => <FolderPathCell folderUid={original.name} folderTitle={original.title} />,
    },
  ];
});

const getSkeletonData = memoizeOne(() =>
  Array.from({ length: 3 }, (_, index) => ({
    name: `loading-folder-${index}`,
    resource: 'folder',
    title: t('teams.team-pages.team-folders.loading', 'Loading...'),
  }))
);

/**
 * Shows list of folders owned by the team.
 * @param teamUid
 * @constructor
 */
export function TeamFolders({ teamUid }: { teamUid: string }) {
  const { data, isLoading, error } = useSearchDashboardsAndFoldersQuery(
    teamUid ? { ownerReference: [`iam.grafana.app/Team/${teamUid}`], type: 'folder' } : skipToken
  );

  const folders = data?.hits ?? [];

  if (error) {
    return (
      <Alert
        severity="error"
        title={t('teams.team-pages.team-folders.error-loading-folders', 'Could not load team folders')}
      >
        {extractErrorMessage(error)}
      </Alert>
    );
  }

  if (!isLoading && !folders.length) {
    return <Text color="secondary">{t('teams.team-pages.team-folders.empty', 'No folders owned by this team')}</Text>;
  }

  return (
    <InteractiveTable
      columns={getColumns()}
      data={isLoading ? getSkeletonData() : folders}
      getRowId={(folder) => folder.name}
      pageSize={25}
    />
  );
}

function FolderPathCell({ folderUid, folderTitle }: { folderUid: string; folderTitle?: string }) {
  const { data, isLoading, isError } = useGetFolderParentsQuery(folderUid ? { name: folderUid } : skipToken);

  if (isLoading) {
    return <Skeleton width={220} />;
  }

  if (isError) {
    // No better error handling here. This is not blocking anything if not shown.
    return <>-</>;
  }

  const path = buildFolderPath(data?.items ?? []);
  return <>{path}</>;
}

function buildFolderPath(items: FolderInfo[]): string {
  const parentTitles = items.map((item) => item.title).filter(Boolean);

  const pathParts = [...parentTitles];
  if (pathParts[0] !== GENERAL_FOLDER_TITLE) {
    pathParts.unshift(GENERAL_FOLDER_TITLE);
  }

  return `/${pathParts.join('/')}`;
}
