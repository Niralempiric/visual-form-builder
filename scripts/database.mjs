import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const compose = ['compose', '-f', 'infra/compose.yaml'];
function run(args) {
  const result = spawnSync('docker', [...compose, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error('Local database command failed. Check Docker availability and the output above.');
    process.exit(result.status || 1);
  }
}
if (process.argv[2] === 'up') {
  run(['up', '-d', 'mongo']);
  run(['run', '--rm', '--no-deps', 'mongo-init']);
  run(['up', '-d', '--wait', '--wait-timeout', '90', 'mongo']);
} else if (process.argv[2] === 'down') {
  // Deliberately preserve volumes. Destructive reset instructions belong to D02.3.
  run(['down']);
} else {
  console.error('Usage: node scripts/database.mjs up|down');
  process.exitCode = 1;
}
