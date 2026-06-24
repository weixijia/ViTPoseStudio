import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const IS_WIN = process.platform === 'win32';
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.mov', '.avi', '.webm', '.mkv']);
const safeSeg = (s: string) => String(s).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
const baseOf = (name: string) => name.replace(/\.[^./\\]+$/, '');

function readJson(p: string): any {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Dev endpoint: persist annotation JSON to annotation/<video>/<file> (no browser downloads). */
function annotationSaver(): Plugin {
  return {
    name: 'annotation-saver',
    configureServer(server) {
      server.middlewares.use('/__save_annotation', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { video, file, data } = JSON.parse(body || '{}');
            if (!video || !file) throw new Error('video and file required');
            const dir = path.join(ROOT, 'annotation', safeSeg(video));
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, safeSeg(file)), JSON.stringify(data, null, 2), 'utf8');
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// ---- MediaPipe Python discovery (so the repo is portable: no hardcoded interpreter) ----
type PyStatus = { ok: boolean; path: string | null; reason: 'OK' | 'MODULE_MISSING' | 'NO_PYTHON'; fix: string };

/** Interpreters to try, best first: explicit override → repo-local venv → system. */
function pythonCandidates(): string[] {
  const list: string[] = [];
  if (process.env.MEDIAPIPE_PYTHON) list.push(process.env.MEDIAPIPE_PYTHON);
  const venvBins = IS_WIN
    ? ['tools/.venv/Scripts/python.exe', '.venv/Scripts/python.exe']
    : ['tools/.venv/bin/python3', 'tools/.venv/bin/python', '.venv/bin/python3', '.venv/bin/python'];
  for (const v of venvBins) list.push(path.join(ROOT, ...v.split('/')));
  list.push(...(IS_WIN ? ['python', 'py'] : ['python3', 'python']));
  return list;
}

/**
 * Find a Python that can `import mediapipe, cv2`. Returns the ABSOLUTE interpreter path
 * (via sys.executable) so spawning later needs no shell and tolerates spaces in the path.
 */
function probePython(): PyStatus {
  let binaryButNoModule: string | null = null;
  for (const cand of pythonCandidates()) {
    // skip absolute candidates that don't exist (fast, avoids ENOENT noise)
    if ((cand.includes('/') || cand.includes('\\')) && !fs.existsSync(cand)) continue;
    const full = spawnSync(cand, ['-c', 'import mediapipe, cv2, sys; sys.stdout.write(sys.executable)'], { encoding: 'utf8' });
    if (full.error) continue; // ENOENT — candidate not runnable
    if (full.status === 0) {
      return { ok: true, path: (full.stdout || '').trim() || cand, reason: 'OK', fix: '' };
    }
    // ran, but import failed → remember it; maybe another candidate has the modules
    if (!binaryButNoModule) {
      const bare = spawnSync(cand, ['-c', 'import sys; sys.stdout.write(sys.executable)'], { encoding: 'utf8' });
      if (!bare.error && bare.status === 0) binaryButNoModule = (bare.stdout || '').trim() || cand;
    }
  }
  if (binaryButNoModule) {
    return {
      ok: false,
      path: binaryButNoModule,
      reason: 'MODULE_MISSING',
      fix: 'Python found, but MediaPipe/OpenCV are not installed. Run `npm run setup` to create a ready-to-use venv.',
    };
  }
  return {
    ok: false,
    path: null,
    reason: 'NO_PYTHON',
    fix: 'No Python found. Install Python 3.9–3.12, then run `npm run setup` to create a MediaPipe venv.',
  };
}

let pyCache: PyStatus | null = null;
let pyLastProbe = 0;
/** Cache a working interpreter forever; re-probe a failing one at most every 5s (so creating the venv then retrying works). */
function getPython(force = false): PyStatus {
  if (pyCache?.ok) return pyCache;
  const now = Date.now();
  if (!force && pyCache && now - pyLastProbe < 5000) return pyCache;
  pyLastProbe = now;
  pyCache = probePython();
  return pyCache;
}

type Job = { status: 'queued' | 'running' | 'done' | 'error'; done: number; total: number; error?: string };

/**
 * Dev endpoints for the welcome-page video library:
 *  - GET  /__library   → status of every video in videos/ (skeleton?, labels?, annotation %) + Python status
 *  - POST /__preprocess {videos:[...], force?} → batch-run tools/extract_mediapipe.py with live progress
 * Python is auto-discovered (repo-local tools/.venv, or system, or the MEDIAPIPE_PYTHON override).
 */
function videoLibrary(): Plugin {
  const jobs = new Map<string, Job>();
  const queue: string[] = [];
  let running = false;
  let forceFlag = false;

  function runOne(video: string): Promise<void> {
    return new Promise((resolve) => {
      const py = getPython(true);
      if (!py.ok || !py.path) {
        jobs.set(video, { status: 'error', done: 0, total: 0, error: py.fix });
        return resolve();
      }
      const job: Job = { status: 'running', done: 0, total: 0 };
      jobs.set(video, job);
      const args = [path.join(ROOT, 'tools', 'extract_mediapipe.py'), path.join(ROOT, 'videos', video)];
      if (forceFlag) args.push('--force');
      let child;
      try {
        child = spawn(py.path, args, { cwd: ROOT }); // py.path is absolute → no shell needed, spaces OK
      } catch (e) {
        jobs.set(video, { status: 'error', done: 0, total: 0, error: String(e) });
        return resolve();
      }
      let buf = '';
      let errTail = '';
      child.stdout.on('data', (d) => {
        buf += d.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() ?? '';
        for (const ln of lines) {
          const m = ln.trim().match(/^__PROGRESS__\s+(\d+)\s+(\d+)/);
          if (m) {
            job.done = Number(m[1]);
            job.total = Number(m[2]);
          }
        }
      });
      child.stderr.on('data', (d) => {
        errTail = (errTail + d.toString()).slice(-600);
      });
      child.on('error', (e) => {
        jobs.set(video, { status: 'error', done: job.done, total: job.total, error: String(e) });
        resolve();
      });
      child.on('close', (code) => {
        if (code === 0) jobs.set(video, { status: 'done', done: job.total || job.done, total: job.total });
        else jobs.set(video, { status: 'error', done: job.done, total: job.total, error: errTail.trim() || `exited ${code}` });
        resolve();
      });
    });
  }

  async function drain() {
    if (running) return;
    running = true;
    while (queue.length) {
      const v = queue.shift()!;
      await runOne(v);
    }
    running = false;
  }

  function scan() {
    const videosDir = path.join(ROOT, 'videos');
    const skelDir = path.join(ROOT, 'mediapipe_skeleton');
    const labelDir = path.join(ROOT, 'action_labels');
    const annDir = path.join(ROOT, 'annotation');
    const manifest = readJson(path.join(skelDir, 'manifest.json'));
    const manMap = new Map<string, any>((manifest?.videos ?? []).map((e: any) => [e.video, e]));

    let files: string[] = [];
    try {
      files = fs.readdirSync(videosDir).filter((f) => VIDEO_EXTS.has(path.extname(f).toLowerCase()));
    } catch {
      files = [];
    }
    files.sort();

    return files.map((video) => {
      const base = baseOf(video);
      const skeleton = fs.existsSync(path.join(skelDir, base + '.json'));
      const labels = fs.existsSync(path.join(labelDir, base + '.json'));
      const rep = readJson(path.join(annDir, base, 'rep_counting.json'));
      const pose = readJson(path.join(annDir, base, 'pose_analysis.json'));
      const reps = Array.isArray(rep?.reps) ? rep.reps.length : 0;
      const poseFlags = Array.isArray(pose?.pose_errors) ? pose.pose_errors.length : 0;
      const frameCount = rep?.frame_count ?? manMap.get(video)?.frame_count ?? null;
      const lastFrame = reps ? Math.max(...rep.reps.map((r: any) => Number(r.end_frame) || 0)) : 0;
      const progressPct = frameCount && frameCount > 1 ? Math.round((lastFrame / (frameCount - 1)) * 100) : 0;
      return {
        video,
        skeleton,
        skeletonFrames: manMap.get(video)?.frame_count ?? null,
        labels,
        reps,
        poseFlags,
        progressPct,
        job: jobs.get(video) ?? null,
      };
    });
  }

  return {
    name: 'video-library',
    configureServer(server) {
      server.middlewares.use('/__library', (req, res, next) => {
        if (req.method !== 'GET') return next();
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ videos: scan(), python: getPython() }));
      });
      server.middlewares.use('/__preprocess', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { videos, force } = JSON.parse(body || '{}');
            forceFlag = !!force;
            for (const v of videos ?? []) {
              // only queue real files inside videos/ (no path traversal into arbitrary paths)
              if (typeof v !== 'string' || v.includes('/') || v.includes('\\') || v.includes('..')) continue;
              if (!fs.existsSync(path.join(ROOT, 'videos', v))) continue;
              const cur = jobs.get(v);
              if (!cur || cur.status === 'done' || cur.status === 'error') {
                jobs.set(v, { status: 'queued', done: 0, total: 0 });
                if (!queue.includes(v)) queue.push(v);
              }
            }
            void drain();
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end('{"ok":true}');
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), annotationSaver(), videoLibrary()],
  server: {
    port: Number(process.env.VITE_PORT) || 5180,
    open: !process.env.CI && process.env.VITE_OPEN !== 'false',
  },
});
