import base64

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.base import Base
from db.session import get_db
from models.auth_models import User
from models.tenant_models import Tenant
from models.expense_models import ExpenseReport, ExpenseOcrResult, ExpenseApprovalHistory
from services import expense_service as service, receipt_ocr_service
from services.auth_service import get_current_user_for_tenant, get_current_admin_for_tenant, get_current_user_for_tenant_media
from schemas.expense_schemas import ExpenseAction

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1X8AAAAASUVORK5CYII=')
VALID = dict(expense_date='2026-09-11', expense_type='MEAL', account_code='MEETING',
    merchant_name='상점', supply_amount='10000.00', vat_amount='1000.00', total_amount='11000.00',
    payment_method='CARD', purpose='회의')


@pytest.fixture
def env(tmp_path, monkeypatch):
    from api.hr.expenses import router as hr
    from api.admin.expenses import router as admin
    from api.common import router as common
    engine = create_engine(f'sqlite:///{tmp_path / "expense.sqlite"}', connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        db.add_all([Tenant(id=1, slug='a', name='A'), Tenant(id=2, slug='b', name='B')])
        db.flush()
        for tid in [1, 2]:
            for uid in ['employee', 'other', 'admin']:
                db.add(User(tenant_id=tid, user_login_id=uid, user_name=uid, user_password='unused'))
        db.commit()
    app = FastAPI()
    app.include_router(hr, prefix='/hr/expenses')
    app.include_router(admin, prefix='/admin/expenses')
    app.include_router(common, prefix='/common')
    actor = {'tenantId': 1, 'userId': 'employee', 'role': 'user'}
    def db_dep():
        with sessions() as db:
            yield db
    def admin_dep():
        from fastapi import HTTPException
        if actor['role'] != 'admin':
            raise HTTPException(403)
        return actor
    app.dependency_overrides[get_db] = db_dep
    app.dependency_overrides[get_current_user_for_tenant] = lambda: actor
    app.dependency_overrides[get_current_user_for_tenant_media] = lambda: actor
    app.dependency_overrides[get_current_admin_for_tenant] = admin_dep
    monkeypatch.setattr(service, 'PRIVATE_RECEIPT_DIR', tmp_path / 'receipts')
    with TestClient(app) as client:
        yield client, actor, sessions
    engine.dispose()


def draft(client):
    response = client.post('/hr/expenses')
    assert response.status_code == 200, response.text
    return response.json()


def fill(client, row, **overrides):
    response = client.put(f'/hr/expenses/{row["id"]}', json={**VALID, 'version': row['version'], **overrides})
    assert response.status_code == 200, response.text
    return response.json()


def act(client, row, action, area='hr', **kwargs):
    return client.post(f'/{area}/expenses/{row["id"]}/{action}', json={'version': row['version'], **kwargs})


def test_complete_workflow_and_rejection_history(env):
    c, actor, sessions = env
    row = fill(c, draft(c))
    assert act(c, row, 'submit').status_code == 400
    row = act(c, row, 'submit', reviewed=True).json()
    assert c.put(f'/hr/expenses/{row["id"]}', json={'version': row['version'], **VALID}).status_code == 400
    assert act(c, row, 'cancel').status_code == 400
    assert act(c, row, 'approve', area='admin').status_code == 403
    actor.update(userId='admin', role='admin')
    assert act(c, row, 'reject', area='admin').status_code == 400
    row = act(c, row, 'reject', area='admin', comment='목적 보완').json()
    actor.update(userId='employee', role='user')
    row = act(c, row, 'reopen').json()
    row = fill(c, row, purpose='고객사 미팅')
    row = act(c, row, 'submit', reviewed=True).json()
    actor.update(userId='admin', role='admin')
    row = act(c, row, 'approve', area='admin').json()
    row = act(c, row, 'account', area='admin').json()
    assert row['status'] == 'ACCOUNTED' and row['accounted_at']
    assert [(h['from_status'], h['to_status']) for h in row['history']] == [
        ('DRAFT','REQUESTED'), ('REQUESTED','REJECTED'), ('REJECTED','DRAFT'),
        ('DRAFT','REQUESTED'), ('REQUESTED','APPROVED'), ('APPROVED','ACCOUNTED')]
    assert act(c, row, 'reopen', area='admin').status_code == 400


def test_withdraw_cancel_and_stale_versions(env):
    c, _, _ = env
    old = draft(c)
    row = fill(c, old)
    assert act(c, old, 'cancel').status_code == 409
    row = act(c, row, 'submit', reviewed=True).json()
    row = act(c, row, 'withdraw').json()
    row = act(c, row, 'reopen').json()
    row = act(c, row, 'cancel').json()
    assert row['status'] == 'CANCELED'
    assert act(c, row, 'submit', reviewed=True).status_code == 400


def test_tenant_owner_and_all_download_paths(env):
    c, actor, _ = env
    row = draft(c)
    row = c.post(f'/hr/expenses/{row["id"]}/receipt', data={'version':row['version']}, files={'file':('r.png',PNG,'image/png')}).json()
    assert row['ocr']['ocr_provider'] == 'mock'
    assert row['merchant_name'] is None  # OCR suggestions never silently overwrite the report.
    fid = row['receipt_file_id']
    from models.common_models import UploadedFile
    with env[2]() as db:
        name = db.get(UploadedFile, fid).saved_name
    urls = [f'/common/files/{fid}', f'/common/download/{fid}', f'/common/files/by-saved-name/{name}']
    for url in urls:
        assert c.get(url).content == PNG
    for tid, uid, role in [(1,'other','user'), (2,'employee','user'), (2,'admin','admin')]:
        actor.update(tenantId=tid, userId=uid, role=role)
        assert c.get(f'/hr/expenses/{row["id"]}').status_code == 404
        assert c.get('/hr/expenses').json()['total'] == 0
        assert act(c, row, 'cancel').status_code == 404
        for url in urls:
            assert c.get(url).status_code == 403
    actor.update(tenantId=1, userId='admin', role='admin')
    assert c.get(f'/admin/expenses/{row["id"]}').status_code == 200
    for url in urls:
        assert c.get(url).content == PNG


def test_failed_ocr_manual_input_and_replacement_acl(env, monkeypatch):
    c, actor, sessions = env
    row = draft(c)
    def fail(*args): raise RuntimeError('provider unavailable')
    monkeypatch.setattr(receipt_ocr_service, 'analyze', fail)
    for _ in range(2):
        response = c.post(f'/hr/expenses/{row["id"]}/receipt', data={'version':row['version']}, files={'file':('r.png',PNG,'image/png')})
        assert response.status_code == 200
        row = response.json()
        assert row['ocr']['status'] == 'FAILED'
    with sessions() as db:
        results = db.query(ExpenseOcrResult).all()
        assert len(results) == 2 and all(r.expense_report_id == row['id'] for r in results)
        old_id = results[0].receipt_file_id
    actor.update(tenantId=2, role='admin', userId='admin')
    assert c.get(f'/common/files/{old_id}').status_code == 403
    actor.update(tenantId=1, role='user', userId='employee')
    row = fill(c, row)
    assert act(c, row, 'submit', reviewed=True).status_code == 200


@pytest.mark.parametrize('patch', [{'total_amount':'NaN'}, {'vat_amount':'-1'}, {'total_amount':'1.001'}, {'tenant_id':2}, {'user_id':'other'}, {'receipt_file_id':1}, {'masked_card_number':'1234567812345678'}])
def test_invalid_edit(env, patch):
    c, _, _ = env
    row = draft(c)
    assert c.put(f'/hr/expenses/{row["id"]}', json={'version':row['version'], **patch}).status_code == 422


@pytest.mark.parametrize('name,content,mime', [('a.svg',b'<svg/>','image/svg+xml'), ('a.png',b'bad','image/png'), ('a.png',PNG,'image/jpeg'), ('a.png',b'','image/png'), ('a.png',PNG+b'x'*(10*1024*1024),'image/png')], ids=['extension','signature','mime','empty','oversize'])
def test_invalid_upload_has_no_rows_or_files(env, name, content, mime):
    c, _, sessions = env
    row = draft(c)
    assert c.post(f'/hr/expenses/{row["id"]}/receipt', data={'version':row['version']}, files={'file':(name,content,mime)}).status_code == 400
    with sessions() as db:
        assert db.query(ExpenseOcrResult).count() == 0
    assert not service.PRIVATE_RECEIPT_DIR.exists()


def test_atomic_stale_transition(env):
    c, _, sessions = env
    row = fill(c, draft(c))
    row = act(c, row, 'submit', reviewed=True).json()
    with sessions() as first, sessions() as second:
        a = service.get(first, 1, row['id'])
        b = service.get(second, 1, row['id'])
        payload = ExpenseAction(version=row['version'], comment='test')
        service.transition(first, a, 'approve', payload, 'admin', True)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as error:
            service.transition(second, b, 'reject', payload, 'admin', True)
        assert error.value.status_code == 409
    with sessions() as db:
        assert db.query(ExpenseApprovalHistory).count() == 2


def test_unique_report_numbers(env):
    c, _, _ = env
    assert len({draft(c)['report_no'] for _ in range(20)}) == 20


def test_actual_auth_dependencies(integration_employee_client):
    c = integration_employee_client
    response = c.post('/api/hr/expenses')
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'DRAFT'
    assert c.get('/api/admin/expenses').status_code == 403


def test_partial_ocr_discards_raw_sensitive_payload(monkeypatch):
    class Partial:
        def analyze(self, *args):
            return {'merchant_name': '상점', 'expense_date': None, 'raw_text': 'CVV 123',
                    'raw_json': {'card': '1234567812345678'}, 'card_number': '1234567812345678'}
    monkeypatch.setattr(receipt_ocr_service, 'get_provider', lambda: Partial())
    result = receipt_ocr_service.analyze(PNG, 'image/png')
    assert result == {'merchant_name': '상점', 'expense_date': None}


def test_upload_rollback_removes_disk_file(env, monkeypatch):
    c, _, sessions = env
    row = draft(c)
    def fail(db):
        from fastapi import HTTPException
        raise HTTPException(503, 'test database failure')
    monkeypatch.setattr(service, 'commit', fail)
    result = c.post(f'/hr/expenses/{row["id"]}/receipt', data={'version':row['version']}, files={'file':('r.png',PNG,'image/png')})
    assert result.status_code == 503
    assert not list(service.PRIVATE_RECEIPT_DIR.iterdir())
    with sessions() as db:
        assert db.query(ExpenseOcrResult).count() == 0
        assert db.get(ExpenseReport, row['id']).receipt_file_id is None
