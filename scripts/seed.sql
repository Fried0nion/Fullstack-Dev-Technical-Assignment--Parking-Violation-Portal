-- Seed data for local demo.
-- Credentials (plaintext, for testing only):
--   officer@portal.com / officer123
--   member@portal.com  / member123
-- Hashes below were generated with bcrypt (cost 12) and are valid
-- for use with golang.org/x/crypto/bcrypt. Regenerate with:
--   go run scripts/gen_hash/main.go <password>

INSERT INTO users (email, password_hash, role, plate, balance)
VALUES (
    'officer@portal.com',
    '$2b$12$QeddoWyMcnqZBaZApToKu.ihSvhZOl4IYOQ2aNMKlpmH5YGqk4OPK',
    'officer',
    NULL,
    0
);

INSERT INTO users (email, password_hash, role, plate, balance)
VALUES (
    'member@portal.com',
    '$2b$12$CQeYh2GAFQiqjf34OOVEoOWuEYAlHv1gR.uH5lloYMoc1pV.4ZJ8a',
    'member',
    'B1234XYZ',
    2000000
);

-- Day-one rule version, published by the seeded officer (user id 1).
INSERT INTO rule_versions (published_by, is_active, base_amounts, time_multipliers, repeat_multipliers)
VALUES (
    1,
    1,
    '{"illegal_parking": 100000, "no_parking_zone": 150000, "blocking_access": 200000, "expired_meter": 50000}',
    '{"day": 1.0, "night": 1.5, "night_start_hour": 22, "night_end_hour": 6}',
    '{"1": 1.5, "2": 2.0, "3": 3.0}'
);
