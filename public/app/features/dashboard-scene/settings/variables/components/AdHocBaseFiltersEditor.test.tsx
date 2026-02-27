import { render, screen } from '@testing-library/react';

import { AdHocFiltersController } from '@grafana/scenes';

import { AdHocBaseFiltersEditor } from './AdHocBaseFiltersEditor';

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    AdHocFiltersComboboxRenderer: ({ controller }: { controller: unknown }) => (
      <div data-testid="adhoc-combobox-renderer">mock combobox</div>
    ),
  };
});

function createMockController(): AdHocFiltersController {
  return {
    useState: () => ({
      filters: [],
      allowCustomValue: true,
      supportsMultiValueOperators: false,
    }),
    getKeys: jest.fn().mockResolvedValue([]),
    getValuesFor: jest.fn().mockResolvedValue([]),
    getOperators: jest.fn().mockReturnValue([]),
    updateFilter: jest.fn(),
    updateToMatchAll: jest.fn(),
    removeFilter: jest.fn(),
    removeLastFilter: jest.fn(),
    handleComboboxBackspace: jest.fn(),
    addWip: jest.fn(),
    restoreOriginalFilter: jest.fn(),
    clearAll: jest.fn(),
  };
}

describe('AdHocBaseFiltersEditor', () => {
  it('should render the combobox renderer', () => {
    render(<AdHocBaseFiltersEditor controller={createMockController()} />);
    expect(screen.getByTestId('adhoc-combobox-renderer')).toBeInTheDocument();
  });

  it('should render with the correct test id', () => {
    render(<AdHocBaseFiltersEditor controller={createMockController()} />);
    expect(screen.getByTestId('data-testid ad-hoc filters variable base filters')).toBeInTheDocument();
  });

  it('should render the field label', () => {
    render(<AdHocBaseFiltersEditor controller={createMockController()} />);
    expect(screen.getByText('Base filters')).toBeInTheDocument();
  });
});
