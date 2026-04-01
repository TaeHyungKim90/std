from datetime import date, timedelta


def validate_report_date_range(d: date, name: str) -> None:
	"""과거 3년 초과 / 미래 1년 초과 날짜를 공통 검증한다."""
	today = date.today()
	min_date = today - timedelta(days=365 * 3)
	max_date = today + timedelta(days=365 * 1)
	if d < min_date:
		raise ValueError(f"{name}는 너무 과거입니다. ({min_date.isoformat()} 이후만 허용)")
	if d > max_date:
		raise ValueError(f"{name}는 너무 미래입니다. ({max_date.isoformat()} 이전만 허용)")
