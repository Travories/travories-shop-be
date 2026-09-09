# Medusa backend -> PORT_BE (7342).
#
# One process serves everything, routed by path:
#   /store, /admin, /auth  -> API
#   /app                   -> admin dashboard
# The dashboard has its own domain (admin.shop.travories.com) pointing at this
# same backend, so this host is left as the plain API entry point.

server {
    server_name api.shop.travories.com;

    # Admin media uploads pass through this host.
    client_max_body_size 100m;

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
