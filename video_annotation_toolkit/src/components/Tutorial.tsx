/** Right-hand welcome panel: a self-contained tutorial an annotator can read before starting. */
export default function Tutorial() {
  return (
    <div className="tutorial">
      <h2>How to use Rep Annotator</h2>
      <p className="tut-lead">
        A frame-accurate tool for turning fitness coaching videos into machine-learning ground truth.
        Everything runs locally — your videos never leave this machine.
      </p>

      <section>
        <h3>What you’ll annotate</h3>
        <p>Two layers of labels, both tied to exact frame numbers:</p>
        <ul>
          <li><strong>Rep counting</strong> — mark the start and end frame of each movement cycle (one rep), tagged with its action type.</li>
          <li><strong>Pose review</strong> — when a MediaPipe skeleton is loaded, flag individual frames where the tracked pose is wrong.</li>
        </ul>
      </section>

      <section>
        <h3>How to operate</h3>
        <ol>
          <li>Pick a video on the left. Its action labels load by file name; if a MediaPipe skeleton was pre-extracted, it loads too.</li>
          <li>Move frame-by-frame: <kbd>Space</kbd> play/pause, <kbd>←</kbd>/<kbd>→</kbd> step one frame, <kbd>J</kbd>/<kbd>K</kbd>/<kbd>L</kbd> shuttle.</li>
          <li>Choose the <strong>action type</strong>, then press <kbd>I</kbd> on the first frame of a rep and <kbd>O</kbd> on the last; press <kbd>Enter</kbd> to add the rep.</li>
          <li>On a bad pose frame, toggle an error label (<kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> …), add a note, and click <strong>Save frame</strong> (or <kbd>Ctrl/Cmd+S</kbd>).</li>
        </ol>
      </section>

      <section>
        <h3>What to focus on</h3>
        <ul>
          <li><strong>Precise boundaries.</strong> The whole value is frame accuracy — land the In/Out exactly on the first and last frame of the movement.</li>
          <li><strong>Consistent labels.</strong> Use the same action type for the same movement across the dataset.</li>
          <li><strong>Flag only real errors.</strong> Most frames are fine; flag a pose only when it’s clearly wrong (occlusion, drift, garbage).</li>
        </ul>
      </section>

      <section>
        <h3>How it saves</h3>
        <p>Everything saves automatically — there’s nothing to download.</p>
        <ul>
          <li><strong>Where</strong> — each video gets its own folder: <code>annotation/&lt;video&gt;/rep_counting.json</code> (reps) and <code>pose_analysis.json</code> (flagged frames).</li>
          <li><strong>When</strong> — edits are written within a second; the header shows the current save status.</li>
          <li><strong>Resume</strong> — reopen the same video later and your earlier labels load back automatically.</li>
        </ul>
      </section>

      <section>
        <h3>Why your labels matter</h3>
        <p>This labeled data is the ground truth for the analysis and models built on top of it:</p>
        <ul>
          <li><strong>Quantitative</strong> — rep counts, tempo and duration distributions, timing of each movement phase.</li>
          <li><strong>Qualitative</strong> — where and why pose tracking fails, to improve capture and models.</li>
          <li><strong>ML training &amp; evaluation</strong> — training rep-counting, action-recognition and pose-quality models, and scoring them against these exact frame labels.</li>
        </ul>
      </section>

      <p className="tut-foot">Press <kbd>?</kbd> at any time for the full keyboard shortcut list.</p>
    </div>
  );
}
