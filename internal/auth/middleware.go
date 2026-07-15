package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type contextKey string

const (
	userIDKey contextKey = "userID"
	roleKey   contextKey = "role"
)

// Middleware validates the Bearer token on the request and injects the
// authenticated user's id + role into the request context. Requests with
// a missing, malformed, expired, or invalid token get a 401 and never
// reach the next handler.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		tokenStr, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || tokenStr == "" {
			writeError(w, http.StatusUnauthorized, "missing or malformed Authorization header")
			return
		}

		claims, err := ParseToken(tokenStr)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		ctx = context.WithValue(ctx, roleKey, claims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole returns middleware that only lets requests through if the
// context's role (set by Middleware) matches the given role. Must be
// mounted behind Middleware. Mismatches get a 403.
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, userRole, err := UserFromContext(r.Context())
			if err != nil || userRole != role {
				writeError(w, http.StatusForbidden, "you do not have access to this resource")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// UserFromContext extracts the authenticated user id + role that Middleware
// injected into the request context.
func UserFromContext(ctx context.Context) (userID int, role string, err error) {
	id, ok := ctx.Value(userIDKey).(int)
	if !ok {
		return 0, "", errors.New("no authenticated user in context")
	}
	r, ok := ctx.Value(roleKey).(string)
	if !ok {
		return 0, "", errors.New("no role in context")
	}
	return id, r, nil
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
