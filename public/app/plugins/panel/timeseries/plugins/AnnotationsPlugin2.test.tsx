import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import uPlot from 'uplot';

import { ScopedVars } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
import { TimeRange2 } from '@grafana/ui/internal';

import { AnnotationsPlugin2 } from './AnnotationsPlugin2';
import { mockAnnotationFrame } from './mocks/mockAnnotationFrames';

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  // @ts-ignore
  createPortal: (node) => {
    return node;
  },
}));
jest.mock('uplot', () => {
  const setDataMock = jest.fn();
  const setSizeMock = jest.fn();
  const initializeMock = jest.fn();
  const destroyMock = jest.fn();
  const rootElement = jest.fn();
  const valToPos = jest.fn();
  const redraw = jest.fn();
  return jest.fn().mockImplementation(() => {
    return {
      setData: setDataMock,
      setSize: setSizeMock,
      initialize: initializeMock,
      destroy: destroyMock,
      valToPos,
      redraw,
      rect: {
        width: 600,
      },
      root: {
        querySelector: jest.fn().mockImplementation(() => rootElement),
      },
    };
  });
});

const uplotMock = jest.requireMock('uplot');
const uplotMockInstance = uplotMock();
uplotMockInstance.setData.mockImplementationOnce(() => {});

describe('AnnotationsPlugin2', () => {
  let hooks: Record<string, (u: uPlot) => {}> = {};
  let config: UPlotConfigBuilder;
  const setUp = (props?: React.ComponentProps<typeof AnnotationsPlugin2>) => {
    function applyReady() {
      act(() => {
        //@ts-ignore
        hooks.ready(new uPlot());
      });
    }

    const result = render(
      <AnnotationsPlugin2
        annotations={[mockAnnotationFrame]}
        annotationsOptions={{}}
        config={config}
        timeZone={'browser'}
        newRange={{ from: 1759388895560, to: 1759390200000 }}
        setNewRange={function (newRage: TimeRange2 | null): void {
          throw new Error('Function not implemented.');
        }}
        replaceVariables={function (value: string, scopedVars?: ScopedVars, format?: string | Function): string {
          throw new Error('Function not implemented.');
        }}
        {...props}
      />
    );

    applyReady();
    return result;
  };

  beforeEach(() => {
    //@todo remove
    jest.spyOn(console, 'log').mockImplementation();
    hooks = {};
    config = {
      addHook: jest.fn((type, hook) => {
        hooks[type] = hook;
      }),
    } as unknown as UPlotConfigBuilder;
  });

  it('should render', async () => {
    setUp();
    await waitFor(() => expect(screen.queryAllByTestId('data-testid annotation-marker').length).toEqual(4));
  });

  it.todo('should display avatar');
  it.todo('alerts');

  describe('edit', () => {});
  describe('delete', () => {});

  describe('fields', () => {
    it.todo('time');
    it.todo('timeEnd');
    it.todo('isRegion');
    it.todo('color');
    it.todo('title');
    it.todo('id');

    describe('text', () => {
      it.todo('links');
    });

    it.todo('type');
    it.todo('tags');
    it.todo('source');
    it.todo('clusterIdx');
    it.todo('links');
  });

  describe('overrides', () => {
    it.todo('links');
    it.todo('actions');
  });
});
