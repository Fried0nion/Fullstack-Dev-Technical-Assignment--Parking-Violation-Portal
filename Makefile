.PHONY: setup gen-hashes seed run run-backend run-frontend tables

setup:
	go mod tidy

# Prints bcrypt hashes for the demo passwords (already embedded in seed.sql,
# only needed if you change the passwords).
gen-hashes:
	go run ./scripts/gen_hash officer123
	go run ./scripts/gen_hash member123

seed:
	sqlite3 portal.db < scripts/seed.sql

tables:
	sqlite3 portal.db ".tables"

run-backend:
	go run ./cmd

run: run-backend
