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
  const { editable, nonEditable } = useMemo(() => partitionVariablesByEditability(variables), [variables]);
  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(editable), [editable]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;
      if (!destination) {
        return;
      }

      const isSameList = source.droppableId === destination.droppableId;
      if (isSameList && source.index === destination.index) {
        return;
      }

      const currentVariables = set.state.variables;
      const lists: Record<string, SceneVariable[]> = {
        'variables-visible': [...visible],
        'variables-controls-menu': [...controlsMenu],
        'variables-hidden': [...hidden],
      };

      const sourceList = lists[source.droppableId];
      const destList = isSameList ? sourceList : lists[destination.droppableId];

      const [moved] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, moved);

      const oldHide = moved.state.hide ?? VariableHide.dontHide;
      const newHide = getTargetHide(destination.droppableId, oldHide);

      dashboardEditActions.edit({
        source: set,
        description: t(
          'dashboard-scene.variables-list.create-drag-end-handler.description.reorder-variables-list',
          'Reorder variables list'
        ),
        perform: () => {
          if (newHide !== oldHide) {
            moved.setState({ hide: newHide });
          }
          set.setState({
            variables: [
              ...nonEditable,
              ...lists['variables-visible'],
              ...lists['variables-controls-menu'],
              ...lists['variables-hidden'],
            ],
          });
        },
        undo: () => {
          if (newHide !== oldHide) {
            moved.setState({ hide: oldHide });
          }
          set.setState({ variables: currentVariables });
        },
      });
    },
    [set, nonEditable, visible, controlsMenu, hidden]
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
      <DragDropContext onDragEnd={onDragEnd}>
        <VariablesSection
          title={t('dashboard-scene.variables-list.title-above-dashboard', 'Above dashboard')}
          variables={visible}
          droppableId="variables-visible"
          onClickVariable={onClickVariable}
        />
        <VariablesSection
          title={t('dashboard-scene.variables-list.title-controls-menu', 'Controls menu')}
          variables={controlsMenu}
          droppableId="variables-controls-menu"
          onClickVariable={onClickVariable}
        />
        <VariablesSection
          title={t('dashboard-scene.variables-list.title-hidden', 'Hidden')}
          variables={hidden}
          droppableId="variables-hidden"
          onClickVariable={onClickVariable}
        />
      </DragDropContext>
      <Box display="flex" paddingTop={1} paddingBottom={2}>
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
        <Text color="primary">
          {title} ({variables.length})
        </Text>
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

const DROPPABLE_TO_HIDE: Record<string, VariableHide> = {
  'variables-visible': VariableHide.dontHide,
  'variables-controls-menu': VariableHide.inControlsMenu,
  'variables-hidden': VariableHide.hideVariable,
};

function getTargetHide(droppableId: string, currentHide: VariableHide): VariableHide {
  if (droppableId === 'variables-visible') {
    return currentHide === VariableHide.dontHide || currentHide === VariableHide.hideLabel
      ? currentHide
      : VariableHide.dontHide;
  }
  return DROPPABLE_TO_HIDE[droppableId];
}

function partitionVariables<K extends string>(
  variables: SceneVariable[],
  getPartitionKey: (v: SceneVariable) => K | null
): Partial<Record<K, SceneVariable[]>> {
  const result: Partial<Record<K, SceneVariable[]>> = {};
  for (const v of variables) {
    const key = getPartitionKey(v);
    if (key !== null) {
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(v);
    }
  }
  return result;
}

export function partitionVariablesByEditability(variables: SceneVariable[]) {
  const { editable = [], nonEditable = [] } = partitionVariables(variables, (v) =>
    isEditableVariableType(v.state.type) ? 'editable' : 'nonEditable'
  );
  return { editable, nonEditable };
}

export function partitionVariablesByDisplay(variables: SceneVariable[]) {
  const {
    visible = [],
    controlsMenu = [],
    hidden = [],
  } = partitionVariables(variables, (v) => {
    if (!isEditableVariableType(v.state.type)) {
      return null;
    }

    switch (v.state.hide) {
      case VariableHide.hideVariable:
        return 'hidden';
      case VariableHide.inControlsMenu:
        return 'controlsMenu';
      default:
        return 'visible';
    }
  });
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
