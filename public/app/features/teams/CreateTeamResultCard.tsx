import { QueryStatus } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, AlertVariant, Link, Stack, Text } from '@grafana/ui';
import { useCreateFolder } from 'app/api/clients/folder/v1beta1/hooks';

import { extractErrorMessage } from '../../api/utils';
import { Role } from '../../types/accessControl';

import { useCreateTeam } from './hooks';

export type Progress =
  | {
      status: 'loading';
    }
  | {
      status: 'error';
      error: unknown;
    }
  | {
      status: 'success';
      uid: string;
    };

type CreateTeamCallProps = {
  name: string;
  email?: string;
  roles?: Role[];
  reportProgress: (progress: Progress) => void;
};

export function CreateTeamCall({ email, name, roles, reportProgress }: CreateTeamCallProps) {
  const [cardProps, setCardProps] = useState<CardProps>(getTeamCardProps({ type: 'loading' }));
  const [createTeamTrigger, response] = useCreateTeam();

  useEffect(() => {
    setCardProps(getTeamCardProps({ type: 'loading' }));
    reportProgress({ status: 'loading' });
    createTeamTrigger(
      { email: email || '', name },
      roles,
      // We are showing status inline so don't need this
      { showSuccessAlert: false }
    );
    // TODO abort request once we don't use the promise in the trigger
  }, [email, name, roles, createTeamTrigger, reportProgress]);

  useEffect(() => {
    if (response.status === QueryStatus.rejected) {
      setCardProps(getTeamCardProps({ type: 'error', error: response.error }));
      reportProgress({ status: 'error', error: response.error || 'Unknown error' });
    }

    if (response.status === QueryStatus.fulfilled && response.data.uid) {
      setCardProps(getTeamCardProps({ type: 'success', uid: response.data.uid }));
      reportProgress({ status: 'success', uid: response.data.uid });
    }

    // Not sure why this would happen, but the types suggest it could happen so we treat it as error
    if (response.status === QueryStatus.fulfilled && !response.data.uid) {
      setCardProps(getTeamCardProps({ type: 'error', error: 'Server did not send team uid' }));
      reportProgress({ status: 'error', error: 'Server did not send team uid' });
    }
  }, [response, reportProgress]);

  // useEffect(() => {
  //   (async () => {
  //     setCardProps(getTeamCardProps({ type: 'loading' }));
  //     reportProgress({ status: 'loading' });
  //
  //     const { data: teamData, error: teamError } = await createTeamTrigger(
  //       { email: email || '', name },
  //       roles,
  //       // We are showing status inline so don't need this
  //       { showSuccessAlert: false }
  //     );
  //
  //     if (teamError || !teamData?.uid) {
  //       setCardProps(getTeamCardProps({ type: 'error', error: teamError }));
  //       reportProgress({ status: 'error', error: teamError || 'Unknown error' });
  //       return;
  //     }
  //
  //     setCardProps(getTeamCardProps({ type: 'success', uid: teamData.uid }));
  //     reportProgress({ status: 'success', uid: teamData.uid });
  //   })();
  // }, [email, name, roles, createTeamTrigger, reportProgress]);

  return <StepResultAlert {...cardProps} />;
}

type CreateFolderCallProps = {
  name: string;
  teamUid: string;
};

export function CreateFolderCall({ teamUid, name }: CreateFolderCallProps) {
  const [cardProps, setCardProps] = useState<CardProps>(getFolderCardProps({ type: 'loading' }));
  const [createFolderTrigger] = useCreateFolder();

  useEffect(() => {
    (async () => {
      setCardProps(getFolderCardProps({ type: 'loading' }));

      const { data, error } = await createFolderTrigger({
        title: name,
        teamOwnerReferences: [{ uid: teamUid, name: teamUid }],
      });

      if (error || !data?.url) {
        setCardProps(getFolderCardProps({ type: 'error', error }));
        return;
      }

      setCardProps(getFolderCardProps({ type: 'success', url: data.url }));
    })();
  }, [teamUid, name, createFolderTrigger]);

  return <StepResultAlert {...cardProps} />;
}

interface CardProps {
  severity: AlertVariant;
  description: string;
  link?: ResultCardLink;
}

interface ResultCardLink {
  href: string;
  text: string;
}

export function StepResultAlert({ severity, description, link }: CardProps) {
  return (
    <Alert severity={severity} title="">
      <Stack direction="row" justifyContent={'space-between'}>
        <Text>{description}</Text>
        {link && <Link href={link.href}>{link.text}</Link>}
      </Stack>
    </Alert>
  );
}

export type FolderCardVariant =
  | { type: 'loading' }
  | { type: 'success'; url: string }
  | { type: 'error'; error?: unknown };

export function getFolderCardProps(variant: FolderCardVariant): CardProps {
  if (variant.type === 'error') {
    return {
      severity: 'error',
      description: variant.error
        ? extractErrorMessage(variant.error)
        : t('teams.create-team.folder-create-failed', 'Failed to create folder'),
    };
  }

  if (variant.type === 'success') {
    return {
      severity: 'success',
      description: t('teams.create-team.folder-creation-success', 'Folder created successfully.'),
      link: {
        href: locationUtil.stripBaseFromUrl(variant.url),
        text: t('teams.create-team.folder-creation-link', 'Open folder'),
      },
    };
  }

  // variant.type === 'info'
  return {
    severity: 'info',
    description: t('teams.create-team.folder-creation-loading', 'Creating folder...'),
  };
}

export type TeamCardVariant =
  | { type: 'loading' }
  | { type: 'success'; uid: string }
  | { type: 'error'; error?: unknown };

export function getTeamCardProps(variant: TeamCardVariant): CardProps {
  if (variant.type === 'error') {
    return {
      severity: 'error',
      description: variant.error
        ? extractErrorMessage(variant.error)
        : t('teams.create-team.failed-to-create', 'Failed to create team'),
    };
  }

  if (variant.type === 'success') {
    return {
      severity: 'success',
      description: t('teams.create-team.team-creation-success', 'Team created successfully.'),
      link: {
        href: `/org/teams/edit/${variant.uid}`,
        text: t('teams.create-team.team-creation-link', 'Open team details'),
      },
    };
  }

  // variant.type === 'loading'
  return {
    severity: 'info',
    description: t('teams.create-team.team-creation-loading', 'Creating team...'),
  };
}
