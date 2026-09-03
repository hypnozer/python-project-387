import { expect, test } from "@playwright/test";

test("owner creates an event type and a guest books it", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const eventTitle = `Consultation ${suffix}`;
  const eventId = `consultation-${suffix}`;
  const guestName = `Guest ${suffix}`;
  const guestEmail = `${suffix}@example.com`;

  await page.goto("/owner");
  await page.getByLabel("Название").fill(eventTitle);
  await page.getByLabel("Идентификатор").fill(eventId);
  await page.getByLabel("Описание").fill("Introductory consultation");
  await page.getByLabel("Длительность").selectOption("30");
  await page.getByRole("button", { name: "Создать формат" }).click();
  await expect(page.getByRole("status")).toContainText(eventTitle);

  await page.goto("/");
  const eventCard = page.getByRole("article").filter({ hasText: eventTitle });
  await expect(eventCard).toBeVisible();
  await eventCard.getByRole("link", { name: "Выбрать время" }).click();

  await page.locator("button.slot-button").first().click();
  await page.getByLabel("Ваше имя").fill(guestName);
  await page.getByLabel("Электронная почта").fill(guestEmail);
  await page.getByRole("button", { name: "Подтвердить встречу" }).click();

  await expect(page.getByRole("heading", { name: "До встречи!" })).toBeVisible();
  await expect(page.getByText("Встреча забронирована")).toBeVisible();
  await expect(page.getByText(eventTitle)).toBeVisible();

  await page.goto("/owner");
  const booking = page.getByRole("article").filter({ hasText: eventTitle });
  await expect(booking).toContainText(guestName);
  await expect(booking).toContainText(guestEmail);
});
