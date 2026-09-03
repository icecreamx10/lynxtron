const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflowPath = path.resolve(__dirname, '../../../../.github/workflows/publish.yml');
const workflowSource = fs.readFileSync(workflowPath, 'utf8');
const workflow = yaml.load(workflowSource);
const { jobs } = workflow;
const ciWorkflowPath = path.resolve(__dirname, '../../../../.github/workflows/ci.yml');
const ciJobs = yaml.load(fs.readFileSync(ciWorkflowPath, 'utf8')).jobs;

test('one version and one release gate both runtime variants', () => {
  assert.deepEqual(Object.keys(jobs['get-version'].outputs).sort(), ['tag', 'version']);
  assert.equal(jobs['create-release-dev'], undefined);
  assert.equal(jobs['publish-npm-dev'], undefined);
  assert.deepEqual(
    new Set(jobs['create-release'].needs),
    new Set([
      'get-version',
      'build-cef-webview-macos',
      'build-macos',
      'build-linux',
      'build-windows',
      'build-macos-devtool',
      'build-linux-devtool',
      'build-windows-devtool',
    ])
  );
});

test('release builds disable inspector and DevTool builds enable it', () => {
  for (const jobName of ['build-macos', 'build-linux', 'build-windows']) {
    const buildStep = jobs[jobName].steps.find((step) => step.uses && step.uses.includes('lynxtron-build'));
    assert.equal(buildStep.with['enable-inspector'], 'false');
  }
  for (const jobName of ['build-macos-devtool', 'build-linux-devtool', 'build-windows-devtool']) {
    const buildStep = jobs[jobName].steps.find((step) => step.uses && step.uses.includes('lynxtron-build'));
    assert.equal(buildStep.with['enable-inspector'], 'true');
    const uploadedPaths = jobs[jobName].steps
      .filter((step) => step.uses === 'actions/upload-artifact@v4')
      .map((step) => step.with.path)
      .join('\n');
    assert.match(uploadedPaths, /-devtool\.zip/);
  }
});

test('every supported platform and architecture publishes release and DevTool archives', () => {
  const targets = [
    { platform: 'darwin', arches: ['arm64', 'x64'], job: 'build-macos' },
    { platform: 'linux', arches: ['x64'], job: 'build-linux' },
    { platform: 'win32', arches: ['x64'], job: 'build-windows' },
  ];

  for (const { platform, arches, job } of targets) {
    for (const [jobName, suffix] of [[job, ''], [`${job}-devtool`, '-devtool']]) {
      assert.deepEqual(new Set(jobs[jobName].strategy.matrix.arch), new Set(arches));
      const runtimeUpload = jobs[jobName].steps.find(
        (step) => step.uses === 'actions/upload-artifact@v4' &&
          step.with.path.endsWith(`${suffix}.zip`) &&
          !step.with.path.includes('-symbols')
      );
      assert.ok(runtimeUpload, `${jobName} must upload its runtime archive`);
      assert.match(
        runtimeUpload.with.path,
        new RegExp(`lynxtron-v.*-${platform}-\\$\\{\\{ matrix\\.arch \\}\\}${suffix}\\.zip$`)
      );
    }
  }
});

test('Linux symbol extraction from main is retained for both runtime variants', () => {
  for (const jobName of ['build-linux', 'build-linux-devtool']) {
    const buildStep = jobs[jobName].steps.find((step) => step.uses && step.uses.includes('linux-lynxtron-build'));
    assert.equal(buildStep.with['gn-args'], 'symbol_level=1');

    const packageScript = jobs[jobName].steps.find(
      (step) => step.name.startsWith('Package Linux binary')
    ).run;
    assert.match(packageScript, /strip_binary\.py/);
    assert.match(packageScript, /Linux symbols package is empty or unexpectedly small/);
    if (jobName.endsWith('-devtool')) {
      assert.match(packageScript, /linux-\$\{\{ matrix\.arch \}\}-devtool\.zip/);
    }
  }
});

test('macOS releases publish both universal slice architectures', () => {
  for (const jobName of ['build-macos', 'build-macos-devtool']) {
    assert.deepEqual(
      new Set(jobs[jobName].strategy.matrix.arch),
      new Set(['arm64', 'x64'])
    );
    const uploadedPaths = jobs[jobName].steps
      .filter((step) => step.uses === 'actions/upload-artifact@v4')
      .map((step) => step.with.path)
      .join('\n');
    assert.match(uploadedPaths, /darwin-\$\{\{ matrix\.arch \}\}/);
  }

  const nodeHeadersStep = jobs['build-macos'].steps.find(
    (step) => step.name === 'Upload node headers'
  );
  assert.equal(nodeHeadersStep.if, "matrix.arch == 'arm64'");

  assert.deepEqual(
    new Set(jobs['build-cef-webview-macos'].strategy.matrix.arch),
    new Set(['arm64', 'x64'])
  );
});

test('macOS publish jobs preserve sibling architectures and cache CEF dependencies', () => {
  assert.equal(jobs['build-macos'].strategy['fail-fast'], false);
  assert.equal(jobs['build-cef-webview-macos'].strategy['fail-fast'], false);

  const cefJob = jobs['build-cef-webview-macos'];
  const cacheStep = cefJob.steps.find(
    (step) => step.uses === './lynxtron/.github/actions/common-deps'
  );
  assert.ok(cacheStep, 'CEF builds must restore and save the Habitat cache');
  assert.equal(cacheStep.with['run-habitat-sync'], 'false');

  const prepareStep = cefJob.steps.find((step) => step.name === 'Prepare environment');
  assert.equal(prepareStep.env.HABITAT_CONCURRENCY, 2);
  assert.match(prepareStep.run, /for attempt in 1 2 3/);
  assert.match(prepareStep.run, /10 \* \(2 \*\* \(attempt - 1\)\)/);
});

test('pull request CI builds every published architecture', () => {
  assert.deepEqual(
    new Set(ciJobs['macos-lynxtron-build'].strategy.matrix.arch),
    new Set(['arm64', 'x64'])
  );
  assert.deepEqual(ciJobs['linux-lynxtron-build'].strategy.matrix.arch, ['x64']);
  assert.deepEqual(ciJobs['windows-lynxtron-build'].strategy.matrix.arch, ['x64']);
});

test('npm packages are published once without a legacy dev release channel', () => {
  const publishJob = jobs['publish-npm'];
  const publishScript = publishJob.steps.find((step) => step.name === 'Publish').run;
  assert.equal((publishScript.match(/npm publish/g) || []).length, 7);
  assert.doesNotMatch(workflowSource, /npm dist-tag add|legacy dev tag/);
  assert.doesNotMatch(workflowSource, /dev_version|dev_tag|v\$\{VERSION\}-dev/);
});

test('legacy -dev release tags are rejected', () => {
  const versionScript = jobs['get-version'].steps.find(
    (step) => step.name === 'Validate and set version'
  ).run;
  assert.match(versionScript, /\*-dev\|\*-dev\.\*/);
  assert.match(versionScript, /must not include a '-dev' pre-release label/);
});
