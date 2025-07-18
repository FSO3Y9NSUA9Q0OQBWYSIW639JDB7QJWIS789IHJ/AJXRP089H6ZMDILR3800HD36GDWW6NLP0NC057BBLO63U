import os
import shutil
import pyfiglet
from termcolor import colored

def clear_screen():
    os.system("clear")

def show_banner():
    clear_screen()
    
    term_width = shutil.get_terminal_size().columns
    figlet_font = 'standard'
    figlet_text = pyfiglet.figlet_format("OFFLINE PANEL", font=figlet_font, width=min(term_width, 80))
    print(colored(figlet_text, 'cyan'))
    
    print(colored("┌─────────────────────────────────────────────┐", "green"))
    print(colored("│               SELECT AN OPTION              │", "green"))
    print(colored("├─────────────────────────────────────────────┤", "green"))
    print(colored("│  1. WhatsApp Offline                        │", "yellow"))
    print(colored("│  2. WhatsApp Group ID                       │", "yellow"))
    print(colored("│  3. Get Creds File                          │", "yellow"))
    print(colored("│  4. Token Checker                           │", "yellow"))
    print(colored("└─────────────────────────────────────────────┘", "green"))

def run_command(cmd):
    print(colored(f"\n📁 Running: {cmd}", "magenta"))
    os.system(cmd)

def handle_choice(choice):
    commands = {
        "1": ["cd Files", "node wp.js"],
        "2": ["cd Files", "node gpid.js"],
        "3": ["cd Files", "node creds.js"],
        "4": ["cd Files", "python tc.py"]
    }
    
    if choice in commands:
        for cmd in commands[choice]:
            run_command(cmd)
    else:
        print(colored("❌ Invalid Option!", "red"))

if __name__ == "__main__":
    show_banner()
    try:
        user_choice = input(colored("\n👉 Enter your choice (1-6): ", "cyan")).strip()
        handle_choice(user_choice)
    except KeyboardInterrupt:
        print(colored("\n\n🛑 Exiting... Goodbye!", "red"))
