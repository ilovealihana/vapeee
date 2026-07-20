import type { ReactNode } from 'react';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';

type AdminPageHeaderProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function AdminPageHeader({ title, subtitle, actions, meta }: AdminPageHeaderProps) {
  return (
    <div className="admin-page-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {meta && <div className="admin-page-meta">{meta}</div>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </div>
  );
}

type AdminModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function AdminModal({ title, subtitle, onClose, children, footer }: AdminModalProps) {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <section className="admin-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="admin-modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="admin-icon-button" type="button" onClick={onClose} aria-label={t('admin.common.close')}>
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
        {footer && <footer className="admin-modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}

type AdminConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AdminConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <section className="admin-confirm-dialog" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="admin-confirm-icon">
          <Icon name="trash" size={20} />
        </div>
        <div>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>
        <footer>
          <button className="admin-button admin-button-secondary" type="button" onClick={onCancel}>{t('admin.common.cancel')}</button>
          <button className="admin-button admin-button-danger" type="button" onClick={onConfirm}>{confirmLabel || t('admin.common.delete')}</button>
        </footer>
      </section>
    </div>
  );
}

type AdminStatusBadgeProps = {
  status: string;
  label?: string;
};

export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  return <span className={`admin-status-badge admin-status-${status}`}>{label || status}</span>;
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-icon">
        <Icon name="box" size={22} />
      </div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
