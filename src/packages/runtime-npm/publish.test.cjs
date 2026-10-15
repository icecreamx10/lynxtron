const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { publish } = require('./publish.cjs');

for (const code of ['E404', 'ETARGET', 'E401']) {
  test(`registry ${code} ${code === 'E401' ? 'aborts without publishing' : 'publishes the missing version'}`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-publish-'));
    let publishes = 0;
    const archive = Buffer.from('test runtime');
    const local = {name:'@lynx-js/test-runtime', version:'1.2.3-alpha.0', os:['linux'], cpu:['x64'],
      runtimeSha256:crypto.createHash('sha256').update(archive).digest('hex')};
    try {
      await fs.mkdir(path.join(root, 'runtime'));
      await fs.writeFile(path.join(root,'runtime/package.json'), JSON.stringify(local));
      const operation = publish(root, 'runtime-test', {
        manifest:async () => {throw Object.assign(new Error(code), {code});},
        run:(_command, args) => {publishes++; assert.ok(args.includes('runtime-test')); return {status:0};},
        extract:async (_spec, directory) => {
          await fs.writeFile(path.join(directory,'package.json'),JSON.stringify(local));
          await fs.writeFile(path.join(directory,'runtime.zip'),archive);
        },
      });
      if (code === 'E401') {await assert.rejects(operation, /E401/); assert.equal(publishes,0);}
      else {await operation; assert.equal(publishes,1);}
    } finally {await fs.rm(root,{recursive:true,force:true});}
  });
}

test('registry visibility retries are bounded and do not hide authentication failures', async () => {
  const { waitForRegistry } = require('./publish.cjs');
  let requests = 0;
  const options = {attempts:3, sleep:async () => {}};
  const result = await waitForRegistry(async () => {
    if (++requests < 3) throw Object.assign(new Error('processing'), {code:'ETARGET'});
    return 'visible';
  }, 'test@1.0.0', options);
  assert.equal(result, 'visible');
  assert.equal(requests, 3);
  requests = 0;
  await assert.rejects(waitForRegistry(async () => {
    requests++; throw Object.assign(new Error('still processing'), {code:'E404'});
  }, 'test@1.0.0', options), /still processing/);
  assert.equal(requests, 3);
  requests = 0;
  await assert.rejects(waitForRegistry(async () => {
    requests++; throw Object.assign(new Error('unauthorized'), {code:'E401'});
  }, 'test@1.0.0', options), /unauthorized/);
  assert.equal(requests, 1);
});
