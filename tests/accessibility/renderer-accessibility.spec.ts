import { expect, test, type Locator, type Page } from '@playwright/test';
import { QUALITY_MANUAL_ROUTES, type QualityManualRoute } from '../../src/verification/manual/qualityRoutes';
import { assertAccessibilityEvidence } from '../quality/evidenceSchema';
import {
    evaluateComputedContrastCandidate,
    selectComputedColorCandidate,
    type ComputedColorValue,
} from './contrast';
import { navigateToQualityManualRoute } from '../quality/manualRouteHarness';

type RouteAccessibilityContract = Readonly<{
    primaryControl: string;
    requiresTabs?: boolean;
    requiresLiveRegion?: boolean;
}>;

type RouteObservation = Readonly<{
    route: string;
    locale: QualityManualRoute['locale'];
    viewport: QualityManualRoute['viewport'];
    controls: string[];
    contrast: unknown;
    focus: unknown;
    horizontalOverflow: boolean;
}>;

type FocusStyle = Readonly<{
    outlineColor: string;
    outlineStyle: string;
    outlineWidth: string;
}>;

const ROUTE_CONTRACTS: Record<QualityManualRoute['id'], RouteAccessibilityContract> = {
    'launcher-home-en': {
        primaryControl: '[data-testid="installed-modpack-actions-alpha"] button',
    },
    'installed-list-detail-ru': {
        primaryControl: '[data-testid="installed-modpack-actions-alpha"] button',
    },
    'provider-content-en': {
        primaryControl: '[data-testid="phase41-appearance-surface"] button',
        requiresTabs: true,
    },
    'provider-content-ru': {
        primaryControl: '[data-testid="phase41-appearance-surface"] button',
        requiresTabs: true,
    },
    'network-tunnel-en': {
        primaryControl: '[role="dialog"] [role="tab"]',
        requiresTabs: true,
        requiresLiveRegion: true,
    },
    'network-lan-ru': {
        primaryControl: '[role="dialog"] button',
        requiresLiveRegion: true,
    },
};

function visibleFocusableSelector(selector: string): string {
    return `${selector}:visible:not([disabled]):not([aria-disabled="true"]):not([inert])`;
}

async function getVisibleFocusableControls(page: Page): Promise<string[]> {
    return page.locator([
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="button"]',
        '[role="tab"]',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ')).evaluateAll((elements) => elements
        .filter((element) => {
            const htmlElement = element as HTMLElement;
            const style = getComputedStyle(htmlElement);
            return style.visibility !== 'hidden'
                && style.display !== 'none'
                && htmlElement.getClientRects().length > 0
                && !htmlElement.closest('[aria-hidden="true"], [inert]')
                && !htmlElement.matches('[disabled], [aria-disabled="true"]');
        })
        .map((element) => {
            const htmlElement = element as HTMLElement;
            const labelledBy = htmlElement.getAttribute('aria-labelledby')
                ?.split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
                .filter(Boolean)
                .join(' ');
            const name = [
                htmlElement.getAttribute('aria-label'),
                labelledBy,
                htmlElement.getAttribute('title'),
                (htmlElement as HTMLInputElement).value,
                htmlElement.textContent?.trim(),
            ].find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0) ?? '';
            const role = htmlElement.getAttribute('role')
                ?? (htmlElement instanceof HTMLButtonElement ? 'button' : undefined)
                ?? (htmlElement instanceof HTMLAnchorElement ? 'link' : undefined)
                ?? (htmlElement instanceof HTMLInputElement ? 'input' : undefined)
                ?? (htmlElement instanceof HTMLSelectElement ? 'select' : undefined)
                ?? (htmlElement instanceof HTMLTextAreaElement ? 'textbox' : undefined);
            return `${role ?? 'missing-role'}:${name}`;
        }));
}

async function collectBackgroundCandidates(locator: Locator, startAtParent = false): Promise<ComputedColorValue[]> {
    return locator.evaluate((element, skipElement) => {
        const candidates: ComputedColorValue[] = [];
        let current: HTMLElement | null = skipElement
            ? (element as HTMLElement).parentElement
            : element as HTMLElement;
        while (current) {
            candidates.push({
                property: current === element ? 'backgroundColor' : 'ancestorBackgroundColor',
                value: getComputedStyle(current).backgroundColor,
            });
            current = current.parentElement;
        }
        return candidates;
    }, startAtParent);
}

async function assertComputedTextAndFocusContrast(locator: Locator, focusedStyle: FocusStyle): Promise<unknown> {
    const [backgroundCandidates, focusBackgroundCandidates, style] = await Promise.all([
        collectBackgroundCandidates(locator),
        collectBackgroundCandidates(locator, true),
        locator.evaluate((element) => {
            const computed = getComputedStyle(element as HTMLElement);
            return {
                color: computed.color,
                fontSizePx: Number.parseFloat(computed.fontSize),
                fontWeight: computed.fontWeight,
                outlineColor: computed.outlineColor,
                outlineStyle: computed.outlineStyle,
                outlineWidth: computed.outlineWidth,
            };
        }),
    ]);
    const background = selectComputedColorCandidate(backgroundCandidates);
    expect(background, 'a rendered contrast candidate needs an opaque computed background').not.toHaveProperty('failureReason');
    if ('failureReason' in background) {
        throw new Error(background.failureReason);
    }
    const focusBackground = selectComputedColorCandidate(focusBackgroundCandidates);
    expect(focusBackground, 'a focus indicator needs an opaque adjacent computed background').not.toHaveProperty('failureReason');
    if ('failureReason' in focusBackground) {
        throw new Error(focusBackground.failureReason);
    }

    const text = evaluateComputedContrastCandidate({
        kind: 'text',
        foreground: style.color,
        background: background.value,
        fontSizePx: style.fontSizePx,
        fontWeight: style.fontWeight,
    });
    expect(text, `text contrast must include computed colors: ${JSON.stringify(text)}`).toMatchObject({ verdict: 'pass' });

    expect(focusedStyle.outlineStyle, 'keyboard focus must be visibly outlined').not.toBe('none');
    expect(Number.parseFloat(focusedStyle.outlineWidth), 'keyboard focus outline must have width').toBeGreaterThan(0);

    const focus = evaluateComputedContrastCandidate({
        kind: 'focus',
        foreground: focusedStyle.outlineColor,
        background: focusBackground.value,
    });
    expect(focus, `focus contrast must include computed colors: ${JSON.stringify({ focus, focusedStyle })}`).toMatchObject({ verdict: 'pass' });

    return { background, focusBackground, text, focus };
}

async function assertTabLinks(page: Page): Promise<void> {
    const tabs = page.locator('[role="tab"]:visible');
    const count = await tabs.count();
    expect(count, 'declared tab route must render tabs').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
        const tab = tabs.nth(index);
        const id = await tab.getAttribute('id');
        const controls = await tab.getAttribute('aria-controls');
        expect(id, 'tab needs a stable id').toBeTruthy();
        expect(controls, 'tab must point at its panel').toBeTruthy();
    }

    const activeTab = page.locator('[role="tab"][aria-selected="true"]:visible').first();
    const activeTabId = await activeTab.getAttribute('id');
    const activePanelId = await activeTab.getAttribute('aria-controls');
    const activePanel = page.locator(`[id="${activePanelId ?? ''}"]`);
    await expect(activePanel, 'the active tab must reference a rendered tabpanel').toHaveAttribute('role', 'tabpanel');
    await expect(activePanel, 'the active tabpanel must point back to its tab').toHaveAttribute('aria-labelledby', activeTabId ?? '');
}

async function assertKeyboardOrder(page: Page, control: Locator): Promise<FocusStyle> {
    let reachedControl = false;
    for (let index = 0; index < 128; index += 1) {
        await page.keyboard.press('Tab');
        if (await control.evaluate((element) => document.activeElement === element)) {
            reachedControl = true;
            break;
        }
    }
    expect(reachedControl, 'Tab traversal must reach the declared visible control').toBe(true);
    const focusedStyle = await control.evaluate((element) => {
        const computed = getComputedStyle(element as HTMLElement);
        return {
            outlineColor: computed.outlineColor,
            outlineStyle: computed.outlineStyle,
            outlineWidth: computed.outlineWidth,
        };
    });

    const nextFocusable = await page.evaluate((element) => {
        const selector = [
            'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
            '[role="button"]', '[role="tab"]', '[tabindex]:not([tabindex="-1"])',
        ].join(', ');
        const focusable = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((candidate) => {
            const style = getComputedStyle(candidate);
            return style.visibility !== 'hidden'
                && style.display !== 'none'
                && candidate.getClientRects().length > 0
                && !candidate.closest('[aria-hidden="true"], [inert]')
                && !candidate.matches('[disabled], [aria-disabled="true"]');
        });
        const currentIndex = focusable.indexOf(element as HTMLElement);
        return focusable[(currentIndex + 1) % focusable.length]?.outerHTML ?? '';
    }, await control.elementHandle());

    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.outerHTML ?? ''), 'Tab must advance in visible DOM order')
        .toBe(nextFocusable);
    return focusedStyle;
}

async function assertRouteAccessibility(page: Page, route: QualityManualRoute): Promise<RouteObservation> {
    const contract = ROUTE_CONTRACTS[route.id];
    await navigateToQualityManualRoute(page, route);

    const primaryControl = page.locator(visibleFocusableSelector(contract.primaryControl)).first();
    await expect(primaryControl, `${route.id} must render its declared keyboard control`).toBeVisible();
    const focusedStyle = await assertKeyboardOrder(page, primaryControl);

    const controls = await getVisibleFocusableControls(page);
    expect(controls, `${route.id} has visible keyboard controls`).not.toEqual([]);
    expect(controls.filter((control) => control.startsWith('missing-role:') || control.endsWith(':')),
        `${route.id} controls must expose a role and accessible name`).toEqual([]);

    if (contract.requiresTabs) {
        await assertTabLinks(page);
    }
    if (contract.requiresLiveRegion) {
        await expect(page.locator('[aria-live]:visible, [role="status"]:visible').first(),
            `${route.id} must expose its dynamic state to assistive technology`).toBeVisible();
    }

    const contrast = await assertComputedTextAndFocusContrast(primaryControl, focusedStyle);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth
        || document.body.scrollWidth > window.innerWidth);
    expect(horizontalOverflow, `${route.id} must not horizontally overflow its declared viewport`).toBe(false);

    return {
        route: route.id,
        locale: route.locale,
        viewport: route.viewport,
        controls,
        contrast,
        focus: await primaryControl.evaluate((element) => ({
            active: document.activeElement === element,
            outline: getComputedStyle(element as HTMLElement).outline,
        })),
        horizontalOverflow,
    };
}

test.describe('production manual route accessibility', () => {
    for (const route of QUALITY_MANUAL_ROUTES) {
        test(`${route.id} is keyboard-operable and exposes computed-style evidence`, async ({ page, browserName }, testInfo) => {
            const observation = await assertRouteAccessibility(page, route);
            const evidence = {
                kind: 'accessibility' as const,
                route,
                environment: {
                    commit: process.env.GITHUB_SHA ?? '0000000',
                    node: process.version,
                    npm: process.env.npm_config_user_agent ?? 'npm',
                    vite: '7',
                    browser: browserName,
                    platform: process.platform,
                    architecture: process.arch,
                    capturedAt: new Date().toISOString(),
                },
                samples: [1],
                aggregation: 'single route keyboard, semantics, focus, contrast and containment observation',
                thresholds: { normalText: 4.5, largeText: 3, border: 3, focus: 3, horizontalOverflow: 0 },
                verdict: 'pass' as const,
                artifactPath: testInfo.outputPath('accessibility-evidence.json'),
                observations: [observation],
            };
            assertAccessibilityEvidence(evidence);
            await testInfo.attach('accessibility-evidence.json', {
                body: JSON.stringify(evidence, null, 2),
                contentType: 'application/json',
            });
        });
    }

    test('reports injected unnamed and insufficient-contrast controls as failures', async ({ page }) => {
        const route = QUALITY_MANUAL_ROUTES[0];
        await navigateToQualityManualRoute(page, route);
        await page.evaluate(() => {
            document.body.insertAdjacentHTML('beforeend', [
                '<button data-accessibility-fixture="unnamed"></button>',
                '<button data-accessibility-fixture="contrast" style="color: rgb(119, 119, 119); background: rgb(255, 255, 255)">Fixture</button>',
            ].join(''));
        });

        const controls = await getVisibleFocusableControls(page);
        expect(controls).toContain('button:');

        const contrastFixture = page.locator('[data-accessibility-fixture="contrast"]');
        const fixtureStyle = await contrastFixture.evaluate((element) => {
            const style = getComputedStyle(element as HTMLElement);
            return {
                color: style.color,
                backgroundColor: style.backgroundColor,
                fontSizePx: Number.parseFloat(style.fontSize),
                fontWeight: style.fontWeight,
            };
        });
        const contrast = evaluateComputedContrastCandidate({
            kind: 'text',
            foreground: fixtureStyle.color,
            background: fixtureStyle.backgroundColor,
            fontSizePx: fixtureStyle.fontSizePx,
            fontWeight: fixtureStyle.fontWeight,
        });
        expect(contrast).toMatchObject({ verdict: 'fail', failureReason: 'contrast-below-threshold' });
    });

    test('returns focus to the visible share invoker after closing its dialog', async ({ page }) => {
        const route = QUALITY_MANUAL_ROUTES[0];
        await navigateToQualityManualRoute(page, route);

        const menuTrigger = page.locator('[data-testid="installed-modpack-actions-alpha"] button').last();
        await menuTrigger.click();
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        await menu.getByRole('menuitem').nth(2).click();

        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(menuTrigger).toBeFocused();
    });
});
