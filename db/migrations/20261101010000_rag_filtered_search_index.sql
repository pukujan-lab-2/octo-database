-- Octo Schema: filtered RAG search uses the indexes
--
-- Issue #38: a search with filter_title_prefix, filter_document_ids or
-- filter_latest_only listed every allowed chunk first, then compared the query with
-- each of them (ORDER BY ... + 0), so its time grew with the size of the filter.
--
-- Now the function looks for up to 2,000 chunks that pass the filter. Fewer than
-- that are searched exactly, as before. A wider filter walks the HNSW index
-- (hnsw.iterative_scan) and the keyword hits in rank order, checking each
-- candidate's document until enough pass. If the walk comes back short, because the
-- filtered chunks lie away from the query, they are searched exactly.
--
-- Same signature, result columns, access check and grant as before.

CREATE OR REPLACE FUNCTION octo.match_chunks_hybrid(
    target_workspace UUID,
    query_embedding halfvec(512),
    query_text TEXT,
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
    lexical_score FLOAT,
    score FLOAT,
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
    params AS (
        SELECT (filter_document_ids IS NOT NULL
                OR filter_title_prefix IS NOT NULL
                OR coalesce(filter_latest_only, false)) AS filtered
    ),
    -- A filter that matches only a few chunks is cheapest to search exactly; a wide
    -- one is cheapest to search on the indexes, checking each candidate's document.
    -- Up to 2,000 matching chunks decide which.
    probe AS MATERIALIZED (
        SELECT c.id AS chunk_id
        FROM octo.documents d
        JOIN octo.document_versions v ON v.document_id = d.id
        JOIN octo.chunks c ON c.document_version_id = v.id
        WHERE d.workspace_id = target_workspace
          AND (SELECT filtered FROM params)
          AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
          AND (filter_title_prefix IS NULL
               OR left(d.title, length(filter_title_prefix)) = filter_title_prefix)
          AND (NOT coalesce(filter_latest_only, false)
               OR v.version_number = (SELECT max(v2.version_number)
                                      FROM octo.document_versions v2
                                      WHERE v2.document_id = v.document_id))
        LIMIT 2000
    ),
    mode AS (
        SELECT CASE
                   WHEN NOT (SELECT filtered FROM params) THEN 'all'
                   WHEN (SELECT count(*) FROM probe) < 2000 THEN 'few'
                   ELSE 'many'
               END AS m
    ),
    vec_all AS (
        SELECT e.chunk_id, 1 - (e.embedding <=> query_embedding) AS similarity
        FROM octo.embeddings e
        WHERE e.workspace_id = target_workspace
          AND (SELECT m FROM mode) = 'all'
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count * 4
    ),
    vec_few AS (
        SELECT e.chunk_id, 1 - (e.embedding <=> query_embedding) AS similarity
        FROM probe p
        JOIN octo.embeddings e ON e.chunk_id = p.chunk_id
        WHERE e.workspace_id = target_workspace
          AND (SELECT m FROM mode) = 'few'
        ORDER BY (e.embedding <=> query_embedding) + 0
        LIMIT match_count * 4
    ),
    -- The index walk (hnsw.iterative_scan, set on the function) keeps going until
    -- enough candidates pass the filter or it has read hnsw.max_scan_tuples.
    vec_many AS MATERIALIZED (
        SELECT e.chunk_id, 1 - (e.embedding <=> query_embedding) AS similarity
        FROM octo.embeddings e
        WHERE e.workspace_id = target_workspace
          AND (SELECT m FROM mode) = 'many'
          AND coalesce((
                SELECT (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
                  AND (filter_title_prefix IS NULL
                       OR left(d.title, length(filter_title_prefix)) = filter_title_prefix)
                  AND (NOT coalesce(filter_latest_only, false)
                       OR v.version_number = (SELECT max(v2.version_number)
                                              FROM octo.document_versions v2
                                              WHERE v2.document_id = v.document_id))
                FROM octo.chunks c
                JOIN octo.document_versions v ON v.id = c.document_version_id
                JOIN octo.documents d ON d.id = v.document_id
                WHERE c.id = e.chunk_id), false)
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count * 4
    ),
    -- A walk that came back short means the filtered chunks lie away from the
    -- query; search them exactly.
    vec_exact AS (
        SELECT e.chunk_id, 1 - (e.embedding <=> query_embedding) AS similarity
        FROM octo.documents d
        JOIN octo.document_versions v ON v.document_id = d.id
        JOIN octo.chunks c ON c.document_version_id = v.id
        JOIN octo.embeddings e ON e.chunk_id = c.id
        WHERE d.workspace_id = target_workspace
          AND (SELECT m FROM mode) = 'many'
          AND (SELECT count(*) FROM vec_many) < match_count * 4
          AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
          AND (filter_title_prefix IS NULL
               OR left(d.title, length(filter_title_prefix)) = filter_title_prefix)
          AND (NOT coalesce(filter_latest_only, false)
               OR v.version_number = (SELECT max(v2.version_number)
                                      FROM octo.document_versions v2
                                      WHERE v2.document_id = v.document_id))
        ORDER BY (e.embedding <=> query_embedding) + 0
        LIMIT match_count * 4
    ),
    vec_raw AS (
        SELECT * FROM vec_all
        UNION ALL SELECT * FROM vec_few
        UNION ALL SELECT * FROM vec_many
        WHERE (SELECT count(*) FROM vec_many) >= match_count * 4
        UNION ALL SELECT * FROM vec_exact
    ),
    vec_ranked AS (
        SELECT chunk_id, similarity::float AS similarity,
               row_number() OVER (ORDER BY similarity DESC, chunk_id) AS rank
        FROM vec_raw
    ),
    query_lexemes AS (
        SELECT string_agg(quote_literal(lexeme), ' | ') AS tsq
        FROM unnest(
            to_tsvector(
                'english',
                regexp_replace(coalesce(query_text, ''), '[^A-Za-z0-9]+', ' ', 'g')
            )
        ) AS t(lexeme, positions, weights)
    ),
    query_tsq AS (
        SELECT to_tsquery('english', NULLIF(tsq, '')) AS tsq FROM query_lexemes
    ),
    lex_hits AS (
        SELECT c.id AS chunk_id, ts_rank(c.content_tsv, q.tsq)::float AS lexical_score
        FROM octo.chunks c
        CROSS JOIN query_tsq q
        WHERE c.workspace_id = target_workspace
          AND (SELECT m FROM mode) <> 'few'
          AND q.tsq IS NOT NULL
          AND c.content_tsv @@ q.tsq
        ORDER BY lexical_score DESC, c.id
    ),
    lex_all AS (
        SELECT * FROM lex_hits
        WHERE (SELECT m FROM mode) = 'all'
        LIMIT match_count * 4
    ),
    lex_few AS (
        SELECT c.id AS chunk_id, ts_rank(c.content_tsv, q.tsq)::float AS lexical_score
        FROM probe p
        JOIN octo.chunks c ON c.id = p.chunk_id
        CROSS JOIN query_tsq q
        WHERE (SELECT m FROM mode) = 'few'
          AND q.tsq IS NOT NULL
          AND c.content_tsv @@ q.tsq
        ORDER BY lexical_score DESC, c.id
        LIMIT match_count * 4
    ),
    -- Check documents only for the best-ranked hits, until enough pass.
    lex_many AS (
        SELECT h.* FROM lex_hits h
        WHERE (SELECT m FROM mode) = 'many'
          AND coalesce((
                SELECT (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
                  AND (filter_title_prefix IS NULL
                       OR left(d.title, length(filter_title_prefix)) = filter_title_prefix)
                  AND (NOT coalesce(filter_latest_only, false)
                       OR v.version_number = (SELECT max(v2.version_number)
                                              FROM octo.document_versions v2
                                              WHERE v2.document_id = v.document_id))
                FROM octo.chunks c
                JOIN octo.document_versions v ON v.id = c.document_version_id
                JOIN octo.documents d ON d.id = v.document_id
                WHERE c.id = h.chunk_id), false)
        LIMIT match_count * 4
    ),
    lex_raw AS (
        SELECT * FROM lex_all
        UNION ALL SELECT * FROM lex_few
        UNION ALL SELECT * FROM lex_many
    ),
    lex_ranked AS (
        SELECT chunk_id, lexical_score,
               row_number() OVER (ORDER BY lexical_score DESC, chunk_id) AS rank
        FROM lex_raw
    ),
    fused AS (
        SELECT
            coalesce(v.chunk_id, l.chunk_id) AS chunk_id,
            v.similarity,
            l.lexical_score,
            (CASE WHEN v.rank IS NOT NULL THEN 1.0 / (60 + v.rank) ELSE 0 END
           + CASE WHEN l.rank IS NOT NULL THEN 1.0 / (60 + l.rank) ELSE 0 END)::float AS score
        FROM vec_ranked v
        FULL OUTER JOIN lex_ranked l ON l.chunk_id = v.chunk_id
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
        f.similarity,
        f.lexical_score,
        f.score,
        cfg.model,
        cfg.model_version,
        cfg.chunker
    FROM fused f
    JOIN octo.chunks c ON c.id = f.chunk_id
    JOIN octo.document_versions dv ON dv.id = c.document_version_id
    JOIN octo.documents d ON d.id = dv.document_id
    JOIN octo.embedding_configs cfg ON cfg.id = c.config_id
    WHERE (SELECT allowed FROM gate)
    ORDER BY f.score DESC, c.id
    LIMIT match_count;
$$ LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = octo, public, pg_temp
SET hnsw.iterative_scan = relaxed_order
SET hnsw.max_scan_tuples = 2000;

GRANT EXECUTE ON FUNCTION octo.match_chunks_hybrid(UUID, halfvec, TEXT, INT, UUID[], TEXT, BOOLEAN)
    TO authenticated;
