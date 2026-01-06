# train_isolation_forest.py
# Responsibility:
# Train Isolation Forest using synthetic transaction history

import sys
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest

# --------------------------------------------------
# Fix import path
# --------------------------------------------------
sys.path.append(str(Path(__file__).parent.parent))

from feature_engineering import load_transaction_history, build_features

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
DATA_PATH = Path(__file__).parent / "synthetic_transactions.csv"
MODEL_PATH = Path(__file__).parent / "isolation_forest.pkl"
RANDOM_STATE = 42

# --------------------------------------------------
# PREPARE TRAINING DATA
# --------------------------------------------------
def prepare_training_data(df):
    """
    Builds feature vectors by replaying transaction history.
    Each transaction is treated as a 'current transaction'
    with previous transactions as context.
    """
    feature_vectors = []

    for i in range(1, len(df)):
        current_tx = {
            "user_id": df.iloc[i]["user_id"],
            "amount": df.iloc[i]["amount"],
            "timestamp": df.iloc[i]["timestamp"],
            "device_id": df.iloc[i]["device_id"],
        }

        history_df = df.iloc[:i]
        features = build_features(history_df, current_tx)
        feature_vectors.append(features)

    return np.array(feature_vectors)

# --------------------------------------------------
# TRAIN MODEL
# --------------------------------------------------
def train():
    print("[INFO] Loading synthetic transaction data...")
    df = load_transaction_history(DATA_PATH)

    print("[INFO] Generating feature vectors...")
    X_train = prepare_training_data(df)

    print("[INFO] Training Isolation Forest...")
    model = IsolationForest(
        n_estimators=150,
        contamination=0.05,   # assume ~5% anomalies
        random_state=RANDOM_STATE
    )

    model.fit(X_train)

    print("[INFO] Saving model...")
    joblib.dump(model, MODEL_PATH)

    print("[SUCCESS] isolation_forest.pkl created using synthetic data!")

if __name__ == "__main__":
    train()
