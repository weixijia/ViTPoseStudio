import customtkinter as ctk
import cv2
import numpy as np
import threading
import time
import os
import sys
import csv
import subprocess
import platform
from PIL import Image

# vp_mirror_engine is bundled locally in the standalone repository
from vp_mirror_engine import VitInference

# Basic configuration
ctk.set_appearance_mode("Dark")  # Modes: "System" (standard), "Dark", "Light"
ctk.set_default_color_theme("blue")  # Themes: "blue" (standard), "green", "dark-blue"

class VPMirrorApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("VP Mirror Verson 1.0")
        self.geometry("1100x700")
        
        # Configure grid layout (1x2)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # Application state
        self.running = True
        self.latest_frame_bgr = None
        self.inference_fps = 0.0
        self.lock = threading.Lock()
        
        # Recording state
        self.is_recording = False
        self.ffmpeg_proc = None
        self.ffmpeg_thread = None
        self.csv_file = None
        self.csv_writer = None
        self.record_start_time = 0
        self.record_frame_count = 0
        
        # Setup UI
        self._build_sidebar()
        self._build_main_area()
        
        # Initialize model (run in background so UI doesn't freeze on boot)
        self.model = None
        self.overlay_text = "INITIALIZING MODEL..."
        self.status_label.configure(text="Initializing Model...")
        self.change_model("s (Small/Fast)")
        
    def _build_sidebar(self):
        # Create sidebar frame
        self.sidebar_frame = ctk.CTkFrame(self, width=250, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(6, weight=1)
        
        # Title
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="VP Mirror", font=ctk.CTkFont(size=24, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 10))
        
        # Recording Controls
        self.record_btn = ctk.CTkButton(self.sidebar_frame, text="Start Recording", fg_color="green", hover_color="darkgreen", command=self.toggle_recording)
        self.record_btn.grid(row=1, column=0, padx=20, pady=(20, 10), sticky="ew")
        
        self.rec_status_label = ctk.CTkLabel(self.sidebar_frame, text="Not Recording", text_color="gray")
        self.rec_status_label.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="w")
        
        self.rec_info_label = ctk.CTkLabel(self.sidebar_frame, text="", text_color="white", justify="left")
        self.rec_info_label.grid(row=3, column=0, padx=20, pady=(0, 20), sticky="w")
        
        # Model Selection
        self.model_label = ctk.CTkLabel(self.sidebar_frame, text="Model Accuracy:", anchor="w")
        self.model_label.grid(row=4, column=0, padx=20, pady=(10, 0), sticky="w")
        self.model_menu = ctk.CTkOptionMenu(self.sidebar_frame, values=["s (Small/Fast)", "b (Base)", "l (Large)", "h (Huge/Precise)"], command=self.change_model)
        self.model_menu.grid(row=5, column=0, padx=20, pady=(0, 20), sticky="ew")
        
        # Status / FPS display
        self.status_label = ctk.CTkLabel(self.sidebar_frame, text="Starting...", font=ctk.CTkFont(size=13))
        self.status_label.grid(row=7, column=0, padx=20, pady=20, sticky="s")
        
    def _build_main_area(self):
        # Create main display area
        self.main_frame = ctk.CTkFrame(self, corner_radius=10, fg_color="black")
        self.main_frame.grid(row=0, column=1, padx=20, pady=20, sticky="nsew")
        
        # Label to hold video
        self.video_label = ctk.CTkLabel(self.main_frame, text="")
        self.video_label.pack(expand=True, fill="both")
        
    def change_model(self, choice):
        size = choice.split(" ")[0] # gets 's', 'b', 'l', 'h'
        self.status_label.configure(text=f"Loading {size.upper()} Model...\nPlease wait.", text_color="orange", font=ctk.CTkFont(size=16, weight="bold"))
        threading.Thread(target=self._load_specific_model, args=(size,), daemon=True).start()

    def _load_specific_model(self, size="s"):
        import torch
        import urllib.request
        import shutil
        
        # Temporarily disable inference during swap
        with self.lock:
            old_model = self.model
            self.model = None
            if old_model is not None:
                del old_model
                
        # Paths
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        models_dir = os.path.join(curr_dir, 'models')
        os.makedirs(models_dir, exist_ok=True)
        
        model_filename = f'vitpose-{size}-wholebody.pth'
        model_path = os.path.join(models_dir, model_filename)
        
        # Migrate from parent directory for existing users (only checking 's' for legacy)
        base_dir = os.path.dirname(curr_dir)
        old_model_path = os.path.join(base_dir, 'vitpose-s-wholebody.pth')
        if size == 's' and not os.path.exists(model_path) and os.path.exists(old_model_path):
            try:
                shutil.move(old_model_path, model_path)
            except Exception as e:
                print(f"Could not move old model: {e}")
        
        # Fallback if wholebody doesn't exist
        dataset = 'wholebody'
        if not os.path.exists(model_path):
            self.status_label.configure(text=f"Downloading {size.upper()} model...\n(Can take minutes)", text_color="orange", font=ctk.CTkFont(size=16, weight="bold"))
            print(f"Downloading {model_filename} into models/ directory...")
            try:
                url = f"https://huggingface.co/JunkyByte/easy_ViTPose/resolve/main/torch/wholebody/{model_filename}"
                urllib.request.urlretrieve(url, model_path)
                self.status_label.configure(text=f"Download complete!\nLoading {size.upper()}...", text_color="orange", font=ctk.CTkFont(size=16, weight="bold"))
            except Exception as e:
                print(f"Failed to download model: {e}")
                self.status_label.configure(text="Download failed, using COCO.", text_color="red")
                model_path = os.path.join(models_dir, 'vitpose-s-coco.pth')
                dataset = 'coco'
                size = 's'
        else:
            self.status_label.configure(text=f"Loading {size.upper()} into memory...", text_color="orange", font=ctk.CTkFont(size=16, weight="bold"))
            
        yolo_path = os.path.join(models_dir, 'yolov8n.pt')
        old_yolo_path = os.path.join(base_dir, 'yolo8n.pt')
        old_yolov8n_path = os.path.join(base_dir, 'yolov8n.pt')
        
        if not os.path.exists(yolo_path):
            if os.path.exists(old_yolo_path):
                shutil.move(old_yolo_path, yolo_path)
            elif os.path.exists(old_yolov8n_path):
                shutil.move(old_yolov8n_path, yolo_path)
            else:
                pass
        
        # Device
        device = 'cpu'
        if torch.cuda.is_available():
            device = 'cuda'
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = 'mps'
            
        try:
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
            self.status_label.configure(text=f"Model Ready ({size.upper()} - {device})")
            
            # Start camera thread if it hasn't been started yet
            if not hasattr(self, '_camera_thread_started'):
                self._camera_thread_started = True
                threading.Thread(target=self._camera_loop, daemon=True).start()
                self.after(30, self._update_video_frame)
            
        except Exception as e:
            self.status_label.configure(text=f"Error initializing model: {str(e)}")
            print(f"Model init error: {e}")

    def _camera_loop(self):
        cap = cv2.VideoCapture(0)
        prev_time = 0
        
        while self.running:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame = cv2.flip(frame, 1)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            start_time = time.time()
            
            # Inference
            current_model = self.model
            if current_model:
                try:
                    keypoints_dict = current_model.inference(frame_rgb)
                    output_rgb = current_model.draw(
                        show_yolo=False,
                        confidence_threshold=0.3,
                        skeleton_thickness=2
                    )
                except Exception as e:
                    print(f"Inference error: {e}")
                    keypoints_dict = {}
                    output_rgb = frame_rgb
            else:
                keypoints_dict = {}
                output_rgb = frame_rgb.copy()
                
            end_time = time.time()
            elapsed = end_time - start_time
            fps = 1.0 / elapsed if elapsed > 0 else 0.0
            
            with self.lock:
                self.latest_frame_bgr = output_rgb
                self.inference_fps = fps
                
                # Write CSV data if recording
                if self.is_recording and self.csv_writer is not None:
                    elapsed = time.time() - self.record_start_time
                    for p_id, kp in keypoints_dict.items():
                        row = [self.record_frame_count, f"{elapsed:.3f}", p_id] + kp.flatten().tolist()
                        self.csv_writer.writerow(row)
                    self.record_frame_count += 1
                
        cap.release()

    def _update_video_frame(self):
        if not self.running:
            return
            
        with self.lock:
            frame_rgb = self.latest_frame_bgr
            fps = self.inference_fps
            is_rec = self.is_recording
            rec_elapsed = time.time() - self.record_start_time if is_rec else 0
            rec_frames = self.record_frame_count
            
        if is_rec:
            mins, secs = divmod(int(rec_elapsed), 60)
            self.rec_info_label.configure(text=f"Time: {mins:02d}:{secs:02d}\nFrames: {rec_frames}")
        else:
            self.rec_info_label.configure(text="")
            
        if frame_rgb is not None:
            # Resize frame to fit label while maintaining aspect ratio
            label_w = self.video_label.winfo_width()
            label_h = self.video_label.winfo_height()
            
            if label_w > 10 and label_h > 10:
                h, w, _ = frame_rgb.shape
                scale = min(label_w/w, label_h/h)
                new_w, new_h = int(w * scale), int(h * scale)
                
                if new_w > 0 and new_h > 0:
                    resized = cv2.resize(frame_rgb, (new_w, new_h))
                    
                    # Convert to PIL then CTkImage
                    img = Image.fromarray(resized)
                    ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=(new_w, new_h))
                    
                    self.video_label.configure(image=ctk_img)
            
            # Update status only if model is loaded (otherwise leave loading text)
            if self.model is not None:
                self.status_label.configure(text=f"Running | FPS: {fps:.1f}", text_color="white", font=ctk.CTkFont(size=13))
            
        self.after(30, self._update_video_frame)

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
                        # FFmpeg expects BGR
                        bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                        frame_bytes = bgr_frame.tobytes()
                        for _ in range(frames_to_write):
                            if proc.stdin:
                                proc.stdin.write(frame_bytes)
                            frames_written += 1
                    except Exception as e:
                        print(f"FFmpeg write error: {e}")
                        break
            time.sleep(0.01)
            
        # Clean up FFmpeg properly in the background when recording stops
        try:
            if proc.stdin:
                proc.stdin.close() # Sending EOF to the video stream
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            print("FFmpeg took too long to save, forcing termination...")
            proc.terminate()
            proc.wait()
        except Exception as e:
            print(f"Error closing FFmpeg: {e}")
        finally:
            # Let the UI know the video was successfully written to disk
            self.rec_status_label.configure(text="Video Saved Successfully!", text_color="#00FF00")
            # Clear the message after 3 seconds
            self.after(3000, lambda: self.rec_status_label.configure(text="Not Recording", text_color="gray"))

    def toggle_recording(self):
        with self.lock:
            if not self.is_recording:
                # Start recording
                os.makedirs("output", exist_ok=True)
                timestamp = int(time.time())
                filename = f"output/recording_{timestamp}.mp4"
                csv_filename = f"output/recording_{timestamp}.csv"
                
                # We need frame dimensions. Wait for first frame.
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
                            # Hide console window on Windows
                            CREATE_NO_WINDOW = 0x08000000
                            result = subprocess.run(['ffmpeg', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], 
                                                    stderr=subprocess.PIPE, text=True, encoding='utf-8', creationflags=CREATE_NO_WINDOW)
                            in_audio = False
                            audio_dev = None
                            for line in result.stderr.split('\n'):
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
                    
                    self.ffmpeg_proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
                    
                    self.csv_file = open(csv_filename, 'w', newline='')
                    self.csv_writer = csv.writer(self.csv_file)
                    
                    # Write CSV Headers dynamically based on the loaded model
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
                    
                    self.record_btn.configure(text="Stop Recording", fg_color="#C93B3B", hover_color="#912828")
                    self.rec_status_label.configure(text="Recording...", text_color="#C93B3B")
            else:
                # Stop recording
                self.is_recording = False
                
                # We no longer wait for FFmpeg here in the UI thread! 
                # The _ffmpeg_writer_loop background thread will handle closing 
                # stdin and waiting for the muxer to finish cleanly.
                
                if self.csv_file is not None:
                    self.csv_file.close()
                    self.csv_file = None
                    self.csv_writer = None
                self.record_btn.configure(text="Start Recording", fg_color="green", hover_color="darkgreen")
                self.rec_status_label.configure(text="Saving Video...", text_color="orange")
                self.rec_info_label.configure(text="")

    def on_closing(self):
        self.running = False
        self.is_recording = False
        
        # Give FFmpeg thread a moment to save the video safely before the app fully closes
        if self.ffmpeg_thread is not None and self.ffmpeg_thread.is_alive():
            self.status_label.configure(text="Saving video... please wait")
            self.update() # Force UI to update before we block
            self.ffmpeg_thread.join(timeout=6.0)
            
        with self.lock:
            if self.csv_file is not None:
                self.csv_file.close()
        self.destroy()
        
if __name__ == "__main__":
    app = VPMirrorApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()
