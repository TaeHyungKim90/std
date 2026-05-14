import {
	clearPreferredWorkLocation,
	preferredWorkLocationStorageKey,
	readPreferredWorkLocation,
	resolvePreferredAgainstOptions,
	writePreferredWorkLocation,
} from './attendanceLocationPreference';

describe('attendanceLocationPreference', () => {
	const uid = 'user-abc';

	beforeEach(() => {
		localStorage.clear();
	});

	test('preferredWorkLocationStorageKey returns null for blank userId', () => {
		expect(preferredWorkLocationStorageKey('')).toBeNull();
		expect(preferredWorkLocationStorageKey(null)).toBeNull();
		expect(preferredWorkLocationStorageKey(undefined)).toBeNull();
	});

	test('write / read / clear round-trip', () => {
		writePreferredWorkLocation(uid, 'company');
		expect(readPreferredWorkLocation(uid)).toBe('company');
		clearPreferredWorkLocation(uid);
		expect(readPreferredWorkLocation(uid)).toBeNull();
	});

	test('write trims value', () => {
		writePreferredWorkLocation(uid, '  hq  ');
		expect(readPreferredWorkLocation(uid)).toBe('hq');
	});

	test('resolvePreferredAgainstOptions returns null when not in list', () => {
		writePreferredWorkLocation(uid, 'unknown');
		expect(resolvePreferredAgainstOptions(uid, ['company', 'hq'])).toBeNull();
	});

	test('resolvePreferredAgainstOptions returns stored when in list', () => {
		writePreferredWorkLocation(uid, 'hq');
		expect(resolvePreferredAgainstOptions(uid, ['company', 'hq'])).toBe('hq');
	});

	test('resolvePreferredAgainstOptions maps legacy label to key', () => {
		writePreferredWorkLocation(uid, '회사');
		expect(resolvePreferredAgainstOptions(uid, ['company'], { 회사: 'company' })).toBe('company');
	});
});
