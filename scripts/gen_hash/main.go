package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

// Usage: go run scripts/gen_hash/main.go <password>
// Prints a bcrypt hash of <password> to stdout so it can be pasted
// into scripts/seed.sql. Never store plaintext passwords in seed data.
func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: gen_hash <password>")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(os.Args[1]), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error generating hash:", err)
		os.Exit(1)
	}

	fmt.Println(string(hash))
}
