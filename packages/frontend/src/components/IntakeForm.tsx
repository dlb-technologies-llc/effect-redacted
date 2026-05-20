import { useAtomSet } from "@effect/atom-react"
import { Cause, Exit } from "effect"
import * as React from "react"
import { submitIntakeAtom } from "../atoms/intake"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type FormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  netWorth: string
}

const empty: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  netWorth: "",
}

type Result =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; referenceId: string }
  | { kind: "error"; message: string; field?: string }

export function IntakeForm() {
  const submit = useAtomSet(submitIntakeAtom, { mode: "promiseExit" })
  const [values, setValues] = React.useState<FormValues>(empty)
  const [result, setResult] = React.useState<Result>({ kind: "idle" })

  const update = (key: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }))

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setResult({ kind: "submitting" })
    const exit = await submit({
      payload: {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        netWorth: Number(values.netWorth),
      },
    })
    Exit.match(exit, {
      onSuccess: (value) => setResult({ kind: "success", referenceId: value.referenceId }),
      onFailure: (cause) => {
        // v4 Cause: typed errors live on Fail reasons. The Reason.error type
        // for our union is IntakeValidationError | HttpApiDecodeError, so we
        // narrow defensively rather than asserting structure.
        const failReason = cause.reasons.find(Cause.isFailReason)
        const error = failReason?.error
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Something went wrong. Please try again."
        const field =
          error && typeof error === "object" && "field" in error && typeof error.field === "string"
            ? error.field
            : undefined
        setResult({ kind: "error", message, field })
      },
    })
  }

  if (result.kind === "success") {
    return (
      <Card className="w-full max-w-md border-t-2 border-t-foreground pt-2">
        <CardHeader className="pt-8">
          <CardTitle className="text-2xl">We&rsquo;ve received your note.</CardTitle>
          <CardDescription className="pt-2 text-base leading-relaxed">
            A partner will be in touch within two business days. Keep this reference for your
            records:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
              {result.referenceId}
            </code>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const submitting = result.kind === "submitting"
  const errorField = result.kind === "error" ? result.field : undefined
  const invalid = (name: keyof FormValues) => (errorField === name ? true : undefined)

  return (
    <Card className="w-full max-w-md border-t-2 border-t-foreground pt-2">
      <CardHeader className="pt-8">
        <CardTitle className="text-2xl">Begin a conversation.</CardTitle>
        <CardDescription className="pt-2 text-base leading-relaxed">
          We work with a small number of accredited investors. Share a few details and a partner
          will reach out within two business days.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-8">
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                placeholder="Eleanor"
                value={values.firstName}
                onChange={update("firstName")}
                aria-invalid={invalid("firstName")}
                disabled={submitting}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                placeholder="Whitfield"
                value={values.lastName}
                onChange={update("lastName")}
                aria-invalid={invalid("lastName")}
                disabled={submitting}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="eleanor@example.com"
              value={values.email}
              onChange={update("email")}
              aria-invalid={invalid("email")}
              disabled={submitting}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(202) 555 0148"
              value={values.phone}
              onChange={update("phone")}
              aria-invalid={invalid("phone")}
              disabled={submitting}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="netWorth">Net worth (USD)</Label>
            <Input
              id="netWorth"
              name="netWorth"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="1500000"
              value={values.netWorth}
              onChange={update("netWorth")}
              aria-invalid={invalid("netWorth")}
              disabled={submitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Whole dollars. We use this only to confirm accreditation.
            </p>
          </div>
          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? "Sending…" : "Request introduction"}
          </Button>
          {result.kind === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {result.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
