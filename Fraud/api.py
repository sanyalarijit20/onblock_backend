from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from anomaly_detector import FraudDetector
from feature_engineering import extract_features

# Initialize app and model
app = FastAPI(title="Fraud Detection API")
detector = FraudDetector()

# Define Input Schema
class TransactionRequest(BaseModel):
    user_id: int
    amount: float
    device_id: str
    receiver: str
    # Optional history fields (in a real app, these would come from a DB)
    avg_amount: float = 500.0
    last_tx_timestamp: Optional[datetime] = None
    tx_count_last_10_min: int = 0
    last_device_id: Optional[str] = None
    known_receivers: List[str] = []

@app.get("/")
def home():
    return {"status": "active", "message": "Fraud Detector is running"}

@app.post("/check-fraud")
def check_fraud(tx: TransactionRequest):
    # 1. Prepare transaction dict
    current_tx = {
        "user_id": tx.user_id,
        "amount": tx.amount,
        "timestamp": datetime.now(),
        "device_id": tx.device_id,
        "receiver": tx.receiver
    }

    # 2. Prepare history dict
    user_history = {
        "avg_amount": tx.avg_amount,
        "last_tx_timestamp": tx.last_tx_timestamp,
        "tx_count_last_10_min": tx.tx_count_last_10_min,
        "last_device_id": tx.last_device_id,
        "known_receivers": tx.known_receivers
    }

    # 3. Enhance features
    features = extract_features(current_tx, user_history)
    
    # 4. Predict
    result = detector.predict(np.array(features))
    
    return result

import numpy as np
import uvicorn

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
