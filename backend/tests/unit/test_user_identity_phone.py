"""user_identity 정규화 단위 테스트."""

from utils.user_identity import normalize_phone_number


def test_normalize_phone_kakao_plus_82():
	assert normalize_phone_number("+82 10-1234-5678") == "01012345678"
	assert normalize_phone_number("+82-10-9876-5432") == "01098765432"


def test_normalize_phone_domestic():
	assert normalize_phone_number("010-1234-5678") == "01012345678"
	assert normalize_phone_number("01012345678") == "01012345678"


def test_normalize_phone_82_digits_without_plus():
	assert normalize_phone_number("821012345678") == "01012345678"
