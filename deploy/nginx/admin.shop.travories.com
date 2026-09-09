# Admin dashboard -> PORT_BE (7342), the same backend as api.shop.travories.com.
#
# The dashboard is not a separate process — Medusa serves it at /app on the
# backend. This domain proxies the whole backend, so the dashboard's own API
# calls (/admin, /auth) stay same-origin: no CORS, no cross-site cookies.
# That works because medusa-config.ts pins admin.backendUrl to "/".

server {
    server_name admin.shop.travories.com;

    # Admin media uploads pass through this host.
    client_max_body_size 100m;

    # The dashboard lives at /app; send the bare domain there.
    location = / {
        return 302 /app;
    }

    location / {
        proxy_pass http://localhost:7342;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Optional WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 80;
}
