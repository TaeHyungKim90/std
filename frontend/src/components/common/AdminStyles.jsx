import adminCss from 'assets/css/admin.css?inline';

/** Vite processes @imports, but only mounts these styles while an admin layout is active. */
export default function AdminStyles() {
  return <style data-admin-styles>{adminCss}</style>;
}
