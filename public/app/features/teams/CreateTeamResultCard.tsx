import { t } from '@grafana/i18n';
import { Alert, Link, Stack, Text } from '@grafana/ui';

export type CreateStepStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TeamCreationState {
  status: CreateStepStatus;
  uid?: string;
  error?: string;
}

export interface FolderCreationState {
  status: CreateStepStatus;
  url?: string;
  error?: string;
}

interface ResultCardLink {
  href: string;
  text: string;
}

export type ResultAlertState =
  | { status: 'idle' }
  | { status: 'loading'; description: string }
  | { status: 'error'; description: string }
  | { status: 'success'; description: string; link?: ResultCardLink };

interface StepResultAlertProps {
  state: ResultAlertState;
}

export function StepResultAlert({ state }: StepResultAlertProps) {
  if (state.status === 'idle') {
    return null;
  }

  const severity = state.status === 'loading' ? 'info' : state.status;

  return (
    <Alert severity={severity} title="">
      <Stack direction="column" gap={0}>
        <Text>{state.description}</Text>
        {state.status === 'success' && state.link && <Link href={state.link.href}>{state.link.text}</Link>}
      </Stack>
    </Alert>
  );
}

export function getFolderResultCardState(
  teamState: TeamCreationState,
  folderState: FolderCreationState
): ResultAlertState {
  if (teamState.status === 'loading') {
    return {
      status: 'loading',
      description: t(
        'teams.create-team.folder-creation-waiting',
        'Waiting for team creation before creating folder...'
      ),
    };
  }

  if (teamState.status === 'error') {
    return {
      status: 'error',
      description: t(
        'teams.create-team.folder-creation-skipped-team-failure',
        'Folder was not created because team creation failed.'
      ),
    };
  }

  if (teamState.status !== 'success') {
    return { status: 'idle' };
  }

  if (folderState.status === 'loading') {
    return {
      status: 'loading',
      description: t('teams.create-team.folder-creation-loading', 'Creating folder...'),
    };
  }

  if (folderState.status === 'error') {
    return {
      status: 'error',
      description: folderState.error ?? t('teams.create-team.folder-create-failed', 'Failed to create folder'),
    };
  }

  if (folderState.status === 'success' && folderState.url) {
    return {
      status: 'success',
      description: t('teams.create-team.folder-creation-success', 'Folder created successfully.'),
      link: {
        href: folderState.url,
        text: t('teams.create-team.folder-creation-link', 'Open folder'),
      },
    };
  }

  return { status: 'idle' };
}

export function getTeamResultCardState(teamState: TeamCreationState): ResultAlertState {
  if (teamState.status === 'loading') {
    return {
      status: 'loading',
      description: t('teams.create-team.team-creation-loading', 'Creating team...'),
    };
  }

  if (teamState.status === 'error') {
    return {
      status: 'error',
      description: teamState.error ?? t('teams.create-team.failed-to-create', 'Failed to create team'),
    };
  }

  if (teamState.status === 'success' && teamState.uid) {
    return {
      status: 'success',
      description: t('teams.create-team.team-creation-success', 'Team created successfully.'),
      link: {
        href: `/org/teams/edit/${teamState.uid}`,
        text: t('teams.create-team.team-creation-link', 'Open team details'),
      },
    };
  }

  return { status: 'idle' };
}
