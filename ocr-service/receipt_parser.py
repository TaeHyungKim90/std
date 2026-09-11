"""Conservative Korean receipt extraction. Missing/ambiguous amounts stay absent."""
import re
from datetime import date
from decimal import Decimal


def parse_receipt(lines: list[dict]) -> dict:
    rows = []
    # Cluster boxes on the same printed line so label/value columns stay together.
    for item in sorted(lines, key=lambda item: (item["box"][1], item["box"][0])):
        if item["score"] < 0.65:
            continue
        x1, y1, x2, y2 = item["box"]
        center = (y1 + y2) / 2
        match = next((r for r in reversed(rows) if abs(r["y"] - center) <= max(4, (y2-y1)*0.45)), None)
        if match is None:
            match = {"y": center, "items": []}
            rows.append(match)
        match["items"].append(item)
    texts = [" ".join(i["text"] for i in sorted(r["items"], key=lambda i: i["box"][0])) for r in rows]
    result = {}
    full = "\n".join(texts)
    # OCR often drops the space between a date and its following time.
    full = re.sub(r"(20\d{2}[./-]\d{2}[./-]\d{2})(?=(?:[01]\d|2[0-3]):[0-5]\d)", r"\1 ", full)
    business = re.findall(r"(?<!\d)(\d{3})\s*-\s*(\d{2})\s*-\s*(\d{5})(?!\d)", full)
    if len(set(business)) == 1:
        result["business_number"] = "-".join(business[0])
    dates = set()
    for year, month, day in re.findall(r"(?<!\d)(20\d{2})[./년-]\s*(\d{1,2})[./월-]\s*(\d{1,2})(?!\d)", full):
        try:
            dates.add(date(int(year), int(month), int(day)).isoformat())
        except ValueError:
            pass
    if len(dates) == 1:
        result["expense_date"] = dates.pop()
    candidates = {"total_amount": set(), "vat_amount": set(), "supply_amount": set()}
    labels = {"total_amount": r"(?:합계금액|합계|총액|총금액|결제금액|결제액|청구금액)",
              "vat_amount": r"(?:부가세|부가가치세|VAT)",
              "supply_amount": r"(?:공급가액|과세금액|과세물품가액)"}
    for text in texts:
        compact = re.sub(r"\s+", "", text).upper()
        if any(word in compact for word in ("소계", "할인", "면세", "비과세", "취소", "환불")):
            continue
        for field, label in labels.items():
            match = re.search(label + r"[:：]?([0-9][0-9,]*(?:\.\d{1,2})?)(?:원|KRW|₩)?$", compact)
            if match:
                amount = Decimal(match.group(1).replace(",", ""))
                if amount < Decimal("1000000000000"):
                    candidates[field].add(amount)
    for field, amounts in candidates.items():
        if len(amounts) == 1:
            result[field] = f"{amounts.pop():.2f}"
    if all(k in result for k in candidates) and Decimal(result['supply_amount']) + Decimal(result['vat_amount']) != Decimal(result['total_amount']):
        # Never auto-correct tax differences or infer VAT from total/1.1.
        result.pop('supply_amount')
        result.pop('vat_amount')
    for text in texts[:6]:
        named = re.search(r"(?:상호명|상호|가맹점명)\s*[:：]?\s*(.+)", text)
        if named:
            value = named.group(1).strip()
            if 1 < len(value) <= 100 and not re.search(r"\d{4}|\*|카드|CVV|CVC", value, re.I):
                result["merchant_name"] = value
                break
    if re.search(r"카드|신용|체크", full):
        result['payment_method'] = 'CARD'
    elif '현금' in full:
        result['payment_method'] = 'CASH'
    # Only an already-masked card pattern is accepted. Never retain raw card text.
    masked = re.search(r"[\*xX•]{3,}[\s-]*(\d{4})(?!\d)", full)
    if masked:
        result['masked_card_number'] = '****' + masked.group(1)
    return result
