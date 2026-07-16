package main

import (
	"fmt"
	"log"

	"parking-portal/internal/db"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	conn, err := db.Init("portal.db")
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	officerHash, err := bcrypt.GenerateFromPassword([]byte("officer123"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	memberHash, err := bcrypt.GenerateFromPassword([]byte("member123"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	_, err = conn.Exec(`INSERT INTO users (email, password_hash, role, plate, balance) VALUES
		(?, ?, 'officer', NULL, 0),
		(?, ?, 'member', 'B1234XYZ', 2000000)`,
		"officer@portal.com", string(officerHash),
		"member@portal.com", string(memberHash),
	)
	if err != nil {
		log.Fatal(err)
	}

	_, err = conn.Exec(`INSERT INTO rule_versions (published_by, published_at, is_active, base_amounts, time_multipliers, repeat_multipliers) VALUES
		(1, datetime('now'), 1, '{"speeding":100000,"illegal_parking":50000}', '{"night":1.5,"day":1.0}', '{"1":1.5,"2":2.0}')`)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Seed complete.")
}
