# SteamID.js

A port of [xPaw/SteamID.php](https://github.com/xPaw/SteamID.php) to JavaSCript/TypeScript.

## Usage

```ts
import { SteamID } from "...";

const id = "your-steam-id";

const steamid = new SteamID(id).getAccountID();

console.log(steamid.getAccountID().toString());
```
