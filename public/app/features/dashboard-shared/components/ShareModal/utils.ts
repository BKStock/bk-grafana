export const getTrackingSource = (panel?: Object | undefined) => {
  return panel ? 'panel' : 'dashboard';
};

export const shareDashboardType: {
  [key: string]: string;
} = {
  link: 'link',
  snapshot: 'snapshot',
  export: 'export',
  embed: 'embed',
  libraryPanel: 'library_panel',
  pdf: 'pdf',
  report: 'report',
  publicDashboard: 'public_dashboard',
  inviteUser: 'invite_user',
  image: 'image',
};
