const protocol = require("minecraft-protocol");
const color = require("colors");
const fs = require("fs");

const targetServer = "nihilium.org";
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

  //const Chunk = prismarineChunk.PCChunk();

  const server = protocol.createServer({
    port: proxyPort,
    version: version,
    "online-mode": !cracked,
    motd: proxyMotd,
    maxPlayers: serverInfo.players.max
  });

  server.on("login", (client) => {
    console.log(`${color.green("[+]")} ${client.username} joined`)

    // open upstream connection *as soon as we know the username*
    let currentDimension;
    const upstream = protocol.createClient({
      username: client.username,
      host: targetServer,
      port: targetPort,
      version: version,
      auth: cracked ? "offline" : "microsoft"
    });

    // client  ->  upstream
    upstream.on("connect", () => {
      client.on("packet", (data, meta) => {
        upstream.write(meta.name, data)
      })
    });

    // upstream -> client
    upstream.on("packet", (data, meta) => {
      client.write(meta.name, data)

      if (meta.name == "login" && data.worldState?.name) {
        currentDimension = data.worldState.name.replace("minecraft:", "")

        if (!fs.existsSync(`${worldSaveDir}/${currentDimension}`)) {
          fs.mkdirSync(`${worldSaveDir}/${currentDimension}`)
        }
      }

      if (meta.name == "map_chunk" && data.chunkData) {
        fs.writeFileSync(`${worldSaveDir}/${currentDimension}/${data.x}_${data.y}.bin`, data.chunkData)
      }

      //if (meta.name == "map_chunk") console.log(data)
      console.log(meta.name, data)
    });


    const close = (reason, log = true) => {
      if (reason instanceof Error) {
        reason = reason.message || String(reason);
      }

      if (log) console.log(`${color.red("[-]")} ${client.username} disconnected (${reason})`)

      if (!client.ended) client.end(reason);
      if (!upstream.ended) upstream.end(reason);
    }

    client.on("end", () => close("Disconnected", false))
    client.on("error", (err) => close(err))

    upstream.on("end", () => close("Proxy error: upstream ended"))
    upstream.on("error", (err) => close(err))
  });
}

async function getServerInfo(ip, port) {
  return await protocol.ping({ host: ip, port: port });
}