const protocol = require("minecraft-protocol");
const color = require("colors");
const zlib = require("zlib");
const fs = require("fs");

const targetServer = "play.6b6t.org";
const targetPort = 25565;
const proxyPort = 25566;

const cracked = true;
const keepAlive = false;
const version = "1.20"; // Don't use 1.20.5 or later (transfer packets = gay)
const fetchServerInfo = false;
const proxyMotd = `${targetServer}${
  targetPort == 25565 ? "" : `:${targetPort}`
} [ PROXIED ]`;

const worldSaveDir = "world";
const useSaveBounds = true;
const asyncSaving = true;
const saveBoundA = { x: 130000, z: 130000 };
const saveBoundB = { x: -130000, z: -130000 };

main();
async function main() {
  if (!fs.existsSync(`${worldSaveDir}`)) {
    fs.mkdirSync(`${worldSaveDir}`);
  }

  const serverInfo = fetchServerInfo
    ? await getServerInfo(targetServer, targetPort)
    : undefined;

  const sleep = (ms) => {
    return new Promise((r) => {
      setTimeout(r, ms);
    });
  };

  const proxy = protocol.createServer({
    port: proxyPort,
    version: version,
    "online-mode": !cracked,
    motd: proxyMotd,
    maxPlayers: serverInfo?.players.max | 100,
    keepAlive,
  });

  proxy.on("listening", () =>
    console.log(
      color.green(`Proxy listening on port ${proxyPort} (${version})`)
    )
  );

  proxy.on("login", (client) => {
    console.log(
      `${color.green("[+]")} [${client.version}-${client.protocolVersion}] ${
        client.username
      } joined`
    );

    let server = protocol.createClient({
      username: client.username,
      host: targetServer,
      port: targetPort,
      version: version,
      auth: cracked ? "offline" : "microsoft",
      keepAlive,
    });

    server.ended = false;

    let intendedToLeave = false;
    let saveChunks = false;
    let currentDimension;

    const prefix = (text) => `[${client.username}] ` + text;

    async function close(reason, log = true) {
      await sleep(300);

      if (reason instanceof Error) {
        reason = "Disconnected";
        console.log(color.yellow(`Error:`), reason);
      }

      if (log)
        console.log(
          `${color.red("[-]")} ${client.username} disconnected (${reason})`
        );

      if (!client.ended && !intendedToLeave) client.end(reason);
      if (!server.ended) server.end();
    }

    client.on("end", (reason) => close(reason, false));
    client.on("error", (err) => close(err));

    server.on("end", (reason) =>
      close(`Upstream ended: ${reason}`, !intendedToLeave)
    );
    server.on("error", (err) => close(err));

    // upstream -> client
    server.on("packet", (data, meta) => {
      if (
        client.state !== protocol.states.PLAY ||
        meta.state != protocol.states.PLAY ||
        client.ended
      )
        return;

      //const dontlog = new Set(["teams", "bundle_delimiter", "map_chunk", "window_items", "declare_commands", "playerlist_header", "update_time", "player_remove"]);
      //if (!dontlog.has(meta.name) && !meta.name.includes("entity")) console.log(meta.name, data);

      client.write(meta.name, data);

      if (meta.name === "compress" || meta.name == "set_compression")
        client.compressionThreshold = data.threshold;

      if (meta.name == "login" || meta.name == "respawn") {
        if (meta.name == "login") {
          if (data.worldState?.name) {
            currentDimension = data.worldState.name.replace("minecraft:", "");
          } else if (data.worldType) {
            currentDimension = data.worldType;
          }
        } else if (meta.name == "respawn") {
          if (data.dimension) currentDimension = data.dimension;
          else if (data.worldName)
            currentDimension = data.worldName.replace("minecraft:", "");
        }

        if (!fs.existsSync(`${worldSaveDir}/${currentDimension}`)) {
          fs.mkdirSync(`${worldSaveDir}/${currentDimension}`);
        }
      }

      if (meta.name == "system_chat") {
        const msg = toPlainText(data.content);

        if (msg.includes("Welcome to 6b6t.org, ")) {
          saveChunks = true;
          console.log(prefix(color.green("Started saving chunks")));
        }

        if (
          msg.startsWith("The target server is offline now!") ||
          msg == "6b6t.org is full"
        ) {
          saveChunks = false;
        }
      }

      if (meta.name == "kick_disconnect") {
        intendedToLeave = true;
        console.log(`${color.red("[-]")} ${client.username} got kicked`);
      }

      if (meta.name == "disconnect") {
        intendedToLeave = true;
        console.log(`${color.red("[-]")} ${client.username} disconnected`);
      }

      if (meta.name == "map_chunk" && saveChunks && data.chunkData) {
        const chunkPos = {
          x: data.x * 16,
          z: data.z * 16,
        };
        const chunkPath = `${worldSaveDir}/${currentDimension}/${data.x}_${data.z}_${client.username}.bin`;

        if (useSaveBounds && !isPosInBounds(saveBoundA, saveBoundB, chunkPos))
          return;

        if (asyncSaving) fs.writeFile(chunkPath, compress(data.chunkData));
        else fs.writeFileSync(chunkPath), compress(data.chunkData);
      }
    });

    // client  ->  upstream
    client.on("packet", (data, meta) => {
      if (
        server.state != protocol.states.PLAY ||
        meta.state != protocol.states.PLAY ||
        server.ended
      )
        return;

      server.write(meta.name, data);
    });
  });
}

async function getServerInfo(ip, port) {
  return await protocol.ping({ host: ip, port: port });
}

function compress(buffer) {
  return zlib.gzipSync(buffer);
}

function toPlainText(json) {
  if (typeof json == "string") json = JSON.parse(json);

  let result = json.text || "";

  if (Array.isArray(json.extra)) {
    for (const part of json.extra) {
      result += toPlainText(part);
    }
  }

  return result;
}

function isPosInBounds(bpos1, bpos2, pos) {
  const { x: x1, z: z1 } = bpos1;
  const { x: x2, z: z2 } = bpos2;
  const { x: px, z: pz } = pos;

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);

  return px >= minX && px <= maxX && pz >= minZ && pz <= maxZ;
}
