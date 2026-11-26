import { t } from '../../i18n/i18n.ts';

export const BACKUP_REMINDER_DAYS = 14;

export interface BackupStatus {
  /** True when the user should be nudged to export a backup. */
  warn: boolean;
  text: string;
}

export function backupStatus(lastBackupAt: string | null, hasData: boolean, now: Date = new Date()): BackupStatus {
  if (!lastBackupAt) {
    return hasData ? { warn: true, text: t('backup.never') } : { warn: false, text: t('backup.none') };
  }
  const days = Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86_400_000);
  if (days <= 0) return { warn: false, text: t('backup.today') };
  const text = t('backup.daysAgo', { count: days });
  return { warn: days >= BACKUP_REMINDER_DAYS, text };
}
