const express = require("express");
const { createServer } = require("http");
const WebSocket = require("ws");
const fs = require("node:fs");

const app = express();
const port = 1234;

var server;
try {
  fileContents = fs.readFileSync(
    "/etc/letsencrypt/live/this-is-fine-server.me/privkey.pem"
  );
  console.log("is secure");
  const options = {
    key: fs.readFileSync(
      "/etc/letsencrypt/live/this-is-fine-server.me/privkey.pem"
    ),
    cert: fs.readFileSync(
      "/etc/letsencrypt/live/this-is-fine-server.me/cert.pem"
    ),
  };
  server = createServer(options, app);
} catch (err) {
  server = createServer(app);
}

const maxClients = 4;
let rooms = {};
const wss = new WebSocket.Server({ server });

wss.on("connection", function connection(ws) {
  ws.on("message", function message(data) {
    const obj = JSON.parse(data.replace(/'/g, `"`));
    const type = obj.type;
    const params = obj.params;

    switch (type) {
      case "action":
        action(params);
        break;
      case "create":
        create(params);
        break;
      case "join":
        join(params);
        break;
      case "leave":
        leave(params);
        break;
      case "delete":
        deleteRoom(params);
        break;
      case "selectCharacter":
        selectCharacter(params);
        break;
      case "unselectCharacter":
        unselectCharacter(params);
        break;
      case "selectMinigame":
        selectMinigame(params);
        break;
      case "startGame":
        startGame(params);
        break;
      case "changeScreen":
        changeScreen(params);
        break;
      case "changeScene":
        changeScene(params);
        break;
      case "playerIsReady":
        changePlayerReadyState(params);
        break;
      default:
        console.warn(`Type: ${type} unknown`);
        break;
    }
  });

  function action(params) {
    const actionFunction = params.action;
    switch (actionFunction) {
      case actionFunction:
        IncrementInteger();
        break;
    }
  }

  function create(params) {
    const room = genKey(4);
    rooms[room] = [ws];
    rooms[room].gameState = "gameConfiguration";
    ws["room"] = room;
    console.log(`Room with pin code ${room} created!`);
    const json = {
      type: "createdRoom",
      params: {
        data: {
          message: `${room}`,
        },
      },
    };
    ws.send(JSON.stringify(json));
    ws.isHost = true;
    generalInformation(ws);
  }

  function deleteRoom(params) {
    const room = params.code;
    delete rooms[room];
    console.log(`Room with pin code ${room} deleted!`);
  }

  function join(params) {
    const room = params.code;
    if (!Object.keys(rooms).includes(room)) {
      const json = {
        type: "serverErrorMessage",
        params: {
          data: {
            message: `Room ${room} does not exist!`,
          },
        },
      };
      console.warn(`Room ${room} does not exist!`);

      ws.send(JSON.stringify(json));
      return;
    }

    if (rooms[room].length >= maxClients) {
      const json = {
        type: "serverErrorMessage",
        params: {
          data: {
            message: `Room ${room} is full!`,
          },
        },
      };
      console.warn(`Room ${room} is full!`);
      ws.send(JSON.stringify(json));
      return;
    }

    if (rooms[room].gameState != "gameConfiguration") {
      const json = {
        type: "serverErrorMessage",
        params: {
          data: {
            message: `Room ${room} game has already been launch!`,
          },
        },
      };
      console.warn(`Room ${room} game has already been launch!`);
      ws.send(JSON.stringify(json));
      return;
    }

    rooms[room].push(ws);
    ws["room"] = room;
    generalInformation(ws);

    const json = {
      type: "joinedRoom",
      params: {
        data: {
          message: `${room}`,
        },
      },
    };

    ws.send(JSON.stringify(json));
  }

  function leave(params) {
    const room = params.code;
    rooms[room] = rooms[room].filter((so) => so !== ws);
    ws["room"] = undefined;
    sendPlayersList(room);
    if (rooms[room].length == 0 || ws.isHost) close(room);
  }

  function close(room) {
    const json = {
      type: "serverErrorMessage",
      params: {
        data: {
          message: `The host has closed the room`,
        },
      },
    };
    rooms[room].forEach((client) => client.send(JSON.stringify(json)));
    delete rooms[room];
    console.log(`Room with pin code ${room} deleted!`);
  }
});

server.listen(port, function () {
  console.log(`Listening on http://localhost:${port}`);
});

function genKey(length) {
  let result = "";
  const characters = "0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
function sendPlayersList(roomPincode) {
  const json = {
    type: "receivedPlayersList",
    params: {
      data: {
        clientsList: [],
      },
    },
  };

  rooms[roomPincode].forEach(({ id, isReady, selectedCharacter }) => {
    const clientData = {
      id: id,
      isReady: isReady ? isReady : false,
      selectedCharacter: selectedCharacter ? selectedCharacter : "",
    };
    json.params.data.clientsList.push(clientData);
  });
  rooms[roomPincode].forEach((client) => client.send(JSON.stringify(json)));
}

function sendPlayerID(ws) {
  if (ws.id != null && ws.id != "") {
    const json = {
      type: "getMyPlayerID",
      params: {
        data: {
          message: `${ws.id}`,
        },
      },
    };
    ws.send(JSON.stringify(json));
  }
}

function changeScreen(params) {
  const room = params.code;
  const screenName = params.screenName;

  if (screenName == null || screenName == "") return;

  const json = {
    type: "changedScreen",
    params: {
      data: {
        message: `${screenName}`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));
}

function changeScene(params) {
  const room = params.code;
  const sceneName = params.sceneName;

  if (sceneName == null || sceneName == "") return;

  const json = {
    type: "changedScene",
    params: {
      data: {
        message: `${sceneName}`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));
}

function selectCharacter(params) {
  const room = params.code;
  const id = params.id;
  const characterName = params.characterName;

  if (characterName == null || characterName == "") return;

  let ws = rooms[room].filter((client) => client.id == id)[0];
  ws.selectedCharacter = characterName;
  ws.isReady = true;

  const json = {
    type: "getMySelectedCharacter",
    params: {
      data: {
        message: `${ws.selectedCharacter}`,
      },
    },
  };
  ws.send(JSON.stringify(json));

  sendPlayersList(room);
}

function unselectCharacter(params) {
  const room = params.code;
  const id = params.id;

  if (id == null || id == "") return;

  let ws = rooms[room].filter((client) => client.id == id)[0];
  ws.selectedCharacter = "";
  ws.isReady = false;

  const json = {
    type: "getMySelectedCharacter",
    params: {
      data: {
        message: `${ws.selectedCharacter}`,
      },
    },
  };
  ws.send(JSON.stringify(json));

  sendPlayersList(room);
}

function changePlayerReadyState(params) {
  const room = params.code;
  const id = params.id;
  if (id == null || id == "") return;

  let ws = rooms[room].filter((client) => client.id == id)[0];
  ws.isReady = true;

  sendPlayersList(room);
}

function selectMinigame(params) {
  const room = params.code;
  const minigameID = params.minigameID;

  if (minigameID == null || minigameID == "") return;

  const json = {
    type: "receivedSelectedMinigame",
    params: {
      data: {
        message: `${minigameID}`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));
}
function startGame(params) {
  const room = params.code;
  rooms[room].gameState = "launchedGame";

  rooms[room].forEach((client) => {
    client.isReady = false;
  });

  const json = {
    type: "changedScene",
    params: {
      data: {
        message: `StartGameScene`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));

  sendPlayersList(room);
}

function generalInformation(ws) {
  ws.id = rooms[ws["room"]].length;
  sendPlayerID(ws);
  sendPlayersList(ws["room"]);
}
