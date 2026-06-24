import numpy as np

from pose_studio_engine.pose2sim_rtmlib import (
    Pose2SimRTMLibWrapper,
    _normalise_model_name,
)


def test_normalise_pose2sim_model_name():
    assert _normalise_model_name("Body With Feet") == "body_with_feet"
    assert _normalise_model_name("whole-body") == "whole_body"


def test_centroid_ignores_low_confidence_points():
    keypoints = np.array([[0.0, 0.0], [10.0, 10.0], [1000.0, 1000.0]])
    scores = np.array([0.9, 0.8, 0.1])

    centroid = Pose2SimRTMLibWrapper._centroid(keypoints, scores)

    np.testing.assert_allclose(centroid, np.array([5.0, 5.0]))


def test_track_ids_are_reused_for_nearby_people():
    wrapper = Pose2SimRTMLibWrapper.__new__(Pose2SimRTMLibWrapper)
    wrapper.keypoint_count = 2
    wrapper._next_track_id = 1
    wrapper._prev_centroids = {}
    wrapper._max_track_distance_px = 20.0

    first_keypoints = np.array([[[0.0, 0.0], [10.0, 10.0]]])
    first_scores = np.array([[0.9, 0.9]])
    second_keypoints = np.array([[[2.0, 1.0], [12.0, 11.0]]])
    second_scores = np.array([[0.9, 0.9]])

    assert wrapper._assign_track_ids(first_keypoints, first_scores) == [1]
    assert wrapper._assign_track_ids(second_keypoints, second_scores) == [1]
