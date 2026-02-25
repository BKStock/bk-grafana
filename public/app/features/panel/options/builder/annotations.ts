import { DataTopic, PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @public
 */

export function addAnnotationOptions<T>(builder: PanelOptionsEditorBuilder<T>) {
  const category = [t('grafana-ui.builder.annotations', 'Annotations')];

  builder.addBooleanSwitch({
    path: 'annotations.multiLane',
    category,
    name: t('grafana-ui.builder.annotations.multi-lane-name', 'Enable multi-lane annotations'),
    description: t(
      'grafana-ui.builder.annotations.multi-lane-desc',
      'Breaks each annotation frame into a separate row in the visualization'
    ),
    defaultValue: false,
    showIf: (_, __, annotations) => annotations?.some((df) => df.meta?.dataTopic === DataTopic.Annotations),
  });

  builder.addBooleanSwitch({
    path: 'annotations.clustering',
    category,
    name: t('grafana-ui.builder.annotations.clustering.name', 'Enable annotation clustering'),
    description: t(
      'grafana-ui.builder.annotations.clustering.desc',
      'Combines high density point annotations into region annotations'
    ),
    defaultValue: false,
    showIf: (_, __, annotations) => annotations?.some((df) => df.meta?.dataTopic === DataTopic.Annotations),
  });
}
