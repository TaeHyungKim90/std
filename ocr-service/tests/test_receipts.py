import io
import json
import time

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as service
import engine
import models
import worker as worker_module
from receipt_parser import parse_receipt


def lines(*texts):
    return [{'text': text, 'score': .99, 'box': [0, i*50, 400, i*50+30]} for i, text in enumerate(texts)]


def png(size=(10, 10)):
    buffer = io.BytesIO()
    Image.new('RGB', size, 'white').save(buffer, format='PNG')
    return buffer.getvalue()


def test_korean_fields_and_joined_datetime():
    result = parse_receipt(lines('상호명: 테스트상점', '123-45-67890', '2026-09-1212:30',
        '공급가액 10,000', '부가세 1,000', '합계금액 11,000', '신용카드 ***1234'))
    assert result == dict(merchant_name='테스트상점', business_number='123-45-67890',
        expense_date='2026-09-12', supply_amount='10000.00', vat_amount='1000.00',
        total_amount='11000.00', payment_method='CARD', masked_card_number='****1234')


def test_position_groups_separate_label_and_amount():
    result = parse_receipt([
        {'text': '합 계 금 액', 'score': .99, 'box': [10, 100, 120, 140]},
        {'text': '18,500', 'score': .99, 'box': [200, 99, 280, 141]}])
    assert result['total_amount'] == '18500.00'


@pytest.mark.parametrize('texts', [
    ('합계 11,000', '합계 22,000'), ('소계 11,000',), ('할인합계 1,000',),
    ('합계 -10,000',), ('환불합계 10,000',), ('합계 1000000000000',),
])
def test_ambiguous_or_invalid_total_is_not_guessed(texts):
    assert 'total_amount' not in parse_receipt(lines(*texts))


def test_inconsistent_tax_and_full_card_are_omitted():
    result = parse_receipt(lines('공급가액 10000', '부가세 2000', '합계 11000', '카드번호 1234567812345678', 'CVV 123'))
    assert result == {'total_amount': '11000.00', 'payment_method': 'CARD'}


def test_low_confidence_missing_date_and_tax_are_not_invented():
    items = lines('합계 11000', '상호명: 믿을수없음', '2026-02-31', '비과세금액 10000')
    items[1]['score'] = .4
    assert parse_receipt(items) == {'total_amount': '11000.00'}


def test_decode_and_image_limits(monkeypatch):
    assert engine.decode_image(png(), 'image/png').size == (10, 10)
    for data, mime in [(b'bad', 'image/png'), (png(), 'image/jpeg'), (png()[:30], 'image/png')]:
        with pytest.raises(ValueError):
            engine.decode_image(data, mime)
    monkeypatch.setattr(engine, 'MAX_PIXELS', 10)
    with pytest.raises(ValueError):
        engine.decode_image(png(), 'image/png')


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('OCR_SERVICE_TOKEN', 'test-only-key-with-at-least-32-characters')
    monkeypatch.setattr(service, 'verify_models', lambda: None)
    monkeypatch.setattr(service.worker, 'infer', lambda *args: {'result': {'total_amount': '11000.00'}})
    with TestClient(service.app) as c:
        yield c


HEADERS = {'Authorization': 'Bearer test-only-key-with-at-least-32-characters', 'Content-Type': 'image/png'}


def test_api_auth_size_mime_and_result(client, monkeypatch):
    assert client.post('/recognize', content=png()).status_code == 401
    assert client.post('/recognize', headers={**HEADERS, 'Content-Type': 'text/plain'}, content=b'hi').status_code == 415
    assert client.post('/recognize', headers=HEADERS, content=b'').status_code == 422
    monkeypatch.setattr(service, 'MAX_BYTES', 5)
    assert client.post('/recognize', headers=HEADERS, content=png()).status_code == 413
    monkeypatch.setattr(service, 'MAX_BYTES', 10*1024*1024)
    assert client.post('/recognize', headers=HEADERS, content=png()).json() == {'total_amount': '11000.00'}


def test_api_timeout_failure_and_busy(client, monkeypatch):
    service.app.state.busy = True
    assert client.post('/recognize', headers=HEADERS, content=png()).status_code == 429
    service.app.state.busy = False
    def timeout(*args): raise TimeoutError()
    monkeypatch.setattr(service.worker, 'infer', timeout)
    assert client.post('/recognize', headers=HEADERS, content=png()).status_code == 504
    assert service.app.state.busy is False
    monkeypatch.setattr(service.worker, 'infer', lambda *args: {'error': 'inference_failed'})
    assert client.post('/recognize', headers=HEADERS, content=png()).status_code == 503


def stalled_child(connection):
    connection.recv()
    time.sleep(120)


def test_worker_is_killed_on_deadline(monkeypatch):
    monkeypatch.setattr(worker_module, '_run', stalled_child)
    worker = worker_module.Worker(timeout=.2)
    try:
        with pytest.raises(TimeoutError):
            worker.infer(png(), 'image/png')
        assert worker.process is None
    finally:
        worker.close()


def test_worker_rejects_parallel_requests():
    worker = worker_module.Worker()
    worker.lock.acquire()
    try:
        with pytest.raises(worker_module.BusyError):
            worker.infer(png(), 'image/png')
    finally:
        worker.lock.release()


def test_tampered_models_are_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(models, 'MODEL_ROOT', tmp_path)
    (tmp_path / 'manifest.json').write_text(json.dumps({'artifacts': models.ARTIFACTS, 'files': {}}))
    (tmp_path / 'modified.bin').write_bytes(b'changed')
    with pytest.raises(ValueError, match='integrity'):
        models.verify_models()
