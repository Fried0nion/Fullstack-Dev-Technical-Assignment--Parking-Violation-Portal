.PHONY: setup seed run run-backend run-frontend build-frontend lint-frontend frontend-install tables

setup:
	go mod tidy
	cd frontend && npm ci

frontend-install:
	cd frontend && npm ci

build-frontend:
	cd frontend && npm run build

lint-frontend:
	cd frontend && npm run lint

run-frontend:
	cd frontend && npm run dev

seed:
	go run ./scripts/seed

tables:
	sqlite3 portal.db ".tables"

run-backend:
	go run ./cmd

run: run-backend
