#!/usr/bin/env node
/**
 * One-command Python setup for MediaPipe preprocessing: creates a repo-local venv at
 * tools/.venv and installs tools/requirements.txt into it. After this, `npm run dev`
 * auto-detects the venv — no MEDIAPIPE_PYTHON, no absolute paths, works on any machine.
 *
 *   npm run setup
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const VENV = path.join(ROOT, 'tools', '.venv');
const REQ = path.join(ROOT, 'tools', 'requirements.txt');
const venvPython = path.join(VENV, IS_WIN ? 'Scripts' : 'bin', IS_WIN ? 'python.exe' : 'python');

const log = (m) => console.log(`\x1b[36m›\x1b[0m ${m}`);
const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.error(`\x1b[31m✗\x1b[0m ${m}`);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  return !r.error && r.status === 0;
}

/** First `python` on this machine that runs (NOT checking for mediapipe — we install that). */
function findBasePython() {
  const candidates = IS_WIN ? ['py', 'python', 'python3'] : ['python3', 'python'];
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) {
      log(`Using ${c} (${(r.stdout || r.stderr || '').trim()})`);
      return c;
    }
  }
  return null;
}

function main() {
  if (!fs.existsSync(REQ)) {
    fail(`Missing ${path.relative(ROOT, REQ)}`);
    process.exit(1);
  }

  if (!fs.existsSync(venvPython)) {
    const base = findBasePython();
    if (!base) {
      fail('No Python found. Install Python 3.9–3.12 from https://www.python.org/downloads/ and re-run `npm run setup`.');
      process.exit(1);
    }
    log(`Creating virtual environment at ${path.relative(ROOT, VENV)} …`);
    if (!run(base, ['-m', 'venv', VENV])) {
      fail('Failed to create the venv. Ensure the `venv` module is available (on Debian/Ubuntu: `apt install python3-venv`).');
      process.exit(1);
    }
  } else {
    ok('Virtual environment already exists — reusing it.');
  }

  log('Upgrading pip …');
  run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet']);

  log('Installing MediaPipe + OpenCV (this can take a minute) …');
  if (!run(venvPython, ['-m', 'pip', 'install', '-r', REQ])) {
    fail('Dependency install failed. See the pip output above. MediaPipe supports Python 3.9–3.12 (not 3.13+ yet).');
    process.exit(1);
  }

  const check = spawnSync(venvPython, ['-c', 'import mediapipe, cv2; print(mediapipe.__version__)'], { encoding: 'utf8' });
  if (check.status === 0) {
    ok(`MediaPipe ${(check.stdout || '').trim()} ready in ${path.relative(ROOT, VENV)}`);
    console.log('\nDone. Run `npm run dev` — the welcome page can now pre-process videos.');
  } else {
    fail('Installed, but importing mediapipe/cv2 failed:\n' + (check.stderr || '').trim());
    process.exit(1);
  }
}

main();
