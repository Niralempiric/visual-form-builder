import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8').trim();
const manifest = JSON.parse(read('package.json'));
const expectedNode = read('.nvmrc');
const expectedNpm = manifest.engines.npm;

if (read('.node-version') !== expectedNode || manifest.engines.node !== expectedNode
  || manifest.packageManager !== `npm@${expectedNpm}`) {
  console.error('Runtime pins disagree. Keep .nvmrc, .node-version and package.json aligned.');
  process.exit(1);
}

if (process.versions.node !== expectedNode) {
  console.error(`Expected Node ${expectedNode}; found ${process.versions.node}. Run nvm install && nvm use.`);
  process.exit(1);
}

// npm supplies its version for lifecycle scripts; direct node invocation checks Node only.
const agent = process.env.npm_config_user_agent;
if (agent && agent.split(' ')[0] !== `npm/${expectedNpm}`) {
  console.error(`Expected npm ${expectedNpm}. Run npm --version and select the pinned toolchain.`);
  process.exit(1);
}

console.log(`Runtime pins valid: Node ${expectedNode}, npm ${expectedNpm}${agent ? '' : ' (npm not checked outside npm)'}.`);
