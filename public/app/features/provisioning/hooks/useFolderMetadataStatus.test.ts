import { renderHook } from '@testing-library/react';

import { useGetRepositoryFilesQuery, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerKind, AnnoKeySourcePath, ManagerKind } from 'app/features/apiserver/types';

import { useFolderMetadataStatus } from './useFolderMetadataStatus';
import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
  useGetRepositoryFilesQuery: jest.fn(),
}));

jest.mock('./useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseGetRepositoryFilesWithPathQuery = jest.mocked(useGetRepositoryFilesWithPathQuery);
const mockUseGetRepositoryFilesQuery = jest.mocked(useGetRepositoryFilesQuery);

const defaultFilesQueryReturn = {
  data: { items: [] },
  error: undefined,
  isLoading: false,
  isFetching: false,
  refetch: jest.fn(),
} as ReturnType<typeof useGetRepositoryFilesQuery>;

const defaultRepoViewReturn = {
  repository: { name: 'my-repo', target: 'folder', title: 'Repo', type: 'github', workflows: ['branch'] },
  folder: {
    metadata: {
      annotations: {
        [AnnoKeyManagerKind]: ManagerKind.Repo,
        [AnnoKeySourcePath]: 'folders/my-folder',
      },
    },
    spec: { title: 'My Folder' },
  },
  isLoading: false,
  isInstanceManaged: false,
  isReadOnlyRepo: false,
} as ReturnType<typeof useGetResourceRepositoryView>;

const defaultFilePathQueryReturn = {
  data: { path: 'folders/my-folder/_folder.json' },
  error: undefined,
  isLoading: false,
  isFetching: false,
  refetch: jest.fn(),
} as ReturnType<typeof useGetRepositoryFilesWithPathQuery>;

function setupFolderMocks({
  repoViewOverrides = {},
  fileQueryOverrides = {},
}: {
  repoViewOverrides?: Partial<ReturnType<typeof useGetResourceRepositoryView>>;
  fileQueryOverrides?: Partial<ReturnType<typeof useGetRepositoryFilesWithPathQuery>>;
} = {}) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    ...defaultRepoViewReturn,
    ...repoViewOverrides,
  } as ReturnType<typeof useGetResourceRepositoryView>);

  mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
    ...defaultFilePathQueryReturn,
    ...fileQueryOverrides,
  } as ReturnType<typeof useGetRepositoryFilesWithPathQuery>);

  // Repo-level query is always called but skipped for folder-level checks
  mockUseGetRepositoryFilesQuery.mockReturnValue(defaultFilesQueryReturn);
}

function setupRepoMocks(overrides: Partial<ReturnType<typeof useGetRepositoryFilesQuery>> = {}) {
  // Folder-level queries are always called but skipped for repo-level checks
  mockUseGetResourceRepositoryView.mockReturnValue(defaultRepoViewReturn);
  mockUseGetRepositoryFilesWithPathQuery.mockReturnValue(defaultFilePathQueryReturn);

  mockUseGetRepositoryFilesQuery.mockReturnValue({
    ...defaultFilesQueryReturn,
    ...overrides,
  } as ReturnType<typeof useGetRepositoryFilesQuery>);
}

describe('useFolderMetadataStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('folder-level check (string arg)', () => {
    describe('returns loading', () => {
      it('when repository view is loading', () => {
        setupFolderMocks({
          repoViewOverrides: { isLoading: true },
        });

        const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
        expect(result.current.status).toBe('loading');
      });

      it('when file query is loading', () => {
        setupFolderMocks({
          fileQueryOverrides: { isLoading: true },
        });

        const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
        expect(result.current.status).toBe('loading');
      });
    });

    describe('returns missing', () => {
      it('when file query returns 404', () => {
        setupFolderMocks({
          fileQueryOverrides: {
            data: undefined,
            error: { status: 404, data: { message: 'not found' } },
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
        expect(result.current.status).toBe('missing');
        expect(result.current.repositoryName).toBe('my-repo');
      });
    });

    describe('returns error', () => {
      it('when file query returns non-404 error', () => {
        setupFolderMocks({
          fileQueryOverrides: {
            data: undefined,
            error: { status: 500, data: { message: 'internal error' } },
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
        expect(result.current.status).toBe('error');
      });
    });

    describe('returns ok', () => {
      it('when file exists', () => {
        setupFolderMocks();

        const { result } = renderHook(() => useFolderMetadataStatus('folder-uid'));
        expect(result.current.status).toBe('ok');
      });
    });

    describe('path construction', () => {
      it('queries the correct path for nested folders', () => {
        setupFolderMocks();

        renderHook(() => useFolderMetadataStatus('folder-uid'));

        expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
          name: 'my-repo',
          path: 'folders/my-folder/_folder.json',
        });
      });

      it('queries _folder.json at repo root for root provisioned folders', () => {
        setupFolderMocks({
          repoViewOverrides: {
            folder: {
              metadata: {
                annotations: {
                  [AnnoKeyManagerKind]: ManagerKind.Repo,
                },
              },
              spec: { title: 'Root Folder' },
            } as ReturnType<typeof useGetResourceRepositoryView>['folder'],
          },
        });

        renderHook(() => useFolderMetadataStatus('folder-uid'));

        expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
          name: 'my-repo',
          path: '_folder.json',
        });
      });

      it('normalizes trailing slash in source path', () => {
        setupFolderMocks({
          repoViewOverrides: {
            folder: {
              metadata: {
                annotations: {
                  [AnnoKeyManagerKind]: ManagerKind.Repo,
                  [AnnoKeySourcePath]: 'folders/my-folder/',
                },
              },
              spec: { title: 'Trailing Slash' },
            } as ReturnType<typeof useGetResourceRepositoryView>['folder'],
          },
        });

        renderHook(() => useFolderMetadataStatus('folder-uid'));

        expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith({
          name: 'my-repo',
          path: 'folders/my-folder/_folder.json',
        });
      });

      it('skips file query when repository name is not yet available', () => {
        setupFolderMocks({
          repoViewOverrides: { repository: undefined },
        });

        renderHook(() => useFolderMetadataStatus('folder-uid'));

        expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith(expect.any(Symbol));
      });
    });
  });

  describe('repo-level check (object arg)', () => {
    describe('returns loading', () => {
      it('when files query is loading', () => {
        setupRepoMocks({ isLoading: true });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('loading');
        expect(result.current.repositoryName).toBe('my-repo');
      });
    });

    describe('returns error', () => {
      it('when files query errors', () => {
        setupRepoMocks({
          error: { status: 500, data: { message: 'internal error' } },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('error');
      });
    });

    describe('returns ok', () => {
      it('when all folders have _folder.json', () => {
        setupRepoMocks({
          data: {
            items: [
              { path: '_folder.json', hash: 'abc' },
              { path: 'subfolder/_folder.json', hash: 'def' },
              { path: 'subfolder/dashboard.json', hash: 'ghi' },
            ],
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('ok');
      });

      it('when repo has no files', () => {
        setupRepoMocks({
          data: { items: [] },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('ok');
      });

      it('when repo has only root-level files with no folders', () => {
        setupRepoMocks({
          data: {
            items: [{ path: 'dashboard.json', hash: 'abc' }],
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('ok');
      });
    });

    describe('returns missing', () => {
      it('when a subfolder is missing _folder.json', () => {
        setupRepoMocks({
          data: {
            items: [
              { path: '_folder.json', hash: 'abc' },
              { path: 'subfolder/dashboard.json', hash: 'def' },
            ],
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('missing');
      });

      it('when root _folder.json is missing but subfolders exist', () => {
        setupRepoMocks({
          data: {
            items: [
              { path: 'subfolder/_folder.json', hash: 'abc' },
              { path: 'subfolder/dashboard.json', hash: 'def' },
            ],
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('missing');
      });

      it('when deeply nested folder is missing _folder.json', () => {
        setupRepoMocks({
          data: {
            items: [
              { path: '_folder.json', hash: 'abc' },
              { path: 'a/_folder.json', hash: 'def' },
              { path: 'a/b/dashboard.json', hash: 'ghi' },
            ],
          },
        });

        const { result } = renderHook(() => useFolderMetadataStatus({ repositoryName: 'my-repo' }));
        expect(result.current.status).toBe('missing');
      });
    });
  });
});
