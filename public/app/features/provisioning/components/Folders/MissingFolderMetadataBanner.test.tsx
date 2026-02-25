import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { FolderMetadataResult } from '../../hooks/useFolderMetadataStatus';

import { FolderPermissions, MissingFolderMetadataBanner } from './MissingFolderMetadataBanner';

jest.mock('app/core/components/AccessControl/Permissions', () => ({
  Permissions: ({ canSetPermissions, resourceId }: { canSetPermissions: boolean; resourceId: string }) => (
    <div data-testid="permissions" data-can-set={canSetPermissions} data-resource-id={resourceId} />
  ),
}));

jest.mock('../../hooks/useFolderMetadataStatus', () => ({
  useFolderMetadataStatus: jest.fn(),
}));

jest.mock('../../useGetActiveJob', () => ({
  useGetActiveJob: jest.fn().mockReturnValue(undefined),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useCreateRepositoryJobsMutation: jest.fn().mockReturnValue([jest.fn(), { isLoading: false }]),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useFolderMetadataStatus } = require('../../hooks/useFolderMetadataStatus');

describe('MissingFolderMetadataBanner', () => {
  it('renders warning alert with correct content', () => {
    render(<MissingFolderMetadataBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();
  });

  it('does not show fix button when repositoryName is not provided', () => {
    render(<MissingFolderMetadataBanner />);

    expect(screen.queryByRole('button', { name: /fix folder ids/i })).not.toBeInTheDocument();
  });

  it('shows fix button when repositoryName is provided', () => {
    render(<MissingFolderMetadataBanner repositoryName="test-repo" />);

    expect(screen.getByRole('button', { name: /fix folder ids/i })).toBeInTheDocument();
  });

  it('calls createJob when fix button is clicked', async () => {
    const mockCreateJob = jest.fn();
    jest
      .mocked(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('app/api/clients/provisioning/v0alpha1').useCreateRepositoryJobsMutation
      )
      .mockReturnValue([mockCreateJob, { isLoading: false }]);

    const { user } = render(<MissingFolderMetadataBanner repositoryName="test-repo" />);

    await user.click(screen.getByRole('button', { name: /fix folder ids/i }));
    expect(mockCreateJob).toHaveBeenCalledWith({
      name: 'test-repo',
      jobSpec: {
        action: 'fixFolderMetadata',
        fixFolderMetadata: {},
      },
    });
  });
});

describe('FolderPermissions', () => {
  testWithFeatureToggles({ enable: ['provisioning', 'provisioningFolderMetadata'] });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders permissions directly when folder is not provisioned', () => {
    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={false} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
    expect(useFolderMetadataStatus).not.toHaveBeenCalled();
  });

  it('renders permissions directly when feature toggles are disabled', () => {
    config.featureToggles.provisioning = false;

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
    expect(permissions).toHaveAttribute('data-resource-id', 'folder-1');
  });

  it('renders loading state', () => {
    useFolderMetadataStatus.mockReturnValue({
      status: 'loading',
      repositoryName: '',
    } satisfies FolderMetadataResult);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders warning banner with fix button when metadata is missing', () => {
    useFolderMetadataStatus.mockReturnValue({
      status: 'missing',
      repositoryName: 'test-repo',
    } satisfies FolderMetadataResult);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This folder is missing metadata.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fix folder ids/i })).toBeInTheDocument();

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'false');
  });

  it('renders error alert when metadata check fails', () => {
    useFolderMetadataStatus.mockReturnValue({
      status: 'error',
      repositoryName: '',
    } satisfies FolderMetadataResult);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to check folder metadata status.')).toBeInTheDocument();
  });

  it('renders permissions with original canSetPermissions when metadata is ok', () => {
    useFolderMetadataStatus.mockReturnValue({
      status: 'ok',
      repositoryName: 'test-repo',
    } satisfies FolderMetadataResult);

    render(<FolderPermissions folderUID="folder-1" canSetPermissions={true} isProvisionedFolder={true} />);

    const permissions = screen.getByTestId('permissions');
    expect(permissions).toHaveAttribute('data-can-set', 'true');
  });
});
