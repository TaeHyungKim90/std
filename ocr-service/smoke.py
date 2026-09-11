"""Run the actual CPU model on a locally generated Korean receipt, no personal data."""
import argparse
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from worker import Worker


def receipt_image(font_path):
    image = Image.new('RGB', (1000, 1050), 'white')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), 38)
    for index, line in enumerate([
        '상호명: 테스트상점', '사업자번호: 123-45-67890', '2026-09-12 12:30',
        '상품                     10,000', '공급가액                10,000',
        '부가세                   1,000', '합계금액                11,000',
        '신용카드                 ****1234',
    ]):
        draw.text((50, 40 + index * 115), line, font=font, fill='black')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--font', required=True, type=Path)
    args = parser.parse_args()
    worker = Worker(timeout=60)
    try:
        result = worker.infer(receipt_image(args.font), 'image/png')
        print(json.dumps(result, ensure_ascii=True))
        assert result.get('result', {}).get('total_amount') == '11000.00', result
        assert result['result'].get('business_number') == '123-45-67890', result
        assert result['result'].get('expense_date') == '2026-09-12', result
    finally:
        worker.close()


if __name__ == '__main__':
    main()
