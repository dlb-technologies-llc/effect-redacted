import { AppApi } from "@effect-redacted/shared/http/api"
import { FetchHttpClient } from "effect/unstable/http"
import { AtomHttpApi } from "effect/unstable/reactivity"

export const IntakeApi = AtomHttpApi.Service()("IntakeApi", {
  api: AppApi,
  httpClient: FetchHttpClient.layer,
  baseUrl: "http://localhost:3001",
})
