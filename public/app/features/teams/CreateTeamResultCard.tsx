import { t } from '@grafana/i18n';
import { Alert, Card, Link, LoadingPlaceholder, Stack, Text } from '@grafana/ui';

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

export type ResultCardState =
  | { status: 'idle' }
  | { status: 'loading'; loadingText: string }
  | { status: 'error'; errorTitle: string; errorMessage: string }
  | { status: 'success'; successText: string; successLink?: ResultCardLink };

interface StepResultCardProps {
  heading: string;
  state: ResultCardState;
}

export function StepResultCard({ heading, state }: StepResultCardProps) {
  if (state.status === 'idle') {
    return null;
  }

  return (
    <Card noMargin>
      <Card.Heading>{heading}</Card.Heading>
      <Card.Description>
        {state.status === 'loading' && <LoadingPlaceholder text={state.loadingText} />}
        {state.status === 'error' && (
          <Alert severity="error" title={state.errorTitle}>
            {state.errorMessage}
          </Alert>
        )}
        {state.status === 'success' && (
          <Stack direction="column" gap={0}>
            <Text>{state.successText}</Text>
            {state.successLink && <Link href={state.successLink.href}>{state.successLink.text}</Link>}
          </Stack>
        )}
      </Card.Description>
    </Card>
  );
}

export function getFolderResultCardState(
  teamState: TeamCreationState,
  folderState: FolderCreationState
): ResultCardState {
  if (teamState.status === 'loading') {
    return {
      status: 'loading',
      loadingText: t(
        'teams.create-team.folder-creation-waiting',
        'Waiting for team creation before creating folder...'
      ),
    };
  }

  if (teamState.status === 'error') {
    return {
      status: 'error',
      errorTitle: t('teams.create-team.folder-creation-skipped', 'Folder creation skipped'),
      errorMessage: t(
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
      loadingText: t('teams.create-team.folder-creation-loading', 'Creating folder...'),
    };
  }

  if (folderState.status === 'error') {
    return {
      status: 'error',
      errorTitle: t('teams.create-team.folder-create-failed', 'Failed to create folder'),
      errorMessage: folderState.error ?? t('teams.create-team.folder-create-failed', 'Failed to create folder'),
    };
  }

  if (folderState.status === 'success' && folderState.url) {
    return {
      status: 'success',
      successText: t('teams.create-team.folder-creation-success', 'Folder created successfully.'),
      successLink: {
        href: folderState.url,
        text: t('teams.create-team.folder-creation-link', 'Open folder'),
      },
    };
  }

  return { status: 'idle' };
}

export function getTeamResultCardState(teamState: TeamCreationState): ResultCardState {
  if (teamState.status === 'loading') {
    return {
      status: 'loading',
      loadingText: t('teams.create-team.team-creation-loading', 'Creating team...'),
    };
  }

  if (teamState.status === 'error') {
    return {
      status: 'error',
      errorTitle: t('teams.create-team.failed-to-create', 'Failed to create team'),
      errorMessage: teamState.error ?? t('teams.create-team.failed-to-create', 'Failed to create team'),
    };
  }

  if (teamState.status === 'success' && teamState.uid) {
    return {
      status: 'success',
      successText: t('teams.create-team.team-creation-success', 'Team created successfully.'),
      successLink: {
        href: `/org/teams/edit/${teamState.uid}`,
        text: t('teams.create-team.team-creation-link', 'Open team details'),
      },
    };
  }

  return { status: 'idle' };
}
