# HR 프로젝트 공통 작업 (CI와 동일한 lint/test)
.PHONY: help lint lint-backend lint-frontend test test-backend test-frontend

help:
	@echo "Available targets:"
	@echo "  make lint            - backend + frontend lint"
	@echo "  make lint-backend    - compileall + pyright"
	@echo "  make lint-frontend   - eslint"
	@echo "  make test            - backend + frontend tests"
	@echo "  make test-backend    - pytest"
	@echo "  make test-frontend   - frontend test:ci (craco)"

lint: lint-backend lint-frontend

lint-backend:
	cd backend && uv run python -m compileall app tests
	uv run --project backend pyright

lint-frontend:
	cd frontend && npm run lint

test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && npm run test:ci
