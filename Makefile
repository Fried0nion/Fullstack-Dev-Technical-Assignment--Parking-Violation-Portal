.PHONY: setup gen-hashes seed run run-backend run-frontend build-frontend lint-frontend frontend-install tables

setup:
	go mod tidy
	cd frontend && npm ci

frontend-install:
	cd frontend && npm ci

# Prints bcrypt hashes for the demo passwords (already embedded in seed.sql,
# only needed if you change the passwords).
gen-hashes:
	go run ./scripts/gen_hash officer123
	go run ./scripts/gen_hash member123

build-frontend:
	cd frontend && npm run build

lint-frontend:
	cd frontend && npm run lint

run-frontend:
	cd frontend && npm run dev

seed:
	sqlite3 portal.db < scripts/seed.sql

tables:
	sqlite3 portal.db ".tables"

run-backend:
	go run ./cmd

run: run-backend
