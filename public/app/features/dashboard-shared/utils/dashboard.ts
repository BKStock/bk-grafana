import { store } from '@grafana/data';

export const NEW_PANEL_TITLE = 'New panel';

type LastUsedDatasource =
  | {
      dashboardUid: string;
      datasourceUid: string;
    }
  | undefined;

export const PANEL_EDIT_LAST_USED_DATASOURCE = 'grafana.dashboards.panelEdit.lastUsedDatasource';

export function getLastUsedDatasourceFromStorage(dashboardUid: string): LastUsedDatasource {
  if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
    const lastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
    if (lastUsedDatasource?.dashboardUid === dashboardUid) {
      return lastUsedDatasource;
    }
  }
  return undefined;
}

export function updateDashboardUidLastUsedDatasource(dashUid: string) {
  if (!store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
    return;
  }
  const oldRegistryLastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
  const datasourceUid = oldRegistryLastUsedDatasource?.datasourceUid ?? '';
  updatePropsLastUsedDatasourceKey(dashUid, datasourceUid);
}

export function initLastUsedDatasourceKeyForDashboard(dashboardUid: string | undefined) {
  store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: '' });
}

export function setLastUsedDatasourceKeyForDashboard(dashUid: string, dsUid: string) {
  const lastUsedDatasource = getLastUsedDatasourceFromStorage(dashUid);
  if (!lastUsedDatasource) {
    updatePropsLastUsedDatasourceKey(dashUid, dsUid);
  } else {
    const dashboardUid = lastUsedDatasource?.dashboardUid ?? '';
    updatePropsLastUsedDatasourceKey(dashboardUid, dsUid);
  }
}

function updatePropsLastUsedDatasourceKey(dashboardUid: string | undefined, datasourceUid: string) {
  store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, { dashboardUid: dashboardUid, datasourceUid: datasourceUid });
}
