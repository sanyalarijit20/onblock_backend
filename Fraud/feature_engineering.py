"""
feature_engineering.py

Converts raw transaction + user history data into numerical
features for fraud/anomaly detection.

These features are behavior-based and user-relative,
not hard-coded rules.
"""

import pandas as pd
import numpy as np
from datetime import datetime, time


# -------------------------------
# Helper functions
# -------------------------------

def load_transaction_history(csv_path):
    """
    Loads transaction history from CSV and parses timestamps.
    """
    df = pd.read_csv(csv_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df


def build_features(history_df: pd.DataFrame, current_tx: dict) -> list:
    """
    Constructs the user history dictionary from past transactions (history_df)
    and calls extract_features.
    """
    if history_df.empty:
        user_history = {
            "avg_amount": 0,
            "last_tx_timestamp": None,
            "tx_count_last_10_min": 0,
            "last_device_id": None,
            "known_receivers": []
        }
    else:
        # Filter for this specific user if not already filtered, 
        # but the training script passes history_df sliced from the main df.
        # However, the main loop in train_isolation_forest just passes df.iloc[:i]
        # which includes ALL users. We must filter by user_id to be correct!
        
        user_id = current_tx.get("user_id")
        user_history_df = history_df[history_df["user_id"] == user_id]

        if user_history_df.empty:
             user_history = {
                "avg_amount": 0,
                "last_tx_timestamp": None,
                "tx_count_last_10_min": 0,
                "last_device_id": None,
                "known_receivers": []
            }
        else:
            # Calculate aggregates
            avg_amount = user_history_df["amount"].mean()
            last_tx = user_history_df.iloc[-1]
            last_tx_timestamp = last_tx["timestamp"]
            last_device_id = last_tx["device_id"]
            known_receivers = [] # Receiver not in synthetic data, assuming empty or need to handle

            # Count recent txs (last 10 mins)
            current_time = current_tx["timestamp"]
            ten_mins_ago = current_time - pd.Timedelta(minutes=10)
            recent_count = len(user_history_df[user_history_df["timestamp"] >= ten_mins_ago])

            user_history = {
                "avg_amount": avg_amount,
                "last_tx_timestamp": last_tx_timestamp,
                "tx_count_last_10_min": recent_count,
                "last_device_id": last_device_id,
                "known_receivers": known_receivers
            }

    return extract_features(current_tx, user_history)


def is_night_time(tx_timestamp: datetime) -> int:
    """
    Returns 1 if transaction happens between 12 AM and 5 AM,
    else returns 0.
    """
    return int(time(0, 0) <= tx_timestamp.time() <= time(5, 0))


def seconds_since_last_tx(tx_timestamp: datetime, last_tx_timestamp: datetime) -> float:
    """
    Returns time gap (in seconds) since last transaction.
    """
    if last_tx_timestamp is None:
        return 999999  # large value for first transaction
    return (tx_timestamp - last_tx_timestamp).total_seconds()


# -------------------------------
# Main Feature Extraction
# -------------------------------

def extract_features(transaction: dict, user_history: dict) -> list:
    """
    Extracts fraud detection features.

    Parameters:
    - transaction: dict containing current transaction data
    - user_history: dict containing past user behavior

    Returns:
    - feature_vector: list of numerical features
    """

    # -------------------------------
    # Raw Inputs
    # -------------------------------
    amount = transaction.get("amount", 0)
    tx_time = transaction.get("timestamp")
    device_id = transaction.get("device_id")
    receiver = transaction.get("receiver")

    avg_amount = user_history.get("avg_amount", 1)
    last_tx_time = user_history.get("last_tx_timestamp")
    recent_tx_count = user_history.get("tx_count_last_10_min", 0)
    last_device_id = user_history.get("last_device_id")
    known_receivers = user_history.get("known_receivers", [])


    # -------------------------------
    # Feature 1: Amount Anomaly
    # -------------------------------
    amount_ratio = amount / max(avg_amount, 1)


    # -------------------------------
    # Feature 2: Transaction Frequency
    # -------------------------------
    tx_frequency = recent_tx_count


    # -------------------------------
    # Feature 3: Time Gap
    # -------------------------------
    time_gap = seconds_since_last_tx(tx_time, last_tx_time)


    # -------------------------------
    # Feature 4: Device Change
    # -------------------------------
    device_change = int(device_id != last_device_id)


    # -------------------------------
    # Feature 5: Night-Time Transaction
    # -------------------------------
    night_tx = is_night_time(tx_time)


    # -------------------------------
    # Feature 6: New Receiver Address
    # -------------------------------
    new_receiver = int(receiver not in known_receivers)


    # -------------------------------
    # Final Feature Vector
    # Order matters for ML model
    # -------------------------------
    feature_vector = [
        amount_ratio,     # how abnormal the amount is
        tx_frequency,     # tx count in recent window
        time_gap,         # seconds since last tx
        device_change,    # new device or not
        night_tx,         # unusual timing
        new_receiver      # new beneficiary
    ]

    return feature_vector
