import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Checkbox, Field, FieldSet, Input, Stack } from '@grafana/ui';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/services/context_srv';
import { Role } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

import { StepResultAlert, CardProps, getFolderCardProps, getTeamCardProps } from './CreateTeamResultCard';
import { useCreateTeam } from './hooks';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;

  const [createTeamTrigger] = useCreateTeam();
  const [createFolderTrigger] = useCreateFolder();
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [autocreateTeamFolder, setAutocreateTeamFolder] = useState(false);
  const [teamCreationCardProps, setTeamCreationCardProps] = useState<CardProps | undefined>(undefined);
  const [folderCreationCardProps, setFolderCreationCardProps] = useState<CardProps | undefined>(undefined);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TeamDTO>();

  // TODO: should we allow to click create again after error?
  const showCreateButton = !teamCreationCardProps || teamCreationCardProps.severity === 'error';
  const formLocked =
    teamCreationCardProps?.severity === 'info' ||
    teamCreationCardProps?.severity === 'success' ||
    folderCreationCardProps?.severity === 'info';

  // Trigger to create team and optionally also a folder. Each one has its own state to inform user about the progress
  // or an error.
  const createTeam = async (formModel: TeamDTO) => {
    setTeamCreationCardProps(getTeamCardProps({ type: 'loading' }));

    let teamData, teamError;
    try {
      const result = await createTeamTrigger(
        {
          email: formModel.email || '',
          name: formModel.name,
        },
        pendingRoles
      );
      teamData = result.data;
      teamError = result.error;
    } catch (e) {
      setTeamCreationCardProps(getTeamCardProps({ type: 'error', error: e }));
      console.error(e);
      return;
    }

    if (teamError || !teamData?.uid) {
      setTeamCreationCardProps(getTeamCardProps({ type: 'error', error: teamError }));
      return;
    }

    setTeamCreationCardProps(getTeamCardProps({ type: 'success', uid: teamData.uid }));

    if (!autocreateTeamFolder) {
      return;
    }

    setFolderCreationCardProps(getFolderCardProps({ type: 'loading' }));

    let folderData, folderError;
    try {
      const result = await createFolderTrigger({
        title: formModel.name,
        teamOwnerReferences: [{ uid: teamData.uid, name: formModel.name }],
      });
      folderData = result.data;
      folderError = result.error;
    } catch (e) {
      setFolderCreationCardProps(getFolderCardProps({ type: 'error', error: e }));
      console.error(e);
      return;
    }

    if (folderError || !folderData?.url) {
      setFolderCreationCardProps(getFolderCardProps({ type: 'error', error: folderError }));
      return;
    }

    setFolderCreationCardProps(getFolderCardProps({ type: 'success', url: folderData.url }));
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

            <Stack direction="column" gap={1}>
              {teamCreationCardProps && <StepResultAlert {...teamCreationCardProps} />}
              {folderCreationCardProps && <StepResultAlert {...folderCreationCardProps} />}
            </Stack>
          </Stack>
        </form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
