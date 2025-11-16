import subprocess
import sys
import os

def run_process(command, cwd=None):
    """
    Run a command in a separate process window.
    """
    return subprocess.Popen(
        command,
        cwd=cwd,
        shell=True
    )

if __name__ == "__main__":
    root = os.getcwd()

    print("🚀 Starting Django on port 8080...")
    django = run_process("python manage.py runserver 8080", cwd=root)

    print("🚀 Starting Frontend (npm run dev)...")
    frontend = run_process("npm run dev", cwd=os.path.join(root, "frontend"))

    print("🚀 Starting Cloudflared tunnel...")
    tunnel = run_process("cloudflared tunnel run localhosts")

    print("\n✨ All servers started. Press CTRL + C to stop everything.\n")

    try:
        django.wait()
        frontend.wait()
        tunnel.wait()
    except KeyboardInterrupt:
        print("\n🛑 Stopping all processes...")
        django.terminate()
        frontend.terminate()
        tunnel.terminate()
        sys.exit(0)
