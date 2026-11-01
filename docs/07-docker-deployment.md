# GitHub Actions deployment

Pushes to `main` or `master` build and push these Docker Hub images:

- `mhartvishwajith448/rag-frontendv4`
- `mhartvishwajith448/rag-backendv4`
- `mhartvishwajith448/rag-servicev4`

The workflow preserves `latest` and also tags every image with the Git commit SHA.
When deployment is enabled, it connects over SSH, copies the configuration to
`/opt/whatsapp-chatbot`, pulls that commit's images, and waits for healthy services.
The server needs Docker Engine and Docker Compose v2 with `--wait` support.
Install Docker using the [official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/)
if the server runs Ubuntu. The workflow does not install or replace server software.

## 1. Allow GitHub Actions to connect

From Windows PowerShell, create a dedicated key (leave the passphrase empty for Actions):

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\whatsapp_deploy" -C github-whatsapp-deploy
Get-Content "$env:USERPROFILE\.ssh\whatsapp_deploy.pub" | ssh root@161.97.165.83 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
ssh -i "$env:USERPROFILE\.ssh\whatsapp_deploy" root@161.97.165.83
```

The second command uses your existing server login, including a password if needed.
Copy the entire private key file into the GitHub secret `SSH_PRIVATE_KEY`.
Keep the public key on the server.

Get the server host key from a trusted server console:

```bash
cat /etc/ssh/ssh_host_ed25519_key.pub
```

Set `SSH_KNOWN_HOSTS` to `161.97.165.83 ` followed by that public key's
`ssh-ed25519 AAAA...` fields. This pins the server identity. For a custom SSH port,
use `[161.97.165.83]:PORT` instead of the bare IP.

## 2. Add repository secrets

Open [repository Actions secrets](https://github.com/RashenThemiya/Whatsapp-chatbot/settings/secrets/actions).
Add these under **Repository secrets**:

| Secret | Value |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub user with push permission to the three image repositories |
| `DOCKERHUB_TOKEN` | Docker Hub access token with read/write permission |
| `SSH_PRIVATE_KEY` | Entire deployment private key, including BEGIN/END lines |
| `SSH_KNOWN_HOSTS` | Verified server host-key entry from step 1 |
| `BACKEND_ENV` | Entire production backend environment file, described below |
| `RAG_ENV` | Entire production RAG environment file, described below |
| `SERVER_ENV` | Optional Compose settings from `.env.server.example`; omit for defaults |

For `BACKEND_ENV`, start with `backend/.env.example` and replace the example values.
Required configuration includes:

```dotenv
MONGODB_URI=mongodb+srv://USER:PASSWORD@YOUR_CLUSTER/rag_chatbot
OPENAI_API_KEY=YOUR_REAL_OPENAI_KEY
RAG_SERVICE_API_KEY=YOUR_LONG_RANDOM_SHARED_SECRET
JWT_SECRET=YOUR_LONG_RANDOM_JWT_SECRET
SUPER_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD=YOUR_STRONG_ADMIN_PASSWORD
PUBLIC_BACKEND_URL=http://161.97.165.83/backend
```

Configure the Meta, Twilio, Google, and token-encryption variables from the example
for the channels you use. Preserve encryption keys between deployments so stored
integration tokens remain readable. Use an accessible MongoDB instance and allow
the server IP in its network settings. Compose does not start MongoDB;
`localhost` inside the backend container refers to the container itself.

For `RAG_ENV`, start with `rag-service/.env.example`. Use the real OpenAI key and
exactly the same `RAG_SERVICE_API_KEY` as the backend. Compose sets the internal
RAG URL, upload path, and Chroma persistence path automatically.

Use plain `KEY=value` lines. Single-quote values containing `$` or `#` as required
by Compose env-file syntax. Environment secrets are runtime settings and are never
baked into images. Never commit actual environment files or private keys.

## 3. Enable deployment

In **Settings → Secrets and variables → Actions → Variables**, add:

| Variable | Value |
| --- | --- |
| `DEPLOY_ENABLED` | `true` |
| `SSH_HOST` | Optional; defaults to `161.97.165.83` |
| `SSH_USER` | Optional; defaults to `root` |
| `SSH_PORT` | Optional; defaults to `22` |

Push to `main` or `master`, or run **Build and deploy Docker images** from the
Actions tab. Until `DEPLOY_ENABLED=true`, the workflow only builds and pushes images.
Ensure server port 80 is available and allowed through the firewall. Set
`FRONTEND_PORT` in `SERVER_ENV` if another application already uses port 80.

Open `http://161.97.165.83`. The frontend proxies API calls through `/backend`.
The backend port is bound to server loopback and RAG has no published port.
Health is available at `http://161.97.165.83/backend/health`.
Widget JavaScript is available at `http://161.97.165.83/rag-chat-widget.iife.js`.

For Meta/Twilio callbacks, configure a domain and HTTPS reverse proxy, update
`PUBLIC_BACKEND_URL` to `https://YOUR_DOMAIN/backend`, and configure provider
webhooks using that base URL. For example, the WhatsApp webhook path becomes
`https://YOUR_DOMAIN/backend/api/whatsapp/webhook`.

## Server operations

```bash
cd /opt/whatsapp-chatbot
docker compose ps
docker compose logs --tail=100 backend rag-service
# Redeploy an earlier successful commit:
bash deploy.sh FULL_PREVIOUS_COMMIT_SHA
```

Uploads and Chroma indexes persist in named Docker volumes across deployments.
Back up MongoDB and both volumes before migrating an existing installation. These
new volumes do not automatically import files from previous containers or folders.
Do not use `docker compose down -v` unless you intend to delete the persisted data.
If deployment fails, inspect Actions output and server logs; automatic rollback
is not performed. Update GitHub environment secrets to make persistent configuration
changes, since each deployment copies them to the server again.
