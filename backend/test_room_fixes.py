#!/usr/bin/env python3
"""
Test script to verify the room management fixes
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_room_fixes():
    """Test the two fixed endpoints"""
    
    print("🧪 Testing Room Management Fixes")
    print("=" * 50)
    
    # You'll need to replace this with a valid JWT token
    # Get it from your browser's developer tools when logged in
    token = "YOUR_JWT_TOKEN_HERE"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\n1. Testing room name update (POST /rooms/update-name)")
    print("-" * 30)
    
    # Test room name update
    update_payload = {
        "old_room_name": "fdgsd",
        "new_room_name": "Living Room"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/rooms/update-name",
            headers=headers,
            json=update_payload
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n2. Testing add device to room (POST /rooms/{room_id}/devices/{device_id})")
    print("-" * 30)
    
    # Test add device to room
    room_id = "room_4f76b1a5"  # Replace with actual room ID
    device_id = "device_01"    # Replace with actual device ID
    
    try:
        response = requests.post(
            f"{BASE_URL}/rooms/{room_id}/devices/{device_id}",
            headers=headers
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n✅ Test completed!")
    print("\nNOTE: Replace 'YOUR_JWT_TOKEN_HERE' with your actual JWT token")
    print("You can get it from browser developer tools -> Application -> Local Storage")

if __name__ == "__main__":
    test_room_fixes()