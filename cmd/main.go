package main

import (
	"log"

	"parking-portal/internal/db"
)

func main() {
	conn, err := db.Init("portal.db")
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer conn.Close()

	log.Println("DB ready")

	// NOTE: HTTP routes (auth, rules, violations, fines, payments, users)
	// are wired here in later tasks. Task 1 only sets up the schema.
}
