import { describe, expect, it } from 'vitest';

import { formatBirthDateForExport, formatPhoneDisplay } from './contactExportFormat';

describe('contactExportFormat', () => {
	it('formats phone with hyphens and leading zero', () => {
		expect(formatPhoneDisplay('01036652602')).toBe('010-3665-2602');
		expect(formatPhoneDisplay('1036652602')).toBe('010-3665-2602');
		expect(formatPhoneDisplay('+82 10-3665-2602')).toBe('010-3665-2602');
	});

	it('formats birth as YYYY-MM-DD', () => {
		expect(formatBirthDateForExport('1990-05-05')).toBe('1990-05-05');
		expect(formatBirthDateForExport('19900505')).toBe('1990-05-05');
		expect(formatBirthDateForExport('05-05-1990')).toBe('1990-05-05');
	});
});
