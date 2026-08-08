/* global console, process, __dirname */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const requiredRootDocs = [
  'README.md',
  'README.ru.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'THIRD_PARTY_NOTICES.md',
  'docs/README.md',
]
const maintainedGitHubDocs = ['.github/PULL_REQUEST_TEMPLATE.md']

function walkMarkdown(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkMarkdown(fullPath))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
  }
  return files
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function localLinkTarget(rawDestination) {
  const destination = rawDestination.trim()
  if (!destination || destination.startsWith('#')) return null

  const withoutTitle = destination.startsWith('<')
    ? destination.slice(1, destination.indexOf('>'))
    : destination.split(/\s+/u)[0]

  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(withoutTitle)) return null

  const withoutFragment = withoutTitle.split('#', 1)[0]
  if (!withoutFragment) return null

  try {
    return decodeURIComponent(withoutFragment)
  } catch {
    return withoutFragment
  }
}

function collectBrokenLinks(files) {
  const broken = []
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8')
    let match
    while ((match = linkPattern.exec(text)) !== null) {
      const target = localLinkTarget(match[1])
      if (!target) continue
      const resolved = target.startsWith('/')
        ? path.join(root, target.slice(1))
        : path.resolve(path.dirname(filePath), target)
      if (!fs.existsSync(resolved)) broken.push(`${relative(filePath)} -> ${target}`)
    }
  }

  return broken
}

function mirroredDocNames(language) {
  const directory = path.join(root, 'docs', language)
  return new Set(
    fs.readdirSync(directory)
      .filter((name) => name.endsWith('.md'))
      .sort()
  )
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort()
}

function main() {
  const failures = []

  for (const relPath of [...requiredRootDocs, ...maintainedGitHubDocs]) {
    if (!fs.existsSync(path.join(root, relPath))) failures.push(`Missing required document: ${relPath}`)
  }

  const maintainedDocs = [
    path.join(root, 'AGENTS.md'),
    ...requiredRootDocs.map((relPath) => path.join(root, relPath)),
    ...maintainedGitHubDocs.map((relPath) => path.join(root, relPath)),
    ...walkMarkdown(path.join(root, 'docs')),
  ]
  const uniqueDocs = [...new Set(maintainedDocs)]
  for (const broken of collectBrokenLinks(uniqueDocs)) failures.push(`Broken local link: ${broken}`)

  const english = mirroredDocNames('en')
  const russian = mirroredDocNames('ru')
  for (const name of difference(english, russian)) failures.push(`Missing Russian mirror: docs/ru/${name}`)
  for (const name of difference(russian, english)) failures.push(`Missing English mirror: docs/en/${name}`)

  const index = fs.readFileSync(path.join(root, 'docs/README.md'), 'utf8')
  for (const name of [...english].sort()) {
    if (!index.includes(`en/${name}`)) failures.push(`Missing from docs index: en/${name}`)
    if (!index.includes(`ru/${name}`)) failures.push(`Missing from docs index: ru/${name}`)
  }

  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  if (!readme.includes('https://github.com/malyarq/burrow/releases/latest')) {
    failures.push('README.md does not link to the latest GitHub release')
  }

  if (failures.length) {
    console.error('[docs] Validation failed')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`[docs] OK (${uniqueDocs.length} maintained Markdown files, ${english.size} mirrored documents)`)
}

main()
