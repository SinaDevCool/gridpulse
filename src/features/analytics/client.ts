import {
  analyticsJobSchema,
  c3RequestSchema,
  jobAcceptedSchema,
  type AnalyticsJob,
  type C3Request,
} from "./contracts";
async function request(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`Analytics service returned ${response.status}`);
  return response.json();
}
export async function submitC3Job(baseUrl: string, token: string, input: C3Request) {
  const payload = c3RequestSchema.parse(input);
  return jobAcceptedSchema.parse(
    await request(`${baseUrl.replace(/\/$/, "")}/v1/jobs/c3-security-flexibility`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}
export async function getAnalyticsJob(baseUrl: string, token: string, id: string) {
  return analyticsJobSchema.parse(
    await request(`${baseUrl.replace(/\/$/, "")}/v1/jobs/${id}`, token),
  );
}
export async function waitForAnalyticsJob(
  baseUrl: string,
  token: string,
  id: string,
  onUpdate?: (job: AnalyticsJob) => void,
  intervalMs = 1500,
) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const job = await getAnalyticsJob(baseUrl, token, id);
    onUpdate?.(job);
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Analytics job polling timed out");
}
