const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const pacote = require('pacote');

async function publish(directory, tag, { manifest = pacote.manifest, extract = pacote.extract, run = spawnSync } = {}) {
  const { loadRegistryOptions } = await import('../lynxtron/runtime-package.js');
  const options = { ...await loadRegistryOptions(), registry: 'https://registry.npmjs.org/', preferOnline: true };
  const entries = (await fs.readdir(directory)).sort();
  for (const entry of entries) {
    const packageDirectory = path.resolve(directory, entry);
    const local = JSON.parse(await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
    const spec = `${local.name}@${local.version}`;
    let remote;
    try { remote = await manifest(spec, options); }
    catch (error) { if (!['E404', 'ETARGET'].includes(error.code)) throw error; }
    if (!remote) {
      const result = run('npm', ['publish', '--access', 'public', '--provenance', '--tag', tag,
        '--registry', options.registry], { cwd: packageDirectory, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`Failed to publish ${spec}`);
    }
    // Verify uploaded bytes as well as metadata before releasing the main package.
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lynxtron-publish-'));
    try {
      await waitForRegistry(() => extract(spec, temporary, options), spec);
      const manifest = JSON.parse(await fs.readFile(path.join(temporary, 'package.json'), 'utf8'));
      const checksum = crypto.createHash('sha256').update(await fs.readFile(path.join(temporary, 'runtime.zip'))).digest('hex');
      if (checksum !== local.runtimeSha256 || manifest.name !== local.name ||
          manifest.version !== local.version || JSON.stringify(manifest.os) !== JSON.stringify(local.os) ||
          JSON.stringify(manifest.cpu) !== JSON.stringify(local.cpu)) {
        throw new Error(`Published package differs from this build: ${spec}. Use a new version.`);
      }
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  }
}
// npm can accept a publish before the new version is readable from the registry.
async function waitForRegistry(operation, spec, {
  attempts = 241,
  delayMs = 15000,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (!['E404', 'ETARGET'].includes(error.code) || attempt >= attempts) throw error;
      if (attempt === 1 || attempt % 4 === 0) {
        console.log(`Waiting for npm processing: ${spec} (${attempt}/${attempts})`);
      }
      await sleep(delayMs);
    }
  }
}
module.exports = { publish, waitForRegistry };
if (require.main === module) {
  publish(...process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
