"""Internal OCR service client. Never sends user IDs, credentials or tenant records."""
import httpx


class PaddleReceiptProvider:
    def analyze(self, image_bytes: bytes, content_type: str) -> dict:
        from core.config import settings
        if not settings.OCR_SERVICE_URL or not settings.OCR_SERVICE_TOKEN:
            raise ValueError("PaddleOCR service is not configured")
        # URL is administrator configuration, never taken from an upload/request.
        with httpx.Client(timeout=httpx.Timeout(settings.OCR_TIMEOUT_SECONDS, connect=3),
                          follow_redirects=False, trust_env=False) as client:
            with client.stream("POST", settings.OCR_SERVICE_URL.rstrip("/") + "/recognize",
                headers={"Authorization": f"Bearer {settings.OCR_SERVICE_TOKEN}",
                         "Content-Type": content_type}, content=image_bytes) as response:
                response.raise_for_status()
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > 65536:
                        raise ValueError("OCR response too large")
        import json
        result = json.loads(body)
        if not isinstance(result, dict):
            raise ValueError("Invalid OCR response")
        return result
