import { css } from '@emotion/css';

import { GrafanaTheme2, NavModel, NavModelItem, PageLayoutType, arrayUtils } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Icon, Stack, TagList, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { DashboardLinkForm } from '../settings/links/DashboardLinkForm';
import { DashboardLinkList } from '../settings/links/DashboardLinkList';
import { NEW_LINK, isLinkEditable } from '../settings/links/utils';
import { getDashboardSceneFor } from '../utils/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { ProvisionedControlsSection, SourceIcon } from './ProvisionedControlsSection';
import { DashboardEditView, DashboardEditListViewState, useDashboardEditPageNav } from './utils';

export interface DashboardLinksEditViewState extends DashboardEditListViewState {}

export class DashboardLinksEditView extends SceneObjectBase<DashboardLinksEditViewState> implements DashboardEditView {
  static Component = DashboardLinksEditViewRenderer;

  protected _urlSync = new EditListViewSceneUrlSync(this);

  public getUrlKey(): string {
    return 'links';
  }

  private get dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  private get links(): DashboardLink[] {
    return this.dashboard.state.links;
  }

  private set links(links: DashboardLink[]) {
    this.dashboard.setState({ links });
  }

  public onNewLink = () => {
    this.links = [...this.links, NEW_LINK];
    this.setState({ editIndex: this.links.length - 1 });
  };

  public onDelete = (editableIndex: number) => {
    const index = this.convertEditableIndexToIndex(editableIndex);
    if (index === -1) {
      return;
    }
    this.links = [...this.links.slice(0, index), ...this.links.slice(index + 1)];
    this.setState({ editIndex: undefined });
  };

  public onDuplicate = (link: DashboardLink) => {
    this.links = [...this.links, { ...link }];
  };

  public onOrderChange = (editableIndex: number, direction: number) => {
    const index = this.convertEditableIndexToIndex(editableIndex);
    const targetIndex = this.convertEditableIndexToIndex(editableIndex + direction);
    if (index === -1 || targetIndex === -1) {
      return;
    }
    this.links = arrayUtils.moveItemImmutably(this.links, index, targetIndex);
  };

  public onEdit = (editIndex: number) => {
    this.setState({ editIndex });
  };

  public onUpdateLink = (link: DashboardLink) => {
    const editableIndex = this.state.editIndex;
    if (editableIndex === undefined) {
      return;
    }
    const index = this.convertEditableIndexToIndex(editableIndex);
    if (index === -1) {
      return;
    }
    this.links = [...this.links.slice(0, index), link, ...this.links.slice(index + 1)];
  };

  private convertEditableIndexToIndex(editableIndex: number): number {
    const links = this.links;
    let count = 0;
    for (let i = 0; i < links.length; i++) {
      if (isLinkEditable(links[i])) {
        if (count === editableIndex) {
          return i;
        }
        count++;
      }
    }
    return -1;
  }

  public onGoBack = () => {
    this.setState({ editIndex: undefined });
  };
}

function DashboardLinksEditViewRenderer({ model }: SceneComponentProps<DashboardLinksEditView>) {
  const { editIndex } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const { links } = dashboard.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const defaultLinks = links.filter((link) => !isLinkEditable(link));
  const editableLinks = links.filter(isLinkEditable);
  const linkToEdit = editIndex !== undefined ? editableLinks[editIndex] : undefined;

  if (linkToEdit) {
    return (
      <EditLinkView
        pageNav={pageNav}
        navModel={navModel}
        link={linkToEdit}
        dashboard={dashboard}
        onChange={model.onUpdateLink}
        onGoBack={model.onGoBack}
      />
    );
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <DashboardLinkList
        links={editableLinks}
        hasProvisionedLinks={defaultLinks.length > 0}
        onNew={model.onNewLink}
        onEdit={model.onEdit}
        onDelete={model.onDelete}
        onDuplicate={model.onDuplicate}
        onOrderChange={model.onOrderChange}
      />
      {defaultLinks.length > 0 && <ProvisionedLinksSection links={defaultLinks} />}
    </Page>
  );
}

const LINK_COLUMNS = [
  { i18nKey: 'dashboard-scene.dashboard-link-list.type', defaultText: 'Type' },
  { i18nKey: 'dashboard-scene.dashboard-link-list.info', defaultText: 'Info' },
];

function ProvisionedLinksSection({ links }: { links: DashboardLink[] }) {
  const styles = useStyles2(getProvisionedLinkStyles);

  return (
    <ProvisionedControlsSection columns={LINK_COLUMNS}>
      {links.map((link, index) => (
        <tr key={`${link.title}-${index}`}>
          <td role="gridcell">
            <Icon name="external-link-alt" /> &nbsp; {link.type}
          </td>
          <td role="gridcell">
            <Stack>
              {link.title && <span className={styles.titleWrapper}>{link.title}</span>}
              {link.type === 'link' && <span className={styles.urlWrapper}>{link.url}</span>}
              {link.type === 'dashboards' && <TagList tags={link.tags ?? []} />}
            </Stack>
          </td>
          <td role="gridcell" className={styles.sourceCell}>
            <SourceIcon origin={link.origin} />
          </td>
        </tr>
      ))}
    </ProvisionedControlsSection>
  );
}

const getProvisionedLinkStyles = (theme: GrafanaTheme2) => ({
  titleWrapper: css({
    width: '20vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  urlWrapper: css({
    width: '40vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  sourceCell: css({
    width: '1%',
    textAlign: 'center' as const,
  }),
});

interface EditLinkViewProps {
  link?: DashboardLink;
  pageNav: NavModelItem;
  navModel: NavModel;
  dashboard: DashboardScene;
  onChange: (link: DashboardLink) => void;
  onGoBack: () => void;
}

function EditLinkView({ pageNav, link, navModel, dashboard, onChange, onGoBack }: EditLinkViewProps) {
  const editLinkPageNav = {
    text: t('dashboard-scene.edit-link-view.edit-link-page-nav.text.edit-link', 'Edit link'),
    parentItem: pageNav,
  };

  return (
    <Page navModel={navModel} pageNav={editLinkPageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <DashboardLinkForm link={link!} onUpdate={onChange} onGoBack={onGoBack} />
    </Page>
  );
}
