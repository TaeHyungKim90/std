import { describe, expect, it } from 'vitest';

import { normalizePhoneDigits } from './phoneNormalize';

describe('normalizePhoneDigits', () => {
	it('converts Kakao +82 mobile to 010…', () => {
		expect(normalizePhoneDigits('+82 10-1234-5678')).toBe('01012345678');
		expect(normalizePhoneDigits('+82-10-9876-5432')).toBe('01098765432');
	});

	it('keeps domestic 010 numbers', () => {
		expect(normalizePhoneDigits('010-1234-5678')).toBe('01012345678');
		expect(normalizePhoneDigits('01012345678')).toBe('01012345678');
	});

	it('does not truncate 82 before converting', () => {
		// buggy old path: replace(/\D/g,'').slice(0,11) → '82101234567'
		expect(normalizePhoneDigits('821012345678')).toBe('01012345678');
	});
});
