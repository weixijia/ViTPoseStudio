import os
from unittest.mock import patch

import numpy as np

import pose_studio_engine.framework_models as framework_models
from pose_studio_engine.framework_models import Sapiens2ExternalWrapper


def test_sapiens2_defaults_to_mps_on_macos_when_device_is_not_configured():
    env = dict(os.environ)
    env.pop("SAPIENS_DEVICE", None)

    with patch.dict(os.environ, env, clear=True), patch.object(framework_models.platform, "system", return_value="Darwin"):
        assert framework_models._default_sapiens_device() == "mps"


def test_sapiens2_predictions_json_is_converted_to_keypoint_triplets():
    wrapper = Sapiens2ExternalWrapper.__new__(Sapiens2ExternalWrapper)
    payload = {
        "frames": [
            {
                "image_name": "frame.png",
                "instances": [
                    {
                        "bbox": [0.0, 1.0, 2.0, 3.0],
                        "keypoints": [[10.0, 20.0], [30.0, 40.0]],
                        "keypoint_scores": [0.9, 0.8],
                    }
                ],
            }
        ]
    }

    keypoints = wrapper._coerce_sapiens_json(payload)

    np.testing.assert_allclose(
        keypoints[1],
        np.array([[10.0, 20.0, 0.9], [30.0, 40.0, 0.8]]),
    )
