import sys
import os
import cv2
import numpy as np
import time
import threading
import subprocess
import csv
import platform
import shutil
import urllib.request
import logging

# Setup debug mode logging (Default to WARNING)
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pose_studio_debug.log", mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                               QHBoxLayout, QLabel, QPushButton, QComboBox, 
                               QFrame, QSizePolicy, QCheckBox)
from PySide6.QtCore import Qt, QThread, Signal, Slot, QTimer
from PySide6.QtGui import QImage, QPixmap, QFont, QColor

# pose_studio_engine is bundled locally in the standalone repository
from pose_studio_engine import VitInference

class YOLOPoseWrapper:
    def __init__(self, size="n", device="cpu"):
        from ultralytics import YOLO
        # We use yolov8 pose models internally
        model_name = f"yolov8{size}-pose.pt"
        logging.info(f"YOLOPoseWrapper loading {model_name} on device {device}")
        self.model = YOLO(model_name)
        self.model.to(device)
        self.dataset = 'coco' # YOLO pose defaults to 17 keypoints
        self._last_results = None

    def inference(self, img_rgb):
        # Ultralytics expects BGR numpy arrays. We receive RGB from CameraThread.
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        # Run inference with tracking to maintain person IDs
        results = self.model.track(img_bgr, persist=True, verbose=False, device=self.model.device)
        self._last_results = results[0]
        
        keypoints_dict = {}
        if self._last_results.boxes and self._last_results.boxes.id is not None:
            # boxes.id is a tensor of tracking IDs
            ids = self._last_results.boxes.id.int().cpu().tolist()
            if self._last_results.keypoints and self._last_results.keypoints.data is not None:
                # keypoints.data is shape (num_persons, 17, 3) where [x, y, conf]
                kpts_data = self._last_results.keypoints.data.cpu().numpy()
                
                for person_id, kpts in zip(ids, kpts_data):
                    keypoints_dict[person_id] = kpts
        return keypoints_dict

    def draw(self, show_yolo=False, confidence_threshold=0.3, skeleton_thickness=2):
        if self._last_results is None:
            return np.zeros((480, 640, 3), dtype=np.uint8)
        # ultralytics plot returns BGR image, we need RGB
        plotted_bgr = self._last_results.plot(
            boxes=show_yolo, 
            kpt_line=True, 
            labels=False, 
            conf=confidence_threshold,
            line_width=skeleton_thickness
        )
        return cv2.cvtColor(plotted_bgr, cv2.COLOR_BGR2RGB)

class CameraThread(QThread):
    change_pixmap_signal = Signal(QImage, float)
    
    def __init__(self, app_instance, cap):
        super().__init__()
        self.app = app_instance
        self.cap = cap
        self.running = True

    def run(self):
        logging.info("CameraThread started")
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                # Camera failed to read. Create a blank frame instead of dying.
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(frame, "Camera Offline", (200, 240), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                time.sleep(0.1)
                
            frame = cv2.flip(frame, 1)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            start_time = time.time()
            
            # Inference
            with self.app.lock:
                current_model = self.app.model
                
            if current_model:
                try:
                    keypoints_dict = current_model.inference(frame_rgb)
                    output_rgb = current_model.draw(
                        show_yolo=False,
                        confidence_threshold=0.3,
                        skeleton_thickness=2
                    )
                except Exception as e:
                    logging.error(f"Inference error: {e}")
                    keypoints_dict = {}
                    output_rgb = frame_rgb
            else:
                keypoints_dict = {}
                output_rgb = frame_rgb.copy()
                
            end_time = time.time()
            elapsed = end_time - start_time
            fps = 1.0 / elapsed if elapsed > 0 else 0.0
            
            with self.app.lock:
                self.app.latest_frame_bgr = output_rgb
                self.app.inference_fps = fps
                
                # Write CSV data if recording
                if self.app.is_recording and self.app.csv_writer is not None:
                    elapsed_rec = time.time() - self.app.record_start_time
                    for p_id, kp in keypoints_dict.items():
                        row = [self.app.record_frame_count, f"{elapsed_rec:.3f}", p_id] + kp.flatten().tolist()
                        self.app.csv_writer.writerow(row)
                    self.app.record_frame_count += 1
            
            # Convert to QImage and copy to prevent memory corruption across threads
            output_rgb = np.ascontiguousarray(output_rgb)
            h, w, ch = output_rgb.shape
            bytes_per_line = ch * w
            q_img = QImage(output_rgb.data, w, h, bytes_per_line, QImage.Format_RGB888).copy()
            
            self.change_pixmap_signal.emit(q_img, fps)

    def stop(self):
        self.running = False
        self.wait()

class PoseStudioApp(QMainWindow):
    model_status_signal = Signal(str, str)
    ffmpeg_finished_signal = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Pose Studio")
        self.setMinimumSize(1100, 700)
        
        self.model_status_signal.connect(self._update_model_status)
        self.ffmpeg_finished_signal.connect(self._on_ffmpeg_finished)
        
        # Application state
        self.lock = threading.Lock()
        self.model = None
        self.latest_frame_bgr = None
        self.inference_fps = 0.0
        
        # Recording state
        self.is_recording = False
        self.ffmpeg_proc = None
        self.ffmpeg_thread = None
        self.csv_file = None
        self.csv_writer = None
        self.record_start_time = 0
        self.record_frame_count = 0
        
        logging.info("PoseStudioApp initializing UI and setting up threads...")
        
        self._setup_ui()
        self._setup_styles()
        
        # Setup background tasks
        self.change_model("ViTPose - s (Small/Fast)")
        
        # Open camera in main thread for macOS AVFoundation safety
        self.cap = cv2.VideoCapture(0)
        
        # Start camera thread
        self.camera_thread = CameraThread(self, self.cap)
        self.camera_thread.change_pixmap_signal.connect(self.update_image)
        # MacOS QThread defaults to tiny stack (512KB) which causes OpenBLAS to crash. 
        # Set to 16MB to allow PyTorch/Numpy heavy inference.
        self.camera_thread.setStackSize(16 * 1024 * 1024) 
        self.camera_thread.start()

        # Update recording UI timer
        self.rec_timer = QTimer(self)
        self.rec_timer.timeout.connect(self._update_rec_ui)
        self.rec_timer.start(1000)

    def _setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # Sidebar
        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(300)
        sidebar_layout = QVBoxLayout(self.sidebar)
        sidebar_layout.setContentsMargins(32, 40, 32, 40)
        sidebar_layout.setSpacing(24)
        
        # Header
        self.logo_label = QLabel("Pose Studio")
        self.logo_label.setObjectName("logo")
        self.logo_label.setAlignment(Qt.AlignLeft)
        sidebar_layout.addWidget(self.logo_label)
        
        # Primary Action
        self.record_btn = QPushButton("Start Recording")
        self.record_btn.setObjectName("record_btn")
        self.record_btn.setCursor(Qt.PointingHandCursor)
        self.record_btn.clicked.connect(self.toggle_recording)
        sidebar_layout.addWidget(self.record_btn)
        
        # Settings Card
        settings_card = QFrame()
        settings_card.setObjectName("card_container")
        settings_layout = QVBoxLayout(settings_card)
        settings_layout.setContentsMargins(16, 16, 16, 16)
        settings_layout.setSpacing(8)
        
        self.model_label = QLabel("Model Accuracy")
        self.model_label.setObjectName("section_title")
        self.model_label.setAlignment(Qt.AlignLeft)
        settings_layout.addWidget(self.model_label)
        
        self.model_menu = QComboBox()
        self.model_menu.setCursor(Qt.PointingHandCursor)
        self.model_menu.addItems([
            "ViTPose - s (Small/Fast)", 
            "ViTPose - b (Base)", 
            "ViTPose - l (Large)", 
            "ViTPose - h (Huge/Precise)",
            "YOLO26 - n (Nano/Fastest)",
            "YOLO26 - s (Small)",
            "YOLO26 - m (Medium)",
            "YOLO26 - l (Large)"
        ])
        self.model_menu.currentTextChanged.connect(self.change_model)
        settings_layout.addWidget(self.model_menu)
        sidebar_layout.addWidget(settings_card)
        
        sidebar_layout.addStretch()
        
        # Status Card
        status_card = QFrame()
        status_card.setObjectName("card_container")
        status_layout = QVBoxLayout(status_card)
        status_layout.setContentsMargins(16, 16, 16, 16)
        status_layout.setSpacing(8)
        
        status_title = QLabel("Telemetry")
        status_title.setObjectName("section_title")
        status_title.setAlignment(Qt.AlignLeft)
        status_layout.addWidget(status_title)
        
        self.rec_status_label = QLabel("Not Recording")
        self.rec_status_label.setObjectName("status_text")
        self.rec_status_label.setAlignment(Qt.AlignLeft)
        status_layout.addWidget(self.rec_status_label)
        
        self.rec_info_label = QLabel("")
        self.rec_info_label.setObjectName("status_text")
        self.rec_info_label.setAlignment(Qt.AlignLeft)
        status_layout.addWidget(self.rec_info_label)
        
        self.status_label = QLabel("Starting...")
        self.status_label.setObjectName("status_text")
        self.status_label.setAlignment(Qt.AlignLeft)
        self.status_label.setWordWrap(True)
        status_layout.addWidget(self.status_label)
        
        sidebar_layout.addWidget(status_card)
        
        # Subtle Debug Toggle
        self.debug_checkbox = QCheckBox("Enable Debug Log")
        self.debug_checkbox.setObjectName("debug_checkbox")
        self.debug_checkbox.stateChanged.connect(self.toggle_debug_mode)
        sidebar_layout.addWidget(self.debug_checkbox, alignment=Qt.AlignLeft)
        
        # Main Display Area
        self.main_area = QFrame()
        self.main_area.setObjectName("main_area")
        main_layout_area = QVBoxLayout(self.main_area)
        main_layout_area.setContentsMargins(32, 32, 32, 32)
        
        self.video_container = QFrame()
        self.video_container.setObjectName("video_container")
        video_layout = QVBoxLayout(self.video_container)
        video_layout.setContentsMargins(0, 0, 0, 0)
        
        self.video_label = QLabel()
        self.video_label.setAlignment(Qt.AlignCenter)
        video_layout.addWidget(self.video_label)
        
        main_layout_area.addWidget(self.video_container)
        
        main_layout.addWidget(self.sidebar)
        main_layout.addWidget(self.main_area)

    def _setup_styles(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #f5f5f7;
            }
            #sidebar {
                background-color: #ffffff;
                border-right: none;
            }
            #logo {
                font-size: 24px;
                font-weight: 700;
                color: #1d1d1f;
                letter-spacing: -0.5px;
                margin-left: 4px;
            }
            #record_btn {
                background-color: #000000;
                color: white;
                font-size: 14px;
                font-weight: 600;
                padding: 12px;
                border-radius: 8px;
                border: none;
                margin-top: 4px;
            }
            #record_btn:hover {
                background-color: #333333;
            }
            #record_btn[recording="true"] {
                background-color: #e30000;
            }
            #record_btn[recording="true"]:hover {
                background-color: #b30000;
            }
            #card_container {
                background-color: #fbfbfd;
                border-radius: 12px;
                border: 1px solid #eaeaec;
            }
            #section_title {
                color: #86868b;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
            }
            #status_text {
                color: #333336;
                font-size: 13px;
                font-weight: 500;
                line-height: 1.4;
            }
            QComboBox {
                background-color: #ffffff;
                color: #1d1d1f;
                border: 1px solid #d2d2d7;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
            }
            QComboBox::drop-down {
                border: none;
            }
            #debug_checkbox {
                color: #a1a1a6;
                font-size: 12px;
                margin-left: 4px;
            }
            #debug_checkbox::indicator {
                width: 12px;
                height: 12px;
            }
            #main_area {
                background-color: #f5f5f7;
            }
            #video_container {
                background-color: #000000;
                border-radius: 20px;
            }
        """)

    @Slot(QImage, float)
    def update_image(self, q_img, fps):
        # Scale image to fit container while maintaining aspect ratio
        container_w = self.video_container.width()
        container_h = self.video_container.height()
        
        if container_w > 10 and container_h > 10:
            scaled_q_img = q_img.scaled(container_w, container_h, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.video_label.setPixmap(QPixmap.fromImage(scaled_q_img))
                
        if self.model is not None:
            self.status_label.setText(f"Running | FPS: {fps:.1f}")
            self.status_label.setStyleSheet("color: #1d1d1f; font-weight: 500;")

    def _update_rec_ui(self):
        with self.lock:
            is_rec = self.is_recording
            rec_elapsed = time.time() - self.record_start_time if is_rec else 0
            rec_frames = self.record_frame_count
            
        if is_rec:
            mins, secs = divmod(int(rec_elapsed), 60)
            self.rec_info_label.setText(f"Time: {mins:02d}:{secs:02d}\nFrames: {rec_frames}")
        else:
            self.rec_info_label.setText("")

    def toggle_debug_mode(self, state):
        if state == 2: # Qt.Checked is int 2
            logging.getLogger().setLevel(logging.DEBUG)
            logging.info("Debug mode activated via UI")
        else:
            logging.info("Debug mode deactivated via UI")
            logging.getLogger().setLevel(logging.WARNING)

    def change_model(self, choice):
        parts = choice.split("-")
        model_type = parts[0].strip()
        size = parts[1].strip().split(" ")[0] # gets 's', 'b', 'l', 'h' or 'n', 's', 'm', 'l'
        
        self.status_label.setText(f"Loading {model_type} {size.upper()}...\nPlease wait.")
        self.status_label.setStyleSheet("color: #d97706; font-weight: 600;")
        threading.Thread(target=self._load_specific_model, args=(model_type, size), daemon=True).start()

    @Slot(str, str)
    def _update_model_status(self, text, color):
        self.status_label.setText(text)
        self.status_label.setStyleSheet(f"color: {color}; font-weight: 600;")

    def _load_specific_model(self, model_type="ViTPose", size="s"):
        import torch
        logging.info(f"Requested model change to type: {model_type}, size: {size}")
        # Temporarily disable inference during swap
        with self.lock:
            old_model = self.model
            self.model = None
            if old_model is not None:
                del old_model
                
        device = 'cpu'
        if torch.cuda.is_available():
            device = 'cuda'
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = 'mps'

        if model_type == "YOLO26":
            try:
                logging.info(f"Instantiating YOLO Pose wrapper with device={device}")
                new_model = YOLOPoseWrapper(size=size, device=device)
                with self.lock:
                    self.model = new_model
                logging.info("YOLO Pose model instantiated successfully")
                self.model_status_signal.emit(f"Model Ready ({model_type}-{size.upper()} - {device})", "#059669")
            except Exception as e:
                logging.error(f"Model init error: {e}", exc_info=True)
                self.model_status_signal.emit(f"Error: {e}", "#e30000")
            return

        # Paths for ViTPose
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(curr_dir, 'models')
        os.makedirs(models_dir, exist_ok=True)
        
        model_filename = f'vitpose-{size}-wholebody.pth'
        model_path = os.path.join(models_dir, model_filename)
        
        base_dir = os.path.dirname(curr_dir)
        old_model_path = os.path.join(base_dir, 'vitpose-s-wholebody.pth')
        if size == 's' and not os.path.exists(model_path) and os.path.exists(old_model_path):
            try:
                shutil.move(old_model_path, model_path)
                logging.info(f"Moved old model from {old_model_path} to {model_path}")
            except Exception as e:
                logging.warning(f"Could not move old model: {e}")
                
        dataset = 'wholebody'
        if not os.path.exists(model_path):
            self.status_label.setText(f"Downloading {size.upper()} model...\n(Can take minutes)")
            logging.info(f"Downloading model {model_filename} from HuggingFace...")
            try:
                url = f"https://huggingface.co/JunkyByte/easy_ViTPose/resolve/main/torch/wholebody/{model_filename}"
                urllib.request.urlretrieve(url, model_path)
                logging.info("Model download complete.")
            except Exception as e:
                logging.error(f"Failed to download model: {e}")
                model_path = os.path.join(models_dir, 'vitpose-s-coco.pth')
                dataset = 'coco'
                size = 's'
        
        yolo_path = os.path.join(models_dir, 'yolov8n.pt')
        old_yolo_path = os.path.join(base_dir, 'yolo8n.pt')
        old_yolov8n_path = os.path.join(base_dir, 'yolov8n.pt')
        
        if not os.path.exists(yolo_path):
            if os.path.exists(old_yolo_path):
                shutil.move(old_yolo_path, yolo_path)
            elif os.path.exists(old_yolov8n_path):
                shutil.move(old_yolov8n_path, yolo_path)
        
        device = 'cpu'
        if torch.cuda.is_available():
            device = 'cuda'
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = 'mps'
            
        try:
            logging.info(f"Instantiating VitInference with device={device}, dataset={dataset}")
            new_model = VitInference(
                model_path,
                yolo_path,
                model_name=size,
                yolo_size=320,
                is_video=True,
                device=device,
                dataset=dataset,
                yolo_step=1
            )
            with self.lock:
                self.model = new_model
            logging.info("VitInference model instantiated successfully")
            self.model_status_signal.emit(f"Model Ready ({size.upper()} - {device})", "#059669")
        except Exception as e:
            logging.error(f"Model init error: {e}", exc_info=True)
            self.model_status_signal.emit(f"Error: {e}", "#e30000")

    def _ffmpeg_writer_loop(self, proc):
        target_fps = 30.0
        start_time = time.time()
        frames_written = 0
        
        while self.is_recording and proc.poll() is None:
            elapsed = time.time() - start_time
            target_frames = int(elapsed * target_fps)
            frames_to_write = target_frames - frames_written
            
            if frames_to_write > 0:
                with self.lock:
                    frame = self.latest_frame_bgr
                    
                if frame is not None:
                    try:
                        bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                        frame_bytes = bgr_frame.tobytes()
                        for _ in range(frames_to_write):
                            if proc.stdin:
                                proc.stdin.write(frame_bytes)
                            frames_written += 1
                    except Exception as e:
                        logging.error(f"FFmpeg write error: {e}")
                        break
            time.sleep(0.01)
            
        try:
            if proc.stdin:
                proc.stdin.close()
            proc.wait(timeout=5)
            logging.info(f"FFmpeg loop finished, wrote {frames_written} frames.")
        except subprocess.TimeoutExpired:
            logging.warning("FFmpeg timeout expired, terminating.")
            proc.terminate()
            proc.wait()
        except Exception as e:
            logging.error(f"Error closing FFmpeg: {e}")
        finally:
            self.ffmpeg_finished_signal.emit()

    @Slot()
    def _on_ffmpeg_finished(self):
        self.rec_status_label.setText("Video Saved Successfully!")
        self.rec_status_label.setStyleSheet("color: #059669;")
        QTimer.singleShot(3000, lambda: self.rec_status_label.setText("Not Recording"))
        QTimer.singleShot(3000, lambda: self.rec_status_label.setStyleSheet("color: #86868b;"))

    def toggle_recording(self):
        with self.lock:
            if not self.is_recording:
                os.makedirs("output", exist_ok=True)
                timestamp = int(time.time())
                filename = f"output/recording_{timestamp}.mp4"
                csv_filename = f"output/recording_{timestamp}.csv"
                
                if self.latest_frame_bgr is not None:
                    h, w, _ = self.latest_frame_bgr.shape
                    
                    sys_os = platform.system()
                    cmd = [
                        'ffmpeg', '-y',
                        '-f', 'rawvideo',
                        '-vcodec', 'rawvideo',
                        '-s', f'{w}x{h}',
                        '-pix_fmt', 'bgr24',
                        '-r', '30',
                        '-i', '-',
                    ]
                    
                    if sys_os == 'Darwin':
                        cmd.extend(['-f', 'avfoundation', '-i', ':0', '-c:a', 'aac', '-shortest'])
                    elif sys_os == 'Linux':
                        cmd.extend(['-f', 'pulse', '-i', 'default', '-c:a', 'aac', '-shortest'])
                    elif sys_os == 'Windows':
                        try:
                            CREATE_NO_WINDOW = 0x08000000
                            result = subprocess.run(['ffmpeg', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], 
                                                    stderr=subprocess.PIPE, text=True, encoding='utf-8', creationflags=CREATE_NO_WINDOW)
                            in_audio = False
                            audio_dev = None
                            for line in result.stderr.split('\\n'):
                                if "DirectShow audio devices" in line:
                                    in_audio = True
                                elif "DirectShow video devices" in line:
                                    in_audio = False
                                elif in_audio and '"' in line:
                                    audio_dev = line.split('"')[1]
                                    break
                            if audio_dev:
                                cmd.extend(['-f', 'dshow', '-i', f'audio={audio_dev}', '-c:a', 'aac', '-shortest'])
                        except:
                            pass
                            
                    cmd.extend([
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        filename
                    ])
                    
                    logging.info(f"Starting FFmpeg with cmd: {' '.join(cmd)}")
                    self.ffmpeg_proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
                    
                    self.csv_file = open(csv_filename, 'w', newline='')
                    self.csv_writer = csv.writer(self.csv_file)
                    
                    dataset_name = getattr(self.model, 'dataset', 'wholebody') if self.model else 'wholebody'
                    num_kps = 133 if dataset_name == 'wholebody' else 17
                    
                    header = ["frame_index", "timestamp_sec", "person_id"]
                    for i in range(num_kps):
                        header.extend([f"k{i}_x", f"k{i}_y", f"k{i}_conf"])
                    self.csv_writer.writerow(header)
                    
                    self.is_recording = True
                    self.record_start_time = time.time()
                    self.record_frame_count = 0
                    
                    self.ffmpeg_thread = threading.Thread(target=self._ffmpeg_writer_loop, args=(self.ffmpeg_proc,), daemon=True)
                    self.ffmpeg_thread.start()
                    
                    self.record_btn.setText("Stop Recording")
                    self.record_btn.setProperty("recording", "true")
                    self.record_btn.style().unpolish(self.record_btn)
                    self.record_btn.style().polish(self.record_btn)
                    
                    self.rec_status_label.setText("Recording...")
                    self.rec_status_label.setStyleSheet("color: #e30000;")
            else:
                logging.info("Stopping recording process.")
                self.is_recording = False
                
                if self.csv_file is not None:
                    self.csv_file.close()
                    self.csv_file = None
                    self.csv_writer = None
                    
                self.record_btn.setText("Start Recording")
                self.record_btn.setProperty("recording", "false")
                self.record_btn.style().unpolish(self.record_btn)
                self.record_btn.style().polish(self.record_btn)
                
                self.rec_status_label.setText("Saving Video...")
                self.rec_status_label.setStyleSheet("color: #d97706;")
                self.rec_info_label.setText("")

    def closeEvent(self, event):
        self.is_recording = False
        
        if self.ffmpeg_thread is not None and self.ffmpeg_thread.is_alive():
            self.ffmpeg_thread.join(timeout=6.0)
            
        with self.lock:
            if self.csv_file is not None:
                self.csv_file.close()
                
        self.camera_thread.stop()
        if hasattr(self, 'cap') and self.cap.isOpened():
            self.cap.release()
            
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # Modern font
    font = QFont("Helvetica Neue", 10)
    font.setStyleHint(QFont.SansSerif)
    app.setFont(font)
    
    window = PoseStudioApp()
    window.show()
    sys.exit(app.exec())
