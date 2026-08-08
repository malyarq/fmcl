import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type Checker = Readonly<{
  checkWorkflowStructure(options: { ci: string; release: string }): { valid: boolean; errors: string[] };
}>;

const require = createRequire(import.meta.url);
const checker = require('../check-workflow-structure.cjs') as Checker;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(overrides: Partial<Record<'ci' | 'release', string>> = {}) {
  const workflows = {
    ci: `on:\n  pull_request:\njobs:\n  checks:\n    steps:\n      - run: npx playwright install --with-deps chromium\n      - run: npm run quality:check -- --profile=pr\n`,
    release: `on:
  workflow_dispatch:
    inputs:
      version:
        required: true
      commit:
        required: true
jobs:
  verify:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: \${{ inputs.commit }}
      - run: git ls-remote origin refs/heads/main
      - run: npx playwright install --with-deps chromium
  build:
    env:
      CSC_IDENTITY_AUTO_DISCOVERY: false
    steps:
      - run: gh release download "$PREVIOUS_TAG"
      - run: node scripts/package-smoke.js --previous-artifact "$PREVIOUS_ARTIFACT" --previous-version 0.9.1 --output "\${{ runner.temp }}/smoke.json"
      - run: node scripts/release-evidence.js --output "\${{ runner.temp }}/evidence.json"
      - run: cp SHA256SUMS.txt SHA256SUMS-\${{ runner.os }}.txt
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: release-package-\${{ runner.os }}
  verify-evidence:
    needs: build
    steps:
      - uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7
        with:
          pattern: release-package-*
          path: \${{ runner.temp }}/release-assets/\${{ needs.verify.outputs.version }}
      - run: sha256sum --check "$(basename "$manifest")"
      - run: xvfb-run --auto-servernum npm run quality:check -- --profile=release --releaseDir "\${{ runner.temp }}/release-assets/\${{ needs.verify.outputs.version }}" --version 0.9.2 --tag v0.9.2 --commit "\${{ inputs.commit }}" --report "\${{ runner.temp }}/verified/release-evidence.json"
      - run: node scripts/aggregate-platform-smoke.js --input "\${{ runner.temp }}/evidence" --output "\${{ runner.temp }}/verified/platform-smoke.json" --require-upgrade
      - run: node scripts/prepush-release-report.js --tag v0.9.2 --commit "\${{ inputs.commit }}" --version 0.9.2 --quality quality/evidence/quality-contract.json --release-evidence "\${{ runner.temp }}/verified/release-evidence.json" --platform-smoke "\${{ runner.temp }}/verified/platform-smoke.json" --output "\${{ runner.temp }}/verified/prepush-release-report.json"
      - run: test -f quality/schemas/prepush-release-report.schema.json
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: verified-release-assets
  publish:
    needs: verify-evidence
    environment: release-publication
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: \${{ inputs.commit }}
      - uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7
        with:
          name: verified-release-assets
      - run: |
          git ls-remote origin refs/heads/main
          sha256sum --check SHA256SUMS.txt
          node scripts/changelog-release-notes.js --current 0.9.2 --previous 0.9.1 --output release-notes.md
          cleanup_unpublished_tag() { git push origin ":refs/tags/$TAG"; }
          trap cleanup_unpublished_tag ERR
          git tag -a "$TAG" -m "Release $TAG"
          git push origin "refs/tags/$TAG"
          if [[ "$TAG" == *-* ]]; then
            gh release create "$TAG" --notes-file release-notes.md --draft --prerelease
            gh release edit "$TAG" --draft=false --prerelease --latest=false
          else
            gh release create "$TAG" --notes-file release-notes.md --draft
            gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --draft=false --latest
            git tag -f latest "$COMMIT"
          fi
VITE_POSTHOG_PROJECT_TOKEN: \${{ vars.POSTHOG_PROJECT_TOKEN }}
test -n "$VITE_POSTHOG_PROJECT_TOKEN"
`,
  };
  return { ...workflows, ...overrides };
}

describe('offline workflow structure enforcement', () => {
  it('accepts tag-last protected publication from an exact main commit', () => {
    expect(checker.checkWorkflowStructure(fixture())).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['direct tag trigger', fixture({ release: fixture().release.replace('workflow_dispatch:', "push:\n    tags: ['v*']\n  workflow_dispatch:") })],
    ['missing protected publish environment', fixture({ release: fixture().release.replace('environment: release-publication', '') })],
    ['missing quality contract', fixture({ ci: fixture().ci.replace('npm run quality:check -- --profile=pr', 'npm test') })],
    ['release artifact smoke without virtual display', fixture({ release: fixture().release.replace('xvfb-run --auto-servernum npm run quality:check', 'npm run quality:check') })],
    ['clobber', fixture({ release: `${fixture().release}\n      - run: gh release upload tag asset --clobber\n` })],
    ['missing evidence verifier dependency', fixture({ release: fixture().release.replace('needs: verify-evidence', 'needs: build') })],
    ['broad release artifact pattern', fixture({ release: fixture().release.replace('pattern: release-package-*', 'pattern: release-*') })],
    ['missing exact commit checkout', fixture({ release: fixture().release.replaceAll('ref: ${{ inputs.commit }}', 'ref: main') })],
    ['missing deterministic smoke aggregation', fixture({ release: fixture().release.replace('node scripts/aggregate-platform-smoke.js', 'node inline-aggregate.js') })],
    ['flattened artifact download path', fixture({ release: fixture().release.replaceAll('/release-assets/${{ needs.verify.outputs.version }}', '/release-assets') })],
    ['tag created before protected publish', fixture({ release: fixture().release.replace('  verify:\n', '  verify:\n    env:\n      EARLY: git tag -a "$TAG"\n') })],
    ['generated release notes', fixture({ release: fixture().release.replace('node scripts/changelog-release-notes.js --current 0.9.2 --previous 0.9.1 --output release-notes.md', 'true').replace('--notes-file release-notes.md', '--generate-notes') })],
    ['mutable action tag', fixture({ release: fixture().release.replace(/@[0-9a-f]{40}/, '@v7') })],
    ['untrusted pinned action', fixture({ release: `${fixture().release}\n      - uses: attacker/payload@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n` })],
  ])('rejects %s', (_name, workflows) => {
    expect(checker.checkWorkflowStructure(workflows).valid).toBe(false);
  });

  it('checks repository workflows without a YAML parser or network', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-workflow-check-'));
    roots.push(root);
    const ciPath = path.join(root, 'ci.yml');
    const releasePath = path.join(root, 'release.yml');
    const workflows = fixture();
    fs.writeFileSync(ciPath, workflows.ci);
    fs.writeFileSync(releasePath, workflows.release);
    expect(checker.checkWorkflowStructure({ ci: fs.readFileSync(ciPath, 'utf8'), release: fs.readFileSync(releasePath, 'utf8') })).toEqual({ valid: true, errors: [] });
  });
});
