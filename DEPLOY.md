# Lakshmi Physio — deployment

| Item | Value |
|---|---|
| URL | https://lakshmiphysio.thangaminfotech.com |
| Server | 156.67.104.242, path `/opt/projects/lakshmiphysio` |
| Containers | `lakshmiphysio-frontend` (127.0.0.1:3170) / `lakshmiphysio-backend` (127.0.0.1:5170) |
| nginx site | `/etc/nginx/sites-available/lakshmiphysio.conf` |
| Database | `T_LakshmiPhysio` on 147.93.155.21 |

## Deploy / redeploy (from this folder)

```
set DEPLOY_PASSWORD=<root password>
python deploy/deploy.py            # build + restart containers, install nginx site
python deploy/deploy.py --init-db  # also run the re-runnable schema script
```

The script backs up the previous server copy to `/opt/projects/lakshmiphysio-backup-<stamp>.tgz`
and refuses to run if ports 3170/5170 belong to another app.

## Local development

```
cd backend && npm install && npm run init-db && npm run dev     # API on :5000
cd frontend && npm install && npm run dev                       # UI on :5174 (proxies /api)
```

First login: user `Admin`, with the password from `ADMIN_INITIAL_PASSWORD` in `backend/.env` (or the one `init-db` prints if that is empty). Passwords are never stored in this repository.
