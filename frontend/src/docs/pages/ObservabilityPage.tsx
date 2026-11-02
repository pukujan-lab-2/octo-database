import { Link } from "react-router-dom";
import { Callout, C, EndpointTable, Exchange, H2, P, PageHeader, UL } from "@/docs/blocks";

export function ObservabilityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Guide"
        title="Traces and UX analytics"
        lead="Two hosted tools sit behind your Octo key: Phoenix for agent traces and eval scores, and Umami for what people do in your app. Octo checks the key and the workspace, then forwards the call, so neither tool's own secret ever reaches a caller."
      />

      <H2 id="traces">Traces and eval scores</H2>
      <P>
        One Phoenix runs next to Octo. Send OTLP/HTTP traces to your workspace with the same key you
        use for everything else. Octo forwards the bytes unchanged and sets the Phoenix project to
        the workspace, so each workspace gets its own project, created on its first span. Eval scores
        go the same way, as span annotations.
      </P>
      <EndpointTable
        rows={[
          {
            action: "traces.ingest",
            method: "POST",
            path: "/api/workspaces/<id>/otel/v1/traces",
            scope: "write",
            summary: "Send OTLP/HTTP spans for this workspace's project.",
          },
          {
            action: "traces.scores",
            method: "POST",
            path: "/api/workspaces/<id>/otel/v1/span_annotations",
            scope: "write",
            summary: "Attach eval scores to spans.",
          },
          {
            action: "traces.read",
            method: "GET",
            path: "/api/workspaces/<id>/otel/read/<resource>",
            scope: "read",
            summary:
              "Read spans, traces, sessions and their annotations for this workspace's project only.",
          },
          {
            action: "traces.link",
            method: "GET",
            path: "/api/workspaces/<id>/otel/link",
            scope: "read",
            summary: "A URL that opens this workspace's project in Phoenix.",
          },
        ]}
      />
      <Callout title="Only project-scoped reads">
        Phoenix's datasets, experiments and prompts are not separated per workspace, so Octo does
        not expose them. Reads cover this workspace's project and nothing else.
      </Callout>

      <H2 id="ux">UX analytics</H2>
      <P>
        Turn it on once per workspace with the domain of the site you want to measure. Octo creates
        a Umami team and website, adds every workspace member to the team, and returns the tracking
        tags to paste into your pages. Clicks, session replays and heatmaps then appear in Umami.
      </P>
      <EndpointTable
        rows={[
          {
            action: "ux.status",
            method: "GET",
            path: "/api/workspaces/<id>/ux-analytics",
            scope: "read",
            summary: "Whether it is on, the website id and the tracking tags.",
          },
          {
            action: "ux.enable",
            method: "POST",
            path: "/api/workspaces/<id>/ux-analytics",
            scope: "write",
            role: "admin",
            summary: "Turn it on for a domain. Owner or admin.",
          },
          {
            action: "ux.link",
            method: "GET",
            path: "/api/workspaces/<id>/ux-analytics/link",
            scope: "read",
            summary: "A URL that signs the caller in to Umami on the workspace's website.",
          },
          {
            action: "ux.read",
            method: "GET",
            path: "/api/workspaces/<id>/ux-analytics/read/<resource>",
            scope: "read",
            summary:
              "The website's own stats, pageviews, metrics, events, sessions, replays and active visitors.",
          },
        ]}
      />
      <Exchange
        request={{
          code: `POST /api/workspaces/6f1c2a90-.../ux-analytics
Authorization: Bearer octo_live_ws_...

{ "domain": "app.example.com" }`,
        }}
        response={{
          code: `GET /api/workspaces/6f1c2a90-.../ux-analytics/read/stats

→ the website's summary statistics, as Umami returns them`,
          caption: "The website is always the workspace's own, never one the caller names.",
        }}
      />

      <H2 id="agents">For agents</H2>
      <P>Every route above is also an MCP tool:</P>
      <UL>
        <li>
          <C>read_traces</C>, <C>record_eval_scores</C> and <C>get_trace_link</C> for Phoenix.
        </li>
        <li>
          <C>get_ux_analytics</C>, <C>enable_ux_analytics</C> and <C>read_ux_analytics</C> for Umami.
        </li>
      </UL>
      <P>
        Phoenix stops when idle and starts on the next request, so the first trace call after a
        quiet spell can be slow.
      </P>
      <P>
        Next:{" "}
        <Link className="text-primary underline underline-offset-2" to="/docs/vault">
          the vault
        </Link>{" "}
        — spending a vendor credential without holding it.
      </P>
    </>
  );
}
