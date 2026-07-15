package main

import (
	"log"
	"net/http"

	"parking-portal/internal/auth"
	"parking-portal/internal/db"
	"parking-portal/internal/fines"
	"parking-portal/internal/rules"
	"parking-portal/internal/violations"
)

func main() {
	conn, err := db.Init("portal.db")
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer conn.Close()

	log.Println("DB ready")

	authService := auth.NewService(conn)
	rulesService := rules.NewService(conn)
	finesService := fines.NewService(conn)
	violationsService := violations.NewService(conn, rulesService, finesService, "./uploads")

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/login", authService.LoginHandler)

	// /rules — officer-only, behind JWT auth + role guard.
	rulesHandler := rulesService.Handler(func(r *http.Request) (int, error) {
		userID, _, err := auth.UserFromContext(r.Context())
		return userID, err
	})
	mux.Handle("/rules", auth.Middleware(auth.RequireRole("officer")(http.HandlerFunc(rulesHandler))))

	// /violations, /violations/{id} — any authenticated user (officer
	// or member); role-based scoping (submit is officer-only, list/detail
	// are filtered by plate for members) happens inside the handler.
	violationsHandler := violationsService.Router(func(r *http.Request) (int, string, error) {
		return auth.UserFromContext(r.Context())
	})
	mux.Handle("/violations", auth.Middleware(violationsHandler))
	mux.Handle("/violations/", auth.Middleware(violationsHandler))

	// NOTE: remaining HTTP routes (payments, users) are wired here in
	// later tasks.

	addr := ":8080"
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
