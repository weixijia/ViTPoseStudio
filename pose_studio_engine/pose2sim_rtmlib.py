import json
import logging
import math
import urllib.request
from typing import Dict, Iterable, Optional, Tuple

import cv2
import numpy as np


HF_RTMLIB_MODELS_API = "https://huggingface.co/api/datasets/DavidPagnon/rtmlib_models"
HF_RTMLIB_MODELS_BASE = "https://huggingface.co/datasets/DavidPagnon/rtmlib_models/resolve/main/"


POSE2SIM_MODEL_CLASSES = {
    "body_with_feet": ("BodyWithFeet", "HALPE_26", 26),
    "lower_body": ("BodyWithFeet", "HALPE_26", 26),
    "whole_body": ("Wholebody", "COCO_133", 133),
    "whole_body_wrist": ("Wholebody", "COCO_133", 133),
    "body": ("Body", "COCO_17", 17),
}

POSE2SIM_SKELETONS = {
    "body": (
        (5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11), (6, 12),
        (11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (0, 1),
        (0, 2), (1, 3), (2, 4), (0, 5), (0, 6),
    ),
    "body_with_feet": (
        (0, 1), (0, 2), (1, 3), (2, 4), (5, 6), (5, 7), (7, 9),
        (6, 8), (8, 10), (5, 11), (6, 12), (11, 12), (11, 13),
        (13, 15), (15, 20), (15, 22), (15, 24), (12, 14), (14, 16),
        (16, 21), (16, 23), (16, 25), (20, 22), (21, 23),
    ),
}


def _normalise_model_name(model_name: str) -> str:
    return model_name.strip().lower().replace("-", "_").replace(" ", "_")


def _build_hf_url_index(timeout: float = 5.0) -> Dict[str, str]:
    with urllib.request.urlopen(HF_RTMLIB_MODELS_API, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    index = {}
    for item in payload.get("siblings", []):
        path = item.get("rfilename")
        if not path:
            continue
        filename = path.rsplit("/", 1)[-1]
        index[filename] = HF_RTMLIB_MODELS_BASE + path
    return index


def _patch_rtmlib_urls(classes: Iterable[type]) -> None:
    try:
        index = _build_hf_url_index()
    except Exception as exc:
        logging.info("Could not fetch Hugging Face RTMLib mirror index: %s", exc)
        return

    patched = 0
    for cls in classes:
        modes = getattr(cls, "MODE", None)
        if not isinstance(modes, dict):
            continue
        for cfg in modes.values():
            if not isinstance(cfg, dict):
                continue
            for key, value in list(cfg.items()):
                if not isinstance(value, str) or not value.startswith("http"):
                    continue
                filename = value.rsplit("/", 1)[-1]
                stem = filename.rsplit(".", 1)[0]
                replacement = index.get(filename) or index.get(stem + ".onnx")
                if replacement and replacement != value:
                    cfg[key] = replacement
                    patched += 1

    if patched:
        logging.info("Redirected %d RTMLib model URLs to the Hugging Face mirror.", patched)


def _select_backend_device(device: str = "auto", backend: str = "auto") -> Tuple[str, str]:
    if device != "auto" and backend != "auto":
        return backend.lower(), device.lower()

    try:
        import torch
        import onnxruntime as ort

        providers = set(ort.get_available_providers())
        if torch.cuda.is_available() and "CUDAExecutionProvider" in providers:
            return "onnxruntime", "cuda"
        if "ROCMExecutionProvider" in providers:
            return "onnxruntime", "rocm"
    except Exception:
        pass

    try:
        import openvino  # noqa: F401

        return "openvino", "cpu"
    except Exception:
        return "onnxruntime", "cpu"


class Pose2SimRTMLibWrapper:
    """Realtime adapter for MMPose RTMLib RTMPose/RTMW pose-estimation models."""

    def __init__(
        self,
        pose_model: str = "body_with_feet",
        mode: str = "balanced",
        det_frequency: int = 4,
        device: str = "auto",
        backend: str = "auto",
        tracking: bool = False,
        max_track_distance_px: float = 100.0,
        mirror_hf_models: bool = True,
    ):
        try:
            from rtmlib import Body, BodyWithFeet, PoseTracker, Wholebody, draw_skeleton
        except ModuleNotFoundError as exc:
            raise ModuleNotFoundError(
                "MMPose RTMLib mode requires RTMLib. Install dependencies with "
                "`pip install -r requirements.txt`."
            ) from exc

        self.pose_model = _normalise_model_name(pose_model)
        if self.pose_model not in POSE2SIM_MODEL_CLASSES:
            raise ValueError(f"Unsupported Pose2Sim realtime pose model: {pose_model}")

        class_name, dataset, keypoint_count = POSE2SIM_MODEL_CLASSES[self.pose_model]
        model_classes = {
            "Body": Body,
            "BodyWithFeet": BodyWithFeet,
            "Wholebody": Wholebody,
        }
        ModelClass = model_classes[class_name]

        if mirror_hf_models:
            _patch_rtmlib_urls(model_classes.values())

        self.backend, self.device = _select_backend_device(device=device, backend=backend)
        self.dataset = self.pose_model
        self.keypoint_count = keypoint_count
        self.pose2sim_dataset = dataset
        self._draw_skeleton = draw_skeleton
        self._last_img_rgb: Optional[np.ndarray] = None
        self._last_keypoints: np.ndarray = np.empty((0, keypoint_count, 2), dtype=float)
        self._last_scores: np.ndarray = np.empty((0, keypoint_count), dtype=float)
        self._next_track_id = 1
        self._prev_centroids: Dict[int, np.ndarray] = {}
        self._max_track_distance_px = max_track_distance_px

        self.pose_tracker = PoseTracker(
            ModelClass,
            det_frequency=det_frequency,
            mode=mode,
            backend=self.backend,
            device=self.device,
            tracking=tracking,
            to_openpose=False,
        )

    def inference(self, img_rgb: np.ndarray) -> Dict[int, np.ndarray]:
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        keypoints, scores = self.pose_tracker(img_bgr)

        keypoints = np.asarray(keypoints, dtype=float)
        scores = np.asarray(scores, dtype=float)
        if keypoints.ndim != 3 or scores.ndim != 2:
            keypoints = np.empty((0, self.keypoint_count, 2), dtype=float)
            scores = np.empty((0, self.keypoint_count), dtype=float)

        self._last_img_rgb = img_rgb.copy()
        self._last_keypoints = keypoints
        self._last_scores = scores

        track_ids = self._assign_track_ids(keypoints, scores)
        frame_keypoints = {}
        for track_id, person_keypoints, person_scores in zip(track_ids, keypoints, scores):
            frame_keypoints[track_id] = np.column_stack([person_keypoints, person_scores])
        return frame_keypoints

    def draw(self, show_yolo=False, confidence_threshold=0.3, skeleton_thickness=2):
        if self._last_img_rgb is None:
            return np.zeros((480, 640, 3), dtype=np.uint8)

        img_bgr = cv2.cvtColor(self._last_img_rgb, cv2.COLOR_RGB2BGR)
        try:
            drawn_bgr = self._draw_skeleton(
                img_bgr,
                self._last_keypoints,
                self._last_scores,
                kpt_thr=confidence_threshold,
            )
        except Exception:
            drawn_bgr = self._draw_fallback(
                img_bgr,
                self._last_keypoints,
                self._last_scores,
                confidence_threshold,
                skeleton_thickness,
            )
        return cv2.cvtColor(drawn_bgr, cv2.COLOR_BGR2RGB)

    def _assign_track_ids(self, keypoints: np.ndarray, scores: np.ndarray) -> list[int]:
        centroids = [self._centroid(k, s) for k, s in zip(keypoints, scores)]
        assigned_ids = []
        remaining_prev = dict(self._prev_centroids)
        next_prev = {}

        for centroid in centroids:
            best_id = None
            best_distance = math.inf
            if centroid is not None:
                for track_id, prev_centroid in remaining_prev.items():
                    distance = float(np.linalg.norm(centroid - prev_centroid))
                    if distance < best_distance:
                        best_id = track_id
                        best_distance = distance

            if best_id is None or best_distance > self._max_track_distance_px:
                best_id = self._next_track_id
                self._next_track_id += 1
            else:
                remaining_prev.pop(best_id, None)

            assigned_ids.append(best_id)
            if centroid is not None:
                next_prev[best_id] = centroid

        self._prev_centroids = next_prev
        return assigned_ids

    @staticmethod
    def _centroid(keypoints: np.ndarray, scores: np.ndarray) -> Optional[np.ndarray]:
        valid = np.isfinite(keypoints).all(axis=1) & np.isfinite(scores) & (scores > 0.2)
        if not np.any(valid):
            return None
        return np.nanmean(keypoints[valid], axis=0)

    def _draw_fallback(
        self,
        img_bgr: np.ndarray,
        keypoints: np.ndarray,
        scores: np.ndarray,
        confidence_threshold: float,
        skeleton_thickness: int,
    ) -> np.ndarray:
        skeleton = POSE2SIM_SKELETONS.get(self.pose_model, POSE2SIM_SKELETONS["body_with_feet"])
        for person_keypoints, person_scores in zip(keypoints, scores):
            for a, b in skeleton:
                if a >= len(person_keypoints) or b >= len(person_keypoints):
                    continue
                if person_scores[a] < confidence_threshold or person_scores[b] < confidence_threshold:
                    continue
                pa = tuple(np.round(person_keypoints[a]).astype(int))
                pb = tuple(np.round(person_keypoints[b]).astype(int))
                cv2.line(img_bgr, pa, pb, (114, 196, 155), skeleton_thickness)
            for point, score in zip(person_keypoints, person_scores):
                if score < confidence_threshold or not np.isfinite(point).all():
                    continue
                cv2.circle(img_bgr, tuple(np.round(point).astype(int)), 3, (0, 255, 128), -1)
        return img_bgr
