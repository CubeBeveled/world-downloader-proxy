const protocol = require("minecraft-protocol");
const color = require("colors");
const fs = require("fs");
const zlib = require("zlib");

const targetServer = "play.6b6t.org";
const targetPort = 25565;
const proxyPort = 25566;

const cracked = true;
const version = "1.21";
const proxyMotd = `${targetServer}${targetPort == 25565 ? "" : `:${targetPort}`} [ PROXIED ]`

const worldSaveDir = "world"

main();
async function main() {
  if (!fs.existsSync(`${worldSaveDir}`)) {
    fs.mkdirSync(`${worldSaveDir}`)
  }

  const serverInfo = await getServerInfo(targetServer, targetPort);

  const proxy = protocol.createServer({
    port: proxyPort,
    version: version,
    "online-mode": !cracked,
    motd: proxyMotd,
    maxPlayers: serverInfo.players.max,
    //keepAlive: false // Not sure if i should change ts
  });

  proxy.on("listening", () => console.log(color.green(`Proxy listening on port ${proxyPort}`)))

  proxy.on("login", (client) => {
    console.log(`${color.green("[+]")} [${color.gray(client.version)}-${client.protocolVersion}] ${client.username} joined`)

    const server = protocol.createClient({
      username: client.username,
      host: targetServer,
      port: targetPort,
      version: version,
      auth: cracked ? "offline" : "microsoft",
      //keepAlive: false // Not sure if i should change ts
    });
    let currentDimension;

    function close(reason, log = true) {
      if (log) console.log(`${color.red("[-]")} ${client.username} disconnected (${reason})`)

      if (!client.ended) client.end(reason);
      if (!server.ended) server.end(reason);
    }

    client.on("end", (reason) => close(reason, false))
    client.on("error", (err) => close(err))

    server.on("end", (reason) => close(`Upstream ended: ${reason}`))
    server.on("error", (err) => close(err))

    // upstream -> client
    server.on("packet", async (data, meta) => {
      if (server.state !== protocol.states.PLAY || meta.state !== protocol.states.PLAY || client.ended) return;
      client.write(meta.name, data);

      if (meta.name == "login" && data.worldState?.name) {
        currentDimension = data.worldState.name.replace("minecraft:", "")

        if (!fs.existsSync(`${worldSaveDir}/${currentDimension}`)) {
          fs.mkdirSync(`${worldSaveDir}/${currentDimension}`)
        }
      }

      if (meta.name == "map_chunk" && data.chunkData) {
        fs.writeFileSync(`${worldSaveDir}/${currentDimension}/${data.x}_${data.z}.bin`, await compress(data.chunkData))
      }

      //if (meta.name.includes("map")) console.log(meta.name, data);
      //if (meta.name.includes("chat")) console.log(meta.name, data);
    });

    // client  ->  upstream
    client.on("packet", (data, meta) => {
      if (server.state !== protocol.states.PLAY || meta.state !== protocol.states.PLAY || server.ended) return;
      server.write(meta.name, data);
    });

    client.on("systemChat", (data) => {
      console.log(data)
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