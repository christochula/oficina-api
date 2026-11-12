import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, lstat, realpath, chmod, unlink, rmdir } from 'node:fs/promises';
import { resolve, dirname, join, sep, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { awsReader, preflightAccount, validateManifest, PreflightError } from './preflight-deploy-account.mjs';

const execute = promisify(execFile);
const workspace = resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const profile = 'karina-lab';
export const region = 'us-east-1';
const keys = ['aws_access_key_id', 'aws_secret_access_key', 'aws_session_token'];
const configText = `[profile ${profile}]\nregion = ${region}\noutput = json\ncli_pager =\n`;
const names = ['credentials', 'config', 'session.json'];
export class SessionError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new SessionError(code); };
const safeCode = error => error instanceof SessionError || error instanceof PreflightError ? error.code : 'PRIVATE_SESSION_OPERATION_FAILED';
const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
const inside = (path, root) => canonical(path) === canonical(root) || canonical(path).startsWith(canonical(root + sep));

export function parseTemporaryCredentials(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 65536) fail('INVALID_PRIVATE_INPUT');
  let section; const values = {};
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (/^\[/.test(line)) {
      if (section || !/^\[(?:default|karina-lab)\]$/.test(line)) fail('ONE_UNAMBIGUOUS_PROFILE_REQUIRED');
      section = line; continue;
    }
    const match = line.match(/^([a-z_]+)\s*=\s*(\S+)$/);
    if (!section || !match || !keys.includes(match[1]) || Object.hasOwn(values, match[1])) fail('ONLY_UNIQUE_TEMPORARY_CREDENTIAL_TRIPLE_ALLOWED');
    values[match[1]] = match[2];
  }
  if (!section || keys.some(key => !values[key])) fail('COMPLETE_TEMPORARY_CREDENTIAL_TRIPLE_REQUIRED');
  if (!/^ASIA[A-Z0-9]{16}$/.test(values.aws_access_key_id) || !/^[A-Za-z0-9/+=]{40}$/.test(values.aws_secret_access_key) || !/^[A-Za-z0-9/+=]{16,16384}$/.test(values.aws_session_token)) fail('INVALID_TEMPORARY_CREDENTIAL_FORMAT');
  return values;
}

async function outsideWorkspace(path, { newDirectory = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PRIVATE_PATH_REQUIRED');
  const target = resolve(path);
  const real = newDirectory ? join(await realpath(dirname(target)), target.slice(dirname(target).length + 1)) : await realpath(target);
  if (inside(target, workspace) || inside(real, await realpath(workspace))) fail('PRIVATE_FILES_MUST_BE_OUTSIDE_WORKSPACE');
  return target;
}

// Apply a private DACL before writing credentials. No secret value enters a shell argument.
export async function privateAccess(path, { protect = false } = {}) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile() && !info.isDirectory()) fail('REGULAR_PRIVATE_PATH_REQUIRED');
  if (process.platform !== 'win32') {
    if (protect) await chmod(path, info.isDirectory() ? 0o700 : 0o600);
    const checked = await lstat(path);
    if ((checked.mode & 0o077) !== 0 || typeof process.getuid === 'function' && checked.uid !== process.getuid()) fail('PRIVATE_OWNER_PERMISSIONS_REQUIRED');
    return;
  }
  const script = String.raw`
$ErrorActionPreference = 'Stop'
$sessionPath = $env:OFICINA_PRIVATE_SESSION_PATH
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$trustedSids = @($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544')
if ($env:OFICINA_PRIVATE_SESSION_PROTECT -eq 'true') {
  $privateAcl = New-Object System.Security.AccessControl.DirectorySecurity
  $privateAcl.SetAccessRuleProtection($true, $false)
  $privateAcl.SetOwner($currentSid)
  foreach ($trustedSid in $trustedSids) {
    $identity = New-Object System.Security.Principal.SecurityIdentifier($trustedSid)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $privateAcl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $sessionPath -AclObject $privateAcl
}
$actualAcl = Get-Acl -LiteralPath $sessionPath
if ($actualAcl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $currentSid.Value) { throw 'PRIVATE_OWNER_REQUIRED' }
if (@($actualAcl.Access).Count -eq 0) { throw 'EXPLICIT_PRIVATE_ACL_REQUIRED' }
foreach ($rule in $actualAcl.Access) {
  if ($rule.AccessControlType -eq 'Allow' -and $trustedSids -notcontains $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value) { throw 'PRIVATE_ACCESS_REQUIRED' }
}`;
  try { await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, OFICINA_PRIVATE_SESSION_PATH: path, OFICINA_PRIVATE_SESSION_PROTECT: String(protect) } }); }
  catch { fail('PRIVATE_WINDOWS_ACL_REQUIRED'); }
}

async function readPrivate(path) {
  await outsideWorkspace(path);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 65536) fail('REGULAR_PRIVATE_FILE_REQUIRED');
  await privateAccess(path);
  return readFile(path, 'utf8');
}

export async function importSession({ inputFile, directory, now = () => new Date() }) {
  const values = parseTemporaryCredentials(await readPrivate(inputFile));
  const target = await outsideWorkspace(directory, { newDirectory: true });
  // No recursive mkdir: the caller chooses an existing private parent and a new leaf.
  try { await mkdir(target, { mode: 0o700 }); } catch { fail('NEW_SESSION_DIRECTORY_REQUIRED'); }
  try {
    await privateAccess(target, { protect: true });
    const metadata = { schemaVersion: 1, profile, region, createdAt: now().toISOString(), expiresAt: null, expirationStatus: 'unknown-renew-before-deploy', awsVerified: false };
    const credentials = `[${profile}]\n${keys.map(key => `${key} = ${values[key]}`).join('\n')}\n`;
    for (const [name, text] of [['credentials', credentials], ['config', configText], ['session.json', JSON.stringify(metadata, null, 2) + '\n']]) await writeFile(join(target, name), text, { mode: 0o600, flag: 'wx' });
    return { mode: 'offline-import', directory: target, ...metadata, awsCalled: false, sourceFileRetained: true };
  } catch (error) {
    // Only the three known files in the new, explicitly named directory may be removed.
    for (const name of names) await unlink(join(target, name)).catch(() => {});
    await rmdir(target).catch(() => {});
    throw error;
  }
}

export function isolatedSessionEnv(directory, inherited = process.env) {
  if (!isAbsolute(directory)) fail('ABSOLUTE_PRIVATE_PATH_REQUIRED');
  const clean = Object.fromEntries(Object.entries(inherited).filter(([key]) => !/^AWS_/i.test(key) && !/^AMAZON_/i.test(key) && key !== 'BOTO_CONFIG'));
  return { ...clean, AWS_SHARED_CREDENTIALS_FILE: join(directory, 'credentials'), AWS_CONFIG_FILE: join(directory, 'config'), AWS_PROFILE: profile, AWS_DEFAULT_PROFILE: profile, AWS_REGION: region, AWS_DEFAULT_REGION: region, AWS_EC2_METADATA_DISABLED: 'true', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true', AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' };
}

export async function loadSession(directory, inherited = process.env) {
  const target = await outsideWorkspace(directory);
  if (!(await lstat(target)).isDirectory()) fail('SESSION_DIRECTORY_REQUIRED');
  await privateAccess(target);
  const credentials = await readPrivate(join(target, 'credentials'));
  if (!credentials.startsWith(`[${profile}]\n`)) fail('ISOLATED_PROFILE_REQUIRED');
  parseTemporaryCredentials(credentials);
  if (await readPrivate(join(target, 'config')) !== configText) fail('ISOLATED_CONFIG_REQUIRED');
  let metadata;
  try { metadata = JSON.parse(await readPrivate(join(target, 'session.json'))); } catch { fail('INVALID_SESSION_METADATA'); }
  if (metadata.schemaVersion !== 1 || metadata.profile !== profile || metadata.region !== region || metadata.expiresAt !== null || metadata.expirationStatus !== 'unknown-renew-before-deploy' || metadata.awsVerified !== false) fail('INVALID_SESSION_METADATA');
  return { metadata, env: isolatedSessionEnv(target, inherited) };
}

export async function sessionPreflight({ directory, manifest, inherited = process.env, exec }) {
  validateManifest(manifest, { remote: true });
  const session = await loadSession(directory, inherited);
  const result = await preflightAccount(manifest, awsReader({ region, profile, env: session.env, ...(exec ? { exec } : {}) }));
  return { ...result, session: { profile, expiresAt: null, expirationStatus: 'unknown-renew-before-deploy' } };
}

export function parseArgs(args) {
  const result = {}; const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (seen.has(key)) fail('DUPLICATE_OPTION');
    seen.add(key);
    if (['--describe', '--preflight'].includes(key)) result[key.slice(2)] = true;
    else if (['--import-file', '--directory', '--manifest'].includes(key) && args[index + 1] && !args[index + 1].startsWith('--')) result[key.slice(2)] = args[++index];
    else fail('UNKNOWN_OR_INCOMPLETE_OPTION');
  }
  const modes = [result.describe, result.preflight, result['import-file']].filter(Boolean).length;
  if (modes > 1 || result.preflight && (!result.directory || !result.manifest) || result['import-file'] && (!result.directory || result.manifest) || !result.preflight && !result['import-file'] && (result.directory || result.manifest)) fail('INVALID_SESSION_MODE');
  return result;
}

async function main(args) {
  const options = parseArgs(args);
  let result;
  if (options['import-file']) result = await importSession({ inputFile: options['import-file'], directory: options.directory });
  else if (options.preflight) {
    let manifest;
    try { manifest = JSON.parse(await readFile(options.manifest, 'utf8')); } catch { fail('MANIFEST_READ_OR_JSON_FAILED'); }
    result = await sessionPreflight({ directory: options.directory, manifest });
    if (result.requiresReview) process.exitCode = 2;
  } else result = { mode: 'describe', awsCalled: false, writes: false, profile, region, input: 'One private INI section [default] or [karina-lab], with only the temporary AWS credential triple. Input and new session directory must be outside the workspace. No secret arguments or environment intake.', commands: ['--describe', '--import-file <private-INI> --directory <new-private-directory>', '--preflight --directory <existing-session> --manifest <manifest-with-expected-account>'], expiration: 'Unknown; import does not validate credentials or extend their expiration.', github: 'No GitHub calls. Never use configure-repositories.mjs --apply for credential intake.' };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(error => { process.stderr.write(`Session preparation failed: ${safeCode(error)}\n`); process.exitCode = 1; });
