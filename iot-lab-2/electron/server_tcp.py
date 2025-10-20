# server_tcp.py
import json, socket, threading
from picarx import Picarx
from vilib import Vilib

HOST = "0.0.0.0"
PORT = 5555
DEFAULT_SPEED = 40
TURN_ANGLE = 30

px = Picarx()

def do_move(req):
    cmd = req.get("cmd")
    speed = int(req.get("speed", DEFAULT_SPEED))
    angle = int(req.get("angle", 0))
    speed = max(0, min(speed, 100))
    angle = max(-45, min(angle, 45))

    print(f"[SERVER] cmd={cmd} speed={speed} angle={angle}", flush=True)

    if cmd == "forward":
        px.set_dir_servo_angle(angle); px.forward(speed)
        return {"ok": True}
    if cmd == "backward":
        px.set_dir_servo_angle(angle); px.backward(speed)
        return {"ok": True}
    if cmd == "left":
        px.set_dir_servo_angle(-TURN_ANGLE); px.forward(speed)
        return {"ok": True}
    if cmd == "right":
        px.set_dir_servo_angle(TURN_ANGLE); px.forward(speed)
        return {"ok": True}
    if cmd == "stop":
        px.stop(); return {"ok": True}
    if cmd == "sensors":
        try:
            dist = round(px.ultrasonic.read(), 2)
        except Exception as e:
            print(f"[SERVER] ultrasonic error: {e}", flush=True)
            return {"ok": False, "error": f"ultrasonic: {e}"}
        try:
            gm_val_list = px.get_grayscale_data()
            gm_state = px.get_cliff_status(gm_val_list)
            state = "danger" if gm_state else "safe"
            print(f"[SERVER] sensors distance_cm={dist} cliff={state}", flush=True)
            return {"ok": True, "distance_cm": dist, "cliff": state}
        except Exception as e:
            print(f"[SERVER] grayscale error: {e}", flush=True)
            return {"ok": False, "error": f"grayscale: {e}"}
    return {"ok": False, "error": "unknown_cmd"}

def handle(conn, addr):
    conn.settimeout(60)
    buf = b""
    print(f"[SERVER] client connected {addr}", flush=True)
    try:
        while True:
            chunk = conn.recv(4096)
            if not chunk: break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                if not line.strip(): continue
                try:
                    req = json.loads(line.decode("utf-8"))
                except json.JSONDecodeError:
                    conn.sendall(b'{"ok":false,"error":"bad_json"}\n')
                    continue
                resp = do_move(req)
                conn.sendall((json.dumps(resp) + "\n").encode("utf-8"))
    finally:
        try: px.stop()
        except Exception: pass
        conn.close()
        print(f"[SERVER] client disconnected {addr}", flush=True)

def main():
    print(f"[SERVER] TCP control on {HOST}:{PORT}", flush=True)
    Vilib.camera_start(vflip=False,hflip=False)
    Vilib.display(local=True,web=True)

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((HOST, PORT)); s.listen()
        while True:
            conn, addr = s.accept()
            threading.Thread(target=handle, args=(conn, addr), daemon=True).start()

if __name__ == "__main__":
    try: main()
    except KeyboardInterrupt: pass
    finally:
        try: px.stop()
        except Exception: pass
