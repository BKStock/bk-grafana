import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { locationUtil, NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  FieldSet,
  Input,
  Link,
  LoadingPlaceholder,
  Stack,
  Text,
} from '@grafana/ui';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/services/context_srv';
import { Role } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

import { useCreateTeam } from './hooks';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

type CreateStepStatus = 'idle' | 'loading' | 'success' | 'error';

interface TeamCreationState {
  status: CreateStepStatus;
  uid?: string;
  error?: string;
}

interface FolderCreationState {
  status: CreateStepStatus;
  url?: string;
  error?: string;
}

interface ResultCardLink {
  href: string;
  text: string;
}

type ResultCardState =
  | { status: 'idle' }
  | { status: 'loading'; loadingText: string }
  | { status: 'error'; errorTitle: string; errorMessage: string }
  | { status: 'success'; successText: string; successLink?: ResultCardLink };

interface StepResultCardProps {
  heading: string;
  state: ResultCardState;
}

function StepResultCard({ heading, state }: StepResultCardProps) {
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

function getFolderResultCardState(teamState: TeamCreationState, folderState: FolderCreationState): ResultCardState {
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

const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;

  const [createTeamTrigger] = useCreateTeam();
  const [createFolderTrigger] = useCreateFolder();
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [autocreateTeamFolder, setAutocreateTeamFolder] = useState(false);
  const [teamCreationState, setTeamCreationState] = useState<TeamCreationState>({ status: 'idle' });
  const [folderCreationState, setFolderCreationState] = useState<FolderCreationState>({ status: 'idle' });
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TeamDTO>();
  const shouldShowStatusCards = teamCreationState.status !== 'idle';
  const showCreateButton = teamCreationState.status === 'idle' || teamCreationState.status === 'error';
  const formLocked =
    teamCreationState.status === 'loading' ||
    teamCreationState.status === 'success' ||
    folderCreationState.status === 'loading';
  const teamResultCardState: ResultCardState =
    teamCreationState.status === 'loading'
      ? {
          status: 'loading',
          loadingText: t('teams.create-team.team-creation-loading', 'Creating team...'),
        }
      : teamCreationState.status === 'error'
        ? {
            status: 'error',
            errorTitle: t('teams.create-team.failed-to-create', 'Failed to create team'),
            errorMessage: teamCreationState.error ?? t('teams.create-team.failed-to-create', 'Failed to create team'),
          }
        : teamCreationState.status === 'success' && teamCreationState.uid
          ? {
              status: 'success',
              successText: t('teams.create-team.team-creation-success', 'Team created successfully.'),
              successLink: {
                href: `/org/teams/edit/${teamCreationState.uid}`,
                text: t('teams.create-team.team-creation-link', 'Open team details'),
              },
            }
          : { status: 'idle' };
  const folderResultCardState = getFolderResultCardState(teamCreationState, folderCreationState);

  const createTeam = async (formModel: TeamDTO) => {
    setTeamCreationState({ status: 'loading' });
    setFolderCreationState({ status: 'idle' });

    try {
      const { data, error } = await createTeamTrigger(
        {
          email: formModel.email || '',
          name: formModel.name,
        },
        pendingRoles
      );

      const teamErrorMessage = error ? extractErrorMessage(error) : undefined;

      if (teamErrorMessage || !data?.uid) {
        setTeamCreationState({
          status: 'error',
          error: teamErrorMessage ?? t('teams.create-team.failed-to-create', 'Failed to create team'),
        });
        return;
      }

      setTeamCreationState({ status: 'success', uid: data.uid });

      if (!autocreateTeamFolder) {
        return;
      }

      setFolderCreationState({ status: 'loading' });

      try {
        const { data: folderData, error: folderError } = await createFolderTrigger({
          title: formModel.name,
          teamOwnerReferences: [{ uid: data.uid, name: formModel.name }],
        });

        const folderErrorMessage = folderError ? extractErrorMessage(folderError) : undefined;

        if (folderErrorMessage || !folderData?.url) {
          setFolderCreationState({
            status: 'error',
            error: folderErrorMessage ?? t('teams.create-team.folder-create-failed', 'Failed to create folder'),
          });
          return;
        }

        setFolderCreationState({
          status: 'success',
          url: locationUtil.stripBaseFromUrl(folderData.url),
        });
      } catch (e) {
        setFolderCreationState({
          status: 'error',
          error: t('teams.create-team.folder-create-failed', 'Failed to create folder'),
        });
        console.error(e);
      }
    } catch (e) {
      setTeamCreationState({
        status: 'error',
        error: t('teams.create-team.failed-to-create', 'Failed to create team'),
      });
      console.error(e);
    }
  };

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(createTeam)} style={{ maxWidth: '600px' }}>
          <FieldSet>
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                label={t('teams.create-team.label-name', 'Name')}
                required
                invalid={!!errors.name}
                error="Team name is required"
              >
                <Input {...register('name', { required: true })} id="team-name" disabled={formLocked} />
              </Field>
              {contextSrv.licensedAccessControlEnabled() && (
                <Field noMargin label={t('teams.create-team.label-role', 'Role')}>
                  <TeamRolePicker
                    teamId={0}
                    roleOptions={roleOptions}
                    disabled={formLocked}
                    apply={true}
                    onApplyRoles={setPendingRoles}
                    pendingRoles={pendingRoles}
                    maxWidth="100%"
                  />
                </Field>
              )}
              <Field
                noMargin
                label={t('teams.create-team.label-email', 'Email')}
                description={t(
                  'teams.create-team.description-email',
                  'This is optional and is primarily used for allowing custom team avatars'
                )}
              >
                <Input
                  {...register('email')}
                  type="email"
                  id="team-email"
                  disabled={formLocked}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="email@test.com"
                />
              </Field>
              <Field noMargin>
                <Checkbox
                  value={autocreateTeamFolder}
                  label={t('teams.create-team.autocreate-team-folder', 'autocreate team folder')}
                  onChange={(event) => setAutocreateTeamFolder(event.currentTarget.checked)}
                  disabled={formLocked}
                />
              </Field>
            </Stack>
          </FieldSet>
          <Stack direction="column" gap={2}>
            {showCreateButton && (
              <Button type="submit" variant="primary">
                <Trans i18nKey="teams.create-team.create">Create</Trans>
              </Button>
            )}

            {shouldShowStatusCards && (
              <Stack direction="column" gap={1}>
                <StepResultCard
                  heading={t('teams.create-team.team-card-heading', 'Team')}
                  state={teamResultCardState}
                />

                {autocreateTeamFolder && (
                  <StepResultCard
                    heading={t('teams.create-team.folder-card-heading', 'Folder')}
                    state={folderResultCardState}
                  />
                )}
              </Stack>
            )}
          </Stack>
        </form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
