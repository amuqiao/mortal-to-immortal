import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');

async function runScript(args) {
  try {
    const result = await execFileAsync('bash', args, { cwd: ROOT });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: typeof error.code === 'number' ? error.code : 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

test('run.sh help prints available dev recipes', async () => {
  const result = await runScript(['scripts/run.sh', '--help']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /up dev/);
  assert.match(result.stdout, /status dev/);
});

test('run.sh rejects unknown recipes with exit code 2', async () => {
  const result = await runScript(['scripts/run.sh', 'up', 'assets']);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /unknown run recipe/);
});

test('dev.sh help documents runtime files without starting a server', async () => {
  const result = await runScript(['scripts/dev.sh', '--help']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /\.run\/dev\.pid/);
  assert.match(result.stdout, /--strictPort/);
});

test('dev.sh rejects missing service with exit code 2', async () => {
  const result = await runScript(['scripts/dev.sh', 'status']);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /usage: \.\/scripts\/dev\.sh status dev/);
});

test('export-yuque-doc help documents output layout without network access', async () => {
  const result = await execFileAsync('node', ['scripts/export-yuque-doc.mjs', '--help'], { cwd: ROOT });

  assert.match(result.stdout, /<out>\/<name>\/<file>/);
  assert.match(result.stdout, /--dry-run/);
  assert.match(result.stdout, /--json/);
  assert.match(result.stdout, /--force/);
  assert.match(result.stdout, /选项:/);
});

test('export-yuque-doc short help is supported for agent discovery', async () => {
  const result = await execFileAsync('node', ['scripts/export-yuque-doc.mjs', '-h'], { cwd: ROOT });

  assert.match(result.stdout, /用法:/);
  assert.match(result.stdout, /--assets-dir/);
});

test('export-yuque-doc rejects non-Yuque URLs before network access', async () => {
  try {
    await execFileAsync('node', ['scripts/export-yuque-doc.mjs', 'https://example.com/a/b/c'], { cwd: ROOT });
    assert.fail('expected export-yuque-doc to reject non-Yuque URL');
  } catch (error) {
    assert.equal(error.code, 2);
    assert.match(error.stderr, /不是语雀 URL/);
  }
});

test('export-yuque-doc rejects path-like output file names before network access', async () => {
  try {
    await execFileAsync(
      'node',
      ['scripts/export-yuque-doc.mjs', 'https://www.yuque.com/a/b/c', '--file', '../bad.md'],
      { cwd: ROOT },
    );
    assert.fail('expected export-yuque-doc to reject path-like file name');
  } catch (error) {
    assert.equal(error.code, 2);
    assert.match(error.stderr, /--file 必须是单个路径名/);
  }
});

test('package dev aliases route through the stable run.sh recipes', async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(pkg.scripts.dev, 'bash scripts/run.sh up dev');
  assert.equal(pkg.scripts['dev:status'], 'bash scripts/run.sh status dev');
  assert.equal(pkg.scripts['dev:stop'], 'bash scripts/run.sh down dev');
  assert.equal(pkg.scripts['dev:restart'], 'bash scripts/run.sh restart dev');
  assert.equal(pkg.scripts['dev:logs'], 'bash scripts/run.sh logs dev');
  assert.equal(pkg.scripts['dev:raw'], 'vite --config vite/config.dev.mjs --host 127.0.0.1 --port 8080 --strictPort');
  assert.equal(pkg.scripts['yuque:export'], 'node scripts/export-yuque-doc.mjs');
});
