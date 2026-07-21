import { useEffect, useMemo, useState } from 'react';
import {
  adminApi,
  type AdminCity,
  type AdminLocation,
  type AdminStaffMember,
  type AdminStaffRole,
} from '../../api/admin';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';
import { AdminConfirmDialog, AdminEmptyState, AdminModal, AdminPageHeader, AdminStatusBadge } from './AdminUI';

type StaffForm = {
  tg_id: string;
  username: string;
  role: AdminStaffRole;
  city_ids: number[];
  location_ids: number[];
};

type ConfirmAction = {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
};

const roles: AdminStaffRole[] = ['project_admin', 'city_curator', 'point_manager', 'inpost_curator'];
const emptyForm: StaffForm = { tg_id: '', username: '', role: 'city_curator', city_ids: [], location_ids: [] };

export default function AdminStaff() {
  const activeLocale = useUserStore((state) => state.activeLocale);
  const { t } = useI18n(activeLocale);
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState<AdminStaffMember | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const locationsByCity = useMemo(() => {
    const grouped: Record<number, AdminLocation[]> = {};
    for (const location of locations) {
      grouped[location.city_id] = [...(grouped[location.city_id] || []), location];
    }
    return grouped;
  }, [locations]);

  const roleLabel = (role: AdminStaffRole) => t(`admin.staff.roles.${role}`);

  const loadReferenceData = async () => {
    const loadedCities = await adminApi.getCities();
    setCities(loadedCities);
    const locationLists = await Promise.all(loadedCities.map((city) => adminApi.getLocations(city.id)));
    setLocations(locationLists.flat());
  };

  const load = async () => {
    setLoading(true);
    try {
      const [staffRows] = await Promise.all([
        adminApi.getStaff(),
        loadReferenceData(),
      ]);
      setStaff(staffRows);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const assignmentSummary = (member: AdminStaffMember) => {
    if (member.role === 'project_admin' || member.role === 'inpost_curator') {
      return t('admin.staff.globalScope');
    }
    if (member.assignments.length === 0) return t('admin.staff.noAssignments');
    return member.assignments
      .map((assignment) => assignment.city_name || assignment.location_name || String(assignment.city_id || assignment.location_id))
      .join(', ');
  };

  const toggleId = (field: 'city_ids' | 'location_ids', id: number) => {
    setForm((current) => {
      const selected = current[field].includes(id);
      return {
        ...current,
        [field]: selected ? current[field].filter((item) => item !== id) : [...current[field], id],
      };
    });
  };

  const openModal = (member?: AdminStaffMember) => {
    setEditStaff(member || null);
    setForm(member ? {
      tg_id: String(member.tg_id),
      username: member.username || '',
      role: member.role,
      city_ids: member.assignments.map((assignment) => assignment.city_id).filter((id): id is number => Boolean(id)),
      location_ids: member.assignments.map((assignment) => assignment.location_id).filter((id): id is number => Boolean(id)),
    } : emptyForm);
    setShowModal(true);
  };

  const saveStaff = async () => {
    try {
      const role = form.role;
      const payload = {
        tg_id: Number(form.tg_id),
        username: form.username.trim(),
        role,
        city_ids: role === 'city_curator' ? form.city_ids : [],
        location_ids: role === 'point_manager' ? form.location_ids : [],
      };
      if (editStaff) {
        await adminApi.updateStaff(editStaff.id, payload);
      } else {
        await adminApi.createStaff(payload);
      }
      setShowModal(false);
      setEditStaff(null);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deactivateStaff = async (member: AdminStaffMember) => {
    try {
      await adminApi.deleteStaff(member.id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const reactivateStaff = async (member: AdminStaffMember) => {
    try {
      await adminApi.updateStaff(member.id, { is_active: true });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    await confirmAction.onConfirm();
    setConfirmAction(null);
  };

  return (
    <section>
      <AdminPageHeader
        title={t('admin.staff.title')}
        subtitle={t('admin.staff.subtitle')}
        meta={<span>{t('admin.staff.meta').replace('{count}', String(staff.length))}</span>}
        actions={(
          <button className="admin-button admin-button-primary" type="button" onClick={() => openModal()}>
            <Icon name="plus" size={16} /> {t('admin.staff.addStaff')}
          </button>
        )}
      />

      {error && <p className="admin-message admin-message-error">{error}</p>}
      {loading && <div className="spinner" />}
      {!loading && staff.length === 0 && (
        <AdminEmptyState title={t('admin.staff.emptyTitle')} description={t('admin.staff.emptyDescription')} />
      )}
      {!loading && staff.length > 0 && (
        <div className="admin-cms-table">
          {staff.map((member) => (
            <div key={member.id} className="admin-cms-row admin-staff-row">
              <span className="admin-cms-cell-main">
                <strong>{t('admin.staff.telegramIdLabel')} {member.tg_id}</strong>
                {member.username && <span>@{member.username}</span>}
                <span>{roleLabel(member.role)}</span>
                <span>{assignmentSummary(member)}</span>
              </span>
              <AdminStatusBadge
                status={member.is_active ? 'active' : 'hidden'}
                label={member.is_active ? t('admin.status.active') : t('admin.status.hidden')}
              />
              <div className="admin-row-actions">
                <button className="admin-icon-button" type="button" onClick={() => openModal(member)} aria-label={t('admin.staff.editAria')}>
                  <Icon name="edit" size={16} />
                </button>
                {member.is_active ? (
                  <button
                    className="admin-icon-button admin-icon-button-danger"
                    type="button"
                    onClick={() => setConfirmAction({
                      title: t('admin.staff.deactivateTitle'),
                      message: t('admin.staff.deactivateMessage').replace('{tgId}', String(member.tg_id)),
                      onConfirm: () => deactivateStaff(member),
                    })}
                    aria-label={t('admin.staff.deactivateAria')}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                ) : (
                  <button className="admin-icon-button" type="button" onClick={() => reactivateStaff(member)} aria-label={t('admin.staff.reactivateAria')}>
                    <Icon name="check" size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AdminModal
          title={editStaff ? t('admin.staff.editTitle') : t('admin.staff.newTitle')}
          subtitle={t('admin.staff.modalSubtitle')}
          onClose={() => setShowModal(false)}
          footer={<button className="admin-button admin-button-primary" type="button" onClick={saveStaff}>{t('admin.common.save')}</button>}
        >
          <div className="input-group">
            <label className="input-label">{t('admin.staff.telegramId')}</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.tg_id}
              onChange={(event) => setForm((current) => ({ ...current, tg_id: event.target.value.replace(/\D/g, '') }))}
              placeholder={t('admin.staff.telegramIdPlaceholder')}
              disabled={Boolean(editStaff)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('admin.staff.telegramUsername')}</label>
            <input
              className="input"
              type="text"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              placeholder={t('admin.staff.telegramUsernamePlaceholder')}
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('admin.staff.role')}</label>
            <select
              className="input"
              value={form.role}
              onChange={(event) => setForm((current) => ({
                ...current,
                role: event.target.value as AdminStaffRole,
                city_ids: [],
                location_ids: [],
              }))}
            >
              {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
          </div>

          {form.role === 'city_curator' && (
            <div className="input-group">
              <label className="input-label">{t('admin.staff.cities')}</label>
              <div className="admin-check-list">
                {cities.map((city) => (
                  <label key={city.id} className="admin-check-row">
                    <input
                      type="checkbox"
                      checked={form.city_ids.includes(city.id)}
                      onChange={() => toggleId('city_ids', city.id)}
                    />
                    <span>{city.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.role === 'point_manager' && (
            <div className="input-group">
              <label className="input-label">{t('admin.staff.locations')}</label>
              <div className="admin-check-list">
                {cities.map((city) => (
                  <div key={city.id} className="admin-check-group">
                    <span className="muted">{city.name}</span>
                    {(locationsByCity[city.id] || []).map((location) => (
                      <label key={location.id} className="admin-check-row">
                        <input
                          type="checkbox"
                          checked={form.location_ids.includes(location.id)}
                          onChange={() => toggleId('location_ids', location.id)}
                        />
                        <span>{location.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminModal>
      )}

      {confirmAction && (
        <AdminConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          onCancel={() => setConfirmAction(null)}
          onConfirm={runConfirmAction}
        />
      )}
    </section>
  );
}
