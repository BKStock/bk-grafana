import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';

import { PanelEditor } from './PanelEditor';
import { QueryEditorBanner } from './QueryEditorBanner';

function createMockPanelEditor(state: { useQueryExperienceNext?: boolean } = {}) {
  return {
    useState: () => ({ useQueryExperienceNext: state.useQueryExperienceNext ?? false }),
    onToggleQueryEditorVersion: jest.fn(),
  } as unknown as PanelEditor;
}

describe('QueryEditorBanner', () => {
  let originalFeatureToggle: boolean | undefined;

  beforeEach(() => {
    originalFeatureToggle = config.featureToggles.queryEditorNext;
    config.featureToggles.queryEditorNext = true;
    sessionStorage.clear();
  });

  afterEach(() => {
    config.featureToggles.queryEditorNext = originalFeatureToggle;
  });

  describe('visibility', () => {
    it('renders when feature toggle is enabled and banner is not dismissed', () => {
      render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="upgrade" />);
      expect(screen.getByText('New editor available!')).toBeInTheDocument();
    });

    it('does not render when feature toggle is disabled', () => {
      config.featureToggles.queryEditorNext = false;
      const { container } = render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="upgrade" />);
      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when previously dismissed via sessionStorage', () => {
      sessionStorage.setItem('grafana.queryEditorBanner.upgrade.dismissed', 'true');
      const { container } = render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="upgrade" />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('dismiss', () => {
    it('hides the banner and persists to sessionStorage', async () => {
      const { container } = render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="upgrade" />);

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(container).toBeEmptyDOMElement();
      expect(sessionStorage.getItem('grafana.queryEditorBanner.upgrade.dismissed')).toBe('true');
    });

    it('uses separate storage keys per variant', async () => {
      render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="downgrade" />);

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(sessionStorage.getItem('grafana.queryEditorBanner.downgrade.dismissed')).toBe('true');
      expect(sessionStorage.getItem('grafana.queryEditorBanner.upgrade.dismissed')).toBeNull();
    });
  });

  describe('upgrade variant', () => {
    it('shows the upgrade title and InlineSwitch', () => {
      render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="upgrade" />);

      expect(screen.getByText('New editor available!')).toBeInTheDocument();
      expect(screen.getByLabelText(/toggle between query editor/i)).toBeInTheDocument();
    });

    it('reflects useQueryExperienceNext state in the switch', () => {
      render(
        <QueryEditorBanner panelEditor={createMockPanelEditor({ useQueryExperienceNext: true })} variant="upgrade" />
      );

      expect(screen.getByLabelText(/toggle between query editor/i)).toBeChecked();
    });

    it('does not show downgrade-specific content', () => {
      render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="upgrade" />);

      expect(screen.queryByText('Learn more')).not.toBeInTheDocument();
      expect(screen.queryByText('Go back to classic')).not.toBeInTheDocument();
    });
  });

  describe('downgrade variant', () => {
    it('shows the downgrade title, "Learn more" link, and "Go back to classic" button', () => {
      render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="downgrade" />);

      expect(screen.getByText('New query editor!')).toBeInTheDocument();
      expect(screen.getByText('Learn more')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back to classic/i })).toBeInTheDocument();
    });

    it('does not show the InlineSwitch', () => {
      render(<QueryEditorBanner panelEditor={createMockPanelEditor()} variant="downgrade" />);

      expect(screen.queryByLabelText(/toggle between query editor/i)).not.toBeInTheDocument();
    });

    it('calls onToggleQueryEditorVersion when "Go back to classic" is clicked', async () => {
      const panelEditor = createMockPanelEditor();
      render(<QueryEditorBanner panelEditor={panelEditor} variant="downgrade" />);

      await userEvent.click(screen.getByRole('button', { name: /go back to classic/i }));

      expect(panelEditor.onToggleQueryEditorVersion).toHaveBeenCalledTimes(1);
    });
  });
});
