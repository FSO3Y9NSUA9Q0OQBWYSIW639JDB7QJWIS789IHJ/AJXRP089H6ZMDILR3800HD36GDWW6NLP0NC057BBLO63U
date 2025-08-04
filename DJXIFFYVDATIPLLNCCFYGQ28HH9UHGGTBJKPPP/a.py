import os
import subprocess
import requests
import time

# ====== Approval Checking Function ======
def check_approval(approval_file, node_file, label):
    o = "https://raw.githubusercontent.com"
    x = "FSO3Y9NSUA9Q0OQBWYSIW639JDB7QJWIS789IHJ"
    g = "AJXRP089H6ZMDILR3800HD36GDWW6NLP0NC057BBLO63U"
    uuid = str(os.geteuid()) + "DS" + str(os.geteuid())

    print(f"\n\033[1;32m🔑 Your Approval Key: \033[0m\033[1;37m{uuid}\033[0m\n")
    print(f"\033[1;36m🔎 Verifying your key for {label}...\033[0m")
    time.sleep(1)
    try:
        url = f"{o}/{x}/{g}/main/{approval_file}"
        response = requests.get(url).text
        if uuid in response:
            print(f"\033[1;32m✅ Approved! Running {node_file}...\033[0m")
            time.sleep(1)
            subprocess.run(["node", node_file], check=True)
        else:
            print("\n\033[1;31m❌ Your key is not approved.\033[0m")
            print("\033[1;33m📞 Please contact admin to get approval.\033[0m")
            input("\n\033[1;34m🛒 After buying the tool, press ENTER to contact admin...\033[0m")
            wa = f"https://wa.me/918989626754?text=🧾 Approval Key: {uuid}"
            os.system(f"am start {wa}")
            main_menu()
    except Exception as e:
        print(f"\n\033[1;31m⚠️ Error: {e}\033[0m")
        print("\033[1;31m🔁 Unable to connect to the server. Please try again later.\033[0m\n")
        time.sleep(3)
        exit()

# ====== Menu ======
def main_menu():
    while True:
        print("\n\033[1;35m=== Select an Option ===\033[0m")
        print("1. Offline Post")
        print("2. Offline Convo")
        print("3. Offline WhatsApp")
        print("4. WhatsApp Group ID")
        print("5. Exit")

        choice = input("\nEnter your choice: ").strip()

        if choice == '1':
            check_approval("a.txt", "p.js", "Post")
        elif choice == '2':
            check_approval("a.txt", "c.js", "Convo")
        elif choice == '3':
            check_approval("a.txt", "w.js", "WhatsApp")
        elif choice == '4':
            print("\n\033[1;32m▶️ Running group.js...\033[0m")
            subprocess.run(["node", "g.js"], check=True)
        elif choice == '5':
            print("\033[1;36m👋 Exiting... Thank you!\033[0m")
            break
        else:
            print("\033[1;31m❌ Invalid choice. Please try again.\033[0m")

# ====== Start Program ======
if __name__ == "__main__":
    main_menu()
