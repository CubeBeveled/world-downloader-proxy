# World downloader
*proxy edition*
People can join and it saves the chunks they load

## Packet Discoveries
### block_change
```json
{ location: { x: 94, z: 93, y: 113 }, type: 2354 }
```

### acknowledge_player_digging
```json
{ sequenceId: 0 }
```

### collect
```json
{
  collectedEntityId: 9786751,
  collectorEntityId: 9782778,
  pickupItemCount: 1
}
```

### set_slot
```json
{
  windowId: 0,
  stateId: 4,
  slot: 43,
  item: { present: true, itemId: 657, itemCount: 41, nbtData: undefined }
}
```

### system_chat
System (server) chat messages
```json
{
  content: '{"translate":"sleep.players_sleeping","with":["1","133"]}',
  isActionBar: true
}
```

### map_chunk
used to send chunk data

```json
{
  x: 22,
  z: 14,
  heightmaps: {
    type: 'compound',
    value: { MOTION_BLOCKING: [Object], WORLD_SURFACE: [Object] }
  },
  chunkData: <Buffer 00 00 00 00 00 00 38 00 00 00 00 00 00 00 38 00 00 00 00 00 00 00 38 00 00 00 00 00 00 00 38 00 00 00 00 00 00 00 38 00 00 00 00 00 00 00 38 00 00 00 ... 78 more bytes>,
  blockEntities: [],
  skyLightMask: [],
  blockLightMask: [],
  emptySkyLightMask: [],
  emptyBlockLightMask: [],
  skyLight: [],
  blockLight: []
}
```

Detection/Debug code
```js
if (meta.name == "map_chunk") console.log(data)
```

### login
used to initialize like the thangs
```json
{
  entityId: 2703,
  isHardcore: false,
  worldNames: [ 'minecraft:overworld', 'minecraft:the_end' ],
  maxPlayers: 100,
  viewDistance: 3,
  simulationDistance: 1,
  reducedDebugInfo: false,
  enableRespawnScreen: true,
  doLimitedCrafting: false,
  worldState: {
    dimension: 2,
    name: 'minecraft:the_end',
    hashedSeed: -1196981485148785952n,
    gamemode: 'survival',
    previousGamemode: 255,
    isDebug: false,
    isFlat: false,
    death: undefined,
    portalCooldown: 0
  },
  enforcesSecureChat: false
}
```

### declare_commands
used to declare commands

```json
{
  flags: {
    unused: 0,
    has_custom_suggestions: 0,
    has_redirect_node: 0,
    has_command: 1,
    command_node_type: 1
  },
  children: [ 128 ],
  redirectNode: undefined,
  extraNodeData: { name: 'bukkit:help' }
},
{
  flags: {
    unused: 0,
    has_custom_suggestions: 0,
    has_redirect_node: 0,
    has_command: 1,
    command_node_type: 1
  },
  children: [ 129 ],
  redirectNode: undefined,
  extraNodeData: { name: 'help' }
},
```
Detection/Debug code
```js
if (meta.name == "declare_commands") data.nodes.forEach(console.log)
```

[useful project](https://github.com/MineProxy/mineproxy/blob/master/lib/Proxy.js)
