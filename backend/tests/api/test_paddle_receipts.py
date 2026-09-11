import httpx
import pytest
import os
from pathlib import Path

from core.config import settings
from services import receipt_ocr_service
from services.paddle_receipt_provider import PaddleReceiptProvider


@pytest.fixture
def paddle_transport(monkeypatch):
    monkeypatch.setattr(settings, 'OCR_PROVIDER', 'paddleocr')
    monkeypatch.setattr(settings, 'OCR_SERVICE_URL', 'http://ocr.internal:8010')
    monkeypatch.setattr(settings, 'OCR_SERVICE_TOKEN', 'test-service-key')
    original = httpx.Client
    def setup(handler):
        monkeypatch.setattr(httpx, 'Client', lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    return setup


def test_provider_sends_only_image_and_filters_output(paddle_transport):
    def handler(request):
        assert str(request.url) == 'http://ocr.internal:8010/recognize'
        assert request.headers['Authorization'] == 'Bearer test-service-key'
        assert request.content == b'image'
        return httpx.Response(200, json={'total_amount': '11000.00', 'merchant_name': '상점', 'raw_text': 'secret card data'})
    paddle_transport(handler)
    assert receipt_ocr_service.analyze(b'image', 'image/png') == {'total_amount': '11000.00', 'merchant_name': '상점'}


@pytest.mark.parametrize('status', [401, 413, 422, 429, 503, 504, 302])
def test_provider_rejects_errors_and_redirects(paddle_transport, status):
    paddle_transport(lambda request: httpx.Response(status, headers={'Location': 'http://elsewhere'}))
    with pytest.raises(httpx.HTTPStatusError):
        PaddleReceiptProvider().analyze(b'image', 'image/png')


def test_provider_bounds_response_and_requires_configuration(paddle_transport, monkeypatch):
    paddle_transport(lambda request: httpx.Response(200, content=b'x'*65537))
    with pytest.raises(ValueError, match='too large'):
        PaddleReceiptProvider().analyze(b'image', 'image/png')
    monkeypatch.setattr(settings, 'OCR_SERVICE_TOKEN', '')
    with pytest.raises(ValueError, match='configured'):
        PaddleReceiptProvider().analyze(b'image', 'image/png')


@pytest.mark.skipif(not os.getenv('OCR_LIVE_URL'), reason='Requires a running real PaddleOCR service')
def test_live_hr_upload(integration_employee_client, monkeypatch, tmp_path):
    from services import expense_service
    monkeypatch.setattr(expense_service, 'PRIVATE_RECEIPT_DIR', tmp_path)
    monkeypatch.setattr(settings, 'OCR_PROVIDER', 'paddleocr')
    monkeypatch.setattr(settings, 'OCR_SERVICE_URL', os.environ['OCR_LIVE_URL'])
    monkeypatch.setattr(settings, 'OCR_SERVICE_TOKEN', os.environ['OCR_SERVICE_TOKEN'])
    client = integration_employee_client
    report = client.post('/api/hr/expenses').json()
    response = client.post(f'/api/hr/expenses/{report["id"]}/receipt',
        data={'version': report['version']},
        files={'file': ('fixture.png', Path(os.environ['OCR_LIVE_RECEIPT']).read_bytes(), 'image/png')})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['ocr']['ocr_provider'] == 'paddleocr'
    assert result['ocr']['status'] == 'SUCCEEDED', result
    assert result['ocr']['data']['total_amount'] == '11000.00'
    assert result['ocr']['data']['business_number'] == '123-45-67890'
    assert result['status'] == 'DRAFT'
    assert result['total_amount'] == '0.00'  # Suggestions still require human review.
