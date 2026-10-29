import { expect, test } from "@playwright/test";
import { API, latestJoinLink, login, passIdentity, setGaze, token } from "./helpers";

const MENTOR = "mentor1@example.com";
const CANDIDATE = "candidate01@example.com";
const CANDIDATE_NAME = "Bela Sato"; // synthetic seed name for candidate01
const TITLE = "E2E · Thermodynamics check";

test("mentor → candidate with 2 flags and 5 glances → summary approved and published", async ({ browser, request }) => {
  // --- setup: a topic and approved questions via the API (the UI for these is covered elsewhere)
  const mt = await token(request, MENTOR);
  const h = { Authorization: `Bearer ${mt}` };
  const course = (await (await request.get(`${API}/courses`, { headers: h })).json())[0];
  const topic = await (await request.post(`${API}/topics`, { headers: h, data: { course_id: course.id, name: "First law" } })).json();
  for (let i = 1; i <= 4; i++) {
    const r = await request.post(`${API}/questions`, {
      headers: h,
      data: {
        topic_id: topic.id,
        body: `E2E question ${i}: which statement is correct?`,
        options: [
          { key: "A", text: `Correct answer ${i}`, is_correct: true },
          { key: "B", text: `Wrong answer ${i}` },
        ],
      },
    });
    expect(r.ok()).toBeTruthy();
  }
  for (let i = 1; i <= 5; i++) {
    // unseen questions the summary can use for the practice set
    await request.post(`${API}/questions`, {
      headers: h,
      data: {
        topic_id: topic.id,
        body: `Practice ${i}: pick the energy balance that holds for a closed system`,
        options: [
          { key: "A", text: "dU = dQ - dW", is_correct: true },
          { key: "B", text: "dU = dQ + dW" },
        ],
      },
    });
  }

  // --- mentor builds the assessment in the UI
  const mentor = await browser.newPage();
  await login(mentor, MENTOR);
  await mentor.goto("/mentor/exams");
  await mentor.getByLabel("Title").fill(TITLE);
  await mentor.getByRole("button", { name: "Create assessment" }).click();
  await mentor.waitForURL(/\/mentor\/exams\/[0-9a-f-]{36}$/);
  const examId = mentor.url().split("/").pop()!;
  for (let i = 1; i <= 4; i++) await mentor.getByLabel(`Include question: E2E question ${i}: which statement is correct?`).check();
  await mentor.getByRole("button", { name: "Save questions" }).click();
  await expect(mentor.getByText("Questions (4)")).toBeVisible();
  await mentor.getByLabel(`Assign ${CANDIDATE_NAME}`).check();
  await mentor.getByRole("button", { name: "Save candidates" }).click();
  await mentor.getByRole("button", { name: "Send links" }).click();
  await expect(mentor.getByText("Link sent")).toBeVisible();

  // --- candidate opens the emailed link, consents, passes identity, calibrates, starts
  const cctx = await browser.newContext();
  const cand = await cctx.newPage();
  await login(cand, CANDIDATE);
  await cand.goto(latestJoinLink(CANDIDATE));
  await cand.waitForURL(/\/candidate\/sessions\//);
  const sessionId = cand.url().split("/").pop()!;
  await cand.getByLabel(/I have read this notice/).check();
  await cand.getByRole("button", { name: "Continue" }).click();
  await expect(cand.getByText("Enrol your face")).toBeVisible();
  await passIdentity(cand, sessionId);
  await cand.reload();
  await cand.getByRole("button", { name: "Start assessment" }).click();
  await expect(cand.getByTestId("flag-counter")).toHaveText(/Flags 0 of 3/);

  // --- proctoring: 2 red flags (head turned > threshold) and 5 glances (eyes off screen 1.5 s)
  for (let f = 1; f <= 2; f++) {
    await setGaze(cand, { yaw: 50 });
    await cand.waitForTimeout(3600);
    await expect(cand.getByRole("status").filter({ hasText: `Flag ${f} of 3 – please keep your eyes on the screen.` })).toBeVisible();
    await setGaze(cand, {});
    await cand.waitForTimeout(1500);
  }
  for (let g = 0; g < 5; g++) {
    await setGaze(cand, { gazeH: 0.95 });
    await cand.waitForTimeout(1600);
    await setGaze(cand, {});
    await cand.waitForTimeout(1200);
  }
  await cand.waitForTimeout(2500); // uploader batch interval
  await expect(cand.getByTestId("flag-counter")).toHaveText(/Flags 2 of 3/);
  await expect(cand.getByText(/glance/i)).toHaveCount(0);

  // --- answer and submit
  // two right, two wrong -> First law 50% (weak) so the summary recommends it
  for (let i = 1; i <= 4; i++) {
    await cand.getByRole("button", { name: new RegExp(`^Question ${i}`) }).click();
    await cand.getByText(i <= 2 ? /^Wrong answer \d$/ : /^Correct answer \d$/).first().click();
  }
  await cand.getByRole("button", { name: "Submit assessment" }).click();
  await cand.getByRole("button", { name: "Yes, submit" }).click();
  await expect(cand.getByText("Assessment submitted")).toBeVisible();

  // --- mentor sees 2 flags and 5 eye glances on the candidate details page
  await mentor.goto(`/mentor/sessions/${sessionId}`);
  await expect(mentor.getByText("2 / 3")).toBeVisible();
  await expect(mentor.getByText("Eye glances").locator("..")).toContainText("5");

  // --- the evaluation job drafts the summary; mentor approves and publishes
  await expect(async () => {
    await mentor.goto(`/mentor/exams/${examId}/summaries`);
    await expect(mentor.getByRole("link", { name: "Review", exact: true })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await mentor.getByRole("link", { name: "Review", exact: true }).click();
  await mentor.getByRole("button", { name: "Approve" }).click();
  await mentor.getByRole("button", { name: "Publish to candidate" }).click();
  await expect(mentor.getByText(/^Published \d/)).toBeVisible();

  // --- candidate sees the approved recommendations, and nothing about glances or flags beyond the counter
  await cand.goto("/candidate");
  await expect(cand.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(cand.getByText(/Reviewed by/)).toBeVisible();
  await expect(cand.getByText("Recommended next")).toBeVisible();
  await expect(cand.getByText(/^1\. First law$/)).toBeVisible();
  await expect(cand.getByText(/Practice set · \d+ questions/)).toBeVisible();
  const text = (await cand.locator("main").innerText()).toLowerCase();
  for (const forbidden of ["glance", "red flag", "integrity", "look away", "evidence"]) expect(text).not.toContain(forbidden);
});
