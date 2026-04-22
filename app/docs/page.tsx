import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Braces,
  Clock3,
  CreditCard,
  KeyRound,
  ListTree,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import { CodeExample } from "@/components/docs/code-example";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Developer Docs | KnownSense.AI",
  description: "Integration documentation for external developers using the KnownSense Enterprise Analysis API on audio.knownsense.ai.",
};

const apiBaseUrl = "https://audio.knownsense.ai";

const createJobRequestExample = `{
  "template_id": "verification_plus_generic.v1",
  "mic_ids": ["mic_1"],
  "time_range_start_unix": 1776763800,
  "time_range_end_unix": 1776767400,
  "reference_data": {
    "entity_type": "bus_ticket",
    "data": {
      "ticket_number": "TN-2481",
      "source": "Aundh",
      "destination": "Swargate",
      "fare": "25"
    }
  },
  "checks": [
    {
      "id": "route_match",
      "label": "Source and destination are correct",
      "match_type": "semantic",
      "expected": {
        "source": "Aundh",
        "destination": "Swargate"
      }
    }
  ],
  "instructions": "Verify ticket fields and include a short general analysis.",
  "external_reference_id": "client-job-123"
}`;

const createJobCurl = `curl -X POST \\
  "${apiBaseUrl}/api/v1/analysis/jobs" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ks_..." \\
  -H "Idempotency-Key: client-job-123" \\
  -d '${createJobRequestExample}'`;

const createJobTypeScript = `const payload = {
  template_id: "verification_plus_generic.v1",
  mic_ids: ["mic_1"],
  time_range_start_unix: 1776763800,
  time_range_end_unix: 1776767400,
  reference_data: {
    entity_type: "bus_ticket",
    data: {
      ticket_number: "TN-2481",
      source: "Aundh",
      destination: "Swargate",
      fare: "25",
    },
  },
  checks: [
    {
      id: "route_match",
      label: "Source and destination are correct",
      match_type: "semantic",
      expected: {
        source: "Aundh",
        destination: "Swargate",
      },
    },
  ],
  instructions: "Verify ticket fields and include a short general analysis.",
  external_reference_id: "client-job-123",
};

const response = await fetch("${apiBaseUrl}/api/v1/analysis/jobs", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.KENSO_API_KEY!,
    "Idempotency-Key": payload.external_reference_id,
  },
  body: JSON.stringify(payload),
});

const requestId = response.headers.get("X-Request-ID");
const body = await response.json();

if (!response.ok) {
  throw new Error(\`\${body.error}: \${body.message} (\${requestId})\`);
}

console.log(body.job_id, requestId);`;

const createJobPython = `import requests

payload = {
    "template_id": "verification_plus_generic.v1",
    "mic_ids": ["mic_1"],
    "time_range_start_unix": 1776763800,
    "time_range_end_unix": 1776767400,
    "reference_data": {
        "entity_type": "bus_ticket",
        "data": {
            "ticket_number": "TN-2481",
            "source": "Aundh",
            "destination": "Swargate",
            "fare": "25",
        },
    },
    "checks": [
        {
            "id": "route_match",
            "label": "Source and destination are correct",
            "match_type": "semantic",
            "expected": {
                "source": "Aundh",
                "destination": "Swargate",
            },
        }
    ],
    "instructions": "Verify ticket fields and include a short general analysis.",
    "external_reference_id": "client-job-123",
}

response = requests.post(
    "${apiBaseUrl}/api/v1/analysis/jobs",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "ks_...",
        "Idempotency-Key": payload["external_reference_id"],
    },
    json=payload,
    timeout=30,
)

request_id = response.headers.get("X-Request-ID")
body = response.json()

if response.status_code >= 400:
    raise RuntimeError(f"{body['error']}: {body['message']} ({request_id})")

print(body["job_id"], request_id)`;

const pollTypeScript = `async function waitForTerminalJob(jobId: string) {
  const jobsUrl = "${apiBaseUrl}/api/v1/analysis/jobs";

  while (true) {
    const response = await fetch(\`\${jobsUrl}/\${jobId}\`, {
      headers: {
        "X-API-Key": process.env.KENSO_API_KEY!,
      },
    });

    const requestId = response.headers.get("X-Request-ID");
    const job = await response.json();

    if (!response.ok) {
      throw new Error(\`\${job.error}: \${job.message} (\${requestId})\`);
    }

    if (["completed", "failed", "refunded"].includes(job.status)) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}`;

const pollPython = `import requests
import time

def wait_for_terminal_job(job_id: str):
    jobs_url = "${apiBaseUrl}/api/v1/analysis/jobs"

    while True:
        response = requests.get(
            f"{jobs_url}/{job_id}",
            headers={"X-API-Key": "ks_..."},
            timeout=15,
        )

        request_id = response.headers.get("X-Request-ID")
        body = response.json()

        if response.status_code >= 400:
            raise RuntimeError(f"{body['error']}: {body['message']} ({request_id})")

        if body["status"] in {"completed", "failed", "refunded"}:
            return body

        time.sleep(5)`;

const templateListExample = `[
  {
    "template_id": "generic.analysis.v1",
    "name": "Generic Analysis",
    "category": "generic",
    "description": "General purpose structured analysis for a bounded audio window.",
    "result_kind": "generic.analysis.v1",
    "schema_version": "v1",
    "accepts_reference_data": false,
    "accepts_checks": false,
    "accepts_instructions": true,
    "max_time_range_minutes": 120,
    "is_builtin": true
  },
  {
    "template_id": "verification_plus_generic.v1",
    "name": "Verification + General Analysis",
    "category": "generic",
    "description": "Runs a verification contract and a general summary in one async job.",
    "result_kind": "verification_plus_generic.v1",
    "schema_version": "v1",
    "accepts_reference_data": true,
    "accepts_checks": true,
    "accepts_instructions": true,
    "max_time_range_minutes": 120,
    "max_reference_data_bytes": 8192,
    "max_checks": 20,
    "single_mic_required": true,
    "is_builtin": true
  }
]`;

const completedJobExample = `{
  "job_id": "aj_01hxyz123",
  "trigger_source": "api",
  "template_id": "verification_plus_generic.v1",
  "template_name": "Verification + General Analysis",
  "result_kind": "verification_plus_generic.v1",
  "schema_version": "v1",
  "execution_tier": "flex",
  "mic_ids": ["mic_1"],
  "mic_names": ["Front Counter"],
  "time_range_start_unix": 1776763800,
  "time_range_end_unix": 1776767400,
  "status": "completed",
  "estimated_credits": 60,
  "actual_credits": 55,
  "cached": false,
  "external_reference_id": "client-job-123",
  "result": {
    "core_analysis": {
      "summary": "The interaction completed cleanly and the ticketing workflow was audible.",
      "findings": [],
      "highlights": [],
      "recommendations": []
    },
    "verification": {
      "entity_type": "bus_ticket",
      "overall_verdict": "verified",
      "checks": [],
      "missing_evidence": [],
      "recommendations": []
    }
  },
  "audio_artifact": {
    "status": "ready",
    "download_url": "https://storage.googleapis.com/...",
    "expires_at_unix": 1776771000
  },
  "created_at_unix": 1776763850,
  "completed_at_unix": 1776764200
}`;

const webhookPayloadExample = `{
  "event_id": "evt_01hxyz123",
  "event_type": "job.completed",
  "created_at_unix": 1776764200,
  "company_id": "cmp_123",
  "data": {
    "object_type": "analysis_job",
    "object": {
      "job_id": "aj_01hxyz123",
      "status": "completed",
      "template_id": "verification_plus_generic.v1",
      "result_kind": "verification_plus_generic.v1",
      "schema_version": "v1",
      "actual_credits": 55,
      "audio_artifact": {
        "status": "ready",
        "download_url": "https://storage.googleapis.com/...signed-url...",
        "expires_at_unix": 1776771000
      },
      "result": {
        "core_analysis": {
          "summary": "Customer interaction completed cleanly."
        },
        "verification": {
          "overall_verdict": "verified"
        }
      }
    }
  }
}`;

const webhookNodeExample = `import crypto from "node:crypto";

export function verifyKnownSenseWebhook(rawBody: string, headers: Headers, signingSecret: string) {
  const timestamp = headers.get("X-Kenso-Timestamp");
  const signatureHeader = headers.get("X-Kenso-Signature");

  if (!timestamp || !signatureHeader) {
    throw new Error("Missing KnownSense webhook headers");
  }

  const signedPayload = \`\${timestamp}.\${rawBody}\`;
  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(signedPayload)
    .digest("hex");

  const received = signatureHeader
    .split(",")
    .find((part) => part.startsWith("v1="))
    ?.slice(3);

  if (!received) {
    throw new Error("Missing v1 signature");
  }

  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(received, "hex");

  if (
    expectedBytes.length !== receivedBytes.length ||
    !crypto.timingSafeEqual(expectedBytes, receivedBytes)
  ) {
    throw new Error("Invalid KnownSense webhook signature");
  }
}`;

const webhookPythonExample = `import hashlib
import hmac

def verify_knownsense_webhook(raw_body: str, headers: dict[str, str], signing_secret: str) -> None:
    timestamp = headers.get("X-Kenso-Timestamp")
    signature_header = headers.get("X-Kenso-Signature")

    if not timestamp or not signature_header:
        raise RuntimeError("Missing KnownSense webhook headers")

    signed_payload = f"{timestamp}.{raw_body}".encode("utf-8")
    expected = hmac.new(
        signing_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    parts = dict(item.split("=", 1) for item in signature_header.split(",") if "=" in item)
    received = parts.get("v1")

    if not received or not hmac.compare_digest(expected, received):
        raise RuntimeError("Invalid KnownSense webhook signature")`;

const errorResponseExample = `{
  "error": "request/time_range_exceeded",
  "message": "maximum time range is 120 minutes",
  "request_id": "req_01hxyz123"
}`;

const sandboxFixturesExample = `[
  {
    "fixture_id": "generic_success",
    "name": "Generic analysis success",
    "template_id": "generic.analysis.v1",
    "mic_id": "sbx_generic_front_counter",
    "mic_name": "Sandbox Front Counter",
    "shop_id": "sbx_shop_generic",
    "time_range_start_unix": 1768471200,
    "time_range_end_unix": 1768472100,
    "expected_terminal_status": "completed"
  },
  {
    "fixture_id": "verification_success",
    "name": "Verification + generic success",
    "template_id": "verification_plus_generic.v1",
    "mic_id": "sbx_verification_counter",
    "mic_name": "Sandbox Verification Counter",
    "shop_id": "sbx_shop_verification",
    "time_range_start_unix": 1768474800,
    "time_range_end_unix": 1768475700,
    "expected_terminal_status": "completed"
  },
  {
    "fixture_id": "verification_refunded",
    "name": "Verification refunded terminal state",
    "template_id": "verification.generic.v1",
    "mic_id": "sbx_failure_lane",
    "mic_name": "Sandbox Failure Lane",
    "shop_id": "sbx_shop_failure",
    "time_range_start_unix": 1768478400,
    "time_range_end_unix": 1768479300,
    "expected_terminal_status": "refunded"
  }
]`;

const sandboxCreateJobExample = `curl -X POST \\
  "${apiBaseUrl}/api/v1/analysis/jobs" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ks_sandbox_..." \\
  -H "Idempotency-Key: sbx-generic-success-1" \\
  -d '{
    "template_id": "generic.analysis.v1",
    "mic_ids": ["sbx_generic_front_counter"],
    "time_range_start_unix": 1768471200,
    "time_range_end_unix": 1768472100,
    "instructions": "Return the deterministic generic success fixture."
  }'`;

const sandboxStarterEnvExample = `KENSO_API_BASE=http://localhost:9090
KENSO_API_KEY=ks_sandbox_...
KENSO_WEBHOOK_SECRET=whsec_...
KENSO_WEBHOOK_EVENT_LOG=./data/received_events.jsonl
KENSO_WEBHOOK_HOST=127.0.0.1
KENSO_WEBHOOK_PORT=8787
KENSO_WEBHOOK_PATH=/webhooks/knownsense`;

const sandboxStarterSetupExample = `cd examples/enterprise_sandbox_python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env`;

const sandboxStarterWebhookFlowExample = `# terminal 1: run the webhook receiver
source .venv/bin/activate
python receiver.py

# terminal 2: expose it publicly
ngrok http 8787

# dashboard: add the ngrok HTTPS URL as
# https://<public-host>/webhooks/knownsense

# terminal 3: create a fresh sandbox job and wait for the webhook
python sandbox_client.py create-from-fixture \\
  --fixture-id generic_success \\
  --avoid-cache \\
  --wait-webhook \\
  --expected-event-type job.completed`;

const sandboxStarterSmokeSuiteExample = `source .venv/bin/activate
python sandbox_client.py run-smoke-suite \\
  --verify-webhooks \\
  --webhook-timeout-seconds 120`;

const sections = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "sandbox", label: "Sandbox" },
  { id: "starter-kit", label: "Starter Project" },
  { id: "endpoints", label: "Endpoints" },
  { id: "contract", label: "Request & Result Model" },
  { id: "webhooks", label: "Webhooks" },
  { id: "limits", label: "Limits & Billing" },
  { id: "errors", label: "Errors & Retries" },
  { id: "launch", label: "Launch Checklist" },
] as const;

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/analysis/templates",
    anchor: "endpoint-get-templates",
    title: "List templates",
    detail: "Discover built-in and company-owned templates before creating jobs. Cache this response, but refresh when your integration changes template selection logic.",
    notes: [
      "Requires X-API-Key.",
      "Returns accepts_reference_data, accepts_checks, accepts_instructions, and template-specific max_* limits.",
      "Built-in templates ship with the platform. Company-owned templates appear in the same list.",
    ],
  },
  {
    method: "POST",
    path: "/api/v1/analysis/jobs",
    anchor: "endpoint-post-jobs",
    title: "Create job",
    detail: "Create one asynchronous job for a bounded audio window. Always send Idempotency-Key so retries do not create duplicates.",
    notes: [
      "Request body max is 16 KB.",
      "Time window must be in the past and within the selected template limit.",
      "A successful response returns 201 and a job envelope immediately. Processing happens asynchronously.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/analysis/sandbox/fixtures",
    anchor: "endpoint-get-sandbox-fixtures",
    title: "List sandbox fixtures",
    detail: "Available only for sandbox API keys. Returns the seeded fixture windows, mic IDs, and expected terminal outcomes.",
    notes: [
      "Requires a sandbox-scoped X-API-Key.",
      "Use this to drive automated smoke tests without hardcoding fixture windows into your client.",
      "Production API keys receive 404 for this endpoint.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/analysis/jobs",
    anchor: "endpoint-get-jobs",
    title: "List jobs",
    detail: "Fetch recent jobs for the authenticated company. Useful for dashboards, support tooling, or a recovery pass when a webhook was missed.",
    notes: [
      "Optional query params: status and limit.",
      "Default limit is 20. Maximum limit is 100.",
      "Returns the same stable job envelope used by GET /jobs/{id}.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/analysis/jobs/{id}",
    anchor: "endpoint-get-job",
    title: "Get job",
    detail: "Fetch the latest state for one job. Use this for polling and to refresh the merged audio URL after the previous signed URL expires.",
    notes: [
      "Returns 404 if the job does not belong to the authenticated company.",
      "When audio_artifact.status is ready, the download URL is regenerated with a fresh 60 minute expiry.",
      "Terminal states are completed, failed, and refunded.",
    ],
  },
] as const;

function MethodPill({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.2rem] items-center justify-center rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
        method === "POST"
          ? "bg-primary/12 text-primary"
          : "bg-status-streaming/10 text-status-streaming",
      )}
    >
      {method}
    </span>
  );
}

function SectionShell({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.6rem] border border-border/70 bg-card/40">
      <div className="border-b border-border/60 px-5 py-4 sm:px-7">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-foreground sm:text-[1.65rem]">{title}</h2>
      </div>
      <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">{children}</div>
    </section>
  );
}

function KeyValueCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.15rem] border border-border/70 bg-background/55 p-4 shadow-[0_12px_30px_-24px_rgba(2,6,23,0.85)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">{detail}</p>
    </div>
  );
}

function FlowStep({
  index,
  title,
  path,
  detail,
}: {
  index: number;
  title: string;
  path: string;
  detail: string;
}) {
  return (
    <li className="grid gap-3 rounded-[1.2rem] border border-border/70 bg-background/45 p-4 shadow-[0_10px_24px_-20px_rgba(2,6,23,0.85)] sm:grid-cols-[2rem_minmax(0,1fr)]">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary tabular-nums">
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <code className="mt-2 inline-flex max-w-full break-all rounded-full border border-border/70 bg-card px-3 py-1.5 text-[0.72rem] text-foreground">
          {path}
        </code>
        <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">{detail}</p>
      </div>
    </li>
  );
}

function TemplateContractRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="grid gap-3 border-b border-border/60 py-4 last:border-b-0 md:grid-cols-[18rem_minmax(0,1fr)]">
      <code className="inline-flex max-w-max items-center rounded-full border border-border/70 bg-background/65 px-3 py-1.5 font-mono text-[0.78rem] text-foreground">
        {name}
      </code>
      <p className="text-sm leading-6 text-muted-foreground text-pretty">{detail}</p>
    </div>
  );
}

export default function DeveloperDocsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <div className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-[0.08]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(16,185,129,0.07),transparent)]" />

      <div className="relative border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
              <BadgeCheck className="h-3.5 w-3.5" />
              Developer Documentation
            </div>
            <h1 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">Enterprise Analysis API</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Get API Key</Link>
            </Button>
            <Button asChild size="sm" className="glow-primary">
              <a href="#quickstart">
                Quickstart
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <nav className="rounded-[1.35rem] border border-border/70 bg-card/55 p-4 shadow-[0_20px_40px_-34px_rgba(2,6,23,0.9)]">
            <p className="px-3 pb-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Table of Contents
            </p>
            <div className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.label}
                </a>
              ))}
            </div>

            <div className="mt-5 border-t border-border/60 pt-4">
              <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Endpoint Index
              </p>
              <div className="space-y-2">
                {endpoints.map((endpoint) => (
                  <a
                    key={`${endpoint.method}:${endpoint.path}`}
                    href={`#${endpoint.anchor}`}
                    className="flex items-start gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/35"
                  >
                    <MethodPill method={endpoint.method} />
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-foreground">{endpoint.path}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{endpoint.title}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        <article className="space-y-6">
          <section className="rounded-[1.7rem] border border-border/70 bg-card/45 shadow-[0_24px_60px_-40px_rgba(2,6,23,0.95)]">
            <div className="grid gap-8 px-5 py-6 sm:px-7 sm:py-7 xl:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary">Enterprise Analysis API</p>
                  <code className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-foreground">
                    {apiBaseUrl}/api/v1/analysis
                  </code>
                </div>
                <h2 className="mt-4 max-w-3xl text-balance text-[1.95rem] font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
                  Integration guide for asynchronous audio analysis
                </h2>
                <p className="mt-4 max-w-3xl text-pretty text-sm leading-7 text-muted-foreground sm:text-[0.98rem]">
                  Submit a bounded audio window, attach structured business context when needed, and retrieve a stable
                  job envelope with a template-scoped result. The public contract is asynchronous by design and built
                  for backend-to-backend integrations.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KeyValueCard
                    icon={KeyRound}
                    label="Authentication"
                    value="X-API-Key"
                    detail="Use a company-scoped API key generated from dashboard settings."
                  />
                  <KeyValueCard
                    icon={Braces}
                    label="Contract"
                    value="Stable envelope"
                    detail="The top-level job object stays stable. The result shape depends on the selected template."
                  />
                  <KeyValueCard
                    icon={Webhook}
                    label="Delivery"
                    value="Polling or webhook"
                    detail="Create a job once, then either poll by job ID or wait for a terminal webhook."
                  />
                  <KeyValueCard
                    icon={Clock3}
                    label="Merged audio"
                    value="60-minute URL"
                    detail="Refresh the signed audio URL by calling GET /jobs/{id} after the previous URL expires."
                  />
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-border/70 bg-background/55 p-5 shadow-[0_14px_28px_-24px_rgba(2,6,23,0.88)]">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Integration Essentials</p>
                <div className="mt-4 space-y-3">
                  {[
                    ["Base URL", apiBaseUrl],
                    ["Base path", "/api/v1/analysis"],
                    ["Idempotency", "Idempotency-Key"],
                    ["Trace", "X-Request-ID"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[0.95rem] border border-border/60 bg-card/35 px-3 py-3">
                      <p className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                      <p className="mt-1 font-mono text-xs text-foreground break-all">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <SectionShell id="overview" eyebrow="Overview" title="How the integration is meant to work">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_18rem]">
              <ol className="space-y-3">
              {[
                {
                  title: "Discover templates",
                  path: "GET /api/v1/analysis/templates",
                    detail: "Cache only the templates your integration supports before you build request bodies.",
                },
                {
                    title: "Create one async job",
                  path: "POST /api/v1/analysis/jobs",
                    detail: "Send a stable Idempotency-Key for each client-originated action so retries are safe.",
                },
                {
                  title: "Persist the handles",
                  path: "job_id + external_reference_id + X-Request-ID",
                    detail: "Keep all three together so support traces and replay logic stay aligned.",
                },
                {
                  title: "Read completion",
                  path: "GET /api/v1/analysis/jobs/{id}",
                    detail: "Poll for completion or receive a signed terminal webhook event.",
                },
              ].map((item, index) => (
                  <FlowStep
                  key={item.title}
                    index={index + 1}
                    title={item.title}
                    path={item.path}
                    detail={item.detail}
                  />
              ))}
              </ol>

              <div className="space-y-3">
                {[
                  {
                    title: "One job per bounded task",
                    body: "Keep the audio window tight and the verification intent explicit.",
                  },
                  {
                    title: "Template-owned outputs",
                    body: "Clients select a template instead of defining arbitrary output schemas.",
                  },
                  {
                    title: "Same billing path",
                    body: "API jobs reserve and commit credits through the same balance used in dashboard analysis.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.15rem] border border-border/70 bg-background/45 p-4 shadow-[0_10px_22px_-18px_rgba(2,6,23,0.86)]">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionShell>

          <SectionShell id="quickstart" eyebrow="Quickstart" title="Create and track your first job">
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              The examples below use the production host and the current public API contract.
              Always send <code className="rounded bg-background px-1.5 py-0.5 text-foreground">Idempotency-Key</code> on
              create-job requests. If the same client operation retries, the API returns the same logical job instead
              of creating a duplicate.
            </p>

            <CodeTabs
              title="Create job examples"
              description="Choose the example closest to your stack. All three call the same production endpoint and use the same request contract."
              maxHeight="30rem"
              tabs={[
                {
                  id: "curl",
                  label: "cURL",
                  language: "bash",
                  title: "POST /api/v1/analysis/jobs",
                  note: "Useful for smoke tests and initial validation.",
                  code: createJobCurl,
                },
                {
                  id: "ts",
                  label: "TypeScript",
                  language: "ts",
                  title: "TypeScript create-job client",
                  note: "Store X-Request-ID with the returned job_id for troubleshooting and support.",
                  code: createJobTypeScript,
                },
                {
                  id: "python",
                  label: "Python",
                  language: "python",
                  title: "Python create-job client",
                  note: "Use the same Idempotency-Key when retrying the same business action.",
                  code: createJobPython,
                },
              ]}
            />

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "What to persist",
                  body: "Store job_id, external_reference_id, and the create-request X-Request-ID together. This is the minimum recovery set.",
                },
                {
                  title: "When to poll",
                  body: "Poll GET /jobs/{id} every few seconds when you need a synchronous operator workflow or do not control a webhook endpoint.",
                },
                {
                  title: "When to refresh audio",
                  body: "Never cache audio_artifact.download_url as a permanent link. Re-read the job if the previous URL has expired.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <CodeTabs
              title="Poll until the job reaches a terminal state"
              description="Webhooks are preferred for server-to-server integrations, but polling remains the fallback path."
              maxHeight="18rem"
              tabs={[
                {
                  id: "poll-ts",
                  label: "TypeScript",
                  language: "ts",
                  title: "TypeScript polling helper",
                  note: "Stop polling only when status is completed, failed, or refunded.",
                  code: pollTypeScript,
                },
                {
                  id: "poll-python",
                  label: "Python",
                  language: "python",
                  title: "Python polling helper",
                  note: "Keep a backoff policy if you expect large request bursts.",
                  code: pollPython,
                },
              ]}
            />

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Polling interval",
                  body: "Five seconds is a reasonable default for operator-facing flows. Back off further if your integration fans out large job batches.",
                },
                {
                  title: "Terminal states",
                  body: "Treat completed, failed, and refunded as terminal. Anything else should continue polling or await a webhook.",
                },
                {
                  title: "Traceability",
                  body: "Keep the latest X-Request-ID from your GET calls when escalating support issues around one job.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell id="sandbox" eyebrow="Sandbox" title="Use the hosted sandbox before going live">
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              The hosted sandbox uses the same API origin and public contract as production, but it is isolated behind
              sandbox-scoped API keys, fake credits, deterministic results, and seeded fixture windows. Provision the
              sandbox workspace from dashboard settings, switch into that workspace, then generate sandbox keys and
              configure sandbox-only webhook endpoints.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Same host, different keys",
                  body: "Keep your client base URL unchanged. Switching from sandbox to production is only a key rotation and fixture replacement exercise.",
                },
                {
                  title: "Deterministic payloads",
                  body: "The sandbox does not call live Gemini models. Each seeded window returns a stable terminal result so retries, parsers, and webhooks stay predictable.",
                },
                {
                  title: "Real callback path",
                  body: "Sandbox jobs still create real webhook deliveries and replay entries, so you can validate signatures, retries, and idempotent receivers against a sandbox-only endpoint.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <CodeExample title="GET /api/v1/analysis/sandbox/fixtures" language="json" code={sandboxFixturesExample} maxHeight="20rem" />
            <CodeExample title="Create a seeded sandbox job" language="bash" code={sandboxCreateJobExample} maxHeight="14rem" />
          </SectionShell>

          <SectionShell id="starter-kit" eyebrow="Starter Project" title="Use the official Python sandbox starter for integration testing">
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              The official reference project is{" "}
              <code className="rounded bg-background px-1.5 py-0.5 text-foreground">examples/enterprise_sandbox_python</code>.
              Use it before writing your own production client. It already covers the parts of the integration that
              usually fail first: sandbox key authentication, webhook signature verification, ngrok callback plumbing,
              idempotent create-job requests, and deterministic fixture validation.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KeyValueCard
                icon={KeyRound}
                label="Get From KnownSense"
                value="Sandbox API key"
                detail="Generate it from dashboard settings after switching into the sandbox workspace. Production and sandbox keys are different."
              />
              <KeyValueCard
                icon={Webhook}
                label="Get From Dashboard"
                value="Webhook signing secret"
                detail="Create or rotate the sandbox webhook endpoint, then save the returned whsec_* value immediately. It is shown only once."
              />
              <KeyValueCard
                icon={ListTree}
                label="Run Locally"
                value="receiver.py + sandbox_client.py"
                detail="The starter project includes a verified webhook receiver and a CLI harness for fixtures, create-job calls, polling, and smoke tests."
              />
              <KeyValueCard
                icon={Clock3}
                label="Prove Before Launch"
                value="Smoke suite"
                detail="Run the webhook-aware smoke suite to confirm success and refunded paths before switching to production keys."
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <CodeExample
                title="Starter project setup"
                language="bash"
                code={sandboxStarterSetupExample}
                maxHeight="12rem"
              />
              <CodeExample
                title="Required .env values"
                language="bash"
                code={sandboxStarterEnvExample}
                maxHeight="12rem"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "1. Configure webhook plumbing",
                  body: "Run receiver.py, expose it with ngrok, and register the current HTTPS tunnel URL in the sandbox webhook settings page.",
                },
                {
                  title: "2. Run a webhook-first job",
                  body: "Use create-from-fixture with --avoid-cache and --wait-webhook so the test proves callback delivery instead of only polling state.",
                },
                {
                  title: "3. Run the smoke suite",
                  body: "Execute the full suite with --verify-webhooks to validate generic success, verification success, refunded state, and the corresponding terminal events.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <CodeTabs
              title="Recommended starter-project test commands"
              description="These are the two flows we recommend every integration team runs before moving to production credentials."
              maxHeight="20rem"
              tabs={[
                {
                  id: "starter-webhook-flow",
                  label: "Webhook-first",
                  language: "bash",
                  title: "Create a fresh job and wait for job.completed",
                  note: "Best for proving end-to-end callback handling without relying only on GET /jobs/{id}.",
                  code: sandboxStarterWebhookFlowExample,
                },
                {
                  id: "starter-smoke-suite",
                  label: "Smoke suite",
                  language: "bash",
                  title: "Run the full sandbox validation suite",
                  note: "Covers generic success, verification success, refunded terminal state, and webhook verification.",
                  code: sandboxStarterSmokeSuiteExample,
                },
              ]}
            />

            <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
              <p className="text-sm font-semibold text-foreground">What your team should have before going live</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>A working sandbox API key and sandbox-only webhook endpoint.</li>
                <li>A receiver that verifies KnownSense signatures and logs raw callback payloads.</li>
                <li>A passing smoke suite across completed and refunded job paths.</li>
                <li>Confidence that moving to production is mainly a key rotation plus replacing seeded fixtures with real mic IDs and time windows.</li>
              </ul>
            </div>
          </SectionShell>

          <SectionShell id="endpoints" eyebrow="Endpoints" title="HTTP endpoint reference">
            <div className="overflow-hidden rounded-[1.3rem] border border-border/70 bg-background/45 shadow-[0_18px_36px_-28px_rgba(2,6,23,0.9)]">
              {endpoints.map((endpoint) => (
                <div
                  id={endpoint.anchor}
                  key={`${endpoint.method}:${endpoint.path}`}
                  className="scroll-mt-24 border-b border-border/60 p-5 last:border-b-0"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <MethodPill method={endpoint.method} />
                        <code className="max-w-full break-all rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-foreground">
                          {endpoint.path}
                        </code>
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-foreground">{endpoint.title}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">{endpoint.detail}</p>

                      <div className="mt-4 rounded-[1rem] border border-border/60 bg-card/30 p-4">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Implementation Notes
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                          {endpoint.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/60 bg-card/30 p-4">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Typical Use
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {endpoint.method === "GET" && endpoint.path === "/api/v1/analysis/templates"
                          ? "Call once during startup or configuration sync, then cache the relevant templates for your workflow."
                          : endpoint.method === "POST"
                            ? "Call once for each client-originated analysis task and reuse the same Idempotency-Key on retries."
                          : endpoint.path === "/api/v1/analysis/jobs"
                              ? "Use for recovery screens, support tooling, or dashboards that need recent job history."
                              : "Use for polling, state refresh, and generating a fresh merged-audio URL after the previous one expires."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionShell>

          <SectionShell id="contract" eyebrow="Contract Model" title="Stable job envelope, template-scoped result">
            <div className="overflow-x-auto rounded-[1.25rem] border border-border/70">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-muted/25 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Input field</th>
                    <th className="px-4 py-3 font-medium">How to use it</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[
                    ["template_id", "Selects the result contract and validation rules."],
                    ["mic_ids", "Company-owned microphones included in the analysis request."],
                    ["time_range_start_unix / time_range_end_unix", "Bounded audio window to analyze."],
                    ["reference_data", "Structured business context such as ticket metadata, case details, or transaction fields."],
                    ["checks", "Specific assertions the model should verify against the audio."],
                    ["instructions", "Short bounded guidance that narrows the task without turning the API into a raw prompt surface."],
                    ["external_reference_id", "Caller-owned identifier echoed back in job and webhook payloads."],
                  ].map(([field, detail]) => (
                    <tr key={field} className="bg-card/20">
                      <td className="px-4 py-3 align-top font-mono text-xs text-foreground">{field}</td>
                      <td className="px-4 py-3 text-muted-foreground">{detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-background/45 px-5 py-2 shadow-[0_16px_34px_-30px_rgba(2,6,23,0.9)]">
              {[
                {
                  name: "generic.analysis.v1",
                  detail: "Returns a core_analysis block for general-purpose analysis with a stable result schema.",
                },
                {
                  name: "verification.generic.v1",
                  detail: "Returns a verification block for caller-defined checks against the selected audio window.",
                },
                {
                  name: "verification_plus_generic.v1",
                  detail: "Returns both core_analysis and verification sections in a single async job.",
                },
              ].map((item) => (
                <TemplateContractRow key={item.name} name={item.name} detail={item.detail} />
              ))}
            </div>

            <CodeExample title="Request body example" language="json" code={createJobRequestExample} maxHeight="24rem" />
            <CodeExample title="Completed job response" language="json" code={completedJobExample} maxHeight="32rem" />
            <CodeExample title="GET /api/v1/analysis/templates response" language="json" code={templateListExample} maxHeight="22rem" />
          </SectionShell>

          <SectionShell id="webhooks" eyebrow="Webhooks" title="Verify and process terminal webhook events">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  Terminal webhooks carry the same job envelope you would receive from{" "}
                  <code className="rounded bg-background px-1.5 py-0.5 text-foreground">GET /api/v1/analysis/jobs/{'{id}'}</code>,
                  plus a fresh audio artifact URL when the artifact is ready.
                </p>

                <div className="flex flex-wrap gap-2">
                  {["job.completed", "job.failed", "job.refunded", "webhook.test"].map((item) => (
                    <code
                      key={item}
                      className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-foreground"
                    >
                      {item}
                    </code>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.1rem] border border-border/70 bg-background/45 p-4">
                    <p className="text-sm font-semibold text-foreground">Verification steps</p>
                    <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      <li>Read the raw request body exactly as delivered.</li>
                      <li>Build the signed payload as <code className="rounded bg-card px-1.5 py-0.5 text-foreground">timestamp.raw_body</code>.</li>
                      <li>Compute HMAC-SHA256 with your webhook signing secret.</li>
                      <li>Compare only against the <code className="rounded bg-card px-1.5 py-0.5 text-foreground">v1=</code> component of the signature header.</li>
                    </ol>
                  </div>
                  <div className="rounded-[1.1rem] border border-border/70 bg-background/45 p-4">
                    <p className="text-sm font-semibold text-foreground">Delivery behavior</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      <li>KnownSense retries failed deliveries with backoff.</li>
                      <li>Do not trust the payload until the signature passes.</li>
                      <li>Deduplicate by <code className="rounded bg-card px-1.5 py-0.5 text-foreground">event_id</code> in your receiver.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                <p className="text-sm font-semibold text-foreground">Headers to validate</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {["X-Kenso-Event-ID", "X-Kenso-Event-Type", "X-Kenso-Timestamp", "X-Kenso-Signature"].map((item) => (
                    <li key={item}>
                      <code className="rounded bg-card px-1.5 py-0.5 text-foreground">{item}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <CodeExample title="Webhook payload example" language="json" code={webhookPayloadExample} maxHeight="18rem" />

            <CodeTabs
              title="Signature verification examples"
              description="Always verify against the raw request body bytes before any JSON parsing or framework middleware mutation."
              maxHeight="18rem"
              tabs={[
                {
                  id: "node",
                  label: "Node.js",
                  language: "ts",
                  title: "Node.js webhook verification",
                  note: "Use timingSafeEqual for the final digest comparison.",
                  code: webhookNodeExample,
                },
                {
                  id: "python",
                  label: "Python",
                  language: "python",
                  title: "Python webhook verification",
                  note: "Use hmac.compare_digest for the final digest comparison.",
                  code: webhookPythonExample,
                },
              ]}
            />
          </SectionShell>

          <SectionShell id="limits" eyebrow="Limits & Billing" title="Current limits, validation rules, and pricing behavior">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: Clock3, label: "Time window", value: "2 hours max" },
                { icon: Braces, label: "Request body", value: "16 KB" },
                { icon: ListTree, label: "Checks", value: "20 max" },
                { icon: CreditCard, label: "Audio URL", value: "60 min TTL" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                  <item.icon className="h-4 w-4 text-primary" />
                  <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.25rem] border border-border/70">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-muted/25 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Rule</th>
                    <th className="px-4 py-3 font-medium">Current behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[
                    ["Credits", "Jobs reserve and commit credits through the same company balance shown in dashboard usage."],
                    ["Pricing basis", "Usage is billed on actual analyzed audio duration, not only wall-clock range."],
                    ["Reference data", "Up to 8 KB serialized JSON unless the selected template advertises a stricter limit."],
                    ["checks[].expected", "Up to 512 bytes serialized JSON."],
                    ["Mics", "Up to 10 mic_ids per request unless the selected template requires fewer."],
                    ["Time range", "time_range_end_unix must be in the past and time_range_start_unix must be before it."],
                  ].map(([label, value]) => (
                    <tr key={label} className="bg-card/20">
                      <td className="px-4 py-3 text-foreground">{label}</td>
                      <td className="px-4 py-3 text-muted-foreground">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionShell>

          <SectionShell id="errors" eyebrow="Errors & Retries" title="Implement retries and failure handling explicitly">
            <CodeExample title="Canonical error response" language="json" code={errorResponseExample} maxHeight="12rem" />

            <div className="overflow-x-auto rounded-[1.25rem] border border-border/70">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-muted/25 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">HTTP</th>
                    <th className="px-4 py-3 font-medium">Error code</th>
                    <th className="px-4 py-3 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[
                    ["400", "request/missing_fields", "Required fields were omitted."],
                    ["400", "request/invalid_time_range", "time_range_start_unix is not before time_range_end_unix."],
                    ["400", "request/time_range_in_future", "time_range_end_unix is in the future."],
                    ["400", "request/time_range_exceeded", "Template or platform max time range was exceeded."],
                    ["400", "request/invalid_mic_ids", "mic_ids contains duplicate or empty values."],
                    ["400", "request/too_many_checks", "The selected template limit for checks was exceeded."],
                    ["401", "auth/missing_api_key", "X-API-Key is missing."],
                    ["401", "auth/invalid_api_key", "API key is invalid, revoked, or expired."],
                    ["402", "billing/insufficient_credits", "Company balance cannot cover the requested work."],
                    ["402", "rate_limit/credit_balance_low", "Low-credit throttle is currently applied."],
                    ["403", "auth/api_disabled", "Company API access is disabled."],
                    ["403", "request/mic_access_denied", "One or more mics do not belong to the authenticated company."],
                    ["404", "not_found/job", "Requested job was not found for this company."],
                    ["409", "request/idempotency_in_progress", "The same idempotent request is still processing."],
                    ["422", "request/idempotency_key_reused_with_different_body", "The same Idempotency-Key was reused with a different request body."],
                    ["429", "request/rate_limited", "Current read or write budget was exceeded."],
                  ].map((row) => (
                    <tr key={row[1]} className="bg-card/20">
                      <td className="px-4 py-3 text-foreground">{row[0]}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{row[1]}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                <p className="text-sm font-semibold text-foreground">Retry guidance</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>Always retry POST /jobs with the same Idempotency-Key when the business action is the same.</li>
                  <li>Respect Retry-After on 409 and 429 responses instead of guessing a delay.</li>
                  <li>Store X-Request-ID in logs for every failed request, not only successful ones.</li>
                </ul>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                <p className="text-sm font-semibold text-foreground">Failure cases to test before launch</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>Low credits on POST /jobs.</li>
                  <li>No audio available in the requested window.</li>
                  <li>Expired merged-audio URL refresh via GET /jobs/{'{id}'}.</li>
                  <li>Webhook signature rejection for a tampered payload.</li>
                </ul>
              </div>
            </div>
          </SectionShell>

          <SectionShell id="launch" eyebrow="Launch Checklist" title="What a production-ready integration should already do">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Use a stable Idempotency-Key for every create-job request.",
                "Persist job_id, external_reference_id, and X-Request-ID together.",
                "Verify webhook signatures against the raw request body bytes.",
                "Do not store merged audio URLs as permanent asset URLs.",
                "Handle 402, 409, 422, and 429 explicitly in retry logic.",
                "Run at least one no-audio and one low-credit test case before launch.",
              ].map((item) => (
                <div key={item} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-4 text-sm leading-6 text-muted-foreground">
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </SectionShell>
        </article>
      </div>
    </main>
  );
}
