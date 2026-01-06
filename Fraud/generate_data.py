import csv
import random
from datetime import datetime, timedelta

# =========================
# CONFIG
# =========================
NUM_USERS = 50
TX_PER_USER = 40
OUTPUT_FILE = "synthetic_transactions.csv"

# =========================
# HELPERS
# =========================
def random_time(start):
    return start + timedelta(seconds=random.randint(10, 3600))

# =========================
# DATA GENERATION
# =========================
rows = []
header = [
    "user_id",
    "amount",
    "timestamp",
    "device_id",
    "receiver",
    "hour",
    "is_night",
    "time_gap",
    "device_change",
    "location_change",
    "is_fraud"
]

start_time = datetime.now()

for user_id in range(1, NUM_USERS + 1):
    last_time = start_time
    
    # Track current state
    current_device_id = f"device_{user_id}_1"
    current_receiver = f"merchant_{user_id}_1"
    
    known_devices = [current_device_id]
    known_location = "loc_1"

    for _ in range(TX_PER_USER):
        tx_time = random_time(last_time)
        time_gap = (tx_time - last_time).total_seconds()
        last_time = tx_time

        hour = tx_time.hour
        is_night = 1 if hour < 5 else 0

        amount = round(random.uniform(50, 2000), 2)

        # Behavior changes
        # 10% chance to use a new device
        if random.random() < 0.1:
            current_device_id = f"device_{user_id}_{random.randint(2, 100)}"
            device_change = 1
        else:
            device_change = 0

        # Receiver logic: 80% chance to use a known receiver (or same one), 20% new
        if random.random() < 0.2:
             current_receiver = f"merchant_{random.randint(100, 999)}"
        # else keep current_receiver (simplified) or pick from known. 
        # For simplicity, let's just say "receiver" is this value.
        
        location_change = 1 if random.random() < 0.08 else 0

        # FRAUD LOGIC (synthetic)
        is_fraud = 0
        if (
            amount > 1500 and
            is_night and
            time_gap < 30
        ):
            is_fraud = 1

        rows.append([
            user_id,
            amount,
            tx_time.isoformat(),
            current_device_id,
            current_receiver,
            hour,
            is_night,
            time_gap,
            device_change,
            location_change,
            is_fraud
        ])

# =========================
# WRITE CSV
# =========================
with open(OUTPUT_FILE, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print(f"[SUCCESS] Dataset generated: {OUTPUT_FILE}")
print(f"[INFO] Total transactions: {len(rows)}")
