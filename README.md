# Friend Launcher (FMCL)

Access your friend's world easily! A custom Minecraft launcher built with Electron, React, and Hyperswarm.

## Features

- **P2P Multiplayer**: Connect to your friend's LAN world over the internet using a sleek, pirate-bay style P2P tunnel. No port forwarding required!
- **Offline Mode Support**: Includes built-in support for **Authlib Injector** and an internal Permissive Mock Authentication Server. This allows standard "Open to LAN" games (which are natively Online Mode) to work seamlessly with offline/cracked clients.
- **Auto-Updates**: Automatically checks for updates from this repository's releases and updates itself.
- **Modern UI**: Dark-themed, responsive interface built with React and Tailwind CSS.

## How it Works

1. **Host**: Launches the game, opens a world to LAN. The launcher creates a P2P tunnel (Hyperswarm) securely routing traffic to the LAN port.
2. **Join**: Enters the P2P connection code. The launcher connects to the host via the P2P swarm and creates a local tunnel. The player joins `localhost:randomPort`.
3. **Authentication**: The launcher uses `authlib-injector.jar` (downloaded automatically) to hijack the game's authentication calls. It redirects them to an internal "Mock Yggdrasil" server inside the Electron app. This server approves all sessions, bypassing Mojang's online checks.

## Development

### Prerequisites
- Node.js (v18+)
- npm

### Setup
```bash
git clone https://github.com/malyarq/fmcl.git
cd fmcl
npm install
```

### Run Locally
```bash
npm run dev
```

### Build for Release
```bash
npm run build
```
The executable will be in the `release` (or `dist`) folder.

## Troubleshooting

- **"Invalid Session"**: Ensure `authlib-injector.jar` is present in the launcher root. The launcher should download it automatically.
- **Connection Issues**: P2P requires a reasonably open NAT. Symmetric NATs might have trouble connecting.

## License
MIT
