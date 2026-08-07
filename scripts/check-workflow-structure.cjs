/* global console, process */
const fs = require('node:fs')

function checkWorkflowStructure({ ci, release }) {
  const errors = []
  const allowedActions = new Set([
    'actions/checkout',
    'actions/setup-node',
    'actions/upload-artifact',
    'actions/download-artifact',
  ])
  for (const workflow of [ci, release]) {
    for (const match of workflow.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/g)) {
      if (!allowedActions.has(match[1])) errors.push(`workflow action ${match[1]} is not in the trusted action allowlist`)
      if (!/^[0-9a-f]{40}$/.test(match[2])) errors.push(`workflow action ${match[1]} must be pinned to an immutable commit SHA`)
    }
  }
  if (!/pull_request\s*:/m.test(ci)) errors.push('CI must run for pull requests')
  if (!/npm run quality:check -- --profile=pr/.test(ci)) errors.push('CI must invoke the shared PR quality contract')
  if (/^\s*push\s*:/m.test(release) || /tags\s*:/m.test(release)) errors.push('release workflow must not have a push/tag trigger')
  if (!/workflow_dispatch\s*:/m.test(release) || !/inputs:\s*[\s\S]*?version\s*:[\s\S]*?commit\s*:/m.test(release)) errors.push('release workflow must be dispatch-only with version and exact commit inputs')
  if (!/ref:\s*\$\{\{\s*inputs\.commit\s*\}\}/.test(release)) errors.push('release workflow must checkout the requested exact commit before build')
  if (!/git ls-remote origin refs\/heads\/main/.test(release)) errors.push('release workflow must prove the candidate is still the exact origin/main commit')
  if (!/npm run quality:check -- --profile=release/.test(release)) errors.push('release builds must invoke the shared release quality contract')
  if (!/xvfb-run --auto-servernum (?:npm run quality:check -- --profile=release|node scripts\/package-smoke\.js)/.test(release)) errors.push('Linux release artifact verification must provide a virtual display')
  if (!/playwright install(?: --with-deps)? chromium/.test(ci) || !/playwright install(?: --with-deps)? chromium/.test(release)) errors.push('measured quality jobs must install Chromium explicitly')
  if (!/scripts\/prepush-release-report\.js/.test(release) || !/quality\/schemas\/prepush-release-report\.schema\.json/.test(release)) errors.push('release workflow must execute the available pre-push report generator and schema')
  if (!/verify-evidence:/.test(release) || !/needs:\s*(?:\[[^\]]*\bverify-evidence\b[^\]]*\]|verify-evidence)/.test(release) || !/actions\/download-artifact@/.test(release) || !/sha256sum --check SHA256SUMS\.txt/.test(release) || !/(?:scripts\/release-evidence\.js|npm run release:evidence)/.test(release)) errors.push('publish must depend on downloaded checksum and release-evidence verification')
  if (!/environment:\s*release-publication/.test(release)) errors.push('only protected release-publication environment may authorize publish')
  if (/--clobber\b/.test(release)) errors.push('release workflow must not overwrite existing assets')
  if (/--generate-notes\b/.test(release) || !/scripts\/changelog-release-notes\.js/.test(release) || !/--notes-file\s+release-notes\.md/.test(release)) errors.push('release notes must come from the committed changelog and published-release boundary')
  if (!/if \[\[ "\$TAG" == \*-\* \]\]/.test(release)) errors.push('release workflow must derive prerelease/latest behavior from the SemVer tag')
  if (!/--prerelease/.test(release) || !/--latest=false/.test(release)) errors.push('release workflow must publish prereleases as non-latest')
  if (!/else\s+[\s\S]*?gh release edit[^\n]*--draft=false[^\n]*--latest(?:\s|$)/.test(release)) errors.push('release workflow must publish stable tags as latest')
  if (!/CSC_IDENTITY_AUTO_DISCOVERY:\s*false/.test(release)) errors.push('release builds must explicitly preserve unsigned credential behavior')
  if (!/VITE_POSTHOG_PROJECT_TOKEN:\s*\$\{\{\s*vars\.POSTHOG_PROJECT_TOKEN\s*\}\}/.test(release) || !/test -n "\$VITE_POSTHOG_PROJECT_TOKEN"/.test(release)) errors.push('release builds must require the configured privacy-reviewed analytics project token')
  if (/npm run (?:smoke:package|release:evidence)[^\n]*>/.test(release)) errors.push('workflow must not redirect npm banners into JSON evidence')
  if (!/scripts\/package-smoke\.js[^\n]*--output/.test(release) || !/scripts\/release-evidence\.js[^\n]*--output/.test(release)) errors.push('workflow must persist smoke and release evidence through explicit output files')
  if (!/gh release download[^\n]*PREVIOUS_TAG/.test(release) || !/scripts\/package-smoke\.js[^\n]*--previous-artifact[^\n]*--previous-version/.test(release)) errors.push('native release smoke must prove upgrade from the previous published package')
  if (!/\$\{\{\s*runner\.temp\s*\}\}/.test(release)) errors.push('downloaded and generated evidence must stay outside the checkout')
  if (/pattern:\s*release-\*\s*$/m.test(release)) errors.push('broad release artifact patterns can mix packages with evidence')
  if (!/pattern:\s*release-package-\*/.test(release) || !/name:\s*verified-release-assets/.test(release)) errors.push('publish must consume only the verified release-assets handoff')
  if (!/runner\.temp\s*\}\}\/release-assets\/\$\{\{\s*needs\.verify\.outputs\.version\s*\}\}/.test(release)) errors.push('downloaded packages must retain the version-scoped directory expected by smoke')
  if (!/SHA256SUMS-\$\{\{\s*runner\.os\s*\}\}\.txt/.test(release) || !/sha256sum --check[^\n]*\$?\(?['"]?\$?\(?basename/.test(release)) errors.push('clean verification must check preserved per-platform build manifests')
  if (!/scripts\/aggregate-platform-smoke\.js[^\n]*--require-upgrade/.test(release)) errors.push('release platform smoke aggregation must require verified package upgrades')
  const publish = release.match(/^ {2}publish:\s*$[\s\S]*/m)?.[0] ?? ''
  const beforePublish = publish ? release.slice(0, release.indexOf(publish)) : release
  if (/git tag\s+-[a-zA-Z]*a/.test(beforePublish)) errors.push('release tag must not be created before protected publication')
  if (!/git tag\s+-a\s+"?\$TAG/.test(publish) || !/git push origin\s+"?refs\/tags\/\$TAG/.test(publish)) errors.push('protected publish must create and push the annotated immutable tag after evidence')
  if (!/trap cleanup_unpublished_tag ERR/.test(publish) || !/git push origin\s+"?:refs\/tags\/\$TAG/.test(publish)) errors.push('failed unpublished releases must clean up their newly-created candidate tag')
  if (!/gh release create[^\n]*--draft/.test(publish) || !/gh release edit[^\n]*--draft=false/.test(publish)) errors.push('release assets must be staged as a draft before atomic publication')
  const stablePublishIndex = publish.indexOf('gh release edit "$TAG" --repo "$GITHUB_REPOSITORY" --draft=false --latest')
  const latestTagIndex = publish.indexOf('git tag -f latest')
  if (stablePublishIndex === -1 || latestTagIndex === -1 || latestTagIndex < stablePublishIndex) errors.push('mutable latest tag must move only after successful stable release publication')
  const checkoutIndex = publish.indexOf('actions/checkout@')
  const remoteIndex = publish.indexOf('git ls-remote')
  if (checkoutIndex === -1 || remoteIndex === -1 || checkoutIndex > remoteIndex) errors.push('publish must checkout the exact commit before verifying origin')
  return { valid: errors.length === 0, errors }
}

function main() {
  const [ciPath, releasePath] = process.argv.slice(2)
  if (!ciPath || !releasePath) throw new Error('Usage: node scripts/check-workflow-structure.cjs <ci.yml> <release.yml>')
  const result = checkWorkflowStructure({ ci: fs.readFileSync(ciPath, 'utf8'), release: fs.readFileSync(releasePath, 'utf8') })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.valid ? 0 : 1
}

if (require.main === module) {
  try { main() } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
}

module.exports = { checkWorkflowStructure }
