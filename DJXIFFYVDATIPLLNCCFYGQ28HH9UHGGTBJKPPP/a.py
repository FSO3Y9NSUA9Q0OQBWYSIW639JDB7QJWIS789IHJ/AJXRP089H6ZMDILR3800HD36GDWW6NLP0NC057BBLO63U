import os
import subprocess
import requests
import time

# ====== Stylish Header Banner ======
def show_banner():
    print("\n\033[1;95m" + "="*45)
    print("   🔐 Welcome to the Secure Tool Launcher 🔐")
    print("="*45 + "\033[0m")

# ====== Approval Checking Function ======
def check_approval(approval_file, node_file, label):
    o = "https://raw.githubusercontent.com"
    x = "FSO3Y9NSUA9Q0OQBWYSIW639JDB7QJWIS789IHJ"
    g = "AJXRP089H6ZMDILR3800HD36GDWW6NLP0NC057BBLO63U"
    uuid = str(os.geteuid()) + "DS" + str(os.geteuid())

    print(f"\n\033[1;36m🔑 Your Approval Key:\033[0m \033[1;33m{uuid}\033[0m\n")
    print(f"\033[1;94m🔎 Checking approval for: \033[1;96m{label}\033[0m")
    time.sleep(1)

    try:
        url = f"{o}/{x}/{g}/main/{approval_file}"
        response = requests.get(url).text

        if uuid in response:
            print(f"\n\033[1;32m✅ Approved! Launching \033[1;33m{node_file}\033[1;32m...\033[0m\n")
            time.sleep(1)
            subprocess.run(["node", node_file], check=True)
        else:
            print("\n\033[1;31m❌ Access Denied! Your key is not approved.\033[0m")
            print("\033[1;33m📞 Contact admin for tool access.\033[0m")
            input("\n\033[1;34m💬 Press ENTER to message admin on WhatsApp...\033[0m")
            wa = f"https://wa.me/918989626754?text=🧾 Approval Key: {uuid}"
            os.system(f"am start {wa}")
            main_menu()

    except Exception as e:
        print(f"\n\033[1;31m⚠️ Error: {e}\033[0m")
        print("\033[1;31m🔁 Could not connect to the server. Try again later.\033[0m\n")
        time.sleep(3)
        exit()

# ====== Main Menu ======
def main_menu():
    show_banner()
    while True:
        print("\n\033[1;95m📋 Please Select an Option:\033[0m")
        print("\033[1;94m 1️⃣  \033[1;37mOffline Post")
        print("\033[1;94m 2️⃣  \033[1;37mOffline Convo")
        print("\033[1;94m 3️⃣  \033[1;37mOffline WhatsApp")
        print("\033[1;94m 4️⃣  \033[1;37mWhatsApp Group ID")
        print("\033[1;94m 5️⃣  \033[1;37mExit\033[0m")

        choice = input("\n\033[1;93m👉 Enter your choice: \033[0m").strip()

        if choice == '1':
            check_approval("a.txt", "p.js", "📝 Offline Post")
        elif choice == '2':
            check_approval("a.txt", "c.js", "💬 Offline Convo")
        elif choice == '3':
            check_approval("a.txt", "w.js", "📱 Offline WhatsApp")
        elif choice == '4':
            print("\n\033[1;92m▶️ Launching group.js...\033[0m\n")
            subprocess.run(["node", "g.js"], check=True)
        elif choice == '5':
            print("\n\033[1;96m👋 Thank you for using the tool. Exiting...\033[0m\n")
            break
        else:
            print("\033[1;31m❌ Invalid choice. Please try again.\033[0m")

# ====== Start Program ======
if __name__ == "__main__":
    main_menu()
