import { expect, test } from "@playwright/test";

test("homepage is engaging and fits the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Turn one idea into a working demo." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Build a project" })).toBeVisible();
  await expect(page.getByText("One coordinator keeps the whole build coherent.")).toBeVisible();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  const unlabeled = await page.locator("button, a, input, textarea").evaluateAll((items) => items.filter((item) => {
    const element = item as HTMLElement;
    return !(element.innerText.trim() || element.getAttribute("aria-label") || element.getAttribute("title"));
  }).length);
  expect(unlabeled).toBe(0);
});

test("multidimensional climate journey restores after refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build a project" }).click();
  await page.getByRole("button", { name: /Climate resilience/ }).click();
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Proposed workers")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Content Executive", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer Service Executive", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve and build" }).click();

  await expect(page.locator(".landing h1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Worker Lab" })).toBeVisible();
  const voiceTab = page.getByRole("tab", { name: /Voice/ });
  await voiceTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Support/ })).toBeFocused();
  const previewDimensions = await page.locator(".landing").evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
  expect(previewDimensions.scrollWidth).toBeLessThanOrEqual(previewDimensions.clientWidth + 1);
  await page.getByLabel("Studio message").fill('Change the headline to "Earlier warnings for safer shores"');
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Earlier warnings for safer shores" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Earlier warnings for safer shores" })).toBeVisible();
});

test("invalid input keeps focus and a problem can be corrected before approval", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build a project" }).click();
  const composer = page.getByLabel("Studio message");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("#studio-input-error")).toContainText("Enter the audience");
  await expect(composer).toBeFocused();

  await page.getByRole("button", { name: /Climate resilience/ }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Proposed workers")).toBeVisible();
  await page.getByRole("button", { name: "Edit problem" }).click();
  await expect(composer).toBeFocused();
  await composer.fill("Build ClinicPath for rural patients who need accessible appointment guidance and safe referral routes. Do not contact patients automatically.");
  await page.getByRole("button", { name: "Reanalyze problem" }).click();
  await expect(page.getByText("Proposed workers")).toBeVisible();
  await expect(composer).not.toBeVisible();
  await expect(page.getByText(/rural patients/i).first()).toBeVisible();
});

test("ambiguous removal and capability expansion remain safe", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build a project" }).click();
  await page.getByRole("button", { name: /Public services/ }).click();
  await page.getByRole("button", { name: "Send" }).click();
  const campaignWorker = page.getByRole("button", { name: /Digital Campaign Executive/ });
  if (await campaignWorker.getAttribute("aria-pressed") === "true") await campaignWorker.click();
  const approveButton = page.getByRole("button", { name: "Approve and build" });
  if (await approveButton.isDisabled()) await page.getByRole("button", { name: /Content Executive/ }).click();
  await approveButton.click();
  const initialHeadline = await page.locator(".landing h1").textContent();
  expect(initialHeadline).toBeTruthy();

  await page.getByLabel("Studio message").fill("Remove it");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/which .*section.*remove|which section or capability/i)).toBeVisible();
  await expect(page.locator(".landing h1")).toHaveText(initialHeadline!);

  await page.getByLabel("Studio message").fill("Remove the support section");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog", { name: "Confirm removal" })).toBeVisible();
  await page.getByRole("button", { name: "Keep page unchanged" }).click();
  await expect(page.locator(".landing h1")).toHaveText(initialHeadline!);

  await page.getByLabel("Studio message").fill("Create a community awareness campaign, but do not send anything");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "New worker proposed" })).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.locator(".landing h1")).toHaveText(initialHeadline!);
});
