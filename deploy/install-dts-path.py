from pathlib import Path
from shutil import copy2
from time import strftime


config = Path("/www/server/panel/vhost/nginx/aaw-telemetry.conf")
marker = "# DTS managed route"
block = r"""

    # DTS managed route
    location = /dts {
        return 302 /dts/;
    }

    location /dts/api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /dts/ {
        proxy_pass http://127.0.0.1:18082/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""

text = config.read_text(encoding="utf-8")
if marker in text:
    print("DTS route already installed")
else:
    end = text.rfind("}")
    if end < 0:
        raise RuntimeError(f"no closing server brace in {config}")
    backup = config.with_name(f"{config.name}.backup-{strftime('%Y%m%dT%H%M%S')}")
    copy2(config, backup)
    config.write_text(text[:end].rstrip() + block + "}\n", encoding="utf-8")
    print(f"installed DTS route; backup={backup}")
