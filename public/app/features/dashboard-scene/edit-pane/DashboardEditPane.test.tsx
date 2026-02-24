import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (uid: string) => ({}),
    };
  },
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardEditPane', () => {
  it('Handles edit action events that adds objects', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    expect(editPane.state.undoStack).toHaveLength(1);

    // Should select object
    expect(editPane.getSelection()).toBeDefined();

    editPane.undoAction();

    expect(editPane.state.undoStack).toHaveLength(0);

    // should clear selection
    expect(editPane.getSelection()).toBeUndefined();
  });

  it('when new action comes in clears redo stack', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    editPane.undoAction();

    expect(editPane.state.redoStack).toHaveLength(1);

    scene.onCreateNewPanel();

    expect(editPane.state.redoStack).toHaveLength(0);
  });

  it('clone should not include undo/redo history', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();
    scene.onCreateNewPanel();

    editPane.undoAction();

    expect(editPane.state.redoStack).toHaveLength(1);
    expect(editPane.state.undoStack).toHaveLength(1);

    const cloned = editPane.clone({});

    expect(cloned.state.redoStack).toHaveLength(0);
    expect(cloned.state.undoStack).toHaveLength(0);
  });

  it('Selecting a repeat clone should select the source panel', () => {
    const scene = buildTestSceneWithRepeat();
    const editPane = scene.state.editPane;
    editPane.enableSelection();

    const gridItem = ((scene.state.body as DefaultGridLayoutManager).state.grid as SceneGridLayout).state
      .children[0] as DashboardGridItem;

    const sourcePanel = gridItem.state.body;
    const clonePanel = gridItem.state.repeatedPanels![0];

    expect(clonePanel.state.repeatSourceKey).toBe(sourcePanel.state.key);

    editPane.state.selectionContext.onSelect({ id: clonePanel.state.key! }, {});

    expect(editPane.getSelection()).toBe(sourcePanel);
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
  });

  config.featureToggles.dashboardNewLayouts = true;

  activateFullSceneTree(scene);

  return scene;
}

function buildTestSceneWithRepeat() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    editable: true,
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
          name: 'server',
          query: 'A.*',
          value: ALL_VARIABLE_VALUE,
          text: ALL_VARIABLE_TEXT,
          isMulti: true,
          includeAll: true,
          delayMs: 0,
          optionsToReturn: [
            { label: 'A', value: '1' },
            { label: 'B', value: '2' },
          ],
        }),
      ],
    }),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({
            variableName: 'server',
            repeatedPanels: [],
            body: new VizPanel({
              title: 'Panel $server',
              pluginId: 'timeseries',
              key: 'panel-1',
            }),
            x: 0,
            y: 0,
          }),
        ],
      }),
    }),
  });

  config.featureToggles.dashboardNewLayouts = true;

  activateFullSceneTree(scene);

  return scene;
}
