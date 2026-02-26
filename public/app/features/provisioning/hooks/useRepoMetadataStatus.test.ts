import { renderHook } from '@testing-library/react';

import { useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepoMetadataStatus } from './useRepoMetadataStatus';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesQuery: jest.fn(),
}));

const mockUseGetRepositoryFilesQuery = jest.mocked(useGetRepositoryFilesQuery);

function setupMocks(overrides: Partial<ReturnType<typeof useGetRepositoryFilesQuery>> = {}) {
  mockUseGetRepositoryFilesQuery.mockReturnValue({
    data: { items: [] },
    error: undefined,
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useGetRepositoryFilesQuery>);
}

describe('useRepoMetadataStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading when files query is loading', () => {
    setupMocks({ isLoading: true });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('loading');
    expect(result.current.repositoryName).toBe('my-repo');
  });

  it('returns error when files query errors', () => {
    setupMocks({
      error: { status: 500, data: { message: 'internal error' } },
    });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('error');
  });

  it('returns ok when all folders have _folder.json', () => {
    setupMocks({
      data: {
        items: [
          { path: '_folder.json', hash: 'abc' },
          { path: 'subfolder/_folder.json', hash: 'def' },
          { path: 'subfolder/dashboard.json', hash: 'ghi' },
        ],
      },
    });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('ok');
  });

  it('returns ok when repo has no files', () => {
    setupMocks({ data: { items: [] } });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('ok');
  });

  it('returns ok when repo has only root-level files with no folders', () => {
    setupMocks({
      data: { items: [{ path: 'dashboard.json', hash: 'abc' }] },
    });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('ok');
  });

  it('returns missing when a subfolder is missing _folder.json', () => {
    setupMocks({
      data: {
        items: [
          { path: '_folder.json', hash: 'abc' },
          { path: 'subfolder/dashboard.json', hash: 'def' },
        ],
      },
    });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('missing');
  });

  it('returns missing when root _folder.json is missing but subfolders exist', () => {
    setupMocks({
      data: {
        items: [
          { path: 'subfolder/_folder.json', hash: 'abc' },
          { path: 'subfolder/dashboard.json', hash: 'def' },
        ],
      },
    });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('missing');
  });

  it('returns missing when deeply nested folder is missing _folder.json', () => {
    setupMocks({
      data: {
        items: [
          { path: '_folder.json', hash: 'abc' },
          { path: 'a/_folder.json', hash: 'def' },
          { path: 'a/b/dashboard.json', hash: 'ghi' },
        ],
      },
    });

    const { result } = renderHook(() => useRepoMetadataStatus('my-repo'));
    expect(result.current.status).toBe('missing');
  });
});
