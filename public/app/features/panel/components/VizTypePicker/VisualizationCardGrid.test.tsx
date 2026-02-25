import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  FieldType,
  LoadingState,
  PanelData,
  PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';

import { VisualizationCardGrid } from './VisualizationCardGrid';

jest.mock('./VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: ({
    onClick,
    suggestion,
  }: {
    onClick: () => void;
    suggestion: PanelPluginVisualizationSuggestion;
  }) => (
    <div data-testid={`card-${suggestion.hash}`} onClick={onClick}>
      {suggestion.name}
    </div>
  ),
}));

describe('VisualizationCardGrid', () => {
  const mockData: PanelData = {
    series: [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ],
    state: LoadingState.Done,
    timeRange: getDefaultTimeRange(),
    structureRev: 1,
  };

  const mockItems = [
    {
      pluginId: 'timeseries',
      name: 'Time series',
      hash: 'timeseries-hash',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    },
    {
      pluginId: 'table',
      name: 'Table',
      hash: 'table-hash',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    },
  ];

  it('should render cards for items', () => {
    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        onItemClick={jest.fn()}
        getItemKey={(item) => item.hash}
      />
    );

    expect(screen.getByTestId('card-timeseries-hash')).toBeInTheDocument();
    expect(screen.getByTestId('card-table-hash')).toBeInTheDocument();
  });

  it('should call onItemClick when card is clicked', async () => {
    const mockOnItemClick = jest.fn();
    const user = userEvent.setup();

    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        onItemClick={mockOnItemClick}
        getItemKey={(item) => item.hash}
      />
    );

    await user.click(screen.getByTestId('card-timeseries-hash'));
    expect(mockOnItemClick).toHaveBeenCalledWith(mockItems[0], 0);
  });
});
