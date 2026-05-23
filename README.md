<div align="center">
  <h1>VP Mirror</h1>
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

**VP Mirror** is a distilled, lightweight version of our comprehensive multimodal data collection platform, [**Vomee**](https://doi.org/10.1145/3737904.3768536). While Vomee handles complex multimodal sensing (Video, Audio, mmWave, and Skeleton Data), **VP Mirror** is specifically designed to focus on **RGB-based visual motion capture**. It extracts the foundational capabilities of the ViTPose engine and pairs them with a beautiful graphical user interface built with `PySide6` (Qt for Python), providing seamless, out-of-the-box human pose estimation and synchronization functions for your daily research or creative needs.

---

## ✨ Key Features

- 🖥️ **Modern Cross-Platform UI**: A sleek, fully-responsive macOS-style light mode interface with a card-based side control panel and live camera preview. Works seamlessly on **Windows, macOS, and Linux**.
- 🧍 **Wholebody Detection**: Automatically detects full facial mesh, detailed finger joints, and full body skeletons using the state-of-the-art `vitpose-s-wholebody` model. *(Auto-downloads on first launch!)*
- ⚡ **Real-Time Inference Pipeline**: Powered by **YOLOv8** for rapid human bounding box detection, **SORT** for multi-person temporal tracking, and **ViTPose** for precise 2D keypoint extraction.
- 🎬 **Synchronized AV Recording Engine**: Uses a robust FFmpeg integration to perfectly synchronize live audio (from your system's microphone) with the skeleton-overlaid video. Handles hardware frame-rate jitter effortlessly by zero-padding to a strict 30 FPS.
- 📊 **CSV Data Collection**: Every time you hit record, a synchronized `.csv` dataset is generated containing frame-by-frame data for all tracking keypoints, perfectly matched to the `.mp4` video timeline.

---

## 🛠️ Prerequisites

Before you start, make sure you have FFmpeg installed on your machine:

- 🍎 **macOS**: `brew install ffmpeg`
- 🐧 **Linux (Ubuntu/Debian)**: `sudo apt install ffmpeg`
- 🪟 **Windows**: `winget install ffmpeg` *(or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/))*

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

> "Please help me set up the VP Mirror repository on my computer. 1. Detect my OS (Windows/Linux/macOS) and install `ffmpeg` if it's missing (e.g. via `brew`, `apt`, or `winget`). 2. Run `pip install -r requirements.txt` to install all Python dependencies. 3. Once installed, run `python main.py` to launch the application and let me know if there are any errors."

---

## 🎮 Usage Guide

### 🔴 Data Collection
To start collecting data, press the **"Start Recording"** button on the left panel. A live timer and frame counter will track your progress.
When you press **"Stop Recording"**, your data will be saved inside the automatically generated `output/` folder:
- 🎞️ `recording_<timestamp>.mp4` (Skeletons + Audio)
- 📈 `recording_<timestamp>.csv` (Raw Tracking Keypoints Data)

### 🐞 Troubleshooting & Debug Mode
If you encounter crashes (like macOS `SIGBUS` errors) or unexpected behavior, VP Mirror includes a built-in debugging system:
- **Enable Debug Log**: At the bottom of the left sidebar (under the Telemetry card), check the `Enable Debug Log` box.
- **Log File**: The application will instantly start writing verbose lifecycle and error logs to `vp_mirror_debug.log` in the root directory.
- *(Note: Debug mode is turned off by default to preserve performance.)*

---

## 📚 Citation

**VP Mirror** is a spin-off module from our core research platform, **Vomee**. If you find VP Mirror or Vomee helpful in your academic research, please consider citing our paper:

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

---
<div align="center">
  <sub>Built with ❤️ for multimodal researchers and developers.</sub>
</div>
