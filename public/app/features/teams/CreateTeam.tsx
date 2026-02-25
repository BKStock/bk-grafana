import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Checkbox, Field, FieldSet, Input, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/services/context_srv';
import { Role } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

import { Progress, CreateTeamCall, CreateFolderCall } from './CreateTeamResultCard';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;

  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [autocreateTeamFolder, setAutocreateTeamFolder] = useState(false);
  const [teamCreationProgress, setTeamCreationProgress] = useState<Progress | undefined>(undefined);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TeamDTO>();

  const [formModel, setFormModel] = useState<TeamDTO | undefined>(undefined);

  const disableCreateButton = formModel && teamCreationProgress?.status !== 'error';
  const formLocked = !!disableCreateButton;

  const submit = async (formModel: TeamDTO) => {
    setFormModel(formModel);
  };

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(submit)} style={{ maxWidth: '600px' }}>
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
            <Button type="submit" variant="primary" disabled={disableCreateButton}>
              <Trans i18nKey="teams.create-team.create">Create</Trans>
            </Button>

            <Stack direction="column" gap={1}>
              {formModel && (
                <CreateTeamCall
                  name={formModel.name}
                  email={formModel.email}
                  reportProgress={setTeamCreationProgress}
                />
              )}
              {autocreateTeamFolder &&
                teamCreationProgress?.status === 'success' &&
                formModel &&
                teamCreationProgress.uid && (
                  <CreateFolderCall name={formModel.name} teamUid={teamCreationProgress.uid} />
                )}
            </Stack>
          </Stack>
        </form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
