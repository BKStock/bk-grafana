import { useEffect, useMemo, useRef, useState } from 'react';

import { AITextInput } from '@grafana/assistant';
import { DataQuery, DataSourceRef, LoadingState, PanelData, getPanelDataSummary } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dashboard, Panel } from '@grafana/schema';
import { Input } from '@grafana/ui';

import { buildTitleInputSystemPrompt, getPanelFingerprint } from './assistantContext';
import { useIsAssistantAvailable } from './hooks';

export interface GenAITextInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  panel: Panel;
  dashboard: Dashboard;
  data?: PanelData;
  autoGenerate?: boolean;
  id?: string;
  'data-testid'?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Used for reactive regeneration when panel semantics change */
  pluginId?: string;
  datasource?: DataSourceRef;
  queries?: DataQuery[];
}

/**
 * A text input that uses the Grafana Assistant for AI generation when available,
 * falling back to a plain Input otherwise.
 * When pluginId/datasource/queries are provided, reactively regenerates on meaningful changes.
 */
export function GenAITextInput({
  value,
  onChange,
  onComplete,
  onBlur,
  onFocus,
  panel,
  dashboard,
  data,
  autoGenerate = false,
  id,
  'data-testid': dataTestId,
  inputRef,
  pluginId,
  datasource,
  queries,
}: GenAITextInputProps) {
  const isAssistant = useIsAssistantAvailable();

  const fingerprint = useMemo(
    () => (pluginId != null ? getPanelFingerprint(pluginId, datasource, queries) : ''),
    [pluginId, datasource, queries]
  );

  const hasValidData =
    data?.state === LoadingState.Done && getPanelDataSummary(data.series).hasData === true;

  const [localValue, setLocalValue] = useState(value);
  const userEdited = useRef(false);
  const previousValue = useRef<string | undefined>(undefined);
  const [generationKey, setGenerationKey] = useState(fingerprint);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!isAssistant || !pluginId) {
      return;
    }
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (fingerprint !== generationKey && hasValidData && !userEdited.current) {
      previousValue.current = localValue || undefined;
      setLocalValue('');
      onChange('');
      setGenerationKey(fingerprint);
    }
  }, [fingerprint, hasValidData, generationKey, localValue, isAssistant, pluginId, onChange]);

  const systemPrompt = useMemo(() => {
    if (!isAssistant) {
      return undefined;
    }
    return buildTitleInputSystemPrompt(panel, dashboard, data, previousValue.current);
    // generationKey triggers recomputation with captured previousValue on regeneration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssistant, panel, dashboard, data, generationKey]);

  if (isAssistant) {
    const effectiveAutoGenerate = pluginId ? !localValue : autoGenerate;
    return (
      <AITextInput
        key={generationKey}
        data-testid={dataTestId}
        value={pluginId ? localValue : value}
        onChange={(val) => {
          userEdited.current = true;
          setLocalValue(val);
          onChange(val);
        }}
        onComplete={(val) => {
          userEdited.current = false;
          setLocalValue(val);
          onComplete?.(val);
        }}
        systemPrompt={systemPrompt}
        origin="grafana/panel-metadata/title"
        placeholder={t('gen-ai.text-input.placeholder', 'Type a title or let AI generate one...')}
        autoGenerate={effectiveAutoGenerate}
        streaming
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      data-testid={dataTestId}
      id={id}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  );
}
