import { useCallback, useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import type { DashboardLink } from '@grafana/schema';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';

import { DashboardLinkForm } from './DashboardLinkForm';
import { NEW_LINK } from './utils';

export function openAddLinkPane(dashboard: DashboardScene) {
  const element = new LinkAdd({ dashboardRef: dashboard.getRef(), link: { ...NEW_LINK } });
  dashboard.state.editPane.selectObject(element, element.state.key!, { force: true, multi: false });
}

export function openLinkEditPane(dashboard: DashboardScene, linkIndex: number) {
  const element = new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex });
  dashboard.state.editPane.selectObject(element, element.state.key!, { force: true, multi: false });
}

export interface LinkAddState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  link: DashboardLink;
}

export class LinkAdd extends SceneObjectBase<LinkAddState> {}

export interface LinkEditState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  linkIndex: number;
}

export class LinkEdit extends SceneObjectBase<LinkEditState> {}

function useEditPaneOptions(this: LinkAddEditableElement, linkAdd: LinkAdd): OptionsPaneCategoryDescriptor[] {
  const id = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'link-add' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id,
        skipField: true,
        render: () => <LinkAddForm linkAdd={linkAdd} />,
      })
    );
  }, [linkAdd, id]);

  return [options];
}

export class LinkAddEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Link';

  public constructor(private linkAdd: LinkAdd) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard-scene.add-link.label-link', 'Link'),
      icon: 'external-link-alt',
      instanceName: t('dashboard-scene.add-link.inline-instance-name', 'New link'),
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.linkAdd);
}

function LinkAddForm({ linkAdd }: { linkAdd: LinkAdd }) {
  const dashboard = linkAdd.state.dashboardRef.resolve();
  const editPane = dashboard.state.editPane;
  const { link } = linkAdd.useState();

  const onUpdate = useCallback(
    (updated: DashboardLink) => {
      linkAdd.setState({ link: updated });
    },
    [linkAdd]
  );

  const onCancel = useCallback(() => {
    editPane.selectObject(dashboard, dashboard.state.key!);
  }, [editPane, dashboard]);

  const onAdd = useCallback(() => {
    const currentLinks = dashboard.state.links ?? [];
    const newLinks = [...currentLinks, { ...link }];

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.add', 'Add {{typeName}}', {
        typeName: t('dashboard-scene.add-link.label-link', 'Link'),
      }),
      source: dashboard,
      perform: () => {
        dashboard.setState({ links: newLinks });
      },
      undo: () => {
        dashboard.setState({ links: currentLinks });
      },
    });

    DashboardInteractions.addLinkButtonClicked({ source: 'edit_pane' });
    editPane.selectObject(dashboard, dashboard.state.key!);
  }, [dashboard, link, editPane]);

  return <DashboardLinkForm link={link} onUpdate={onUpdate} onGoBack={onCancel} onAdd={onAdd} />;
}

function useEditPaneOptionsLinkEdit(
  this: LinkEditEditableElement,
  linkEdit: LinkEdit
): OptionsPaneCategoryDescriptor[] {
  const id = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'link-edit' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id,
        skipField: true,
        render: () => <LinkEditForm linkEdit={linkEdit} />,
      })
    );
  }, [linkEdit, id]);

  return [options];
}

export class LinkEditEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Link';

  public constructor(private linkEdit: LinkEdit) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const dashboard = this.linkEdit.state.dashboardRef.resolve();
    const links = dashboard.state.links ?? [];
    const link = links[this.linkEdit.state.linkIndex];
    const instanceName = link?.title ?? t('dashboard-scene.add-link.inline-instance-name', 'New link');
    return {
      typeName: t('dashboard-scene.add-link.label-link', 'Link'),
      icon: 'external-link-alt',
      instanceName,
    };
  }

  public useEditPaneOptions = useEditPaneOptionsLinkEdit.bind(this, this.linkEdit);

  public onDelete(): void {
    const dashboard = this.linkEdit.state.dashboardRef.resolve();
    const editPane = dashboard.state.editPane;
    const linkIndex = this.linkEdit.state.linkIndex;
    const currentLinks = dashboard.state.links ?? [];

    if (linkIndex < 0 || linkIndex >= currentLinks.length) {
      editPane.selectObject(dashboard, dashboard.state.key!);
      return;
    }

    const newLinks = [...currentLinks.slice(0, linkIndex), ...currentLinks.slice(linkIndex + 1)];

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.remove', 'Remove {{typeName}}', {
        typeName: t('dashboard-scene.add-link.label-link', 'Link'),
      }),
      source: dashboard,
      perform: () => {
        dashboard.setState({ links: newLinks });
        editPane.selectObject(dashboard, dashboard.state.key!);
      },
      undo: () => {
        dashboard.setState({ links: currentLinks });
      },
    });
  }
}

function LinkEditForm({ linkEdit }: { linkEdit: LinkEdit }) {
  const dashboard = linkEdit.state.dashboardRef.resolve();
  const editPane = dashboard.state.editPane;
  const { linkIndex } = linkEdit.useState();
  const { links: linksFromDashboard } = dashboard.useState();
  const links = useMemo(() => linksFromDashboard ?? [], [linksFromDashboard]);
  const link = links[linkIndex];

  const onUpdate = useCallback(
    (updated: DashboardLink) => {
      const newLinks = [...links];
      if (linkIndex >= 0 && linkIndex < newLinks.length) {
        newLinks[linkIndex] = updated;
        dashboard.setState({ links: newLinks });
      }
    },
    [dashboard, links, linkIndex]
  );

  const onGoBack = useCallback(() => {
    editPane.selectObject(dashboard, dashboard.state.key!);
  }, [editPane, dashboard]);

  if (link == null) {
    return null;
  }

  return <DashboardLinkForm link={link} onUpdate={onUpdate} onGoBack={onGoBack} />;
}
