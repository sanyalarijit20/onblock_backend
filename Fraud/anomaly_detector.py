# anomaly_detector.py
# Responsibility:
# Take a numerical feature vector and decide:
# ALLOW / FLAG / BLOCK using Isolation Forest

import numpy as np
import joblib
from pathlib import Path


# -----------------------------
# CONFIG
# -----------------------------
MODEL_PATH = Path(__file__).parent / "isolation_forest.pkl"

# Thresholds (can be tuned)
ALLOW_THRESHOLD = 0.6
FLAG_THRESHOLD = 0.3
# score < FLAG_THRESHOLD → BLOCK


# -----------------------------
# LOAD MODEL (once)
# -----------------------------
class FraudDetector:
    def __init__(self):
        self.model = joblib.load(MODEL_PATH)

    def predict(self, feature_vector: np.ndarray) -> dict:
        """
        Returns fraud score and decision.
        """

        # Ensure correct shape
        feature_vector = feature_vector.reshape(1, -1)

        # Isolation Forest score
        # Higher = more normal
        score = self.model.decision_function(feature_vector)[0]

        # -----------------------------
        # Decision logic
        # -----------------------------
        if score >= ALLOW_THRESHOLD:
            decision = "ALLOW"
            reason = "Transaction matches normal behavior"

        elif score >= FLAG_THRESHOLD:
            decision = "FLAG"
            reason = "Unusual behavior detected — extra verification required"

        else:
            decision = "BLOCK"
            reason = "High fraud risk detected"

        return {
            "fraud_score": float(score),
            "decision": decision,
            "reason": reason
        }
