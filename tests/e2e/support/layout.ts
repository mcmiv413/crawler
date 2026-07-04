import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export const LAYOUT_PRESETS = {
  'desktop-default': { width: 1280, height: 900, mobile: false },
  'android-min': { width: 360, height: 640, mobile: true },
  'ios-min': { width: 375, height: 667, mobile: true },
  'ios-primary': { width: 390, height: 844, mobile: true },
  'wide-phone': { width: 412, height: 915, mobile: true },
} as const;

export type LayoutPresetName = keyof typeof LAYOUT_PRESETS;

const OVERFLOW_TOLERANCE_PX = 2;

export async function applyLayoutPreset(page: Page, layout: LayoutPresetName): Promise<void> {
  const { width, height } = LAYOUT_PRESETS[layout];
  await page.setViewportSize({ width, height });
}

async function expectReachableInViewport(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  expect(box!.x).toBeGreaterThanOrEqual(-OVERFLOW_TOLERANCE_PX);
  expect(box!.y).toBeGreaterThanOrEqual(-OVERFLOW_TOLERANCE_PX);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + OVERFLOW_TOLERANCE_PX);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + OVERFLOW_TOLERANCE_PX);
}

export async function expectNoDocumentOverflow(
  page: Page,
  layout: LayoutPresetName,
): Promise<void> {
  await expect.poll(async () => page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
  if (LAYOUT_PRESETS[layout].mobile) {
    await expect.poll(async () => page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    )).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
  }
}

export async function expectDungeonCanvasVisible(page: Page): Promise<void> {
  const canvas = page.getByTestId('dungeon-canvas');
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return box !== null && box.width > 0 && box.height > 0;
  }).toBe(true);
  await expect(canvas).toBeVisible();
}

export async function expectMobileNavVisibleWhenExpected(
  page: Page,
  layout: LayoutPresetName,
): Promise<void> {
  if (!LAYOUT_PRESETS[layout].mobile) {
    return;
  }
  await expectReachableInViewport(page, page.getByTestId('mobile-nav'));
}

export async function expectActionAreaReachable(page: Page): Promise<void> {
  await expectReachableInViewport(page, page.getByTestId('action-area'));
  const waitAction = page.getByRole('button', { name: /^Wait:/u });
  await expect(waitAction).toBeEnabled();
  await waitAction.click({ trial: true });
}

export async function expectCombatLogReachable(page: Page): Promise<void> {
  const inlineLog = page.getByTestId('combat-log');
  if (await inlineLog.isVisible()) {
    await expectReachableInViewport(page, inlineLog);
    return;
  }

  const logTab = page.getByTestId('mobile-nav-log');
  await expectReachableInViewport(page, logTab);
  await logTab.click();
  await expectReachableInViewport(page, page.getByTestId('combat-log-entries'));
}
