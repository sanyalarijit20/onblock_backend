import numpy as np
from anomaly_detector import FraudDetector
from feature_engineering import extract_features

def test_system():
    print("[TEST] Initializing Fraud Detector...")
    detector = FraudDetector()
    
    # Mock data matches the training schema
    current_tx = {
        "user_id": 1,
        "amount": 500.0,
        "timestamp": 0, # Placeholder, extract_features expects datetime object though?
        "device_id": "device_1_1",
        "receiver": "merchant_A"
    }

    # Context (normally from DB)
    user_history = {
        "avg_amount": 450.0,
        "last_tx_timestamp": None,
        "tx_count_last_10_min": 1,
        "last_device_id": "device_1_1",
        "known_receivers": ["merchant_A"]
    }
    
    # Needs a real timestamp for is_night_time
    from datetime import datetime
    current_tx["timestamp"] = datetime.now()

    print("[TEST] Extracting features...")
    features = extract_features(current_tx, user_history)
    feature_vector = np.array(features)
    
    print(f"[TEST] Feature Vector: {feature_vector}")

    print("[TEST] Predicting...")
    result = detector.predict(feature_vector)
    
    print(f"[RESULT] {result}")
    
    if "decision" in result:
        print("[SUCCESS] System is working!")
    else:
        print("[FAIL] No decision returned.")

if __name__ == "__main__":
    test_system()
