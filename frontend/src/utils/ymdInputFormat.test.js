import { completeYmdOrEmpty, formatDigitsToYmd, isCompleteYmd } from './ymdInputFormat';

describe('ymdInputFormat', () => {
	test('19900505 → 1990-05-05', () => {
		expect(formatDigitsToYmd('19900505')).toBe('1990-05-05');
	});

	test('중간 입력도 하이픈을 붙인다', () => {
		expect(formatDigitsToYmd('1990')).toBe('1990');
		expect(formatDigitsToYmd('199005')).toBe('1990-05');
		expect(formatDigitsToYmd('1990-05-05')).toBe('1990-05-05');
	});

	test('비숫자·초과 자릿수는 무시한다', () => {
		expect(formatDigitsToYmd('1990abc0505xx')).toBe('1990-05-05');
		expect(formatDigitsToYmd('199005051999')).toBe('1990-05-05');
	});

	test('completeYmdOrEmpty', () => {
		expect(completeYmdOrEmpty('1990-05-05')).toBe('1990-05-05');
		expect(completeYmdOrEmpty('1990-05')).toBe('');
		expect(isCompleteYmd('1990-05-05')).toBe(true);
		expect(isCompleteYmd('19900505')).toBe(false);
	});
});
