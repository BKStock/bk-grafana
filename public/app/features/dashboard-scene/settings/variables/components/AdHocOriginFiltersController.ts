import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AdHocFiltersController, AdHocFilterWithLabels } from '@grafana/scenes';

export class AdHocOriginFiltersController implements AdHocFiltersController {
  constructor(
    private filters: AdHocFilterWithLabels[],
    private setFilters: (filters: AdHocFilterWithLabels[]) => void,
    private wip: AdHocFilterWithLabels | undefined,
    private setWip: (wip: AdHocFilterWithLabels | undefined) => void,
    private _getKeys: (currentKey: string | null) => Promise<Array<SelectableValue<string>>>,
    private _getValuesFor: (filter: AdHocFilterWithLabels) => Promise<Array<SelectableValue<string>>>,
    private _getOperators: () => Array<SelectableValue<string>>
  ) {}

  useState() {
    return {
      filters: this.filters,
      wip: this.wip,
      readOnly: false,
      allowCustomValue: true,
      supportsMultiValueOperators: true,
      inputPlaceholder: t(
        'dashboard-scene.adhoc-origin-filters-controller.input-placeholder',
        'Add a default filter...'
      ),
    };
  }

  getKeys(currentKey: string | null): Promise<Array<SelectableValue<string>>> {
    return this._getKeys(currentKey);
  }

  getValuesFor(filter: AdHocFilterWithLabels): Promise<Array<SelectableValue<string>>> {
    return this._getValuesFor(filter);
  }

  getOperators(): Array<SelectableValue<string>> {
    return this._getOperators();
  }

  updateFilter(filter: AdHocFilterWithLabels, update: Partial<AdHocFilterWithLabels>): void {
    if (filter === this.wip) {
      const merged = { ...this.wip, ...update };
      if ('value' in update && update.value !== '' && merged.key) {
        this.setFilters([...this.filters, { ...merged, origin: 'dashboard' }]);
        this.setWip(undefined);
      } else {
        this.setWip(merged);
      }
      return;
    }

    this.setFilters(this.filters.map((f) => (f === filter ? { ...f, ...update, origin: 'dashboard' } : f)));
  }

  updateToMatchAll(filter: AdHocFilterWithLabels): void {
    this.updateFilter(filter, { operator: '=~', value: '.*', matchAllFilter: true });
  }

  removeFilter(filter: AdHocFilterWithLabels): void {
    const updatedFilters = this.filters.filter((f) => f !== filter);
    this.setFilters(updatedFilters);
  }

  removeLastFilter(): void {
    if (this.filters.length > 0) {
      const updatedFilters = this.filters.slice(0, -1);
      this.setFilters(updatedFilters);
    }
  }

  handleComboboxBackspace(filter: AdHocFilterWithLabels): void {
    // TODO: verify this is correct
    const index = this.filters.indexOf(filter);
    if (index > 0) {
      this.setFilters(
        this.filters.map((f, i) => (i === index - 1 ? { ...f, forceEdit: true } : { ...f, forceEdit: false }))
      );
    }
  }

  addWip(): void {
    this.setWip({
      key: '',
      operator: '=',
      value: '',
      origin: 'dashboard',
    });
  }

  restoreOriginalFilter(filter: AdHocFilterWithLabels): void {
    // Not applicable
  }

  clearAll(): void {
    this.setFilters([]);
    this.setWip(undefined);
  }
}
