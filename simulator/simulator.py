#!/usr/bin/env python3
"""Three virtual weather stations sending the PDF's F.1 payloads over HTTP."""

import argparse
import json
import logging
import math
import os
import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


TELEMETRY_ENDPOINT = "/api/v1/ingest/telemetry"
BATCH_ENDPOINT = "/api/v1/ingest/telemetry/batch"

LOG = logging.getLogger("simulator")
TRAFFIC_LOG = logging.getLogger("simulator.traffic")
TRAFFIC_LOG.propagate = False
DEFAULT_DEVICES_FILE = Path(__file__).with_name("devices.json")


def configure_traffic_log():
    """One payload/response log file per run, with timestamps in WIB."""
    directory = Path(__file__).with_name("logs")
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y%m%d-%H%M%S-%f")
    path = directory / f"log-{stamp}.log"
    handler = logging.FileHandler(path, mode="x", encoding="utf-8")
    formatter = logging.Formatter("%(asctime)s WIB %(levelname)s %(message)s")
    formatter.converter = lambda seconds: datetime.fromtimestamp(seconds, ZoneInfo("Asia/Jakarta")).timetuple()
    handler.setFormatter(formatter)
    for previous in TRAFFIC_LOG.handlers[:]:
        TRAFFIC_LOG.removeHandler(previous)
        previous.close()
    TRAFFIC_LOG.addHandler(handler)
    TRAFFIC_LOG.setLevel(logging.INFO)
    return path


def readable_body(raw, api_key):
    text = raw.decode("utf-8", errors="replace")
    try:
        text = json.dumps(json.loads(text), ensure_ascii=False, indent=2)
    except ValueError:
        pass
    return (text.replace(api_key, "[REDACTED]") if api_key else text) or "(empty body)"


@dataclass
class Device:
    device_id: str
    mode: str
    api_key: str = ""
    seq: int = 0
    rain_counter: int = 1000
    temperature: float = 27.0
    humidity: float = 75.0
    buffer: list = field(default_factory=list)
    fw: str = "1.4.2"

    def sample(self):
        self.temperature = max(18, min(38, self.temperature + random.uniform(-0.3, 0.3)))
        self.humidity = max(30, min(100, self.humidity + random.uniform(-1, 1)))
        self.rain_counter += random.choice([0, 0, 0, 1, 2])
        now = int(time.time())
        # Approximate daylight in WIB; timestamps themselves remain UTC epoch seconds.
        hour = ((now + 7 * 3600) % 86400) / 3600
        sunlight = max(0, math.sin(math.pi * (hour - 6) / 12)) * 800
        payload = {
            "device_id": self.device_id,
            "fw": self.fw,
            "ts": now,
            "seq": self.seq,
            "battery_v": round(random.uniform(3.8, 4.1), 2),
            "rssi": random.randint(-85, -55),
            "readings": [
                {"s": "temp_air", "v": round(self.temperature, 1)},
                {"s": "humidity", "v": round(self.humidity, 1)},
                {"s": "pressure", "v": round(random.uniform(1005, 1012), 1)},
                {"s": "wind_speed", "v": round(random.uniform(0, 8), 1)},
                {"s": "wind_dir", "v": random.randrange(360)},
                {"s": "rain_counter", "v": self.rain_counter},
                {"s": "solar_rad", "v": round(sunlight, 1)},
            ],
        }
        self.seq += 1
        return payload


def post(base_url, path, payload, api_key, timeout):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key
    encoded_payload = json.dumps(payload).encode("utf-8")
    # Each request starts a separate block; payload and response stay together.
    # Credentials in headers are never written to the traffic log.
    TRAFFIC_LOG.info("\n\n%s\n%s POST %s\nPayload:\n%s", "=" * 80, payload["device_id"], path, readable_body(encoded_payload, api_key))
    request = Request(
        base_url.rstrip("/") + path,
        data=encoded_payload,
        headers=headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.status
            body = readable_body(response.read(), api_key)
        TRAFFIC_LOG.info("%s POST %s HTTP %s\nResponse:\n%s", payload["device_id"], path, status, body)
        if status == 207:
            # Partial-success details aren't specified by F.1. Retry the same
            # records rather than risk dropping rejected ones; backend must dedup.
            LOG.warning("%s HTTP 207: retain buffer; partial ACK needs backend contract", payload["device_id"])
            return False
        LOG.info("%s POST %s HTTP %s", payload["device_id"], path, status)
        return 200 <= status < 300
    except HTTPError as error:
        LOG.warning("%s POST %s HTTP %s", payload["device_id"], path, error.code)
        try:
            TRAFFIC_LOG.warning("%s POST %s HTTP %s\nResponse:\n%s", payload["device_id"], path, error.code, readable_body(error.read(), api_key))
        finally:
            error.close()
    except (URLError, TimeoutError, OSError) as error:
        LOG.warning("%s POST %s failed: %s", payload["device_id"], path, error)
        TRAFFIC_LOG.warning("%s POST %s\nResponse: not received; %s", payload["device_id"], path, str(error).replace(api_key, "[REDACTED]") if api_key else error)
    return False


def flush(device, args):
    while device.buffer:
        records = device.buffer[:500]
        batch = {
            "device_id": device.device_id,
            "fw": device.fw,
            "batch": [
                {key: value for key, value in record.items() if key not in ("device_id", "fw")}
                for record in records
            ],
        }
        if not post(args.base_url, BATCH_ENDPOINT, batch, device.api_key, args.timeout):
            return
        del device.buffer[:len(records)]
        LOG.info("%s batch accepted: %s records, buffer=%s", device.device_id, len(records), len(device.buffer))


def tick(device, cycle, args):
    payload = device.sample()
    if device.mode == "offline" and cycle % (args.offline_cycles + 1) != 0:
        device.buffer.append(payload)
        LOG.info("%s simulated offline: buffer=%s", device.device_id, len(device.buffer))
        return
    if device.buffer:
        device.buffer.append(payload)
        flush(device, args)
        return
    accepted = post(args.base_url, TELEMETRY_ENDPOINT, payload, device.api_key, args.timeout)
    if not accepted:
        device.buffer.append(payload)
        return
    if device.mode == "duplicate":
        LOG.info("%s resend identical payload ts=%s seq=%s", device.device_id, payload["ts"], payload["seq"])
        if not post(args.base_url, TELEMETRY_ENDPOINT, payload, device.api_key, args.timeout):
            device.buffer.append(payload)


def load_devices(path, mode="mixed"):
    with open(path, encoding="utf-8") as config:
        entries = json.load(config)
    if not isinstance(entries, list) or not entries:
        raise ValueError("Device config must be a non-empty JSON array")
    devices = []
    seen = set()
    for index, entry in enumerate(entries, 1):
        if not isinstance(entry, dict):
            raise ValueError(f"Device #{index} must be an object")
        device_id = entry.get("device_id")
        api_key = entry.get("api_key")
        scenario = entry.get("mode", "normal")
        if not isinstance(device_id, str) or not device_id.strip():
            raise ValueError(f"Device #{index}: device_id is required")
        device_id = device_id.strip()
        if device_id in seen:
            raise ValueError(f"Device #{index}: duplicate device_id")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValueError(f"Device #{index}: fill api_key with the credential from your backend")
        if "\n" in api_key or "\r" in api_key:
            raise ValueError(f"Device #{index}: api_key must not contain newlines")
        if scenario not in ("normal", "offline", "duplicate"):
            raise ValueError(f"Device #{index}: mode must be normal, offline, or duplicate")
        seen.add(device_id)
        devices.append(Device(device_id, scenario if mode == "mixed" else mode, api_key.strip()))
    return devices


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.getenv("BACKEND_BASE_URL", "http://localhost:3000"))
    parser.add_argument("--interval", type=float, default=60, help="Seconds between sampling cycles (default: 60)")
    parser.add_argument("--mode", choices=["mixed", "normal", "offline", "duplicate"], default="mixed")
    parser.add_argument("--offline-cycles", type=int, default=3, help="Offline cycles before one online cycle")
    parser.add_argument("--cycles", type=int, default=0, help="Stop after N cycles; 0 means run forever")
    parser.add_argument("--timeout", type=float, default=10, help="HTTP timeout in seconds")
    parser.add_argument("--devices-file", default=str(DEFAULT_DEVICES_FILE), help="JSON array of device IDs, API keys, and modes")
    args = parser.parse_args()
    parsed = urlparse(args.base_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.query or parsed.fragment:
        parser.error("--base-url must be an HTTP(S) URL without query or fragment")
    if args.interval < 1 or args.timeout <= 0 or args.offline_cycles < 1 or args.cycles < 0:
        parser.error("interval >= 1, timeout > 0, offline-cycles >= 1, cycles >= 0 required")
    return args


def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        log_path = configure_traffic_log()
    except OSError:
        raise SystemExit("Cannot create traffic log. Check write permission for simulator/logs/.")
    LOG.info("Payload/response log: %s", log_path)
    try:
        devices = load_devices(args.devices_file, args.mode)
    except (OSError, ValueError):
        # Do not print config contents: JSON parsing errors may expose credentials.
        raise SystemExit("Invalid device configuration. Check the file exists and is a non-empty JSON array with unique device_id, filled api_key, and valid mode.")
    LOG.info("Backend: %s | interval=%ss | mode=%s", args.base_url, args.interval, args.mode)
    cycle = 0
    try:
        while args.cycles == 0 or cycle < args.cycles:
            started = time.monotonic()
            cycle += 1
            for device in devices:
                tick(device, cycle, args)
            if args.cycles == 0 or cycle < args.cycles:
                time.sleep(max(0, args.interval - (time.monotonic() - started)))
    except KeyboardInterrupt:
        LOG.info("Stopped")
    for device in devices:
        LOG.info("%s unsent buffer=%s (memory only)", device.device_id, len(device.buffer))


if __name__ == "__main__":
    main()
