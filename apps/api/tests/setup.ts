// Unit tests import service modules that construct a lazy PostgreSQL pool.
// Give those imports a non-routable test-only URL without using developer or
// deployment secrets; tests that exercise SQL provide their own query doubles.
process.env.DATABASE_URL ??=
  'postgresql://edunets_app.test:unit-test-only@127.0.0.1:6543/postgres';
