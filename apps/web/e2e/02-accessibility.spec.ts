import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { API, login, token } from "./helpers";

const problems: string[] = [];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  problems.push(...serious.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.help}`));
}

test("no serious accessibility issues on any page", async ({ browser, request }) => {
  const mt = await token(request, "mentor1@example.com");
  const h = { Authorization: `Bearer ${mt}` };
  const exams = await (await request.get(`${API}/exams`, { headers: h })).json();
  const exam = exams[0];
  const live = await (await request.get(`${API}/mentor/exams/${exam.id}/live`, { headers: h })).json();
  const sessionId = live[0].session_id;
  const runs = await (await request.get(`${API}/agent/runs`, { headers: h })).json();

  const page = await (await browser.newContext()).newPage();
  await audit(page, "/login");
  await audit(page, "/styleguide");

  await login(page, "mentor1@example.com");
  for (const p of [
    "/mentor",
    "/mentor/questions",
    "/mentor/exams",
    `/mentor/exams/${exam.id}`,
    `/mentor/exams/${exam.id}/live`,
    `/mentor/exams/${exam.id}/results`,
    `/mentor/exams/${exam.id}/marking`,
    `/mentor/exams/${exam.id}/summaries`,
    `/mentor/sessions/${sessionId}`,
    `/mentor/sessions/${sessionId}/result`,
    `/mentor/sessions/${sessionId}/summary`,
    "/mentor/identity",
    "/mentor/agent",
    `/mentor/agent/runs/${runs[0].id}`,
  ])
    await audit(page, p);

  const ctx = await browser.newContext();
  const cand = await ctx.newPage();
  await login(cand, "candidate01@example.com");
  await audit(cand, "/candidate");
  const ct = await token(request, "candidate01@example.com");
  const dash = await (await request.get(`${API}/candidates/me/dashboard`, { headers: { Authorization: `Bearer ${ct}` } })).json();
  if (dash.results[0]?.practice) await audit(cand, `/candidate/practice/${dash.results[0].practice.id}`);

  const actx = await browser.newContext();
  const admin = await actx.newPage();
  await login(admin, "admin@example.com");
  for (const p of ["/admin", "/admin/courses", "/admin/notes", "/admin/agent"]) await audit(admin, p);
  expect(problems).toEqual([]);
});
