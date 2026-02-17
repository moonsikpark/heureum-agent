# Required GitHub Repository Secrets

Configure these at: `https://github.com/moonsikpark/heureum-agent/settings/secrets/actions`

## Electron App Release (`release.yml`)

Triggered on tag push (`v*`). Builds and publishes DMG/EXE to GitHub Releases.

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `APPLE_ID` | Apple ID email for notarization | Your Apple Developer account email |
| `APPLE_ID_PASSWORD` | App-specific password for notarization | Generate at https://appleid.apple.com > Sign-In and Security > App-Specific Passwords |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID | https://developer.apple.com/account > Membership Details |
| `CSC_LINK` | Base64-encoded macOS signing certificate (`.p12`) | `base64 -i DeveloperIDApplication.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD` | Password for the `.p12` certificate | The password you set when exporting the certificate from Keychain Access |
| `WIN_CSC_LINK` | Base64-encoded Windows Authenticode certificate (`.pfx`) | `base64 -i authenticode.pfx \| pbcopy` |
| `WIN_CSC_KEY_PASSWORD` | Password for the `.pfx` certificate | The password from your certificate provider |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no configuration needed.

## AKS Deployment (`deploy.yml`)

Triggered on push to `main` (excluding `heureum-client/` and `*.md`). Builds Docker images, pushes to ACR, deploys to AKS.

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `AZURE_CREDENTIALS` | Azure service principal JSON for CI authentication | See command below |
| `OPENAI_API_KEY` | OpenAI API key for the agent service | https://platform.openai.com/api-keys |
| `DJANGO_SECRET_KEY` | Django secret key for the platform service | Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DATABASE_URL` | PostgreSQL connection string | Format: `postgresql://USER:PASSWORD@HOST:5432/DBNAME`. Get HOST from `terraform output pg_fqdn` |
| `VITE_API_URL` | Public URL for the platform API (used at frontend build time) | The ingress public URL, e.g. `https://heureum.example.com` |

### Generating `AZURE_CREDENTIALS`

```bash
az ad sp create-for-rbac \
  --name "heureum-github-actions" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/heureum-rg \
  --json-auth
```

Copy the entire JSON output as the secret value. It looks like:

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  ...
}
```
