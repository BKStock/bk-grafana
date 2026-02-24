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
                <Card noMargin>
                  <Card.Heading>{t('teams.create-team.team-card-heading', 'Team')}</Card.Heading>
                  <Card.Description>
                    {teamCreationState.status === 'loading' && (
                      <LoadingPlaceholder text={t('teams.create-team.team-creation-loading', 'Creating team...')} />
                    )}
                    {teamCreationState.status === 'error' && (
                      <Alert severity="error" title={t('teams.create-team.failed-to-create', 'Failed to create team')}>
                        {teamCreationState.error}
                      </Alert>
                    )}
                    {teamCreationState.status === 'success' && teamCreationState.uid && (
                      <Stack direction="column" gap={0}>
                        <Text>{t('teams.create-team.team-creation-success', 'Team created successfully.')}</Text>
                        <Link href={`/org/teams/edit/${teamCreationState.uid}`}>
                          {t('teams.create-team.team-creation-link', 'Open team details')}
                        </Link>
                      </Stack>
                    )}
                  </Card.Description>
                </Card>

                {autocreateTeamFolder && (
                  <Card noMargin>
                    <Card.Heading>{t('teams.create-team.folder-card-heading', 'Folder')}</Card.Heading>
                    <Card.Description>
                      {teamCreationState.status === 'loading' && (
                        <LoadingPlaceholder
                          text={t(
                            'teams.create-team.folder-creation-waiting',
                            'Waiting for team creation before creating folder...'
                          )}
                        />
                      )}

                      {teamCreationState.status === 'error' && (
                        <Alert
                          severity="error"
                          title={t('teams.create-team.folder-creation-skipped', 'Folder creation skipped')}
                        >
                          {t(
                            'teams.create-team.folder-creation-skipped-team-failure',
                            'Folder was not created because team creation failed.'
                          )}
                        </Alert>
                      )}

                      {teamCreationState.status === 'success' && folderCreationState.status === 'loading' && (
                        <LoadingPlaceholder
                          text={t('teams.create-team.folder-creation-loading', 'Creating folder...')}
                        />
                      )}

                      {teamCreationState.status === 'success' && folderCreationState.status === 'error' && (
                        <Alert
                          severity="error"
                          title={t('teams.create-team.folder-create-failed', 'Failed to create folder')}
                        >
                          {folderCreationState.error}
                        </Alert>
                      )}

                      {teamCreationState.status === 'success' &&
                        folderCreationState.status === 'success' &&
                        folderCreationState.url && (
                          <Stack direction="column" gap={0}>
                            <Text>
                              {t('teams.create-team.folder-creation-success', 'Folder created successfully.')}
                            </Text>
                            <Link href={folderCreationState.url}>
                              {t('teams.create-team.folder-creation-link', 'Open folder')}
                            </Link>
                          </Stack>
                        )}
                    </Card.Description>
                  </Card>
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
