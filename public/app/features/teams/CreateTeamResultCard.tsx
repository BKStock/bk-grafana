import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, AlertVariant, Link, Stack, Text } from '@grafana/ui';

import { extractErrorMessage } from '../../api/utils';

export interface CardProps {
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
