#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const args = process.argv.slice(2);
const version = args[0];
const commitMessage = args.slice(1).join(' ') || `Release v${version}`;

if (!version) {
  console.error('❌ Error: Version is required');
  console.log('Usage: npm run release <version> [commit message]');
  console.log('Example: npm run release 1.2.3 "Added new feature"');
  process.exit(1);
}

const versionRegex = /^\d+\.\d+\.\d+(-.*)?$/;
if (!versionRegex.test(version)) {
  console.error('❌ Error: Invalid version format. Use semver format (e.g., 1.2.3)');
  process.exit(1);
}

console.log(`🚀 Starting release for version ${version}...\n`);

try {
  console.log('📦 Updating version in package.json...');
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  packageJson.version = version;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  console.log(`✅ Version updated to ${version}\n`);

  console.log('📝 Updating version in README.md...');
  const readmePath = join(rootDir, 'README.md');
  let readme = readFileSync(readmePath, 'utf-8');
  
  readme = readme.replace(
    /(!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-)[\d.]+(-[^)]+)?(\))/g,
    `$1${version}-green.svg$3`
  );
  
  writeFileSync(readmePath, readme, 'utf-8');
  console.log('✅ README.md updated\n');

  console.log('🔍 Checking git status...');
  try {
    const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' });
    if (status.trim()) {
      console.log('ℹ️  Uncommitted changes detected (they will be included in the release)\n');
    }
  } catch {
    console.error('❌ Error: Failed to check git status. Make sure you are in a git repository.');
    process.exit(1);
  }

  try {
    const branch = execSync('git branch --show-current', { cwd: rootDir, encoding: 'utf-8' }).trim();
    console.log(`🌿 Current branch: ${branch}\n`);
  } catch {
    // Ignore if branch detection fails
  }

  console.log('➕ Adding files to git...');
  execSync('git add -A', { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Files added\n');

  console.log(`💾 Creating commit: "${commitMessage}"...`);
  execSync(`git commit -m "${commitMessage}"`, { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Commit created\n');

  const tagName = `v${version}`;
  try {
    execSync(`git rev-parse -q --verify "refs/tags/${tagName}"`, { cwd: rootDir, stdio: 'pipe' });
    console.error(`❌ Error: Tag ${tagName} already exists!`);
    console.log('   If you want to recreate the tag, delete it first:');
    console.log(`   git tag -d ${tagName}`);
    console.log(`   git push origin :refs/tags/${tagName}`);
    process.exit(1);
  } catch {
    // Tag doesn't exist, continue
  }

  console.log(`🏷️  Creating tag ${tagName}...`);
  execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { cwd: rootDir, stdio: 'inherit' });
  console.log(`✅ Tag ${tagName} created\n`);

  console.log('📤 Pushing changes to remote repository...');
  execSync('git push', { cwd: rootDir, stdio: 'inherit' });
  execSync(`git push origin ${tagName}`, { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Changes pushed\n');

  console.log('🎉 Release created successfully!');
  console.log(`\n📋 Next steps:`);
  console.log(`   - GitHub Actions will automatically start the build`);
  console.log(`   - After successful build, the release will be published`);
  console.log(`   - Track progress: https://github.com/malyarq/fmcl/actions\n`);

} catch (error) {
  console.error('\n❌ Error creating release:', error.message);
  process.exit(1);
}
