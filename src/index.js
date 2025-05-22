const protocol = require("minecraft-protocol");
const color = require("colors");
const fs = require("fs");
const zlib = require("zlib");

const targetServer = "play.6b6t.org";
const targetPort = 25565;
const proxyPort = 25566;

const cracked = true;
const keepAlive = false;
const version = "1.20"; // Don't use 1.20.5 or later (transfer packets = gay)
const proxyMotd = `${targetServer}${targetPort == 25565 ? "" : `:${targetPort}`} [ PROXIED ]`

const worldSaveDir = "world"

main();
async function main() {
  if (!fs.existsSync(`${worldSaveDir}`)) {
    fs.mkdirSync(`${worldSaveDir}`)
  }

  const serverInfo = await getServerInfo(targetServer, targetPort);

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
    maxPlayers: serverInfo.players.max,
    keepAlive
  });

  proxy.on("listening", () => console.log(color.green(`Proxy listening on port ${proxyPort}`)))

  proxy.on("login", (client) => {
    console.log(`${color.green("[+]")} [${client.version}-${client.protocolVersion}] ${client.username} joined`)

    const server = protocol.createClient({
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
        console.log(color.yellow(`Error:`), reason)
      }

      if (log) console.log(`${color.red("[-]")} ${client.username} disconnected (${reason})`);

      if (!client.ended && !intendedToLeave) client.end(reason);
    }

    client.on("end", (reason) => close(reason, false))
    client.on("error", (err) => close(err))

    server.on("end", (reason) => close(`Upstream ended: ${reason}`, !intendedToLeave))
    server.on("error", (err) => close(err))

    // upstream -> client
    server.on("packet", async (data, meta) => {
      //if (meta.name != "teams" && meta.name != "playerlist_header" && !meta.name.includes("entity")) console.log(meta.name, data);
      if (meta.name.includes("chat")) console.log(meta.name, data);

      if (client.state !== protocol.states.PLAY || meta.state != protocol.states.PLAY || client.ended) return;

      client.write(meta.name, data);

      if (meta.name === "compress" || meta.name == "set_compression") client.compressionThreshold = data.threshold;

      if (meta.name == "login") {
        if (data.worldState?.name) {
          currentDimension = data.worldState.name.replace("minecraft:", "")
        } else if (data.worldType) {
          currentDimension = data.worldType
        }

        if (!fs.existsSync(`${worldSaveDir}/${currentDimension}`)) {
          fs.mkdirSync(`${worldSaveDir}/${currentDimension}`)
        }
      }

      if (meta.name == "system_chat") {
        const msg = toPlainText(data.content);

        if (msg.includes("Welcome to 6b6t.org, ")) {
          saveChunks = true;
          console.log(prefix(color.green("Started saving chunks")))
        }
      }

      if (meta.name == "map_chunk" && saveChunks && data.chunkData) {
        fs.writeFileSync(`${worldSaveDir}/${currentDimension}/${data.x}_${data.z}.bin`, await compress(data.chunkData))
      }

      if (meta.name == "kick_disconnect") {
        intendedToLeave = true;
        console.log(`${color.red("[-]")} ${client.username} got kicked`);
      }

      if (meta.name == "disconnect") {
        intendedToLeave = true;
        console.log(`${color.red("[-]")} ${client.username} disconnected`);
      }
    });

    // client  ->  upstream
    client.on("packet", (data, meta) => {
      if (server.state != protocol.states.PLAY || meta.state != protocol.states.PLAY || server.ended) return;

      server.write(meta.name, data);
    });
  });
}

async function getServerInfo(ip, port) {
  return await protocol.ping({ host: ip, port: port });
}

function compress(buffer) {
  return new Promise((resolve, reject) => {
    zlib.gzip(buffer, (err, compressedBuffer) => {
      if (err) {
        console.error("Compression error:", err);
        reject()
      } else { resolve(compressedBuffer) }
    });
  });
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