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
  description: "Integration documentation for external developers using the KnownSense Enterprise API on audio.knownsense.ai.",
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

const micStatusCurl = `curl "${apiBaseUrl}/api/v1/mics/status" \\
  -H "X-API-Key: ks_..."`;

const micStatusExample = `{
  "items": [
    {
      "mic_id": "mic_front_counter",
      "name": "Front Counter",
      "shop_id": "shop_pune_01",
      "location_id": "loc_pune_01",
      "status": "online",
      "online": true,
      "last_seen_unix": 1776764200,
      "connection_source": "heartbeat",
      "telemetry": {
        "audio_level_db": -34.2,
        "bitrate_kbps": 32,
        "packet_loss_pct": 0,
        "jitter_ms": 3,
        "free_heap_kb": 108,
        "wifi_rssi": -61,
        "cpu_temp_c": 42.3
      }
    }
  ]
}`;

const webhookSubscriptionExample = `{
  "url": "https://example.com/webhooks/knownsense",
  "label": "MIC health receiver",
  "event_types": ["mic.offline", "mic.online"]
}`;

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

const micOfflineWebhookExample = `{
  "event_id": "evt_01hxyz124",
  "event_type": "mic.offline",
  "created_at_unix": 1776764300,
  "company_id": "cmp_123",
  "data": {
    "object_type": "mic",
    "object": {
      "mic_id": "mic_front_counter",
      "name": "Front Counter",
      "shop_id": "shop_pune_01",
      "location_id": "loc_pune_01",
      "status": "offline",
      "online": false,
      "last_seen_unix": 1776764240,
      "changed_at_unix": 1776764300,
      "offline_reason": "ws_close",
      "connection_source": "sfu_ws",
      "telemetry": {
        "audio_level_db": -38.5,
        "bitrate_kbps": 0,
        "packet_loss_pct": 0,
        "jitter_ms": 0,
        "free_heap_kb": 104,
        "wifi_rssi": -67,
        "cpu_temp_c": 43.1
      }
    }
  }
}`;

const micOnlineWebhookExample = `{
  "event_id": "evt_01hxyz125",
  "event_type": "mic.online",
  "created_at_unix": 1776764600,
  "company_id": "cmp_123",
  "data": {
    "object_type": "mic",
    "object": {
      "mic_id": "mic_front_counter",
      "name": "Front Counter",
      "shop_id": "shop_pune_01",
      "location_id": "loc_pune_01",
      "status": "online",
      "online": true,
      "last_seen_unix": 1776764598,
      "changed_at_unix": 1776764600,
      "connection_source": "heartbeat",
      "telemetry": {
        "audio_level_db": -32.1,
        "bitrate_kbps": 32,
        "packet_loss_pct": 0,
        "jitter_ms": 2,
        "free_heap_kb": 111,
        "wifi_rssi": -58,
        "cpu_temp_c": 41.9
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
    "mode": "deterministic",
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
    "mode": "deterministic",
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
    "mode": "deterministic",
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

const sandboxStarterEnvExample = `KENSO_API_BASE=https://audio.knownsense.ai
KENSO_API_KEY=ks_sandbox_...
KENSO_WEBHOOK_SECRET=whsec_...
KENSO_WEBHOOK_EVENT_LOG=./data/received_events.jsonl
# optional: let shell KENSO_* vars override .env only when you mean it
# KENSO_PREFER_PROCESS_ENV=true
KENSO_WEBHOOK_HOST=127.0.0.1
KENSO_WEBHOOK_PORT=8787
KENSO_WEBHOOK_PATH=/webhooks/knownsense`;

const sandboxStarterSetupExample = `git clone https://github.com/KnownSenseAI/knownsense-enterprise-sandbox-python.git
cd knownsense-enterprise-sandbox-python
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

# terminal 3: verify config and auth before creating a job
python sandbox_client.py show-config
python sandbox_client.py list-fixtures

# terminal 4: create a fresh sandbox job and wait for the webhook
python sandbox_client.py create-from-fixture \\
  --fixture-id generic_success \\
  --avoid-cache \\
  --wait-webhook \\
  --expected-event-type job.completed`;

const sandboxStarterSmokeSuiteExample = `source .venv/bin/activate
python sandbox_client.py create-from-fixture \\
  --fixture-id verification_refunded \\
  --avoid-cache \\
  --wait-webhook \\
  --expected-event-type job.refunded

python sandbox_client.py create-from-fixture \\
  --fixture-id generic_success \\
  --avoid-cache \\
  --poll

python sandbox_client.py run-smoke-suite \\
  --verify-webhooks \\
  --webhook-timeout-seconds 120`;

const sandboxStarterLiveAudioExample = `source .venv/bin/activate

# Uses the included sample: samples/bus_station_test.m4a
# Add --wait-webhook when your local receiver + ngrok are running.
python sandbox_client.py create-from-live-audio \\
  --file ./samples/bus_station_test.m4a \\
  --template-id generic.analysis.v1 \\
  --wait-webhook \\
  --poll`;

const sandboxLiveAudioExpectedExample = `{
  "job_id": "job_...",
  "environment": "sandbox",
  "template_id": "generic.analysis.v1",
  "mic_names": ["bus_station_test"],
  "status": "completed",
  "estimated_credits": 2,
  "actual_credits": 2,
  "actual_audio_duration_ms": 72917,
  "result": {
    "core_analysis": {
      "findings": [],
      "highlights": [],
      "recommendations": [],
      "summary": "..."
    }
  },
  "audio_artifact": {
    "status": "ready",
    "download_url": "https://storage.googleapis.com/...",
    "expires_at_unix": 1777016347
  }
}`;

const sandboxStarterFirstChecksExample = `python sandbox_client.py show-config
python sandbox_client.py list-fixtures

# interpret list-fixtures like this:
# 200  -> sandbox key is valid
# 404  -> valid production key, not a sandbox key
# 401  -> wrong/revoked key, wrong workspace, or backend auth issue`;

const sections = [
  { id: "overview", label: "Overview" },
  { id: "mic-health", label: "MIC Health" },
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
    path: "/api/v1/mics/status",
    anchor: "endpoint-get-mics-status",
    title: "List MIC statuses",
    detail: "Return all company MICs with live connectivity status, last seen time, connection source, and telemetry when available.",
    notes: [
      "Requires X-API-Key.",
      "Returns 503 health/rtdb_unavailable when live presence data cannot be trusted.",
      "Use this for polling-based health dashboards or recovery checks after missed webhook events.",
    ],
  },
  {
    method: "GET",
    path: "/api/v1/mics/{mic_id}/status",
    anchor: "endpoint-get-mic-status",
    title: "Get MIC status",
    detail: "Fetch health for one MIC. Missing linked presence returns status unknown with online false.",
    notes: [
      "Returns 404 when the MIC does not belong to the authenticated company.",
      "Status values include online, offline, unknown, pending, and soft_deleted.",
      "Use alongside mic.online and mic.offline webhooks for resilient monitoring.",
    ],
  },
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
    detail: "Available only for sandbox API keys. Returns seeded deterministic fixtures plus any uploaded live-audio sandbox windows.",
    notes: [
      "Requires a sandbox-scoped X-API-Key.",
      "Use this to drive automated smoke tests without hardcoding fixture windows into your client.",
      "Production API keys receive 404 for this endpoint.",
    ],
  },
  {
    method: "POST",
    path: "/api/v1/analysis/sandbox/audio",
    anchor: "endpoint-post-sandbox-audio",
    title: "Upload sandbox audio",
    detail: "Upload one audio file into the sandbox workspace to test the live analysis path without hardware.",
    notes: [
      "Requires a sandbox-scoped X-API-Key.",
      "Returns the generated mic_id and exact time_range_*_unix values for the normal create-job API.",
      "Sandbox job history and webhooks stay isolated, but the later live-audio analysis run consumes production credits.",
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
            <h1 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">Enterprise API</h1>
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
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary">Enterprise API</p>
                  <code className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-foreground">
                    {apiBaseUrl}/api/v1
                  </code>
                </div>
                <h2 className="mt-4 max-w-3xl text-balance text-[1.95rem] font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
                  Integration guide for MIC health and asynchronous audio analysis
                </h2>
                <p className="mt-4 max-w-3xl text-pretty text-sm leading-7 text-muted-foreground sm:text-[0.98rem]">
                  Monitor MIC connectivity, subscribe to online and offline changes, submit bounded audio windows,
                  and retrieve stable job envelopes with template-scoped results. The public contract is built for
                  backend-to-backend integrations with polling and signed webhook delivery.
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
                    value="Polling + webhooks"
                    detail="Poll MIC and job endpoints, or receive signed job and MIC health events."
                  />
                  <KeyValueCard
                    icon={ListTree}
                    label="MIC health"
                    value="Online/offline"
                    detail="Track connection source, last seen timestamp, and device telemetry when available."
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
                    ["Analysis path", "/api/v1/analysis"],
                    ["MIC path", "/api/v1/mics"],
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
                  title: "Monitor MIC health",
                  path: "GET /api/v1/mics/status",
                  detail: "Use the polling endpoint for dashboards and recovery checks, or subscribe to MIC health webhooks.",
                },
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

          <SectionShell id="mic-health" eyebrow="MIC Health" title="Monitor device connectivity">
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              MIC health uses the same company-scoped API key as analysis. Use polling when you need a current view
              of every device, and use <code className="rounded bg-background px-1.5 py-0.5 text-foreground">mic.online</code>{" "}
              plus <code className="rounded bg-background px-1.5 py-0.5 text-foreground">mic.offline</code> webhooks when
              your integration needs activation and deactivation callbacks.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "online", body: "The MIC is active and present in live device health data." },
                { title: "offline", body: "The MIC is active, but live device health reports it disconnected." },
                { title: "unknown", body: "The MIC exists, but no linked device presence record is available." },
                { title: "503", body: "health/rtdb_unavailable means health data cannot be trusted yet." },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                  <p className="font-mono text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <CodeExample title="GET /api/v1/mics/status" language="bash" code={micStatusCurl} maxHeight="9rem" />
            <CodeExample title="MIC status response" language="json" code={micStatusExample} maxHeight="22rem" />
            <CodeExample title="MIC health webhook subscription" language="json" code={webhookSubscriptionExample} maxHeight="10rem" />
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
              sandbox-scoped API keys and sandbox-only webhook endpoints. It now has two testing modes: seeded
              deterministic fixtures for smoke tests, and uploaded live-audio windows for live-analysis validation
              without hardware. Live-audio sandbox jobs stay operationally isolated in sandbox, but they bill against
              the root production company credit balance.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Same host, different keys",
                  body: "Keep your client base URL unchanged. Switching from sandbox to production is only a key rotation and fixture replacement exercise.",
                },
                {
                  title: "Seeded fixture mode",
                  body: "Use GET /sandbox/fixtures plus create-from-fixture when you need predictable completed and refunded terminal states for parser and webhook smoke tests.",
                },
                {
                  title: "Live-audio mode",
                  body: "Use the starter project's create-from-live-audio command when you want the live analysis path without deploying a hardware mic.",
                },
                {
                  title: "Sandbox callbacks, production billing",
                  body: "Sandbox webhooks, job history, and test data remain isolated. But live-audio sandbox analysis runs still check the root production subscription and deduct real production credits.",
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

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                <p className="text-sm font-semibold text-foreground">Exact live-audio sandbox flow</p>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>1. Use a sandbox API key.</li>
                  <li>2. Run <code className="rounded bg-card px-1.5 py-0.5 text-foreground">create-from-live-audio</code> from the Python starter with a file up to 15 minutes.</li>
                  <li>3. The starter uploads the clip, creates the analysis job with the returned sandbox mic/time window, then waits for webhook and/or polling if requested.</li>
                  <li>4. A completed result proves API auth, upload, live analysis, terminal webhook delivery, and polling response parsing.</li>
                  <li>5. Do not reuse the uploaded mic/time window; live-audio sandbox windows are one-time-use.</li>
                </ol>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                <p className="text-sm font-semibold text-foreground">What the backend actually does</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>Stores the uploaded clip in sandbox storage and creates a real sandbox <code className="rounded bg-card px-1.5 py-0.5 text-foreground">audio_segments</code> record.</li>
                  <li>Creates a sandbox live-audio window so the normal create-job API can consume it safely.</li>
                  <li>Runs the later job through the live analysis pipeline, not the deterministic fixture shortcut.</li>
                  <li>Keeps sandbox job history and sandbox webhook isolation.</li>
                  <li>Uses the root production company for subscription checks and credit deduction on that live-audio analysis run.</li>
                  <li>Deletes the raw uploaded source after the job reaches a terminal state, and expires unused uploads after 1 hour.</li>
                </ul>
              </div>
            </div>
          </SectionShell>

          <SectionShell id="starter-kit" eyebrow="Starter Project" title="Use the official Python sandbox starter for integration testing">
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              The official reference project is{" "}
              <a
                href="https://github.com/KnownSenseAI/knownsense-enterprise-sandbox-python"
                target="_blank"
                rel="noreferrer"
                className="rounded bg-background px-1.5 py-0.5 text-foreground underline decoration-border underline-offset-4"
              >
                KnownSenseAI/knownsense-enterprise-sandbox-python
              </a>
              . Use it before writing your own production client. It already covers the parts of the integration that
              usually fail first: sandbox key authentication, webhook signature verification, ngrok callback plumbing,
              idempotent create-job requests, and deterministic fixture validation. After those pass, run the included
              live-audio command with the sample audio to validate the live analysis backend path before switching to
              production credentials.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KeyValueCard
                icon={KeyRound}
                label="Get From KnownSense"
                value="Sandbox API key"
                detail="Generate it from dashboard settings after switching into the sandbox workspace. Production and sandbox keys are different, even though both use the same API host."
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
                detail="The starter includes a verified webhook receiver plus a CLI harness for config checks, fixture discovery, create-job calls, polling, and smoke tests."
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

            <CodeExample
              title="Run these first before any create-job test"
              language="bash"
              code={sandboxStarterFirstChecksExample}
              maxHeight="12rem"
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "1. Verify local config",
                  body: "Run show-config first. It confirms whether the starter is reading the sandbox key from .env or from a stale shell export.",
                },
                {
                  title: "2. Verify sandbox auth",
                  body: "Run list-fixtures before job creation. Fix 401 or 404 here first instead of debugging create-from-fixture blindly.",
                },
                {
                  title: "3. Test webhook reachability",
                  body: "Use the dashboard Send Test button to prove the current tunnel URL can receive signed webhook.test events.",
                },
                {
                  title: "4. Run real lifecycle tests",
                  body: "Then validate generic success, refunded terminal state, polling-only fallback, and finally the webhook-aware smoke suite.",
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
              description="Run the auth checks first, then use these flows before moving to production credentials."
              maxHeight="20rem"
              tabs={[
                {
                  id: "starter-webhook-flow",
                  label: "Webhook-first",
                  language: "bash",
                  title: "Verify config, verify auth, then wait for job.completed",
                  note: "Best for proving end-to-end callback handling without relying only on GET /jobs/{id}.",
                  code: sandboxStarterWebhookFlowExample,
                },
                {
                  id: "starter-smoke-suite",
                  label: "Smoke suite",
                  language: "bash",
                  title: "Finish the refunded path, polling path, and smoke suite",
                  note: "Covers refunded terminal state, polling fallback, generic success, verification success, and webhook verification.",
                  code: sandboxStarterSmokeSuiteExample,
                },
                {
                  id: "starter-live-audio",
                  label: "Live Audio",
                  language: "bash",
                  title: "Upload sample audio and run live analysis",
                  note: "Uses samples/bus_station_test.m4a. This consumes production credits through the root company even though job history and webhooks stay sandbox-scoped.",
                  code: sandboxStarterLiveAudioExample,
                },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
                <p className="text-sm font-semibold text-foreground">Real-audio sandbox constraints</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>Use files up to 15 minutes. Longer uploads are rejected with <code className="rounded bg-card px-1.5 py-0.5 text-foreground">request/invalid_sandbox_audio</code>.</li>
                  <li>Supported formats include wav, webm, ogg, opus, mp3, m4a/mp4, aac, and flac.</li>
                  <li>The included sample is <code className="rounded bg-card px-1.5 py-0.5 text-foreground">samples/bus_station_test.m4a</code>.</li>
                  <li>The full sample response is in <code className="rounded bg-card px-1.5 py-0.5 text-foreground">examples/live_audio_completed_response.json</code>.</li>
                  <li>The signed <code className="rounded bg-card px-1.5 py-0.5 text-foreground">audio_artifact.download_url</code> expires; fetch the job again for a fresh URL.</li>
                </ul>
              </div>
              <CodeExample
                title="Expected live-audio result shape"
                language="json"
                code={sandboxLiveAudioExpectedExample}
                maxHeight="20rem"
              />
            </div>

            <div className="rounded-[1.2rem] border border-amber-500/30 bg-amber-500/[0.08] p-5">
              <p className="text-sm font-semibold text-foreground">Common Issues During Testing</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {[
                  {
                    title: "Dashboard Send Test works, but Python calls fail",
                    body: "The dashboard test uses your logged-in dashboard session. The starter uses X-API-Key. Webhook reachability can be correct while API auth is still wrong.",
                  },
                  {
                    title: "show-config says process_env",
                    body: "A stale exported KENSO_* shell variable is overriding your local expectations. Keep using .env unless you intentionally set KENSO_PREFER_PROCESS_ENV=true.",
                  },
                  {
                    title: "list-fixtures returns 404",
                    body: "That usually means the key is valid but belongs to the production workspace, not the sandbox workspace.",
                  },
                  {
                    title: "list-fixtures returns 401",
                    body: "That usually means the key is wrong, revoked, malformed, from another workspace, or there is a backend auth issue. Capture the returned X-Request-ID before escalating.",
                  },
                  {
                    title: "create-from-fixture fails before creating a job",
                    body: "The CLI loads sandbox fixtures first. If list-fixtures is failing, job creation never really starts. Fix auth and fixture discovery before debugging jobs.",
                  },
                  {
                    title: "--wait-webhook times out",
                    body: "The job may still have completed. Check receiver.py, ngrok, the saved webhook URL, dashboard delivery history, and polling before assuming processing failed.",
                  },
                  {
                    title: "Deliveries stay queued",
                    body: "First confirm the receiver is up and the tunnel URL is still current. If both are correct, treat it as a backend delivery problem rather than a client parsing bug.",
                  },
                  {
                    title: "Repeated tests reuse old results",
                    body: "Use --avoid-cache on repeated sandbox runs so you force a fresh deterministic job instead of reading a prior cached response.",
                  },
                  {
                    title: "Live-audio sandbox still spends production credits",
                    body: "That is intentional. Uploaded sandbox audio keeps sandbox webhooks and sandbox job history, but the actual analysis run is billed against the root production company so the real-model path is not a free lane.",
                  },
                  {
                    title: "Live-audio upload is invalid",
                    body: "Use a supported audio format and keep the file at 15 minutes or less. For a known-good test, run the starter against samples/bus_station_test.m4a first.",
                  },
                  {
                    title: "Live-audio window is expired or already used",
                    body: "Each uploaded live-audio sandbox window expires after 1 hour and can be consumed by only one job. Upload the file again for a fresh window.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1rem] border border-border/60 bg-background/40 p-4">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
              <p className="text-sm font-semibold text-foreground">What your team should have before going live</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>A working sandbox API key and sandbox-only webhook endpoint.</li>
                <li>A receiver that verifies KnownSense signatures and logs raw callback payloads.</li>
                <li>A passing smoke suite across completed and refunded job paths.</li>
                <li>One passing live-audio sandbox run if you want real analysis output before production.</li>
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

          <SectionShell id="webhooks" eyebrow="Webhooks" title="Verify and process webhook events">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                  Job webhooks carry the same job envelope you would receive from{" "}
                  <code className="rounded bg-background px-1.5 py-0.5 text-foreground">GET /api/v1/analysis/jobs/{'{id}'}</code>,
                  plus a fresh audio artifact URL when the artifact is ready. MIC health webhooks use the same signed
                  delivery contract and send the current MIC object when connectivity changes.
                </p>

                <div className="flex flex-wrap gap-2">
                  {["job.completed", "job.failed", "job.refunded", "mic.offline", "mic.online", "webhook.test"].map((item) => (
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
                      <li>Existing endpoints with no event_types receive job terminal events only.</li>
                      <li>Use event_types to subscribe to MIC health, job results, or both.</li>
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

            <CodeExample title="Job webhook payload example" language="json" code={webhookPayloadExample} maxHeight="18rem" />

            <CodeTabs
              title="MIC health webhook payloads"
              description={'Subscribe with event_types ["mic.offline", "mic.online"] when the receiver only needs activation and deactivation events.'}
              maxHeight="20rem"
              tabs={[
                {
                  id: "mic-offline",
                  label: "mic.offline",
                  language: "json",
                  title: "MIC offline payload",
                  note: "Offline events are debounced for WebSocket closes and immediate for stale-sweep offline transitions.",
                  code: micOfflineWebhookExample,
                },
                {
                  id: "mic-online",
                  label: "mic.online",
                  language: "json",
                  title: "MIC online payload",
                  note: "Recovery emits once when a previously offline MIC comes back online.",
                  code: micOnlineWebhookExample,
                },
              ]}
            />

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
                    ["404", "mic/not_found", "Requested MIC was not found for this company."],
                    ["404", "not_found/job", "Requested job was not found for this company."],
                    ["409", "request/idempotency_in_progress", "The same idempotent request is still processing."],
                    ["422", "request/idempotency_key_reused_with_different_body", "The same Idempotency-Key was reused with a different request body."],
                    ["429", "request/rate_limited", "Current read or write budget was exceeded."],
                    ["503", "health/rtdb_unavailable", "MIC health cannot be trusted because presence data is unavailable."],
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
                "Treat 503 health/rtdb_unavailable as an unknown MIC monitoring state and retry later.",
                "Subscribe MIC-only receivers to mic.offline and mic.online event_types.",
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
