package main

import (
	"log"
	"net/http"

	"parking-portal/internal/auth"
	"parking-portal/internal/db"
)

func main() {
	conn, err := db.Init("portal.db")
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer conn.Close()

	log.Println("DB ready")

	authService := auth.NewService(conn)

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/login", authService.LoginHandler)

	// NOTE: remaining HTTP routes (rules, violations, fines, payments, users)
	// are wired here in later tasks.

	addr := ":8080"
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
