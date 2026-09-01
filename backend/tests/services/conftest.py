"""Service-layer test defaults for multi-tenant."""

import pytest

from support.memory_db import DEFAULT_TEST_TENANT_ID

TID = DEFAULT_TEST_TENANT_ID


@pytest.fixture()
def tenant_id():
	return TID
