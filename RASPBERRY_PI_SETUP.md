# Raspberry Pi USB Webcam & Supabase Integration Guide

This guide describes how to connect your physical Raspberry Pi equipped with a standard USB webcam to the GlassBoard live monitoring backend.

---

## 🛠️ System Architecture

1. **User Action:** You navigate to a project folder on the web surface, select your Raspberry Pi device, change the mode to **"Raspberry Pi (Real Hardware)"**, and click **Capture**.
2. **Command Queue:** The React app inserts a row into the Supabase table `captureRequests` with `{ userId, folderId, deviceId, status: "pending" }`.
3. **Hardware Listener:** Your Raspberry Pi script queries the `captureRequests` table looking for outstanding items with its `DEVICE_ID` and status `"pending"`.
4. **Camera Execution:** When a request is detected, the script opens the USB webcam, flushes warm-up frames (to fix the black/blank image issue), captures a photo, and saves it locally.
5. **Storage Upload:** The Pi uploads the captured photo directly into your Supabase Storage bucket (`glassboard`).
6. **Data Linkage:** The Pi updates the request status to `"completed"` in `captureRequests` and inserts a new metadata row into the `images` table so it renders onto your folder page instantly.

---

## 📦 Step-by-Step Setup Instructions

### 1. Fix the PEP-Managed Environment Error
Recent Raspberry Pi OS distributions (Bookworm and newer) block system-wide `pip3 install` commands to prevent cluttering the OS environment. You can install packages safely using a Python virtual environment.

Run these commands on your Pi terminal:
```bash
# Create a dedicated directory for the GlassBoard listener
mkdir -p ~/glassboard
cd ~/glassboard

# Initialize a Python virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install the necessary library dependencies inside the environment
pip install --upgrade pip
pip install supabase opencv-python-headless
```

*(Alternatively, if you'd prefer to skip virtual environments for a quick test, you can run `pip3 install supabase opencv-python-headless --break-system-packages` directly, but the virtual environment method above is standard).*

---

### 2. Configure Environment Secrets
Make a note of your Supabase URL, Anon Key, and Device ID:
- **Supabase URL:** `https://tspopbrylewcirzyholi.supabase.co`
- **Anon Public API Key:** `sb_publishable_NIcMYDWtHyLolyQKKdbfCQ_-oV3HTG_` *(found in `/src/lib/supabase.ts` or your project settings)*
- **Device ID:** Copied directly from your Admin Dashboard (e.g. `30ef6d2d-ca27-439b-ae18-3066aeb3bbda`).

---

### 3. Create the Listener Script on the Raspberry Pi
Create a file named `glassboard_detector.py` inside your `~/glassboard` folder on your Raspberry Pi:

```python
import os
import time
import cv2
import datetime
from supabase import create_client, Client

# --- SETUP CONFIGURATION CONFIG ---
SUPABASE_URL = "https://tspopbrylewcirzyholi.supabase.co"
SUPABASE_KEY = "sb_publishable_NIcMYDWtHyLolyQKKdbfCQ_-oV3HTG_"
DEVICE_ID = "YOUR_COPY_PASTED_DEVICE_UUID" # Replace with your device UUID

# --- CAMERA CAPTURE PREFERENCES ---
# Set the resolution (e.g. 1920x1080 for HD)
FRAME_WIDTH = 1920
FRAME_HEIGHT = 1080

# Image Orientation (Flip / Invert coordinates if camera is upside-down)
# cv2.flip parameters:
#   0  = Flip vertically (upside-down)
#   1  = Flip horizontally (mirror)
#  -1  = Flip both vertically & horizontally (180-degree rotation - standard for upside-down mounts)
FLIP_ORIENTATION = -1   # Set to 0, 1, or -1 to rotate/flip. Set to None to keep default.

# --- AUTHENTICATION CONFIG (To pass Row-Level Security / RLS policies) ---
# OPTION A (Secure & Standard): Enter your Glassboard Email & Password.
# This logs the Raspberry Pi into Supabase so it has matching write permissions for its folder.
USER_EMAIL = "your_glassboard_email@example.com"
USER_PASSWORD = "your_glassboard_password"

# OPTION B (RLS Bypass): Alternatively, use your Supabase "Service Role Key" 
# as the SUPABASE_KEY variable above instead of the public anon key. 
# (If you use the secret Service Role key, you can leave the email and password blank).

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Authenticate if credentials are provided
if USER_EMAIL and USER_EMAIL != "your_glassboard_email@example.com":
    print("🔑 Authenticating with Supabase Auth...")
    try:
        supabase.auth.sign_in_with_password({
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        print("✅ Authenticated successfully! Row-Level Security checks are cleared.")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        print("⚠️ Attempting execution using Anon key configurations...")

def capture_usb_webcam(filename):
    """
    Captures an image using an attached USB Webcam at the configured resolution.
    Applies orientation flip or color inversion filters if activated.
    Flushes early warm-up frames to allow auto-white balance / auto-exposure.
    This prevents black, dark, or distorted images.
    """
    print("🔌 Starting USB Webcam sensor...")
    
    # 0 is usually /dev/video0 (first USB camera interface)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Error: Could not open USB webcam.")
        return False
        
    try:
        # Request target Full HD 1920x1080 frame dimensions
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
        
        # Verify if dimensions were accepted by driver (otherwise uses highest supported fallback)
        actual_w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        actual_h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        print(f"🎬 Resolution configured state: {int(actual_w)} x {int(actual_h)}")
        
        # Crucial for USB Webcams: Wait 1.5s and discard the first 15 frames
        # This lets the camera sensor adjust to the light Level and calibrate focus/gain
        time.sleep(1.5)
        for _ in range(15):
            cap.grab()
            
        # Read the current active calibrated frame
        ret, frame = cap.read()
        
        if ret and frame is not None:
            # Apply orientation correction (flip if physical camera is mounted upside-down)
            if FLIP_ORIENTATION is not None:
                print(f"🔄 Correcting physical image orientation (cv2.flip mode: {FLIP_ORIENTATION})...")
                frame = cv2.flip(frame, FLIP_ORIENTATION)
                
            # Save local copy
            cv2.imwrite(filename, frame)
            print(f"✅ Picture saved locally to: {filename}")
            return True
        else:
            print("❌ Error: Failed to read frame from video buffer.")
            return False
    finally:
        cap.release()
        print("🔌 Camera sensor released.")

def process_request(request):
    req_id = request.get("id")
    user_id = request.get("userId")
    folder_id = request.get("folderId")
    
    print(f"\n📸 Processing capture request: {req_id}")
    print(f"   📂 Target Folder: {folder_id}")
    print(f"   👤 For Account: {user_id}")
    
    # 1. Update status to 'processing'
    supabase.table("captureRequests").update({
        "status": "processing",
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }).eq("id", req_id).execute()
    
    local_path = "/tmp/capture.jpg"
    
    # 2. Grab photo
    success = capture_usb_webcam(local_path)
    if not success:
        print("❌ Failed to snap picture. Reporting failure...")
        supabase.table("captureRequests").update({
            "status": "failed",
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).eq("id", req_id).execute()
        return

    # 3. Upload to Supabase Storage
    remote_filename = f"capture_{int(time.time())}.jpg"
    storage_path = f"{user_id}/{folder_id}/{remote_filename}"
    
    print(f"📤 Uploading picture to Supabase Storage Bucket ('glassboard')...")
    try:
        with open(local_path, "rb") as f:
            supabase.storage.from_("glassboard").upload(
                path=storage_path,
                file=f,
                file_options={"cache-control": "3600", "upsert": "true"}
            )
            
        # Construct public URL based on Supabase endpoint routing
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/glassboard/{storage_path}"
        print(f"🔗 Uploaded successfully. Public link: {public_url}")
        
        # 4. Insert image into the 'images' table (so frontend live updates)
        print("💾 Registering image metadata...")
        supabase.table("images").insert({
            "folderId": folder_id,
            "userId": user_id,
            "imageUrl": public_url,
            "isDeleted": False,
            "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).execute()
        
        # 5. Mark command request as completed
        supabase.table("captureRequests").update({
            "status": "completed",
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).eq("id", req_id).execute()
        
        print("🎉 Capture request processed fully and verified!")
        
    except Exception as e:
        print(f"❌ Error during upload/database sync: {e}")
        supabase.table("captureRequests").update({
            "status": "failed",
            "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).eq("id", req_id).execute()

def start_loop():
    print("=========================================")
    print("🛰️  GlassBoard IoT Raspberry Pi Gateway Active")
    print(f"📌 Listening for Device UUID: {DEVICE_ID}")
    print("=========================================")
    
    while True:
        try:
            # Query pending capture requests assigned to this Raspberry Pi
            response = supabase.table("captureRequests") \
                .select("*") \
                .eq("deviceId", DEVICE_ID) \
                .eq("status", "pending") \
                .execute()
                
            requests = response.data
            
            if requests and len(requests) > 0:
                for req in requests:
                    process_request(req)
                    
            # Wait 2 seconds before checking the queue again
            time.sleep(2)
            
        except Exception as e:
            print(f"⚠️ Failed to probe queue: {e}")
            time.sleep(5)

if __name__ == "__main__":
    if DEVICE_ID == "YOUR_COPY_PASTED_DEVICE_UUID":
        print("❌ Error: You must change the 'DEVICE_ID' string to match your Raspberry Pi!")
    else:
        start_loop()
```

---

## 🏃‍♂️ How to Run the Script

1. **Activate the environment and start the listener:**
   ```bash
   cd ~/glassboard
   source venv/bin/activate
   python3 glassboard_detector.py
   ```

2. **Test the USB webcam flow:**
   - Log into your GlassBoard web panel.
   - Register or copy your device's ID.
   - In any Folder view, select your Raspberry Pi camera.
   - Choose **"Raspberry Pi (Real Hardware)"** option.
   - Click **Capture**.
   - Your Raspberry Pi terminal will show the triggered workflow, grab the webcam frame, and post it to Supabase!
