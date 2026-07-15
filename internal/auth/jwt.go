package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"
)

// Claims is the JWT payload: subject (user id), role, and expiry.
// Matches The Plan: { sub: user_id, role, exp: now+24h }.
type Claims struct {
	UserID int    `json:"sub"`
	Role   string `json:"role"`
	Exp    int64  `json:"exp"`
}

const tokenTTL = 24 * time.Hour

var jwtHeader = []byte(`{"alg":"HS256","typ":"JWT"}`)

// secret reads JWT_SECRET from the environment, defaulting to "dev-secret"
// for local use (per The Plan).
func secret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("dev-secret")
}

// IssueToken builds a signed JWT for the given user id + role, valid for 24h.
//
// This is a small hand-rolled HS256 JWT (header.payload.signature, all
// base64url, HMAC-SHA256 signature) rather than a third-party library.
// For a single local demo route it keeps the dependency list at zero and
// is easy to read top-to-bottom; a real deployment would use a vetted
// library instead (documented as a trade-off in DESIGN.md).
func IssueToken(userID int, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		Exp:    time.Now().Add(tokenTTL).Unix(),
	}

	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	headerB64 := base64.RawURLEncoding.EncodeToString(jwtHeader)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := headerB64 + "." + claimsB64

	return signingInput + "." + sign(signingInput), nil
}

// ParseToken validates the signature and expiry of a JWT and returns its claims.
func ParseToken(token string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("malformed token")
	}

	signingInput := parts[0] + "." + parts[1]
	if !hmac.Equal([]byte(sign(signingInput)), []byte(parts[2])) {
		return nil, errors.New("invalid token signature")
	}

	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("invalid token payload")
	}

	var claims Claims
	if err := json.Unmarshal(claimsJSON, &claims); err != nil {
		return nil, errors.New("invalid token payload")
	}

	if time.Now().Unix() > claims.Exp {
		return nil, errors.New("token expired")
	}

	return &claims, nil
}

func sign(signingInput string) string {
	h := hmac.New(sha256.New, secret())
	h.Write([]byte(signingInput))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
