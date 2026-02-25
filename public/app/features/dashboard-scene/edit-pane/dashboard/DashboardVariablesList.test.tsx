import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableHide } from '@grafana/data';
import { ConstantVariable, SceneVariableSet, type SceneVariable } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { SnapshotVariable } from '../../serialization/custom-variables/SnapshotVariable';
import { openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { partitionVariablesByDisplay, VariablesList } from './DashboardVariablesList';

jest.mock('../../settings/variables/VariableAddEditableElement', () => ({
  openAddVariablePane: jest.fn(),
}));

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    addVariableButtonClicked: jest.fn(),
  },
}));

function renderVariablesList(variables: SceneVariable[] = []) {
  const variableSet = new SceneVariableSet({ variables });
  const dashboardScene = new DashboardScene({
    $variables: variableSet,
    isEditing: true,
  });
  activateFullSceneTree(dashboardScene);
  jest.spyOn(dashboardScene.state.editPane, 'selectObject');

  const renderResult = render(<VariablesList set={variableSet} />);

  return {
    ...renderResult,
    elements: {
      dashboardScene,
      addVariableButton: () => renderResult.getByRole('button', { name: /add variable/i }),
    },
  };
}

function buildTestVariables() {
  return {
    visibleVar1: new ConstantVariable({ name: 'visibleVar1', hide: VariableHide.dontHide }),
    visibleVar2: new ConstantVariable({ name: 'visibleVar2', hide: VariableHide.hideLabel }),
    controlsMenuVar1: new ConstantVariable({ name: 'controlsMenuVar1', hide: VariableHide.inControlsMenu }),
    hiddenVar1: new ConstantVariable({ name: 'hiddenVar1', hide: VariableHide.hideVariable }),
    snapshotVar1: new SnapshotVariable({ name: 'snapshotVar1' }),
  };
}

describe('<DashboardVariablesList />', () => {
  test('renders 3 sections (one per variable display type) and an "Add variable" button', () => {
    const { visibleVar1, visibleVar2, controlsMenuVar1, hiddenVar1 } = buildTestVariables();
    const { getByText, getByTestId, elements } = renderVariablesList([
      hiddenVar1,
      controlsMenuVar1,
      visibleVar2,
      visibleVar1,
    ]);

    expect(getByText('Above dashboard')).toBeInTheDocument();
    const aboveList = getByTestId('variables-visible');
    const aboveItems = Array.from(aboveList.querySelectorAll('li')).map((item) => item.textContent);
    expect(aboveItems).toEqual(['visibleVar2', 'visibleVar1']); // order is preserved

    expect(getByText('Controls menu')).toBeInTheDocument();
    const controlsMenuList = getByTestId('variables-controls-menu');
    const controlsMenuItems = Array.from(controlsMenuList.querySelectorAll('li')).map((item) => item.textContent);
    expect(controlsMenuItems).toEqual(['controlsMenuVar1']);

    expect(getByText('Hidden')).toBeInTheDocument();
    const hiddenMenuList = getByTestId('variables-hidden');
    const hiddenMenuItems = Array.from(hiddenMenuList.querySelectorAll('li')).map((item) => item.textContent);
    expect(hiddenMenuItems).toEqual(['hiddenVar1']);

    expect(elements.addVariableButton()).toBeInTheDocument();
  });

  test('renders sections that have variables', () => {
    const { hiddenVar1 } = buildTestVariables();
    const { queryByText, getByText } = renderVariablesList([hiddenVar1]);

    expect(queryByText('Above dashboard')).not.toBeInTheDocument();
    expect(queryByText('Controls menu')).not.toBeInTheDocument();
    expect(getByText('Hidden')).toBeInTheDocument();
  });

  test('always renders an "Add variable" button', () => {
    const { elements } = renderVariablesList();

    expect(elements.addVariableButton()).toBeInTheDocument();
  });

  describe('User interactions', () => {
    describe('when a variable name is clicked', () => {
      test('selects the variable in the pane', async () => {
        const user = userEvent.setup();
        const { visibleVar1 } = buildTestVariables();
        const { getByText, elements } = renderVariablesList([visibleVar1]);

        await user.click(getByText(visibleVar1.state.name));

        expect(elements.dashboardScene.state.editPane.selectObject).toHaveBeenCalledWith(
          visibleVar1,
          visibleVar1.state.key
        );
      });
    });

    describe('when the "Add variable" button is clicked', () => {
      test('opens the add variable pane', async () => {
        const user = userEvent.setup();
        const { elements } = renderVariablesList([]);

        await user.click(elements.addVariableButton());

        expect(openAddVariablePane).toHaveBeenCalled();
      });

      test('calls DashboardInteractions.addVariableButtonClicked ', async () => {
        const user = userEvent.setup();
        const { elements } = renderVariablesList([]);

        await user.click(elements.addVariableButton());

        expect(DashboardInteractions.addVariableButtonClicked).toHaveBeenCalledWith({ source: 'edit_pane' });
      });
    });

    describe('drag and drop', () => {
      async function dragItem(
        container: HTMLElement,
        findByText: (text: RegExp) => Promise<HTMLElement>,
        itemIndex: number,
        direction: 'up' | 'down',
        positions = 1
      ) {
        const dragHandles = container.querySelectorAll('[data-rfd-drag-handle-draggable-id]');
        const handle = dragHandles[itemIndex] as HTMLElement;
        handle.focus();
        expect(handle).toHaveFocus();

        // press space to start dragging
        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have lifted an item/i); // @hello-pangea/dnd announces each phase via aria-live; awaiting it ensures the library has processed the event

        // press arrow down/up to drag
        const arrowKey = direction === 'down' ? 40 : 38;
        for (let i = 0; i < positions; i++) {
          fireEvent.keyDown(handle, { keyCode: arrowKey });
          await findByText(/you have moved the item/i);
        }

        // press space to drop
        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have dropped the item/i);
      }

      test('reorders visible variables when dragged down by one position', async () => {
        const { visibleVar1, visibleVar2, controlsMenuVar1 } = buildTestVariables();
        const { container, findByText, getByTestId } = renderVariablesList([
          visibleVar1,
          visibleVar2,
          controlsMenuVar1,
        ]);

        await dragItem(container, findByText, 0, 'down');

        const aboveList = getByTestId('variables-visible');
        const items = Array.from(aboveList.querySelectorAll('li')).map((li) => li.textContent);
        expect(items).toEqual(['visibleVar2', 'visibleVar1']);
      });
    });
  });
});

describe('partitionVariablesByDisplay(', () => {
  test('partitions variables into 3 separate lists: visible, controlsMenu and hidden, while preserving order', () => {
    const { visibleVar1, visibleVar2, controlsMenuVar1, hiddenVar1 } = buildTestVariables();
    const variables = [hiddenVar1, controlsMenuVar1, visibleVar2, visibleVar1];

    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay(variables);

    expect(visible.length).toBe(2);
    expect(visible[0]).toBe(visibleVar2);
    expect(visible[1]).toBe(visibleVar1);

    expect(controlsMenu.length).toBe(1);
    expect(controlsMenu[0]).toBe(controlsMenuVar1);

    expect(hidden.length).toBe(1);
    expect(hidden[0]).toBe(hiddenVar1);
  });

  test('returns empty lists when given no variables', () => {
    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay([]);

    expect(visible).toEqual([]);
    expect(controlsMenu).toEqual([]);
    expect(hidden).toEqual([]);
  });

  test('excludes non-editable variable types', () => {
    const { visibleVar1: editableVar, snapshotVar1: nonEditableVar } = buildTestVariables();

    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay([nonEditableVar, editableVar]);

    expect(visible.length).toBe(1);
    expect(visible[0]).toBe(editableVar);
    expect(controlsMenu).toEqual([]);
    expect(hidden).toEqual([]);
  });
});
