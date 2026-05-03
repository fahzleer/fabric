export interface HealthCheck {
  readonly name: string
  readonly check: () => Promise<boolean>
}

export const buildHealthResponse = async (
  service: string,
  checks: HealthCheck[] = [],
): Promise<{ status: string; service: string; checks?: Record<string, "ok" | "fail"> }> => {
  if (checks.length === 0) return { status: "ok", service }

  const results: Record<string, "ok" | "fail"> = {}
  let allOk = true

  await Promise.all(
    checks.map(async ({ name, check }) => {
      try {
        results[name] = (await check()) ? "ok" : "fail"
      } catch {
        results[name] = "fail"
      }
      if (results[name] === "fail") allOk = false
    }),
  )

  return { status: allOk ? "ok" : "degraded", service, checks: results }
}
