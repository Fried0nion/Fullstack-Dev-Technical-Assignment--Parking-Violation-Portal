package main

import (
	"log"
	"net/http"

	"parking-portal/internal/auth"
	"parking-portal/internal/db"
	"parking-portal/internal/fines"
	"parking-portal/internal/payments"
	"parking-portal/internal/rules"
	"parking-portal/internal/users"
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
	usersService := users.NewService(conn)
	violationsService := violations.NewService(conn, rulesService, finesService, usersService, "./uploads")
	paymentsService := payments.NewService(conn, finesService, usersService)

	// userFromContext is the closure all handlers use to extract the
	// JWT-identified user from the request context (injected by auth.Middleware).
	userFromContext := func(r *http.Request) (int, string, error) {
		return auth.UserFromContext(r.Context())
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/login", authService.LoginHandler)

	// /rules — officer-only, behind JWT auth + role guard.
	rulesHandler := rulesService.Handler(func(r *http.Request) (int, error) {
		userID, _, err := auth.UserFromContext(r.Context())
		return userID, err
	})
	mux.Handle("/rules", auth.Middleware(auth.RequireRole("officer")(http.HandlerFunc(rulesHandler))))
	mux.Handle("/rules/", auth.Middleware(auth.RequireRole("officer")(http.HandlerFunc(rulesHandler))))

	// /violations, /violations/{id} — any authenticated user (officer
	// or member); role-based scoping (submit is officer-only, list/detail
	// are filtered by plate for members) happens inside the handler.
	violationsHandler := violationsService.Router(userFromContext)
	mux.Handle("/violations", auth.Middleware(violationsHandler))
	mux.Handle("/violations/", auth.Middleware(violationsHandler))

	// /users/me, /users/me/balance — any authenticated user.
	usersHandler := usersService.Router(userFromContext)
	mux.Handle("/users/me", auth.Middleware(usersHandler))
	mux.Handle("/users/me/balance", auth.Middleware(usersHandler))

	// /payments — member-only, behind JWT auth + role guard.
	paymentsHandler := paymentsService.Router(userFromContext)
	mux.Handle("/payments", auth.Middleware(auth.RequireRole("member")(paymentsHandler)))

	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	addr := ":8080"
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
