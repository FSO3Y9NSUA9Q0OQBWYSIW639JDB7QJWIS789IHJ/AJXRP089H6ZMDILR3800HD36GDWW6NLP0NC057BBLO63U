import requests
import os
import time

def print_banner():
    os.system("clear")
    print("\033[1;35m" + "═" * 50)
    print("    🚀 Facebook Token Checker by Satish    ")
    print("═" * 50 + "\033[0m\n")

def check_token(token, index):
    try:
        url = f"https://graph.facebook.com/v18.0/me?fields=id,name&access_token={token}"
        res = requests.get(url)
        data = res.json()

        if "error" in data:
            print(f"\033[1;31m[ {index} ] ❌ Invalid Token!\033[0m")
        else:
            print(f"\033[1;32m[ {index} ] ✅ Token is valid!\033[0m")
            print(f"\033[1;34m      Name : \033[0m{data.get('name', 'N/A')}")
            print(f"\033[1;34m      UID  : \033[0m{data.get('id', 'N/A')}")
    except Exception as e:
        print(f"\033[1;31m[ {index} ] ❗ Error: {e}\033[0m")

def option_one():
    token = input("🔑 Enter Your Token :- ").strip()
    print("\n🔍 Checking token...\n")
    check_token(token, 1)

def option_two():
    path = "/sdcard/token.txt"
    if not os.path.exists(path):
        print(f"\033[1;31m🚫 File not found: {path}\033[0m")
        return
    
    with open(path, "r") as file:
        tokens = [line.strip() for line in file if line.strip()]
    
    print(f"\n🔍 Checking {len(tokens)} token(s) from file...\n")
    for idx, token in enumerate(tokens, 1):
        check_token(token, idx)
        time.sleep(0.3)

if __name__ == "__main__":
    print_banner()
    print("📌 Choose an option:\n")
    print("1️⃣  Check Single Token")
    print("2️⃣  Check Multiple Tokens \n")

    choice = input("👉 Enter your choice (1 or 2) :- ").strip()

    if choice == "1":
        option_one()
    elif choice == "2":
        option_two()
    else:
        print("\033[1;31m❗ Invalid choice! Please select 1 or 2.\033[0m")
