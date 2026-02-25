import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2, VariableHide, type IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneVariableSet, type SceneVariable } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { isEditableVariableType } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { dashboardEditActions } from '../shared';

export function VariablesList({ set }: { set: SceneVariableSet }) {
  const { variables } = set.useState();

  const { editable, nonEditable } = useMemo(() => {
    const editable: SceneVariable[] = [];
    const nonEditable: SceneVariable[] = [];
    for (const v of variables) {
      (isEditableVariableType(v.state.type) ? editable : nonEditable).push(v);
    }
    return { editable, nonEditable };
  }, [variables]);

  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(editable), [editable]);

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

function VariablesSection({
  title,
  variables,
  droppableId,
  onClickVariable,
  icon,
}: {
  title: string;
  variables: SceneVariable[];
  droppableId: string;
  onClickVariable: (variable: SceneVariable) => void;
  icon?: IconName;
}) {
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
          <ul ref={provided.innerRef} {...provided.droppableProps} className={styles.list} data-testid={droppableId}>
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

export function partitionVariablesByDisplay(variables: SceneVariable[]): {
  visible: SceneVariable[];
  controlsMenu: SceneVariable[];
  hidden: SceneVariable[];
} {
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
