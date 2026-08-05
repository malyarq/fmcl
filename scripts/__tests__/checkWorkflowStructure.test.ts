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
  return {
    ci: `on:\n  pull_request:\njobs:\n  checks:\n    steps:\n      - run: npx playwright install --with-deps chromium\n      - run: npm run quality:check -- --profile=pr\n`,
    release: `on:\n  workflow_dispatch:\n    inputs:\n      tag:\n        required: true\njobs:\n  verify:\n    steps:\n      - run: git checkout "refs/tags/${'${{ inputs.tag }}'}"\n      - run: test "$(git cat-file -t "refs/tags/${'${{ inputs.tag }}'}")" = tag\n      - run: npx playwright install --with-deps chromium\n  build:\n    env:\n      CSC_IDENTITY_AUTO_DISCOVERY: false\n    steps:\n      - run: node scripts/package-smoke.js --output "${'${{ runner.temp }}'}/smoke.json"\n      - run: node scripts/release-evidence.js --output "${'${{ runner.temp }}'}/evidence.json"\n      - run: cp SHA256SUMS.txt SHA256SUMS-${'${{ runner.os }}'}.txt\n      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7\n        with:\n          name: release-package-${'${{ runner.os }}'}\n  verify-evidence:\n    needs: build\n    steps:\n      - uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7\n        with:\n          pattern: release-package-*\n          path: ${'${{ runner.temp }}'}/release-assets/${'${{ needs.verify.outputs.version }}'}\n      - run: sha256sum --check "$(basename "$manifest")"\n      - run: npm run quality:check -- --profile=release --releaseDir "${'${{ runner.temp }}'}/release-assets/${'${{ needs.verify.outputs.version }}'}" --version 0.8.0-rc.1 --tag "${'${{ inputs.tag }}'}" --commit "${'${{ github.sha }}'}" --report "${'${{ runner.temp }}'}/verified/release-evidence.json"\n      - run: node scripts/aggregate-platform-smoke.js --input "${'${{ runner.temp }}'}/evidence" --output "${'${{ runner.temp }}'}/verified/platform-smoke.json"\n      - run: node scripts/prepush-release-report.js --tag "${'${{ inputs.tag }}'}" --commit "${'${{ github.sha }}'}" --version 0.8.0-rc.1 --quality quality/evidence/quality-contract.json --release-evidence "${'${{ runner.temp }}'}/verified/release-evidence.json" --platform-smoke "${'${{ runner.temp }}'}/verified/platform-smoke.json" --output "${'${{ runner.temp }}'}/verified/prepush-release-report.json"\n      - run: test -f quality/schemas/prepush-release-report.schema.json\n      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7\n        with:\n          name: verified-release-assets\n  publish:\n    needs: verify-evidence\n    environment: release-publication\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\n      - uses: actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7\n        with:\n          name: verified-release-assets\n      - run: git ls-remote origin && sha256sum --check SHA256SUMS.txt && gh release create "${'${{ inputs.tag }}'}" --prerelease --latest=false\n`,
    ...overrides,
  };
}

describe('offline workflow structure enforcement', () => {
  it('accepts a dispatch-only protected release flow with shared contract, evidence, and non-overwriting prerelease publication', () => {
    expect(checker.checkWorkflowStructure(fixture())).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['direct tag trigger', fixture({ release: fixture().release.replace('workflow_dispatch:', "push:\n    tags: ['v*']\n  workflow_dispatch:") })],
    ['missing protected publish environment', fixture({ release: fixture().release.replace('environment: release-publication', '') })],
    ['missing quality contract', fixture({ ci: fixture().ci.replace('npm run quality:check -- --profile=pr', 'npm test') })],
    ['clobber and latest bypass', fixture({ release: `${fixture().release}\n      - run: gh release upload tag asset --clobber\n      - run: gh release edit tag --latest\n` })],
    ['missing evidence verifier dependency', fixture({ release: fixture().release.replace('needs: verify-evidence', 'needs: build') })],
    ['npm banner redirected into evidence JSON', fixture({ release: `${fixture().release}\n      - run: npm run smoke:package -- --fixture-unsupported-platform > smoke.json\n` })],
    ['broad package and evidence artifact pattern', fixture({ release: fixture().release.replace('pattern: release-package-*', 'pattern: release-*') })],
    ['missing publish checkout', fixture({ release: fixture().release.replace('      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\n', '') })],
    ['missing deterministic smoke aggregation', fixture({ release: fixture().release.replace('node scripts/aggregate-platform-smoke.js', 'node inline-aggregate.js') })],
    ['flattened artifact download path', fixture({ release: fixture().release.replaceAll(`/release-assets/${'${{ needs.verify.outputs.version }}'}`, '/release-assets') })],
    ['lightweight tag accepted', fixture({ release: fixture().release.replace(/^\s*- run: test .*git cat-file.*\n/m, '') })],
    ['mutable action tag', fixture({ release: fixture().release.replace(/@[0-9a-f]{40}/, '@v7') })],
    ['untrusted pinned action', fixture({ release: `${fixture().release}\n      - uses: attacker/payload@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n` })],
  ])('rejects %s', (_name, workflows) => {
    expect(checker.checkWorkflowStructure(workflows).valid).toBe(false);
  });

  it('checks the repository workflows without YAML parser or network dependency', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-workflow-check-'));
    roots.push(root);
    const ciPath = path.join(root, 'ci.yml');
    const releasePath = path.join(root, 'release.yml');
    fs.writeFileSync(ciPath, fixture().ci);
    fs.writeFileSync(releasePath, fixture().release);
    expect(checker.checkWorkflowStructure({ ci: fs.readFileSync(ciPath, 'utf8'), release: fs.readFileSync(releasePath, 'utf8') })).toEqual({ valid: true, errors: [] });
  });
});
