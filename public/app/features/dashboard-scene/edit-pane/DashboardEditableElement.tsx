import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { ReactNode, useCallback, useId, useMemo, useRef } from 'react';

import { GrafanaTheme2, VariableHide, type IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { SceneObject, SceneVariableSet, type SceneVariable, type SceneVariables } from '@grafana/scenes';
import { Box, Button, Icon, Input, Stack, Text, TextArea, Tooltip, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../scene/DashboardScene';
import { useLayoutCategory } from '../scene/layouts-shared/DashboardLayoutSelector';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';
import { openAddVariablePane } from '../settings/variables/VariableAddEditableElement';
import { isEditableVariableType } from '../settings/variables/utils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { dashboardEditActions } from './shared';

function useEditPaneOptions(
  this: DashboardEditableElement,
  dashboard: DashboardScene
): OptionsPaneCategoryDescriptor[] {
  const { body, $variables } = dashboard.useState();
  const dashboardTitleInputId = useId();
  const dashboardDescriptionInputId = useId();

  const dashboardOptions = useMemo(() => {
    const editPaneHeaderOptions = new OptionsPaneCategoryDescriptor({ title: '', id: 'dashboard-options' })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.options.title-option', 'Title'),
          id: dashboardTitleInputId,
          render: () => <DashboardTitleInput id={dashboardTitleInputId} dashboard={dashboard} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.options.description', 'Description'),
          id: dashboardDescriptionInputId,
          render: () => <DashboardDescriptionInput id={dashboardDescriptionInputId} dashboard={dashboard} />,
        })
      );

    return editPaneHeaderOptions;
  }, [dashboard, dashboardDescriptionInputId, dashboardTitleInputId]);

  const layoutCategory = useLayoutCategory(body);
  const variablesCategory = useVariablesCategory($variables);

  return [dashboardOptions, ...layoutCategory, ...variablesCategory];
}

export class DashboardEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dashboard: DashboardScene) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
      icon: 'apps',
      instanceName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
    };
  }

  public getOutlineChildren(isEditing: boolean): SceneObject[] {
    const { $variables, body } = this.dashboard.state;
    if (!isEditing || !$variables) {
      return body.getOutlineChildren();
    }
    return [$variables, dashboardSceneGraph.getDataLayers(this.dashboard), ...body.getOutlineChildren()];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dashboard);

  public renderActions(): ReactNode {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => this.dashboard.onOpenSettings()}
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
        icon="sliders-v-alt"
        iconPlacement="right"
      >
        <Trans i18nKey="dashboard.actions.open-settings">Settings</Trans>
      </Button>
    );
  }
}

export function DashboardTitleInput({ dashboard, id }: { dashboard: DashboardScene; id?: string }) {
  const { title } = dashboard.useState();

  // We want to save the unchanged value for the 'undo' action
  const valueBeforeEdit = useRef('');

  return (
    <Input
      id={id}
      value={title}
      onChange={(e) => {
        dashboard.setState({ title: e.currentTarget.value });
      }}
      onFocus={(e) => {
        valueBeforeEdit.current = e.currentTarget.value;
      }}
      onBlur={(e) => {
        const titleUnchanged = valueBeforeEdit.current === e.currentTarget.value;
        const shouldSkip = titleUnchanged;
        if (shouldSkip) {
          return;
        }

        dashboardEditActions.changeTitle({
          source: dashboard,
          oldValue: valueBeforeEdit.current,
          newValue: e.currentTarget.value,
        });
      }}
    />
  );
}

export function DashboardDescriptionInput({ dashboard, id }: { dashboard: DashboardScene; id?: string }) {
  const { description } = dashboard.useState();

  // We want to save the unchanged value for the 'undo' action
  const valueBeforeEdit = useRef('');

  return (
    <TextArea
      id={id}
      value={description}
      onChange={(e) => dashboard.setState({ description: e.currentTarget.value })}
      onFocus={(e) => {
        valueBeforeEdit.current = e.currentTarget.value;
      }}
      onBlur={(e) => {
        const descriptionUnchanged = valueBeforeEdit.current === e.currentTarget.value;
        const shouldSkip = descriptionUnchanged;
        if (shouldSkip) {
          return;
        }

        dashboardEditActions.changeDescription({
          source: dashboard,
          oldValue: valueBeforeEdit.current,
          newValue: e.currentTarget.value,
        });
      }}
    />
  );
}

interface PartitionedVariables {
  visible: SceneVariable[];
  controlsMenu: SceneVariable[];
  hidden: SceneVariable[];
}

function partitionVariables(variables: SceneVariable[]): PartitionedVariables {
  const visible: SceneVariable[] = [];
  const controlsMenu: SceneVariable[] = [];
  const hidden: SceneVariable[] = [];

  for (const v of variables) {
    if (!isEditableVariableType(v.state.type)) {
      continue;
    }
    switch (v.state.hide) {
      case VariableHide.hideVariable:
        hidden.push(v);
        break;
      case VariableHide.inControlsMenu:
        controlsMenu.push(v);
        break;
      default:
        visible.push(v);
    }
  }

  return { visible, controlsMenu, hidden };
}

function useVariablesCategory(variableSet: SceneVariables | undefined): OptionsPaneCategoryDescriptor[] {
  const variableListId = useId();

  return useMemo(() => {
    if (!(variableSet instanceof SceneVariableSet) || !variableSet?.state.variables.length) {
      return [];
    }

    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-variables-category.category.title.variables', 'Variables'),
      id: 'dashboard-variables',
    });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: variableListId,
        skipField: true,
        render: () => <VariablesList set={variableSet} />,
      })
    );

    return [category];
  }, [variableSet, variableListId]);
}

function VariablesList({ set }: { set: SceneVariableSet }) {
  const { variables } = set.useState();

  const { editable, nonEditable } = useMemo(() => {
    const editable: SceneVariable[] = [];
    const nonEditable: SceneVariable[] = [];
    for (const v of variables) {
      (isEditableVariableType(v.state.type) ? editable : nonEditable).push(v);
    }
    return { editable, nonEditable };
  }, [variables]);

  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariables(editable), [editable]);

  const createDragEndHandler = useCallback(
    (sourceList: SceneVariable[], mergeLists: (updated: SceneVariable[]) => SceneVariable[]) => {
      return (result: DropResult) => {
        if (!result.destination || result.destination.index === result.source.index) {
          return;
        }

        const currentList = set.state.variables;

        dashboardEditActions.edit({
          source: set,
          description: t(
            'dashboard-scene.variables-list.create-drag-end-handler.description.reorder-variables-list',
            'Reorder variables list'
          ),
          perform: () => {
            const updated = [...sourceList];
            const [moved] = updated.splice(result.source.index, 1);
            updated.splice(result.destination!.index, 0, moved);
            set.setState({ variables: [...nonEditable, ...mergeLists(updated)] });
          },
          undo: () => {
            set.setState({ variables: currentList });
          },
        });
      };
    },
    [nonEditable, set]
  );

  const onVisibleDragEnd = useMemo(
    () => createDragEndHandler(visible, (updated) => [...updated, ...controlsMenu, ...hidden]),
    [createDragEndHandler, visible, controlsMenu, hidden]
  );

  const onControlsDragEnd = useMemo(
    () => createDragEndHandler(controlsMenu, (updated) => [...visible, ...updated, ...hidden]),
    [createDragEndHandler, visible, controlsMenu, hidden]
  );

  const onHiddenDragEnd = useMemo(
    () => createDragEndHandler(hidden, (updated) => [...visible, ...controlsMenu, ...updated]),
    [createDragEndHandler, visible, controlsMenu, hidden]
  );

  const onClickVariable = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable, variable.state.key!);
  }, []);
  const onAddVariable = useCallback(() => {
    openAddVariablePane(getDashboardSceneFor(set));
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [set]);

  return (
    <Stack direction="column" gap={1}>
      {visible.length > 0 && (
        <DragDropContext onDragEnd={onVisibleDragEnd}>
          <VariablesSection
            title={t('dashboard-scene.variables-list.title-above-dashboard', 'Above dashboard')}
            variables={visible}
            droppableId="variables-visible"
            onClickVariable={onClickVariable}
          />
        </DragDropContext>
      )}
      {controlsMenu.length > 0 && (
        <DragDropContext onDragEnd={onControlsDragEnd}>
          <VariablesSection
            title={t('dashboard-scene.variables-list.title-controls-menu', 'Controls menu')}
            variables={controlsMenu}
            droppableId="variables-controls-menu"
            onClickVariable={onClickVariable}
          />
        </DragDropContext>
      )}
      {hidden.length > 0 && (
        <DragDropContext onDragEnd={onHiddenDragEnd}>
          <VariablesSection
            title={t('dashboard-scene.variables-list.title-hidden', 'Hidden')}
            variables={hidden}
            droppableId="variables-hidden"
            onClickVariable={onClickVariable}
          />
        </DragDropContext>
      )}
      <Box display="flex" paddingTop={0} paddingBottom={2}>
        <Button
          fullWidth
          icon="plus"
          size="sm"
          variant="secondary"
          onClick={onAddVariable}
          data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
        >
          <Trans i18nKey="dashboard-scene.variables-list.add-variable">Add variable</Trans>
        </Button>
      </Box>
    </Stack>
  );
}

type VariablesSectionProps = {
  title: string;
  variables: SceneVariable[];
  droppableId: string;
  onClickVariable: (variable: SceneVariable) => void;
  icon?: IconName;
};

function VariablesSection({ title, variables, droppableId, onClickVariable, icon }: VariablesSectionProps) {
  const styles = useStyles2(getStyles);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <div className={styles.section}>
      <div className={styles.title}>
        {icon && <Icon name={icon} size="sm" className={styles.titleIcon} />}
        <Text color="primary">{title}</Text>
      </div>
      <Droppable droppableId={droppableId} direction="vertical">
        {(provided) => (
          <ul ref={provided.innerRef} {...provided.droppableProps} className={styles.list}>
            {variables.map((variable, index) => (
              <Draggable
                key={variable.state.key ?? variable.state.name}
                draggableId={variable.state.key ?? variable.state.name}
                index={index}
              >
                {(draggableProvided) => (
                  <li
                    ref={draggableProvided.innerRef}
                    {...draggableProvided.draggableProps}
                    className={styles.listItem}
                  >
                    <div {...draggableProvided.dragHandleProps} onPointerDown={onPointerDown}>
                      <Tooltip
                        content={t('dashboard-scene.variables-section.content-drag-to-reorder', 'Drag to reorder')}
                        placement="top"
                      >
                        <Icon name="draggabledots" size="md" className={styles.dragHandle} />
                      </Tooltip>
                    </div>
                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                    <span className={styles.variableName} onClick={() => onClickVariable(variable)}>
                      <Text color="primary">{variable.state.name}</Text>
                    </span>
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({
      marginLeft: theme.spacing(0.5),
    }),
    title: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      lineHeight: 1,
      marginBottom: theme.spacing(1),
    }),
    titleIcon: css({
      color: theme.colors.text.secondary,
    }),
    list: css({
      listStyle: 'none',
      margin: theme.spacing(0, 0, 1, 0.5),
      padding: 0,
    }),
    listItem: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      '&:hover span, &:hover svg': {
        color: theme.colors.text.link,
      },
    }),
    variableName: css({
      cursor: 'pointer',
    }),
    dragHandle: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:active': {
        cursor: 'grabbing',
      },
    }),
  };
}
