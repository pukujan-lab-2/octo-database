-- A `token` auth scheme: the relay sends `Authorization: Token <secret>`.
--
-- Deepgram accepts its API key only as `Token <key>`, so a bearer lease reaches
-- the vendor and is refused as INVALID_AUTH. The column checks on routes and
-- leases were unnamed, so they are found by definition and replaced with named
-- ones that list the new scheme.

DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT con.conrelid::regclass AS tbl, con.conname
        FROM pg_constraint AS con
        WHERE con.conrelid IN ('octo.vault_routes'::regclass, 'octo.vault_leases'::regclass)
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%auth_scheme%'
          AND pg_get_constraintdef(con.oid) LIKE '%body_json%'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    END LOOP;
END $$;

ALTER TABLE octo.vault_routes
    ADD CONSTRAINT vault_routes_auth_scheme_check CHECK (auth_scheme IN
        ('bearer', 'token', 'x-api-key', 'basic', 'query', 'body_json', 'path')),
    ADD CONSTRAINT vault_route_scheme_fields CHECK (
        (auth_scheme = 'x-api-key' AND auth_header IS NOT NULL)
        OR (auth_scheme = 'query' AND auth_header IS NOT NULL)
        OR (auth_scheme = 'body_json' AND body_field IS NOT NULL)
        OR (auth_scheme = 'path' AND body_field IS NOT NULL)
        OR auth_scheme IN ('bearer', 'token', 'basic')
    );

ALTER TABLE octo.vault_leases
    ADD CONSTRAINT vault_leases_auth_scheme_check CHECK (auth_scheme IN
        ('bearer', 'token', 'x-api-key', 'basic', 'query', 'body_json', 'path'));
