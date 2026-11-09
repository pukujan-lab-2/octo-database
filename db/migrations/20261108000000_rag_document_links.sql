-- Octo Schema: links between documents, and the graph step of search (issue #42)
--
-- Hybrid search finds passages by their words and meaning. Some useful documents
-- share neither with the question but are linked to documents that do: a case
-- cited by the cases that match, a spec referenced by the matching runbook.
--
-- A workspace stores those links here (from document, to document, relation). A
-- search that asks for the graph step takes the documents behind its best hybrid
-- matches as seeds, follows their links one or two hops in either direction, and
-- returns the best passage of each linked document. The route merges that list
-- with the hybrid list by RRF before the rerank.
--
-- The composite keys make a link between two workspaces impossible, and deleting
-- a document deletes its links.

ALTER TABLE octo.documents
    ADD CONSTRAINT documents_workspace_id_id_key UNIQUE (workspace_id, id);

CREATE TABLE IF NOT EXISTS octo.document_links (
    workspace_id UUID NOT NULL REFERENCES octo.workspaces(id) ON DELETE CASCADE,
    from_document_id UUID NOT NULL,
    to_document_id UUID NOT NULL,
    relation TEXT NOT NULL CHECK (relation ~ '^[a-z][a-z0-9_]{0,39}$'),
    created_by UUID REFERENCES octo.principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, from_document_id, to_document_id, relation),
    CHECK (from_document_id <> to_document_id),
    FOREIGN KEY (workspace_id, from_document_id)
        REFERENCES octo.documents (workspace_id, id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id, to_document_id)
        REFERENCES octo.documents (workspace_id, id) ON DELETE CASCADE
);

-- The primary key serves walks from a document; this serves walks to it.
CREATE INDEX IF NOT EXISTS document_links_to
    ON octo.document_links (workspace_id, to_document_id, relation);

ALTER TABLE octo.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_links_select_member ON octo.document_links
    FOR SELECT USING (octo.is_workspace_member(workspace_id));
CREATE POLICY document_links_insert_operator ON octo.document_links
    FOR INSERT WITH CHECK (octo.get_workspace_role(workspace_id) IN ('owner', 'admin', 'operator'));
CREATE POLICY document_links_delete_operator ON octo.document_links
    FOR DELETE USING (octo.get_workspace_role(workspace_id) IN ('owner', 'admin', 'operator'));

DROP POLICY IF EXISTS tenant_scope_fence ON octo.document_links;
CREATE POLICY tenant_scope_fence ON octo.document_links
    AS RESTRICTIVE
    FOR ALL
    USING (octo.current_workspace_id() IS NULL OR workspace_id = octo.current_workspace_id())
    WITH CHECK (octo.current_workspace_id() IS NULL OR workspace_id = octo.current_workspace_id());

GRANT SELECT, INSERT, DELETE ON octo.document_links TO authenticated;

-- The graph step. Documents linked to the seeds (hops 1) or to those (hops 2),
-- excluding the seeds, ranked by how many links reach them and then by their best
-- passage's similarity to the query. One passage per document. The filter applies
-- as in match_chunks_hybrid, and so does the access check.
CREATE OR REPLACE FUNCTION octo.match_linked_chunks(
    target_workspace UUID,
    query_embedding halfvec(512),
    seed_documents UUID[],
    relations TEXT[] DEFAULT NULL,
    hops INT DEFAULT 1,
    match_count INT DEFAULT 10,
    filter_document_ids UUID[] DEFAULT NULL,
    filter_title_prefix TEXT DEFAULT NULL,
    filter_latest_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
    chunk_id UUID,
    document_version_id UUID,
    document_id UUID,
    title TEXT,
    version_number INT,
    page INT,
    content TEXT,
    chunk_index INT,
    similarity FLOAT,
    links INT,
    linked_from UUID[],
    model TEXT,
    model_version TEXT,
    chunker TEXT
) AS $$
    WITH gate AS (
        SELECT (SELECT r.rolsuper OR r.rolbypassrls FROM pg_roles r WHERE r.rolname = session_user)
            OR (octo.is_workspace_member(target_workspace)
                AND (octo.current_workspace_id() IS NULL
                     OR octo.current_workspace_id() = target_workspace)) AS allowed
    ),
    edges AS (
        SELECT l.from_document_id AS a, l.to_document_id AS b
        FROM octo.document_links l
        WHERE l.workspace_id = target_workspace
          AND (relations IS NULL OR l.relation = ANY(relations))
        UNION ALL
        SELECT l.to_document_id, l.from_document_id
        FROM octo.document_links l
        WHERE l.workspace_id = target_workspace
          AND (relations IS NULL OR l.relation = ANY(relations))
    ),
    hop1 AS (
        SELECT e.b AS document_id, e.a AS via
        FROM edges e
        WHERE e.a = ANY(seed_documents)
          AND NOT e.b = ANY(seed_documents)
    ),
    hop2 AS (
        SELECT e.b AS document_id, h.via
        FROM hop1 h
        JOIN edges e ON e.a = h.document_id
        WHERE hops >= 2
          AND NOT e.b = ANY(seed_documents)
          AND e.b <> h.document_id
    ),
    reached AS (
        SELECT r.document_id, count(*)::int AS links, array_agg(DISTINCT r.via) AS linked_from
        FROM (SELECT * FROM hop1 UNION ALL SELECT * FROM hop2) r
        JOIN octo.documents d ON d.id = r.document_id
        WHERE (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
          AND (filter_title_prefix IS NULL
               OR left(d.title, length(filter_title_prefix)) = filter_title_prefix)
        GROUP BY r.document_id
    ),
    best AS (
        SELECT r.document_id, r.links, r.linked_from, b.chunk_id, b.similarity
        FROM reached r
        CROSS JOIN LATERAL (
            SELECT c.id AS chunk_id, (1 - (e.embedding <=> query_embedding))::float AS similarity
            FROM octo.document_versions v
            JOIN octo.chunks c ON c.document_version_id = v.id
            JOIN octo.embeddings e ON e.chunk_id = c.id
            WHERE v.document_id = r.document_id
              AND (NOT coalesce(filter_latest_only, false)
                   OR v.version_number = (SELECT max(v2.version_number)
                                          FROM octo.document_versions v2
                                          WHERE v2.document_id = v.document_id))
            ORDER BY (e.embedding <=> query_embedding) + 0, c.id
            LIMIT 1
        ) b
    )
    SELECT
        c.id,
        c.document_version_id,
        dv.document_id,
        d.title,
        dv.version_number,
        c.page,
        c.content,
        c.chunk_index,
        b.similarity,
        b.links,
        b.linked_from,
        cfg.model,
        cfg.model_version,
        cfg.chunker
    FROM best b
    JOIN octo.chunks c ON c.id = b.chunk_id
    JOIN octo.document_versions dv ON dv.id = c.document_version_id
    JOIN octo.documents d ON d.id = dv.document_id
    JOIN octo.embedding_configs cfg ON cfg.id = c.config_id
    WHERE (SELECT allowed FROM gate)
    ORDER BY b.links DESC, b.similarity DESC, c.id
    LIMIT match_count;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = octo, public, pg_temp;

GRANT EXECUTE ON FUNCTION octo.match_linked_chunks(UUID, halfvec, UUID[], TEXT[], INT, INT, UUID[], TEXT, BOOLEAN)
    TO authenticated;
