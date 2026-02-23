import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider, ds1SettingsMock } from '../testUtils';
import { Transformation } from '../types';

import { QueryCard } from './QueryCard';
import { SidebarCard } from './SidebarCard';
import { TransformationCard } from './TransformationCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

interface RenderSidebarCardProps {
  id?: string;
  isSelected?: boolean;
  onClick?: jest.Mock;
}

function renderSidebarCard({
  id = 'A',
  isSelected = false,
  onClick = jest.fn(),
}: RenderSidebarCardProps = {}) {
  const queries: DataQuery[] = [{ refId: id, datasource: { type: 'test', uid: 'test' } }];
  const item = {
    name: id,
    type: QueryEditorType.Query,
    isHidden: false,
  };

  const result = renderWithQueryEditorProvider(
    <SidebarCard
      isSelected={isSelected}
      id={id}
      onClick={onClick}
      onDelete={jest.fn()}
      onToggleHide={jest.fn()}
      onDuplicate={jest.fn()}
      item={item}
    >
      <span>Card content</span>
    </SidebarCard>,
    {
      queries,
      selectedQuery: queries[0],
    }
  );

  return { ...result, onClick };
}

describe('SidebarCard', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('should select query card and deselect transformation when clicking query card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const user = userEvent.setup();

    renderWithQueryEditorProvider(<QueryCard query={query} />, {
      queries: [query],
      transformations: [transformation],
      selectedTransformation: transformation,
      uiStateOverrides: { setSelectedQuery, setSelectedTransformation },
    });

    const queryCard = screen.getByRole('button', { name: /select card A/i });
    await user.click(queryCard);

    expect(setSelectedQuery).toHaveBeenCalledWith(query);
    expect(setSelectedTransformation).not.toHaveBeenCalled();
  });

  it('should select transformation card and deselect query when clicking transformation card', async () => {
    const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
    const transformation: Transformation = {
      transformId: 'organize',
      registryItem: undefined,
      transformConfig: { id: 'organize', options: {} },
    };

    const setSelectedQuery = jest.fn();
    const setSelectedTransformation = jest.fn();

    const user = userEvent.setup();

    renderWithQueryEditorProvider(<TransformationCard transformation={transformation} />, {
      queries: [query],
      transformations: [transformation],
      selectedQuery: query,
      uiStateOverrides: { setSelectedQuery, setSelectedTransformation },
    });

    const transformCard = screen.getByRole('button', { name: /select card organize/i });
    await user.click(transformCard);

    expect(setSelectedTransformation).toHaveBeenCalledWith(transformation);
    expect(setSelectedQuery).not.toHaveBeenCalled();
  });

  it('renders the card content', () => {
    renderSidebarCard();

    expect(screen.getByRole('button', { name: /select card A/i })).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });
});
