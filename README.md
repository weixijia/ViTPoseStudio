<div align="center">
  <h1>Pose Studio</h1>
  <p><strong>A Modern, Cross-Platform Desktop Application for Real-Time Skeleton Pose Estimation</strong></p>
  <p>
    <a href="https://github.com/weixijia/ViTPoseStudio/stargazers"><img src="https://img.shields.io/github/stars/weixijia/ViTPoseStudio" alt="Stars Badge"/></a>
    <a href="https://github.com/weixijia/ViTPoseStudio/network/members"><img src="https://img.shields.io/github/forks/weixijia/ViTPoseStudio" alt="Forks Badge"/></a>
    <a href="https://github.com/weixijia/ViTPoseStudio/pulls"><img src="https://img.shields.io/github/issues-pr/weixijia/ViTPoseStudio" alt="Pull Requests Badge"/></a>
    <a href="https://github.com/weixijia/ViTPoseStudio/issues"><img src="https://img.shields.io/github/issues/weixijia/ViTPoseStudio" alt="Issues Badge"/></a>
  </p>
  
  <h3>🌐 <a href="https://xijiawei.com/ViTPoseStudio/">Visit the Official Website</a></h3>
</div>

<br/>

**Pose Studio** is a distilled, lightweight version of our comprehensive multimodal data collection platform, [**Vomee**](https://doi.org/10.1145/3737904.3768536). While Vomee handles complex multimodal sensing (Video, Audio, mmWave, and Skeleton Data), **Pose Studio** is specifically designed to focus on **RGB-based visual motion capture**. It supports MMPose RTMLib, Sapiens2, ViTPose, and YOLO pose models through a filtered model selector.

---

## ✨ Key Features

- 🖥️ **Modern Cross-Platform UI**: A sleek, fully-responsive macOS-style light mode interface with a card-based side control panel and live camera preview. Works seamlessly on **Windows, macOS, and Linux**.
- 🧍 **Filtered Pose Model Selector**: Select by provider and keypoint coverage, then choose among RTMPose, RTMW, Sapiens2, ViTPose, and YOLO pose models.
- ⚡ **Independent Framework Processes**: Loads Sapiens2, MMPose RTMLib models, ViTPose, and YOLO in separate worker processes so framework dependencies do not share one runtime.
- 🧪 **Mac-Oriented Defaults**: Starts from RTMPose-S Body+Feet, while keeping heavier whole-body and offline options selectable.
- 🎬 **Synchronized AV Recording Engine**: Uses a robust FFmpeg integration to perfectly synchronize live audio (from your system's microphone) with the skeleton-overlaid video. Handles hardware frame-rate jitter effortlessly by zero-padding to a strict 30 FPS.
- 📊 **CSV Data Collection**: Every time you hit record, a synchronized `.csv` dataset is generated containing frame-by-frame data for all tracking keypoints, perfectly matched to the `.mp4` video timeline.

---

## 🛠️ Prerequisites

Before you start, make sure you have FFmpeg installed on your machine:

- 🍎 **macOS**: `brew install ffmpeg`
- 🐧 **Linux (Ubuntu/Debian)**: `sudo apt install ffmpeg`
- 🪟 **Windows**: `winget install ffmpeg` *(or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/))*

Pose Studio opens with MMPose RTMLib / RTMPose-S Body+Feet selected for realtime use. Upstream Sapiens2 requires Python 3.12+ and PyTorch 2.7+, so on macOS we recommend a dedicated `pose-sapiens` conda environment and keeping any older `pose` environment as a backup when you want to test Sapiens2.

Configure the Mac Sapiens2 environment with:

```bash
conda create -n pose-sapiens python=3.12 -y
conda activate pose-sapiens
pip install torch==2.8.0 torchvision==0.23.0
pip install -r requirements.txt

git clone https://github.com/facebookresearch/sapiens2
cd sapiens2
pip install -e .

conda env config vars set -n pose-sapiens \
  SAPIENS_ROOT=/path/to/sapiens2 \
  SAPIENS_CHECKPOINT_ROOT=~/sapiens2_host \
  SAPIENS_DEVICE=mps

conda deactivate
conda activate pose-sapiens

hf download facebook/sapiens2-pose-0.4b sapiens2_0.4b_pose.safetensors --local-dir "$SAPIENS_CHECKPOINT_ROOT/pose"
hf download facebook/detr-resnet-101-dc5 --local-dir "$SAPIENS_CHECKPOINT_ROOT/detector/detr-resnet-101-dc5"
```

Mac reality check: RTMPose is the practical local realtime route on Apple Silicon when body pose is the priority. Pose Studio defaults to RTMPose-S Body+Feet with every-frame detection and RTMLib tracking disabled, because RTMW whole-body models spend extra compute on face and hand keypoints and the balanced whole-body model can fluctuate on CPU when the detector and pose model run in the same realtime loop. Sapiens2 is the frontier route, but even 0.4B can run at very low FPS on Mac because it performs high-resolution 308-keypoint top-down inference with a separate person detector. Pose Studio therefore defaults to RTMPose, with RTMW and Sapiens2 kept as explicit high-detail options.

The realtime backend runs through `rtmlib`, which provides MMPose RTMPose/RTMW ONNX models without requiring the full offline Pose2Sim workflow. On macOS the app defaults these RTMLib models to ONNX Runtime CPU instead of CoreML, because the available CoreML provider can process frames but fail to return drawable skeleton tensors for these ONNX exports. The full `pose2sim` package is intentionally not in the default Mac requirements because it pulls in PyAV, which can load FFmpeg/AVFoundation dylibs that conflict with OpenCV on macOS. Install full Pose2Sim in a separate environment if you need offline multiview kinematics.

---

## 🚀 Quick Start

### Option 1: Manual Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/weixijia/ViTPoseStudio.git
   cd ViTPoseStudio
   ```
2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Launch the application:**
   ```bash
   python main.py
   ```

### Option 2: AI Agent Prompt (One-Click Setup)

If you are using an AI coding assistant (like GitHub Copilot, Cursor, or Gemini) to deploy this repo for you, just copy and paste this exact prompt into the chat:

> "Please help me set up the Pose Studio repository on my computer. 1. Detect my OS (Windows/Linux/macOS) and install `ffmpeg` if it's missing (e.g. via `brew`, `apt`, or `winget`). 2. Run `pip install -r requirements.txt` to install all Python dependencies. 3. Once installed, run `python main.py` to launch the application and let me know if there are any errors."

---

## 🎮 Usage Guide

### 🔴 Data Collection
To start collecting data, press the **"Start Recording"** button on the left panel. A live timer and frame counter will track your progress.
When you press **"Stop Recording"**, your data will be saved inside the automatically generated `output/` folder:
- 🎞️ `recording_<timestamp>.mp4` (Skeletons + Audio)
- 📈 `recording_<timestamp>.csv` (Raw Tracking Keypoints Data)

### 🐞 Troubleshooting & Debug Mode
If you encounter crashes (like macOS `SIGBUS` errors) or unexpected behavior, Pose Studio includes a built-in debugging system:
- **Enable Debug Log**: At the bottom of the left sidebar (under the Telemetry card), check the `Enable Debug Log` box.
- **Log File**: The application will instantly start writing verbose lifecycle and error logs to `pose_studio_debug.log` in the root directory.
- *(Note: Debug mode is turned off by default to preserve performance.)*

---

## 📚 Citation

**Pose Studio** is a spin-off module from our core research platform, **Vomee**. If you find Pose Studio or Vomee helpful in your academic research, please consider citing our paper:

```bibtex
@inproceedings{10.1145/3737904.3768536,
  author = {Wei, Xijia and Fang, Yuan and Chetty, Kevin and Cho, Youngjun and Bianchi-Berthouze, Nadia},
  title = {Vomee: A Multimodal Sensing Platform for Video, Audio, mmWave and Skeleton Data Capturing},
  year = {2025},
  isbn = {9798400719813},
  publisher = {Association for Computing Machinery},
  address = {New York, NY, USA},
  url = {https://doi.org/10.1145/3737904.3768536},
  doi = {10.1145/3737904.3768536},
  booktitle = {Proceedings of the 2025 ACM Workshop on Access Networks with Artificial Intelligence},
  pages = {36--40},
  numpages = {5},
  keywords = {mmWave Sensing, Human Activity Recognition, Multimodal Motion Capture},
  series = {MobiCom '25}
}
```

Pose Studio includes **Sapiens2** as an offline/frontier pose framework. Please cite Sapiens2 when you use the Sapiens2 engine:

```bibtex
@article{khirodkarsapiens2,
  title={Sapiens2: Foundation for Human Vision Models},
  author={Khirodkar, Rawal and Bagautdinov, Timur and Martinez, Julieta and Zhao, Su and James, Stephen and Selednik, Peter and Anderson, Stuart and Saito, Shunsuke},
  journal={arXiv preprint arXiv:2604.21681},
  year={2026}
}
```

Pose Studio includes **Ultralytics YOLO** pose models as selectable lightweight pose engines. Please cite their work if you use YOLO models:

```bibtex
@software{yolo_ultralytics,
  author = {Glenn Jocher and Jing Qiu},
  title = {Ultralytics YOLO},
  year = {2026},
  url = {https://github.com/ultralytics/ultralytics},
  license = {AGPL-3.0}
}
```

Pose Studio can interoperate with **Pose2Sim** workflows through RTMLib-compatible keypoint formats. Please cite Pose2Sim when you use the full Pose2Sim pipeline:

```bibtex
@Article{Pagnon_2022_JOSS,
  AUTHOR = {Pagnon, David and Domalain, Mathieu and Reveret, Lionel},
  TITLE = {Pose2Sim: An open-source Python package for multiview markerless kinematics},
  JOURNAL = {Journal of Open Source Software},
  YEAR = {2022},
  DOI = {10.21105/joss.04362},
  URL = {https://joss.theoj.org/papers/10.21105/joss.04362}
}
```

---
<div align="center">
  <sub>Built with ❤️ for multimodal researchers and developers.</sub>
</div>
