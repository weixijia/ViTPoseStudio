# ViTPose Studio

ViTPose Studio is a completely overhauled, modern cross-platform desktop application for high-performance, real-time skeleton pose estimation. It extracts the foundational capabilities of the ViTPose engine and pairs them with a beautiful graphical user interface built with `customtkinter`.

## Features
- **Modern Cross-Platform UI**: Sleek, fully-responsive dark-mode interface with a side control panel and live camera preview. Works seamlessly on Windows, macOS, and Linux.
- **Wholebody Detection**: Automatically detects full facial mesh, detailed finger joints, and full body skeletons using the `vitpose-s-wholebody` model. (Auto-downloads on first launch!)
- **Synchronized AV Recording Engine**: Uses a robust FFmpeg integration to perfectly synchronize live audio (from your system's microphone) with the skeleton-overlaid video. Handles hardware frame-rate jitter effortlessly by zero-padding to a strict 30 FPS.
- **CSV Data Collection**: Every time you hit record, a synchronized `.csv` dataset is generated containing frame-by-frame data for all tracking keypoints, perfectly matched to the `.mp4` video timeline.

## Prerequisites
- **FFmpeg**: Must be installed on your system. 
  - **macOS**: `brew install ffmpeg`
  - **Linux (Ubuntu/Debian)**: `sudo apt install ffmpeg`
  - **Windows**: `winget install ffmpeg` or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/)
- **Python Dependencies**:
  ```bash
  pip install -r requirements.txt
  ```

## Quick Setup (AI Agent Prompt)
If you are using an AI agent (like me) to deploy this repo for you, just copy and paste this exact prompt:
> "Please help me set up the ViTPoseStudio repository on my computer. 1. Detect my OS (Windows/Linux/macOS) and install `ffmpeg` if it's missing (e.g. via `brew`, `apt`, or `winget`). 2. Run `pip install -r requirements.txt` to install all Python dependencies. 3. Once installed, run `python main.py` to launch the application and let me know if there are any errors."

## Usage
Simply run the main application file from within your environment:

```bash
python main.py
```

### Data Collection
To start collecting data, press the **"Start Recording"** button on the left panel. A live timer and frame counter will track your progress.
When you press **"Stop Recording"**, your data will be saved inside the `output/` folder:
- `recording_<timestamp>.mp4` (Skeletons + Audio)
- `recording_<timestamp>.csv` (Raw Tracking Keypoints)
