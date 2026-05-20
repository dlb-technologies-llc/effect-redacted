import * as NodeSdk from "@effect/opentelemetry/NodeSdk"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"

export const TelemetryLive = NodeSdk.layer(() => ({
  resource: { serviceName: "@effect-redacted/backend" },
  spanProcessor: new BatchSpanProcessor(new ConsoleSpanExporter()),
}))
