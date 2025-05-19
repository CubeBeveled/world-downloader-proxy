const protocol = require("minecraft-protocol");
const color = require("colors");

const targetServer = "play.6b6t.org";
const targetPort = 25565;
const proxyPort = 25566;

const version = "1.21"
const cracked = true;
const proxyMotd = `${targetServer}${targetPort == 25565 ? "" : `:${targetPort}`} [ PROXIED ]`

main();
async function main() {
  const serverInfo = await getServerInfo(targetServer, targetPort);

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
    })

    // upstream -> client
    upstream.on("packet", (data, meta) => {
      client.write(meta.name, data)
    })


    const close = (reason, log = true) => {
      if (reason instanceof Error) {
        reason = reason.message || String(reason);
      }

      if (log) console.log(`${color.red("[-]")} ${client.username} disconnected (${reason})`)

      if (!client.ended) client.end(reason);
      if (!upstream.ended) upstream.end(reason);
    }

    client.on('end', () => close("Disconnected", false))
    client.on('error', (err) => close(err))

    upstream.on('end', () => close("Proxy error: upstream ended"))
    upstream.on('error', (err) => close(err))
  });
}

async function getServerInfo(ip, port) {
  return await protocol.ping({ host: ip, port: port });
}