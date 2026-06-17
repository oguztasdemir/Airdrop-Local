import os
import subprocess
import sys
import time
import webbrowser
import socket
import signal

PORT = 3000
APP_DIR = os.path.dirname(os.path.abspath(__file__))

# Load port from .env if exists
env_path = os.path.join(APP_DIR, ".env")
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("PORT="):
                    val = line.strip().split("=")[1].strip()
                    if val:
                        PORT = int(val)
    except Exception:
        pass

def get_local_ip():
    """Detects the primary local network IP address of the host computer."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def check_node_installed():
    """Checks if Node.js is installed on the system."""
    try:
        subprocess.run(["node", "-v"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def install_dependencies():
    """Installs npm packages if node_modules folder is missing."""
    node_modules_path = os.path.join(APP_DIR, "node_modules")
    if not os.path.exists(node_modules_path):
        print("[*] node_modules bulunamadı. Bağımlılıklar yükleniyor...")
        try:
            subprocess.run(["npm", "install"], cwd=APP_DIR, shell=True, check=True)
            print("[+] Bağımlılıklar başarıyla yüklendi.")
        except subprocess.CalledProcessError as e:
            print(f"[-] npm install başarısız oldu: {e}")
            sys.exit(1)

def run_server():
    """Launches the Node.js server and handles graceful shutdown."""
    if not check_node_installed():
        print("[-] Hata: Node.js bilgisayarınızda yüklü değil. Lütfen önce Node.js yükleyin (https://nodejs.org/).")
        sys.exit(1)

    install_dependencies()

    local_ip = get_local_ip()
    print("\n" + "="*50)
    print("           AIRDROP LOCAL BAŞLATILIYOR")
    print("="*50)
    print(f"[*] Bilgisayar Arayüzü: http://localhost:{PORT}")
    print(f"[*] iPhone/Mobil Arayüzü: http://{local_ip}:{PORT}")
    print("="*50)
    print("[*] Sunucu başlatılıyor...")

    # Start the node process
    try:
        process = subprocess.Popen(["node", "src/server.js"], cwd=APP_DIR, shell=True)
    except Exception as e:
        print(f"[-] Sunucu başlatılamadı: {e}")
        sys.exit(1)

    # Wait 1.5 seconds for the server to spin up
    time.sleep(1.5)

    # Auto-open browser
    print("[*] Tarayıcı açılıyor...")
    webbrowser.open(f"http://localhost:{PORT}")

    print("\n[+] Sunucu aktif durumda. Kapatmak için Ctrl+C tuşlarına basın.\n")

    # Set up signal handling for clean exit
    def signal_handler(sig, frame):
        print("\n[*] Sunucu durduruluyor...")
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
        print("[+] Güvenli şekilde kapatıldı.")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    
    # Keep python process alive while server is running
    while True:
        try:
            if process.poll() is not None:
                # If node process dies, exit python
                print("[-] Sunucu beklenmedik şekilde sonlandı.")
                sys.exit(1)
            time.sleep(1)
        except KeyboardInterrupt:
            signal_handler(None, None)

if __name__ == "__main__":
    run_server()
