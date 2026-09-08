import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

vi.mock('context/TenantContext', async () => {
	const mod = await import('testUtils/mockTenantContext');
	return mod.default;
});
