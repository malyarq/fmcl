import path from 'node:path'
import type { ExportOptions } from '../../services/instances/exporter/InstanceExporterService'
import type { ModpackConfig, ModLoaderType, NetworkMode } from '../../services/instances/types'
import type { ModpackManifest, ModpackMetadata } from '../../../shared/types/modpack'
import type {
  InstanceConfigDto,
  InstanceConfigRequest,
  InstanceCreateRequest,
  InstanceMetadataRequest,
  InstancePrepareRequest,
  InstanceRenameRequest,
  InstanceSelectRequest,
  InstanceSnapshotRequest,
  InstanceSourceDto,
} from '../../../shared/contracts/instances'
import { assertTrustedEndpointUrl } from '../../security/trustedEndpoints'

type PlainObject = Record<string, unknown>
type ModpackFile = ModpackManifest['files'][number]

const URL_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i
const SHARE_CODE_PREFIX = 'burrow://share/v1/'
const SHARE_CODE_SCHEMES = ['burrow://share/'] as const
const MAX_PATH_LENGTH = 4096
const MAX_URL_LENGTH = 2048
const MAX_SHARE_CODE_LENGTH = 32_768
const MAX_SHARE_CODE_BYTES = 128 * 1024
const MAX_DESCRIPTION_LENGTH = 4_096
const MAX_ARGUMENT_COUNT = 64
const MAX_DOWNLOAD_COUNT = 32
const MAX_OVERRIDE_ENTRY_COUNT = 512
const MAX_OVERRIDE_BASE64_LENGTH = 8 * 1024 * 1024

const MOD_LOADER_TYPES = ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'] as const
const NETWORK_MODES = ['hyperswarm', 'xmcl_lan', 'xmcl_upnp_host'] as const
const MODPACK_SOURCES = ['local', 'curseforge', 'modrinth'] as const
const EXPORT_FORMATS = ['curseforge', 'modrinth', 'zip', 'multimc'] as const
const MODRINTH_ENV_VALUES = ['required', 'optional', 'unsupported'] as const
const OPEN_DIALOG_PROPERTIES = ['openFile', 'openDirectory', 'multiSelections'] as const
const INSTANCE_LOADERS = ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'] as const

export class PrivilegedPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PrivilegedPayloadError'
  }
}

function fail(message: string): never {
  throw new PrivilegedPayloadError(message)
}

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function requirePlainObject(value: unknown, label: string): PlainObject {
  if (!isPlainObject(value)) {
    fail(`${label} must be an object.`)
  }

  return value
}

function assertAllowedKeys(record: PlainObject, allowedKeys: readonly string[], label: string): void {
  const extras = Object.keys(record).filter((key) => !allowedKeys.includes(key))
  if (extras.length > 0) {
    fail(`${label} contains unsupported field${extras.length > 1 ? 's' : ''}: ${extras.join(', ')}.`)
  }
}

function containsControlCharacters(value: string): boolean {
  return Array.from(value).some((char) => {
    const codePoint = char.charCodeAt(0)
    return (codePoint >= 0 && codePoint <= 0x1f) || codePoint === 0x7f
  })
}

type StringOptions = {
  trim?: boolean
  allowEmpty?: boolean
  minLength?: number
  maxLength?: number
  allowControlChars?: boolean
}

export function validateBoundedString(
  value: unknown,
  label: string,
  options: StringOptions = {},
): string {
  if (typeof value !== 'string') {
    fail(`${label} must be a string.`)
  }

  const trimmed = options.trim !== false ? value.trim() : value
  const candidate = trimmed

  if (!options.allowEmpty && candidate.length === 0) {
    fail(`${label} is required.`)
  }

  if (options.minLength !== undefined && candidate.length < options.minLength) {
    fail(`${label} must be at least ${options.minLength} characters long.`)
  }

  if (options.maxLength !== undefined && candidate.length > options.maxLength) {
    fail(`${label} must be ${options.maxLength} characters or fewer.`)
  }

  if (!options.allowControlChars && containsControlCharacters(candidate)) {
    fail(`${label} contains unsupported control characters.`)
  }

  return candidate
}

export function validateOptionalBoundedString(
  value: unknown,
  label: string,
  options: StringOptions = {},
): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string' && options.allowEmpty !== false && value.length === 0) {
    return undefined
  }

  return validateBoundedString(value, label, { ...options, allowEmpty: false })
}

export function validateBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    fail(`${label} must be true or false.`)
  }

  return value
}

function validateOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateBoolean(value, label)
}

export function validateInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
    fail(`${label} must be an integer.`)
  }

  if (options.min !== undefined && value < options.min) {
    fail(`${label} must be at least ${options.min}.`)
  }

  if (options.max !== undefined && value > options.max) {
    fail(`${label} must be ${options.max} or less.`)
  }

  return value
}

function validateOptionalInteger(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateInteger(value, label, options)
}

function validateIntegerFromUnknown(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
): number {
  if (typeof value === 'string' && value.trim() !== '' && /^\d+$/.test(value.trim())) {
    return validateInteger(Number(value.trim()), label, options)
  }

  return validateInteger(value, label, options)
}

export function validateEnum<T extends readonly string[]>(
  value: unknown,
  label: string,
  allowedValues: T,
): T[number] {
  const candidate = validateBoundedString(value, label, { maxLength: 128 })
  if (!allowedValues.includes(candidate)) {
    fail(`${label} must be one of: ${allowedValues.join(', ')}.`)
  }

  return candidate as T[number]
}

function validateStringArray(
  value: unknown,
  label: string,
  options: { maxItems: number; maxItemLength: number; allowEmpty?: boolean } = {
    maxItems: MAX_ARGUMENT_COUNT,
    maxItemLength: 256,
  },
): string[] {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`)
  }

  if (value.length > options.maxItems) {
    fail(`${label} must contain ${options.maxItems} items or fewer.`)
  }

  return value.map((entry, index) => validateBoundedString(entry, `${label}[${index}]`, {
    allowEmpty: options.allowEmpty,
    maxLength: options.maxItemLength,
  }))
}

function validateOptionalStringArray(
  value: unknown,
  label: string,
  options: { maxItems: number; maxItemLength: number; allowEmpty?: boolean } = {
    maxItems: MAX_ARGUMENT_COUNT,
    maxItemLength: 256,
  },
): string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateStringArray(value, label, options)
}

function isAbsoluteFilesystemPath(candidate: string): boolean {
  return path.isAbsolute(candidate) || path.posix.isAbsolute(candidate) || path.win32.isAbsolute(candidate)
}

function looksLikeUrl(candidate: string): boolean {
  return URL_SCHEME_PATTERN.test(candidate) && !isAbsoluteFilesystemPath(candidate)
}

function findMatchingPrefix(value: string, prefixes: readonly string[]): string | undefined {
  return prefixes.find((prefix) => value.startsWith(prefix))
}

type FilesystemPathOptions = {
  allowUndefined?: boolean
  allowRelative?: boolean
  maxLength?: number
}

export function validateFilesystemPath(
  value: unknown,
  label: string,
  options: FilesystemPathOptions = {},
): string | undefined {
  if (value === undefined || value === null) {
    if (options.allowUndefined) {
      return undefined
    }

    fail(`${label} is required.`)
  }

  const candidate = validateBoundedString(value, label, {
    maxLength: options.maxLength ?? MAX_PATH_LENGTH,
  })

  if (looksLikeUrl(candidate)) {
    fail(`${label} must be a local file system path.`)
  }

  if (!options.allowRelative && !isAbsoluteFilesystemPath(candidate)) {
    fail(`${label} must be an absolute path.`)
  }

  return candidate
}

export function validateOptionalRootPath(value: unknown, label = 'Minecraft root path'): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined
  }

  return validateFilesystemPath(value, label, {
    allowUndefined: true,
    allowRelative: false,
    maxLength: MAX_PATH_LENGTH,
  })
}

export function validateRelativeChildPath(value: unknown, label: string): string {
  const candidate = validateBoundedString(value, label, {
    maxLength: MAX_PATH_LENGTH,
  })

  if (looksLikeUrl(candidate) || isAbsoluteFilesystemPath(candidate)) {
    fail(`${label} must stay inside the selected modpack.`)
  }

  const normalized = path.posix.normalize(candidate.replace(/\\/g, '/'))
  if (normalized === '.' || normalized === '') {
    fail(`${label} is required.`)
  }

  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')) {
    fail(`${label} must stay inside the selected modpack.`)
  }

  return normalized
}

export function validateEndpointUrl(value: unknown, label: string): string {
  const candidate = validateBoundedString(value, label, {
    maxLength: MAX_URL_LENGTH,
  })

  try {
    return assertTrustedEndpointUrl(candidate, label)
  } catch (error) {
    fail(error instanceof Error ? error.message : `${label} must be a valid URL.`)
  }
}

export function validateShareCode(value: unknown): string {
  const rawCode = validateBoundedString(value, 'Share code', {
    maxLength: MAX_SHARE_CODE_LENGTH,
  })
  const matchedScheme = findMatchingPrefix(rawCode, SHARE_CODE_SCHEMES)
  const matchedPrefix = rawCode.startsWith(SHARE_CODE_PREFIX) ? SHARE_CODE_PREFIX : undefined

  if (matchedScheme && !matchedPrefix) {
    fail('Share code version is not supported.')
  }

  const payload = matchedPrefix ? rawCode.slice(matchedPrefix.length) : rawCode
  if (payload.length === 0) {
    fail('Share code payload is empty.')
  }

  if (!/^[A-Za-z0-9+/=_-]+$/.test(payload)) {
    fail('Share code payload is malformed.')
  }

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalizedPayload.length % 4)) % 4)
  const paddedPayload = `${normalizedPayload}${padding}`
  const decoded = Buffer.from(paddedPayload, 'base64')

  if (decoded.length === 0) {
    fail('Share code payload is malformed.')
  }

  if (decoded.length > MAX_SHARE_CODE_BYTES) {
    fail('Share code is too large to import.')
  }

  if (decoded.length < 2 || decoded[0] !== 0x1f || decoded[1] !== 0x8b) {
    fail('Share code is malformed or unsupported.')
  }

  return matchedPrefix ? `${SHARE_CODE_PREFIX}${paddedPayload}` : paddedPayload
}

export function validateOfflineNickname(value: unknown): string {
  const nickname = validateBoundedString(value, 'Offline nickname', {
    minLength: 3,
    maxLength: 16,
  })

  if (!/^[A-Za-z0-9_]+$/.test(nickname)) {
    fail('Offline nickname may contain only letters, numbers, and underscores.')
  }

  return nickname
}

export function validateThirdPartyUsername(value: unknown): string {
  return validateBoundedString(value, 'Third-party account username', {
    maxLength: 320,
  })
}

export function validateOptionalSecret(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string' && value.length === 0) {
    return undefined
  }

  return validateBoundedString(value, label, {
    trim: false,
    maxLength: 1024,
  })
}

export function validateIdentifier(value: unknown, label: string): string {
  return validateBoundedString(value, label, {
    maxLength: 128,
  })
}

function assertNotPathShaped(value: string, label: string): string {
  if (
    value.includes('/')
    || value.includes('\\')
    || value.startsWith('~')
    || value === '.'
    || value === '..'
    || /^[a-z]:/i.test(value)
    || /^file:/i.test(value)
  ) {
    fail(`${label} must not contain a filesystem location.`)
  }

  return value
}

function validateInstanceText(value: unknown, label: string, maxLength: number): string {
  return assertNotPathShaped(validateBoundedString(value, label, { maxLength }), label)
}

function validateOptionalInstanceText(value: unknown, label: string, maxLength: number): string | undefined {
  const candidate = validateOptionalBoundedString(value, label, { maxLength })
  return candidate === undefined ? undefined : assertNotPathShaped(candidate, label)
}

function validateInstanceIdentifier(value: unknown, label: string): string {
  return validateInstanceText(value, label, 128)
}

function validateInstanceRuntime(value: unknown, label: string): InstanceConfigDto['runtime'] {
  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['minecraftVersion', 'modLoader'], label)
  const modLoader = record.modLoader === undefined
    ? undefined
    : (() => {
      const loader = requirePlainObject(record.modLoader, `${label}.modLoader`)
      assertAllowedKeys(loader, ['type', 'version'], `${label}.modLoader`)
      return {
        type: validateEnum(loader.type, `${label}.modLoader.type`, INSTANCE_LOADERS),
        version: validateOptionalInstanceText(loader.version, `${label}.modLoader.version`, 64),
      }
    })()

  return {
    minecraftVersion: validateInstanceText(record.minecraftVersion, `${label}.minecraftVersion`, 64),
    modLoader,
  }
}

export function validateInstanceConfig(value: unknown, label = 'Instance config'): InstanceConfigDto {
  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['runtime', 'memory', 'vmOptions', 'game', 'server', 'networkMode'], label)

  const memory = record.memory === undefined
    ? undefined
    : (() => {
      const entry = requirePlainObject(record.memory, `${label}.memory`)
      assertAllowedKeys(entry, ['maxMb', 'minMb'], `${label}.memory`)
      const maxMb = validateInteger(entry.maxMb, `${label}.memory.maxMb`, { min: 256, max: 262_144 })
      return { maxMb, minMb: validateOptionalInteger(entry.minMb, `${label}.memory.minMb`, { min: 128, max: maxMb }) }
    })()
  const game = record.game === undefined
    ? undefined
    : (() => {
      const entry = requirePlainObject(record.game, `${label}.game`)
      assertAllowedKeys(entry, ['resolution', 'extraArgs', 'useOptiFine'], `${label}.game`)
      const resolution = entry.resolution === undefined
        ? undefined
        : (() => {
          const values = requirePlainObject(entry.resolution, `${label}.game.resolution`)
          assertAllowedKeys(values, ['width', 'height', 'fullscreen'], `${label}.game.resolution`)
          return {
            width: validateOptionalInteger(values.width, `${label}.game.resolution.width`, { min: 1, max: 16_384 }),
            height: validateOptionalInteger(values.height, `${label}.game.resolution.height`, { min: 1, max: 16_384 }),
            fullscreen: validateOptionalBoolean(values.fullscreen, `${label}.game.resolution.fullscreen`),
          }
        })()
      const extraArgs = entry.extraArgs === undefined
        ? undefined
        : validateStringArray(entry.extraArgs, `${label}.game.extraArgs`, { maxItems: MAX_ARGUMENT_COUNT, maxItemLength: 256 })
          .map((argument, index) => assertNotPathShaped(argument, `${label}.game.extraArgs[${index}]`))
      return {
        resolution,
        extraArgs,
        useOptiFine: validateOptionalBoolean(entry.useOptiFine, `${label}.game.useOptiFine`),
      }
    })()
  const server = record.server === undefined
    ? undefined
    : (() => {
      const entry = requirePlainObject(record.server, `${label}.server`)
      assertAllowedKeys(entry, ['host', 'port'], `${label}.server`)
      return {
        host: validateInstanceText(entry.host, `${label}.server.host`, 255),
        port: validateInteger(entry.port, `${label}.server.port`, { min: 1, max: 65_535 }),
      }
    })()
  const vmOptions = record.vmOptions === undefined
    ? undefined
    : validateStringArray(record.vmOptions, `${label}.vmOptions`, { maxItems: MAX_ARGUMENT_COUNT, maxItemLength: 256 })
      .map((option, index) => assertNotPathShaped(option, `${label}.vmOptions[${index}]`))

  return {
    runtime: validateInstanceRuntime(record.runtime, `${label}.runtime`),
    memory,
    vmOptions,
    game,
    server,
    networkMode: record.networkMode === undefined ? undefined : validateEnum(record.networkMode, `${label}.networkMode`, NETWORK_MODES),
  }
}

function validateInstanceSource(value: unknown, label: string): InstanceSourceDto {
  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['source', 'sourceId', 'sourceVersionId', 'version', 'iconUrl', 'description', 'author'], label)
  const iconUrl = validateOptionalBoundedString(record.iconUrl, `${label}.iconUrl`, { maxLength: MAX_URL_LENGTH })
  if (iconUrl !== undefined && (!/^https?:\/\//i.test(iconUrl) || /^(?:file|data):/i.test(iconUrl))) {
    fail(`${label}.iconUrl must be an HTTP URL.`)
  }

  return {
    source: validateEnum(record.source, `${label}.source`, MODPACK_SOURCES),
    sourceId: record.sourceId === undefined ? undefined : validateInstanceIdentifier(record.sourceId, `${label}.sourceId`),
    sourceVersionId: record.sourceVersionId === undefined ? undefined : validateInstanceIdentifier(record.sourceVersionId, `${label}.sourceVersionId`),
    version: validateOptionalInstanceText(record.version, `${label}.version`, 64),
    iconUrl,
    description: validateOptionalInstanceText(record.description, `${label}.description`, MAX_DESCRIPTION_LENGTH),
    author: validateOptionalInstanceText(record.author, `${label}.author`, 120),
  }
}

export function validateInstanceListRequest(value: unknown): Record<never, never> {
  const record = requirePlainObject(value, 'Instance list request')
  assertAllowedKeys(record, [], 'Instance list request')
  return {}
}

export function validateInstanceSnapshotRequest(value: unknown): InstanceSnapshotRequest {
  const record = requirePlainObject(value, 'Instance snapshot request')
  assertAllowedKeys(record, ['id'], 'Instance snapshot request')
  return { id: validateInstanceIdentifier(record.id, 'Instance snapshot request.id') }
}

export function validateInstanceSelectRequest(value: unknown): InstanceSelectRequest {
  const record = requirePlainObject(value, 'Instance select request')
  assertAllowedKeys(record, ['id'], 'Instance select request')
  return { id: validateInstanceIdentifier(record.id, 'Instance select request.id') }
}

export function validateInstanceCreateRequest(value: unknown): InstanceCreateRequest {
  const record = requirePlainObject(value, 'Instance create request')
  assertAllowedKeys(record, ['name', 'source', 'config'], 'Instance create request')
  return {
    name: validateInstanceText(record.name, 'Instance create request.name', 120),
    source: validateInstanceSource(record.source, 'Instance create request.source'),
    config: validateInstanceConfig(record.config, 'Instance create request.config'),
  }
}

export function validateInstanceRenameRequest(value: unknown): InstanceRenameRequest {
  const record = requirePlainObject(value, 'Instance rename request')
  assertAllowedKeys(record, ['id', 'name'], 'Instance rename request')
  return {
    id: validateInstanceIdentifier(record.id, 'Instance rename request.id'),
    name: validateInstanceText(record.name, 'Instance rename request.name', 120),
  }
}

export function validateInstanceConfigRequest(value: unknown): InstanceConfigRequest {
  const record = requirePlainObject(value, 'Instance config request')
  assertAllowedKeys(record, ['action', 'id', 'config'], 'Instance config request')
  const action = validateEnum(record.action, 'Instance config request.action', ['get', 'save'] as const)
  const id = validateInstanceIdentifier(record.id, 'Instance config request.id')
  if (action === 'get') {
    if (record.config !== undefined) fail('Instance config request.config is not allowed for reads.')
    return { action, id }
  }
  return { action, id, config: validateInstanceConfig(record.config, 'Instance config request.config') }
}

export function validateInstanceMetadataRequest(value: unknown): InstanceMetadataRequest {
  const record = requirePlainObject(value, 'Instance metadata request')
  assertAllowedKeys(record, ['action', 'id', 'metadata'], 'Instance metadata request')
  const id = validateInstanceIdentifier(record.id, 'Instance metadata request.id')
  if (record.action === undefined) {
    if (record.metadata !== undefined) fail('Instance metadata request.metadata is not allowed for reads.')
    return { id }
  }
  const action = validateEnum(record.action, 'Instance metadata request.action', ['save'] as const)
  const metadata = requirePlainObject(record.metadata, 'Instance metadata request.metadata')
  assertAllowedKeys(metadata, ['description'], 'Instance metadata request.metadata')
  if (!Object.hasOwn(metadata, 'description')) fail('Instance metadata request.metadata.description is required.')
  const description = metadata.description
  if (description !== null && (typeof description !== 'string' || description.length > 4_000)) {
    fail('Instance metadata request.metadata.description must be a string up to 4000 characters or null.')
  }
  return { action, id, metadata: { description } }
}

export function validateInstancePrepareRequest(value: unknown): InstancePrepareRequest {
  const record = requirePlainObject(value, 'Instance prepare request')
  assertAllowedKeys(record, [], 'Instance prepare request')
  return {}
}

function validateModLoader(value: unknown, label: string): { type: ModLoaderType; version?: string } {
  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['type', 'version'], label)

  return {
    type: validateEnum(record.type, `${label}.type`, MOD_LOADER_TYPES),
    version: validateOptionalBoundedString(record.version, `${label}.version`, {
      maxLength: 64,
    }),
  }
}

export function validateOptionalModLoaderConfig(
  value: unknown,
  label: string,
): { type: ModLoaderType; version?: string } | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateModLoader(value, label)
}

function validateRuntime(value: unknown, label: string): ModpackConfig['runtime'] {
  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['minecraft', 'modLoader'], label)

  return {
    minecraft: validateBoundedString(record.minecraft, `${label}.minecraft`, {
      maxLength: 64,
    }),
    modLoader: record.modLoader === undefined ? undefined : validateModLoader(record.modLoader, `${label}.modLoader`),
  }
}

function validateOptionalJava(value: unknown, label: string): ModpackConfig['java'] | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['path'], label)

  const javaPath = validateFilesystemPath(record.path, `${label}.path`, {
    allowUndefined: true,
    allowRelative: false,
  })

  return javaPath ? { path: javaPath } : {}
}

function validateOptionalMemory(value: unknown, label: string): ModpackConfig['memory'] | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['maxMb', 'minMb'], label)

  const maxMb = validateInteger(record.maxMb, `${label}.maxMb`, { min: 256, max: 262_144 })
  const minMb = validateOptionalInteger(record.minMb, `${label}.minMb`, { min: 128, max: maxMb })

  return {
    maxMb,
    minMb,
  }
}

function validateOptionalGame(value: unknown, label: string): ModpackConfig['game'] | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['resolution', 'extraArgs'], label)

  const resolution = record.resolution === undefined
    ? undefined
    : (() => {
      const resolutionRecord = requirePlainObject(record.resolution, `${label}.resolution`)
      assertAllowedKeys(resolutionRecord, ['width', 'height', 'fullscreen'], `${label}.resolution`)

      return {
        width: validateOptionalInteger(resolutionRecord.width, `${label}.resolution.width`, { min: 1, max: 16_384 }),
        height: validateOptionalInteger(resolutionRecord.height, `${label}.resolution.height`, { min: 1, max: 16_384 }),
        fullscreen: validateOptionalBoolean(resolutionRecord.fullscreen, `${label}.resolution.fullscreen`),
      }
    })()

  return {
    resolution,
    extraArgs: validateOptionalStringArray(record.extraArgs, `${label}.extraArgs`, {
      maxItems: MAX_ARGUMENT_COUNT,
      maxItemLength: 256,
      allowEmpty: false,
    }),
  }
}

function validateOptionalServer(value: unknown, label: string): ModpackConfig['server'] | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['host', 'port'], label)

  return {
    host: validateBoundedString(record.host, `${label}.host`, {
      maxLength: 255,
    }),
    port: validateInteger(record.port, `${label}.port`, {
      min: 1,
      max: 65_535,
    }),
  }
}

export function validateBootstrapSeed(seed: unknown): Partial<ModpackConfig> | undefined {
  if (seed === undefined) {
    return undefined
  }

  const record = requirePlainObject(seed, 'Modpack bootstrap seed')
  assertAllowedKeys(record, ['runtime', 'java', 'memory', 'vmOptions', 'server', 'networkMode'], 'Modpack bootstrap seed')

  return {
    runtime: record.runtime === undefined ? undefined : validateRuntime(record.runtime, 'Modpack bootstrap seed.runtime'),
    java: validateOptionalJava(record.java, 'Modpack bootstrap seed.java'),
    memory: validateOptionalMemory(record.memory, 'Modpack bootstrap seed.memory'),
    vmOptions: validateOptionalStringArray(record.vmOptions, 'Modpack bootstrap seed.vmOptions', {
      maxItems: MAX_ARGUMENT_COUNT,
      maxItemLength: 256,
      allowEmpty: false,
    }),
    server: validateOptionalServer(record.server, 'Modpack bootstrap seed.server'),
    networkMode: record.networkMode === undefined
      ? undefined
      : validateEnum(record.networkMode, 'Modpack bootstrap seed.networkMode', NETWORK_MODES) as NetworkMode,
  }
}

export function validateModpackConfig(value: unknown): ModpackConfig {
  const record = requirePlainObject(value, 'Modpack config')
  assertAllowedKeys(record, [
    'id',
    'name',
    'runtime',
    'java',
    'memory',
    'vmOptions',
    'game',
    'server',
    'networkMode',
    'updatedAt',
    'createdAt',
  ], 'Modpack config')

  return {
    id: validateIdentifier(record.id, 'Modpack config.id'),
    name: validateBoundedString(record.name, 'Modpack config.name', {
      maxLength: 120,
    }),
    runtime: validateRuntime(record.runtime, 'Modpack config.runtime'),
    java: validateOptionalJava(record.java, 'Modpack config.java'),
    memory: validateOptionalMemory(record.memory, 'Modpack config.memory'),
    vmOptions: validateOptionalStringArray(record.vmOptions, 'Modpack config.vmOptions', {
      maxItems: MAX_ARGUMENT_COUNT,
      maxItemLength: 256,
      allowEmpty: false,
    }),
    game: validateOptionalGame(record.game, 'Modpack config.game'),
    server: validateOptionalServer(record.server, 'Modpack config.server'),
    networkMode: record.networkMode === undefined
      ? undefined
      : validateEnum(record.networkMode, 'Modpack config.networkMode', NETWORK_MODES) as NetworkMode,
    createdAt: validateOptionalBoundedString(record.createdAt, 'Modpack config.createdAt', {
      maxLength: 64,
    }),
    updatedAt: validateOptionalBoundedString(record.updatedAt, 'Modpack config.updatedAt', {
      maxLength: 64,
    }),
  }
}

export function validateModpackMetadataUpdates(value: unknown): Partial<ModpackMetadata> {
  const record = requirePlainObject(value, 'Modpack metadata update')
  assertAllowedKeys(record, [
    'id',
    'name',
    'version',
    'source',
    'sourceId',
    'sourceVersionId',
    'minecraftVersion',
    'modLoader',
    'iconUrl',
    'description',
    'author',
    'createdAt',
    'updatedAt',
  ], 'Modpack metadata update')

  return {
    id: validateOptionalBoundedString(record.id, 'Modpack metadata update.id', { maxLength: 128 }),
    name: validateOptionalBoundedString(record.name, 'Modpack metadata update.name', { maxLength: 120 }),
    version: validateOptionalBoundedString(record.version, 'Modpack metadata update.version', { maxLength: 64 }),
    source: record.source === undefined
      ? undefined
      : validateEnum(record.source, 'Modpack metadata update.source', MODPACK_SOURCES),
    sourceId: validateOptionalBoundedString(record.sourceId, 'Modpack metadata update.sourceId', { maxLength: 128 }),
    sourceVersionId: validateOptionalBoundedString(record.sourceVersionId, 'Modpack metadata update.sourceVersionId', { maxLength: 128 }),
    minecraftVersion: validateOptionalBoundedString(record.minecraftVersion, 'Modpack metadata update.minecraftVersion', { maxLength: 64 }),
    modLoader: record.modLoader === undefined ? undefined : validateModLoader(record.modLoader, 'Modpack metadata update.modLoader'),
    iconUrl: validateOptionalBoundedString(record.iconUrl, 'Modpack metadata update.iconUrl', { maxLength: MAX_URL_LENGTH }),
    description: validateOptionalBoundedString(record.description, 'Modpack metadata update.description', { maxLength: MAX_DESCRIPTION_LENGTH }),
    author: validateOptionalBoundedString(record.author, 'Modpack metadata update.author', { maxLength: 120 }),
    createdAt: validateOptionalBoundedString(record.createdAt, 'Modpack metadata update.createdAt', { maxLength: 64 }),
    updatedAt: validateOptionalBoundedString(record.updatedAt, 'Modpack metadata update.updatedAt', { maxLength: 64 }),
  }
}

function validateModpackFileEnv(value: unknown, label: string): ModpackFile['env'] | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, ['client', 'server'], label)

  return {
    client: record.client === undefined ? undefined : validateEnum(record.client, `${label}.client`, MODRINTH_ENV_VALUES),
    server: record.server === undefined ? undefined : validateEnum(record.server, `${label}.server`, MODRINTH_ENV_VALUES),
  }
}

function validateModpackFile(value: unknown, index: number): ModpackFile {
  const label = `Modpack manifest.files[${index}]`
  const record = requirePlainObject(value, label)
  assertAllowedKeys(record, [
    'projectID',
    'fileID',
    'projectId',
    'versionId',
    'path',
    'hashes',
    'downloads',
    'fileSize',
    'required',
    'env',
  ], label)

  const projectID = validateOptionalInteger(record.projectID, `${label}.projectID`, { min: 1 })
  const fileID = validateOptionalInteger(record.fileID, `${label}.fileID`, { min: 1 })
  const projectId = validateOptionalBoundedString(record.projectId, `${label}.projectId`, { maxLength: 128 })
  const versionId = validateOptionalBoundedString(record.versionId, `${label}.versionId`, { maxLength: 128 })
  const hasCurseforgeIds = projectID !== undefined || fileID !== undefined
  const hasModrinthIds = projectId !== undefined || versionId !== undefined

  if (hasCurseforgeIds && (!projectID || !fileID)) {
    fail(`${label} must include both projectID and fileID for CurseForge entries.`)
  }

  if (hasModrinthIds && (!projectId || !versionId)) {
    fail(`${label} must include both projectId and versionId for Modrinth entries.`)
  }

  if (!hasCurseforgeIds && !hasModrinthIds) {
    fail(`${label} must include either CurseForge IDs or Modrinth IDs.`)
  }

  let hashes: ModpackFile['hashes']
  if (record.hashes !== undefined) {
    const hashesRecord = requirePlainObject(record.hashes, `${label}.hashes`)
    assertAllowedKeys(hashesRecord, ['sha1', 'sha512'], `${label}.hashes`)
    hashes = {
      sha1: validateOptionalBoundedString(hashesRecord.sha1, `${label}.hashes.sha1`, { maxLength: 128 }),
      sha512: validateOptionalBoundedString(hashesRecord.sha512, `${label}.hashes.sha512`, { maxLength: 256 }),
    }
  }

  return {
    projectID,
    fileID,
    projectId,
    versionId,
    path: record.path === undefined ? undefined : validateRelativeChildPath(record.path, `${label}.path`),
    hashes,
    downloads: validateOptionalStringArray(record.downloads, `${label}.downloads`, {
      maxItems: MAX_DOWNLOAD_COUNT,
      maxItemLength: MAX_URL_LENGTH,
    }),
    fileSize: validateOptionalInteger(record.fileSize, `${label}.fileSize`, {
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    }),
    required: validateBoolean(record.required, `${label}.required`),
    env: validateModpackFileEnv(record.env, `${label}.env`),
  }
}

export function validateModpackManifest(value: unknown): ModpackManifest {
  const record = requirePlainObject(value, 'Modpack manifest')
  assertAllowedKeys(record, ['formatVersion', 'minecraft', 'name', 'version', 'author', 'files', 'overrides'], 'Modpack manifest')

  const minecraftRecord = requirePlainObject(record.minecraft, 'Modpack manifest.minecraft')
  assertAllowedKeys(minecraftRecord, ['version', 'modLoaders'], 'Modpack manifest.minecraft')
  const modLoadersValue = minecraftRecord.modLoaders
  if (!Array.isArray(modLoadersValue)) {
    fail('Modpack manifest.minecraft.modLoaders must be an array.')
  }

  if (modLoadersValue.length > 8) {
    fail('Modpack manifest.minecraft.modLoaders must contain 8 items or fewer.')
  }

  return {
    formatVersion: validateInteger(record.formatVersion, 'Modpack manifest.formatVersion', { min: 1, max: 10 }),
    minecraft: {
      version: validateBoundedString(minecraftRecord.version, 'Modpack manifest.minecraft.version', { maxLength: 64 }),
      modLoaders: modLoadersValue.map((entry, index) => {
        const loaderRecord = requirePlainObject(entry, `Modpack manifest.minecraft.modLoaders[${index}]`)
        assertAllowedKeys(loaderRecord, ['id', 'primary'], `Modpack manifest.minecraft.modLoaders[${index}]`)
        return {
          id: validateBoundedString(loaderRecord.id, `Modpack manifest.minecraft.modLoaders[${index}].id`, { maxLength: 128 }),
          primary: validateBoolean(loaderRecord.primary, `Modpack manifest.minecraft.modLoaders[${index}].primary`),
        }
      }),
    },
    name: validateBoundedString(record.name, 'Modpack manifest.name', { maxLength: 120 }),
    version: validateBoundedString(record.version, 'Modpack manifest.version', { maxLength: 64 }),
    author: validateOptionalBoundedString(record.author, 'Modpack manifest.author', { maxLength: 120 }),
    files: (() => {
      if (!Array.isArray(record.files)) {
        fail('Modpack manifest.files must be an array.')
      }

      if (record.files.length > 5_000) {
        fail('Modpack manifest.files must contain 5000 items or fewer.')
      }

      return record.files.map((entry, index) => validateModpackFile(entry, index))
    })(),
    overrides: record.overrides === undefined
      ? undefined
      : validateRelativeChildPath(record.overrides, 'Modpack manifest.overrides'),
  }
}

export function validateAddModPayload(
  value: unknown,
): { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number } {
  const record = requirePlainObject(value, 'Modpack mod payload')
  assertAllowedKeys(record, ['platform', 'projectId', 'versionId'], 'Modpack mod payload')
  const platform = validateEnum(record.platform, 'Modpack mod payload.platform', ['curseforge', 'modrinth'] as const)

  if (platform === 'curseforge') {
    return {
      platform,
      projectId: validateIntegerFromUnknown(record.projectId, 'Modpack mod payload.projectId', { min: 1 }),
      versionId: validateIntegerFromUnknown(record.versionId, 'Modpack mod payload.versionId', { min: 1 }),
    }
  }

  return {
    platform,
    projectId: validateBoundedString(record.projectId, 'Modpack mod payload.projectId', { maxLength: 128 }),
    versionId: validateBoundedString(record.versionId, 'Modpack mod payload.versionId', { maxLength: 128 }),
  }
}

export function validateExportOptions(value: unknown): ExportOptions | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = requirePlainObject(value, 'Modpack export options')
  assertAllowedKeys(record, [
    'includeSaves',
    'includeScreenshots',
    'includeResourcePacks',
    'includeShaders',
    'includeMods',
  ], 'Modpack export options')

  return {
    includeSaves: validateOptionalBoolean(record.includeSaves, 'Modpack export options.includeSaves'),
    includeScreenshots: validateOptionalBoolean(record.includeScreenshots, 'Modpack export options.includeScreenshots'),
    includeResourcePacks: validateOptionalBoolean(record.includeResourcePacks, 'Modpack export options.includeResourcePacks'),
    includeShaders: validateOptionalBoolean(record.includeShaders, 'Modpack export options.includeShaders'),
    includeMods: validateOptionalBoolean(record.includeMods, 'Modpack export options.includeMods'),
  }
}

export function validateOverrideEntries(value: unknown): Record<string, string> {
  const record = requirePlainObject(value, 'Modpack overrides')
  const entries = Object.entries(record)

  if (entries.length > MAX_OVERRIDE_ENTRY_COUNT) {
    fail(`Modpack overrides must contain ${MAX_OVERRIDE_ENTRY_COUNT} entries or fewer.`)
  }

  return Object.fromEntries(entries.map(([entryPath, base64Content]) => {
    const normalizedPath = validateRelativeChildPath(entryPath, `Modpack overrides.${entryPath}`)
    const normalizedContent = validateBoundedString(base64Content, `Modpack overrides.${entryPath}`, {
      trim: false,
      allowEmpty: true,
      maxLength: MAX_OVERRIDE_BASE64_LENGTH,
    })

    if (!/^[A-Za-z0-9+/=_-]*$/.test(normalizedContent)) {
      fail(`Modpack overrides.${entryPath} must be base64-encoded.`)
    }

    return [normalizedPath, normalizedContent]
  }))
}

type DialogFilter = { name: string; extensions: string[] }

function validateDialogFilters(value: unknown, label: string): DialogFilter[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`)
  }

  if (value.length > 20) {
    fail(`${label} must contain 20 filters or fewer.`)
  }

  return value.map((entry, index) => {
    const filterLabel = `${label}[${index}]`
    const record = requirePlainObject(entry, filterLabel)
    assertAllowedKeys(record, ['name', 'extensions'], filterLabel)

    return {
      name: validateBoundedString(record.name, `${filterLabel}.name`, { maxLength: 100 }),
      extensions: validateStringArray(record.extensions, `${filterLabel}.extensions`, {
        maxItems: 20,
        maxItemLength: 32,
        allowEmpty: false,
      }),
    }
  })
}

export function validateSaveDialogOptions(value: unknown): Electron.SaveDialogOptions {
  const record = requirePlainObject(value, 'Save dialog options')
  assertAllowedKeys(record, ['title', 'defaultPath', 'filters'], 'Save dialog options')

  return {
    title: validateOptionalBoundedString(record.title, 'Save dialog options.title', { maxLength: 200 }),
    defaultPath: validateFilesystemPath(record.defaultPath, 'Save dialog options.defaultPath', {
      allowUndefined: true,
      allowRelative: true,
    }),
    filters: validateDialogFilters(record.filters, 'Save dialog options.filters'),
  }
}

export function validateOpenDialogOptions(value: unknown): Electron.OpenDialogOptions {
  const record = requirePlainObject(value, 'Open dialog options')
  assertAllowedKeys(record, ['title', 'filters', 'properties'], 'Open dialog options')

  return {
    title: validateOptionalBoundedString(record.title, 'Open dialog options.title', { maxLength: 200 }),
    filters: validateDialogFilters(record.filters, 'Open dialog options.filters'),
    properties: record.properties === undefined
      ? undefined
      : (() => {
        if (!Array.isArray(record.properties)) {
          fail('Open dialog options.properties must be an array.')
        }

        if (record.properties.length > OPEN_DIALOG_PROPERTIES.length) {
          fail('Open dialog options.properties contains too many values.')
        }

        return record.properties.map((entry, index) => validateEnum(
          entry,
          `Open dialog options.properties[${index}]`,
          OPEN_DIALOG_PROPERTIES,
        ))
      })(),
  }
}

export function validateModpackExportFormat(value: unknown): (typeof EXPORT_FORMATS)[number] {
  return validateEnum(value, 'Modpack export format', EXPORT_FORMATS)
}
