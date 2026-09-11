import io
import os
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from models import MODEL_ROOT, verify_models
from receipt_parser import parse_receipt

MAX_PIXELS = 12_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def decode_image(data: bytes, mime: str):
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        try:
            with Image.open(io.BytesIO(data)) as probe:
                if probe.format != {'image/jpeg': 'JPEG', 'image/png': 'PNG'}.get(mime):
                    raise ValueError('Image format mismatch')
                if probe.width * probe.height > MAX_PIXELS or getattr(probe, 'n_frames', 1) != 1:
                    raise ValueError('Image dimensions or frame count exceeded')
                probe.verify()
            with Image.open(io.BytesIO(data)) as image:
                image.load()
                rgb = ImageOps.exif_transpose(image).convert('RGB')
                rgb.thumbnail((2500, 2500))
                return rgb
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError('Invalid receipt image') from exc


def make_engine():
    verify_models()
    os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
    from paddleocr import PaddleOCR
    return PaddleOCR(
        text_detection_model_name='PP-OCRv5_mobile_det',
        text_detection_model_dir=str(MODEL_ROOT / 'PP-OCRv5_mobile_det'),
        text_recognition_model_name='korean_PP-OCRv5_mobile_rec',
        text_recognition_model_dir=str(MODEL_ROOT / 'korean_PP-OCRv5_mobile_rec'),
        use_doc_orientation_classify=False, use_doc_unwarping=False,
        use_textline_orientation=False, device='cpu', cpu_threads=2,
        enable_mkldnn=False,
    )


def recognize(engine, data: bytes, mime: str):
    import numpy as np
    image = decode_image(data, mime)
    prediction = list(engine.predict(np.asarray(image)[:, :, ::-1]))
    lines = []
    for page in prediction:
        for text, score, box in zip(page['rec_texts'], page['rec_scores'], page['rec_boxes']):
            if len(lines) >= 500 or len(text) > 500:
                raise ValueError('Too much receipt text')
            lines.append({'text': str(text), 'score': float(score), 'box': list(map(int, box))})
    result = parse_receipt(lines)
    if not result:
        raise ValueError('No receipt fields recognized')
    # Raw lines, addresses and full card data never leave this process.
    return result
