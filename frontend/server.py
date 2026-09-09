"""
Lithium — Autonomous Operations Platform
Local Development Server (http://localhost:3000)
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def main():
    # Allow port reuse if restarting
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("⚡ LITHIUM — OPERATIONS DESK RUNNING ON LOCALHOST!")
        print(f"👉 Open in browser: {url}")
        print("=" * 60)
        print("Press Ctrl+C to stop the server.")
        try:
            webbrowser.open(url)
        except (Exception, KeyboardInterrupt):
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    main()
