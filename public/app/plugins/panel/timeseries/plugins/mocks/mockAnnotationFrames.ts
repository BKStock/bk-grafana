import { DataFrame, DataTopic, FieldType } from '@grafana/data';

export const mockAnnotationFrame: DataFrame = {
  length: 4,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [1759388895560, 1759388995560, 1759389995560, 1759390200000],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: ['HG Launch (ops) 1', 'HG Launch (ops) 2', 'HG Launch (ops) 3', 'HG Launch (ops) 4'],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        'Launching HG Instance ops with hgrun version 1',
        'Launching HG Instance ops with hgrun version 2',
        'Launching HG Instance ops with hgrun version 3',
        'Launching HG Instance ops with hgrun version 4',
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [['tag1', 'tag2'], ['tag2', 'tag3'], [], []],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        null,
      ],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#8F3BB8', '#8F3BB8', '#8F3BB8', '#8F3BB8'],
    },
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: ['HG Launch 1', 'HG Launch 2', 'HG Launch 3', 'HG Launch 4'],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [false, false, false, false],
    },
    {
      name: 'avatarUrl',
      config: {},
      type: FieldType.string,
      values: [
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
      ],
    },
  ],
};
