import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * The RecallAI acceptance flow, end to end against real local AI:
 * register → workspace → knowledge base → upload PDF → processing → streamed RAG answer
 * → citation opens the cited page → generate MCQs → take quiz → see score.
 */
const SAMPLE_PDF = path.resolve(__dirname, "../../../docs/samples/Advanced Database.pdf");
const QUESTION = "Explain normalization and give examples of 1NF, 2NF and 3NF.";

test.describe.configure({ mode: "serial" });

test("register, upload, ask with citations, and take a generated quiz", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await test.step("register", async () => {
    await page.goto("/register");
    await page.getByLabel("First name").fill("Asha");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("E2e-Strong-Pass-1");
    await page.getByLabel("Confirm password").fill("E2e-Strong-Pass-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Asha/ })).toBeVisible();
  });

  await test.step("create a second workspace and switch to it", async () => {
    await page.getByRole("button", { name: "Switch workspace" }).click();
    await page.getByRole("menuitem", { name: "New workspace" }).click();
    await page.getByLabel("Name").fill("Final Year");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("button", { name: "Switch workspace" })).toContainText("Final Year");
  });

  await test.step("create the BSc CSIT knowledge base", async () => {
    await page.goto("/dashboard/knowledge?new=1");
    await page.getByLabel("Name").fill("BSc CSIT");
    await page.getByLabel("Description").fill("Advanced database lecture notes");
    await page.getByRole("button", { name: "Create knowledge base" }).click();
    await expect(page).toHaveURL(/\/dashboard\/knowledge\/\d+/);
    await expect(page.getByRole("heading", { name: "BSc CSIT" })).toBeVisible();
  });

  await test.step("upload the PDF and wait for processing", async () => {
    await page.getByTestId("upload-input").setInputFiles(SAMPLE_PDF);
    const row = page.getByTestId("document-row").filter({ hasText: "Advanced Database.pdf" });
    await expect(row.locator('[data-status="READY"]')).toBeVisible({ timeout: 5 * 60_000 });
    await expect(row).toContainText("6"); // pages
  });

  await test.step("ask a question and receive a streamed, cited answer", async () => {
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/chat\/\d+/);
    await page.getByRole("textbox", { name: "Message" }).fill(QUESTION);
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("user-message")).toContainText(QUESTION);
    const answer = page.getByTestId("assistant-message").last();
    // Tokens arrive before generation finishes (streaming)…
    await expect(answer).toContainText(/normal/i, { timeout: 3 * 60_000 });
    // …and sources appear once the answer is stored.
    await expect(answer.getByTestId("source-card").first()).toBeVisible({ timeout: 8 * 60_000 });
    await expect(answer).toContainText(/1NF|first normal form/i);
    await expect(page.getByTestId("conversation-title")).toContainText("Explain normalization");
  });

  await test.step("open a citation at the cited page", async () => {
    const answer = page.getByTestId("assistant-message").last();
    const chip = answer.getByTestId("citation-chip").first();
    const target = (await chip.count()) > 0 ? chip : answer.getByTestId("source-card").first();
    await target.click();
    await expect(page).toHaveURL(/\/dashboard\/documents\/\d+\?page=\d+/);
    await expect(page.locator("mark.citation-highlight").first()).toBeVisible();
    await expect(page.getByText("Highlighting the cited passage")).toBeVisible();
  });

  await test.step("generate MCQs", async () => {
    await page.goto("/dashboard/study");
    await page.getByRole("radio", { name: /Quiz/ }).first().click();
    await page.getByRole("button", { name: /Generate quiz/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/study\/\d+/);
    await expect(page.getByTestId("question-counter")).toBeVisible({ timeout: 10 * 60_000 });
  });

  await test.step("take the quiz and see the score", async () => {
    const counter = page.getByTestId("question-counter");
    const total = Number((await counter.textContent())?.match(/of (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await page.getByTestId("option-A").click();
      if (i < total - 1) await page.getByRole("button", { name: /^Next/ }).click();
    }
    await page.getByTestId("submit-exam").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Submit" }).click();
    await expect(page.getByTestId("quiz-results")).toBeVisible();
    await expect(page.getByTestId("quiz-score")).toHaveText(new RegExp(`^\\d+/${total}$`));
  });
});

test("workspace isolation: another user cannot open someone else's document", async ({ page, browser }) => {
  // Owner registers and uploads a document.
  const owner = `owner-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(owner);
  await page.getByLabel("Password", { exact: true }).fill("E2e-Strong-Pass-1");
  await page.getByLabel("Confirm password").fill("E2e-Strong-Pass-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/dashboard/knowledge?new=1");
  await page.getByLabel("Name").fill("Private notes");
  await page.getByRole("button", { name: "Create knowledge base" }).click();
  await page.getByTestId("upload-input").setInputFiles(SAMPLE_PDF);
  const link = page.getByTestId("document-row").getByRole("link").first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");

  // A different user in a fresh browser context cannot see it.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/register");
  await otherPage.getByLabel("Email").fill(`intruder-${Date.now()}@example.com`);
  await otherPage.getByLabel("Password", { exact: true }).fill("E2e-Strong-Pass-1");
  await otherPage.getByLabel("Confirm password").fill("E2e-Strong-Pass-1");
  await otherPage.getByRole("button", { name: "Create account" }).click();
  await expect(otherPage).toHaveURL(/\/dashboard/);
  await otherPage.goto(href!);
  await expect(otherPage.getByText("Document unavailable")).toBeVisible();
  await expect(otherPage.getByText(/Document not found/)).toBeVisible();
  await other.close();
});
