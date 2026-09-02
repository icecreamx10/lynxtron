#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { makeUniversalApp } = require('@electron/universal');
const {
  prepareRuntimeConfig,
  prepareUniversalPackaging,
} = require('./runtime-config.js');

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'electron-builder.yml');
const tempConfigPath = path.join(projectRoot, 'config.json');

function getLynxtronPackage() {
  try {
    const packageJsonPath = require.resolve('@lynx-js/lynxtron/package.json', {
      paths: [projectRoot],
    });
    const runtimeArtifactsPath = require.resolve(
      '@lynx-js/lynxtron/runtime-artifacts',
      { paths: [projectRoot] }
    );
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.version) {
      return {
        version: packageJson.version,
        runtimeArtifacts: require(runtimeArtifactsPath),
      };
    }
  } catch (e) {
    console.warn('Could not resolve the installed Lynxtron package.', e.message);
  }

  throw new Error('Failed to determine Lynxtron version. Please check package.json and node_modules.');
}


function isUniversalFromConfig(config) {
  if (!config || !config.mac || !config.mac.target) {
    return false;
  }
  const targets = config.mac.target;
  if (typeof targets === 'string') {
    return targets === 'universal';
  }
  if (Array.isArray(targets)) {
    return targets.some(t => {
      if (typeof t === 'string') {
        return t === 'universal';
      }
      if (typeof t === 'object' && t !== null) {
        return t.arch === 'universal';
      }
      return false;
    });
  }
  return false;
}

async function build() {
  const rawArgs = process.argv.slice(2);
  const { runtimeArtifacts } = getLynxtronPackage();
  const { forwardedArgs } = runtimeArtifacts.parseRuntimeArguments(rawArgs);

  const config = readConfig();

  const isUniversal = forwardedArgs.includes('--universal') || isUniversalFromConfig(config);

  try {
    if (isUniversal) {
      await runBuild('--x64', rawArgs);
      await runBuild('--arm64', rawArgs);
      await makeUniversal();
    } else {
      await runBuild(undefined, rawArgs);
    }
  } finally {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
}

function readConfig() {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  return yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
}

function runBuild(arch, rawArgs) {
  return new Promise((resolve, reject) => {
    const config = readConfig();
    const lynxtronPackage = getLynxtronPackage();
    const prepared = prepareRuntimeConfig({
      config,
      args: rawArgs,
      env: process.env,
      arch,
      platform: process.platform,
      defaultArch: process.arch,
      lynxtronVersion: lynxtronPackage.version,
      runtimeArtifacts: lynxtronPackage.runtimeArtifacts,
    });

    const isUniversalBuild = prepared.forwardedArgs.includes('--universal') || isUniversalFromConfig(config);

    // If we are building a slice of a universal build, override the arch settings in the config
    if (isUniversalBuild && arch) {
      const currentArch = arch.replace('--', '');
      if (config.mac) {
        // Override top-level mac.arch
        if (config.mac.arch === 'universal') {
          config.mac.arch = currentArch;
        }

        // Handle mac.target array
        if (Array.isArray(config.mac.target)) {
          config.mac.target = config.mac.target.map(t => {
            if (typeof t === 'object' && t !== null && t.arch === 'universal') {
              return { ...t, arch: currentArch };
            }
            if (t === 'universal') return null; // remove 'universal' string from targets
            return t;
          }).filter(t => t !== null);
          // If the array becomes empty, remove it to avoid issues.
          if (config.mac.target.length === 0) {
            delete config.mac.target;
          }
        }
        // Handle mac.target string
        else if (typeof config.mac.target === 'string' && config.mac.target === 'universal') {
          // If it's just 'universal', remove it and let electron-builder use defaults for the target type (e.g. dmg).
          delete config.mac.target;
        }
      }
    }

    fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

    const electronBuilderPath = require.resolve('electron-builder/out/cli/cli.js');
    const args = prepared.forwardedArgs.filter(arg => arg !== '--universal' && arg !== '--mas');
    const finalArgs = ['-c', tempConfigPath, ...args];
    if (arch) {
      finalArgs.push(arch);
    }
    
    const child = spawn('node', [electronBuilderPath, ...finalArgs], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
}

async function makeUniversal() {
  let config = {};
  if (fs.existsSync(configPath)) {
    const yamlContent = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(yamlContent);
  }

  const x64AppPath = path.resolve(projectRoot, config.directories.output, 'mac', `${config.productName}.app`);
  const arm64AppPath = path.resolve(projectRoot, config.directories.output, 'mac-arm64', `${config.productName}.app`);
  const outAppPath = path.resolve(projectRoot, config.directories.output, 'mac-universal', `${config.productName}.app`);

  await makeUniversalApp({
    x64AppPath,
    arm64AppPath,
    outAppPath,
  });

  const packaging = prepareUniversalPackaging({
    config,
    configPath: tempConfigPath,
    outAppPath,
  });
  fs.writeFileSync(tempConfigPath, JSON.stringify(packaging.config, null, 2));

  return new Promise((resolve, reject) => {
    const electronBuilderPath = require.resolve('electron-builder/out/cli/cli.js');

    const child = spawn('node', [electronBuilderPath, ...packaging.args], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Universal packaging failed with code ${code}`));
      }
    });
  });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
