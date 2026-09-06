# Panda JL-Studio

> **🌐 Live Application:** [https://jwlsync.redpandaium.com/](https://jwlsync.redpandaium.com/)  
>
> A privacy-first, 100% client-side utility for merging, organizing, searching, and sharing JW Library backups. 
>
> Crafted by [redpandaium.com](https://redpandaium.com).


> It's was inspired by the idea of https://github.com/j-syncer/Jw-sync-
>
> It's not a fork (different technology and features)

## 🚀 Features

- **Multi-Device Merge:** Restore is a full swap, not a merge. JW Sync combines phone and tablet backups without either overwriting the other.
- **Selective Sharing:** Export just the notes under a specific tag or date range without revealing your private library.
- **Tag & Topic Manager:** Bulk rename tags, merge duplicates, and recolor study topics.
- **Semantic & AI Search:** Search notes by meaning ("Ask Your Library") in addition to fast keyword matching.
- **Library Doctor:** Headless diagnostics to detect and prune duplicate notes, orphaned block ranges, and unused locations.
- **100% Client-Side Privacy:** SQLite operations run in-browser via WebAssembly (`sql.js`). No data is ever uploaded to any server.

## 🛠️ Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🐳 Docker Deployment (Standalone Compose)

You can deploy Panda JWL-Sync on any server or NAS with **just a `docker-compose.yml` file** (no source code or `Dockerfile` needed!):

```yaml
services:
  panda-jwl-sync:
    image: ghcr.io/mercu7io/jlib-sync:latest
    container_name: panda-jwl-sync
    ports:
      - "8080:80"
    restart: unless-stopped
```

### Launch or Update:

```bash
# Start the container
docker compose up -d

# Update to the latest version at any time (instant pull, no rebuild)
docker compose pull && docker compose up -d

# View logs
docker compose logs -f

# Stop container
docker compose down
```

The Docker image is built and published automatically to **GitHub Container Registry (GHCR)** via GitHub Actions on every push.

## 🏗️ Stack

- **Framework:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS (Dark Mode by default, `#ea580c` brand accent)
- **State Management:** Zustand (`useAppStore.ts`)
- **Database Engine:** WebAssembly SQLite (`sql.js` + `sql-wasm.wasm`)
- **Archiving:** JSZip with SHA-256 manifest verification
