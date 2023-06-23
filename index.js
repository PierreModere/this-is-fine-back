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
      case "setMinigameMode":
        setMinigameMode(params);
        break;
      case "selectDuelContester":
        selectDuelContester(params);
        break;
      case "selectWinner":
        selectWinner(params);
        break;
      case "startGame":
        startGame(params);
        break;
      case "updatePlayerScore":
        updatePlayerScore(params);
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
      case "resetDuelStatus":
        resetDuelStatus(params);
        break;
      case "endMinigame":
        endMinigame(params);
        break;
      case "returnToDashboard":
        returnToDashboard(params);
        break;
      case "reconnectPlayer":
        reconnectPlayer(params);
        break;
      case "checkRoomExistance":
        checkRoomExistance(params);
        break;
      default:
        console.warn(`Type: ${type} unknown`);
        break;
    }
  });

  function create(params) {
    const room = genKey(4);
    rooms[room] = [ws];
    rooms[room].gameState = "gameConfiguration";
    rooms[room].gameMode = "Battle";
    rooms[room].firstMinigameID = Math.floor(Math.random() * (4 - 1)) + 1;

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
    const firstMinigameIDJson = {
      type: "receivedFirstMinigameID",
      params: {
        data: {
          message: `${rooms[room].firstMinigameID}`,
        },
      },
    };

    ws.send(JSON.stringify(firstMinigameIDJson));
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

    console.log(`Room ${room} has been joined!`);

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

    const firstMinigameIDJson = {
      type: "receivedFirstMinigameID",
      params: {
        data: {
          message: `${rooms[room].firstMinigameID}`,
        },
      },
    };

    ws.send(JSON.stringify(firstMinigameIDJson));

    rooms[room].firstMinigameID;
  }

  function leave(params) {
    const room = params.code;
    if (rooms[room]) {
      rooms[room] = rooms[room].filter((so) => so !== ws);
      ws["room"] = undefined;
      sendPlayersList(room);
      if (rooms[room].length == 0 || ws.isHost) close(room);
    }
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

  function checkRoomExistance(params) {
    const room = params.code;
    if (rooms[room]) {
      console.log("La room " + room + " existe !");
      if (rooms[room].filter((client) => client.id == params.id).length > 0) {
        const json = {
          type: "hasBeenInARoom",
          params: {
            data: {
              message: `rien`,
            },
          },
        };
        ws.send(JSON.stringify(json));
      }
    }
  }

  function reconnectPlayer(params) {
    const room = params.code;
    const playerID = params.id;
    if (rooms[room]) {
      if (rooms[room].filter((client) => client.id == playerID).length > 0) {
        const client = rooms[room].filter((client) => client.id == playerID)[0];
        ws["room"] = room;
        ws.id = client.id;
        ws.selectedCharacter = client.selectedCharacter
          ? client.selectedCharacter
          : "";
        rooms[room] = rooms[room].filter((client) => client.id != playerID);
        rooms[room].push(ws);
        generalInformation(ws, true);
      }
    }
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
function sendPlayersList(room, isDuelMode) {
  const json = {
    type: "receivedPlayersList",
    params: {
      data: {
        clientsList: [],
      },
    },
  };

  rooms[room].forEach(({ id, isReady, isDuel, selectedCharacter, score }) => {
    const clientData = {
      id: id,
      isReady: isReady,
      isDuel: isDuel,
      selectedCharacter: selectedCharacter ? selectedCharacter : "",
      score: score,
    };
    json.params.data.clientsList.push(clientData);
  });
  if (isDuelMode) {
    json.params.data.clientsList.filter((client) => client.isDuel === true);
  }
  rooms[room].forEach((client) => {
    sendPlayerID(client);
    client.send(JSON.stringify(json));
  });
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

  if (rooms[room]) {
    if (
      rooms[room].gameMode == "Duel" &&
      rooms[room].gameState == "minigameLaunched" &&
      rooms[room].filter((client) => client.isDuel).length >= 2
    ) {
      rooms[room]
        .filter((client) => client.isDuel)
        .forEach((client) => client.send(JSON.stringify(json)));
      console.log("on renvoit aux duelists");
    } else {
      rooms[room].forEach((client) => client.send(JSON.stringify(json)));
    }
  }
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

  if (rooms[room].gameMode == "Duel") {
    rooms[room]
      .filter((client) => client.isDuel)
      .forEach((client) => client.send(JSON.stringify(json)));
  } else rooms[room].forEach((client) => client.send(JSON.stringify(json)));
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

function resetAllReadyState(room) {
  if (!rooms[room] || rooms[room] == null) return;

  rooms[room].forEach((client) => {
    client.isReady = false;
  });
  sendPlayersList(room);
}

function selectMinigame(params) {
  const room = params.code;
  const minigameID = params.minigameID;

  if (minigameID == null || minigameID == "") return;

  rooms[room].gameState = "minigameLaunched";

  const json = {
    type: "receivedSelectedMinigame",
    params: {
      data: {
        message: `${minigameID}`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));

  changeScreen({ code: room, screenName: "MinigameInstructionsCanvas" });

  resetAllReadyState(room);
  resetPlayersScore(room);
}

function setMinigameMode(params) {
  const room = params.code;
  const mode = params.mode;

  const duelHostID = params.id;

  if (mode == null || mode == "") return;

  rooms[room].gameMode = mode;
  const json = {
    type: "setMinigameMode",
    params: {
      data: {
        message: `${mode}`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));

  if (rooms[room].gameMode == "Battle") {
    const jsonForHost = {
      type: "changedScreen",
      params: {
        data: {
          message: `MinigameSelectionCanvas`,
        },
      },
    };

    rooms[room]
      .filter((client) => client.isHost)[0]
      .send(JSON.stringify(jsonForHost));

    const jsonForNoHost = {
      type: "changedScreen",
      params: {
        data: {
          message: `MinigameWaitingCanvas`,
        },
      },
    };

    rooms[room]
      .filter((client) => !client.isHost)
      .forEach((client) => client.send(JSON.stringify(jsonForNoHost)));
  }

  if (rooms[room].gameMode == "Duel" && duelHostID) {
    const jsonForDuelHost = {
      type: "changedScreen",
      params: {
        data: {
          message: `DuelSelectionCanvas`,
        },
      },
    };

    let duelHost = rooms[room].filter((client) => client.id == duelHostID)[0];

    duelHost.isDuelHost = true;
    duelHost.isDuel = true;

    duelHost.send(JSON.stringify(jsonForDuelHost));

    const jsonForNoDuelHosts = {
      type: "changedScreen",
      params: {
        data: {
          message: `DuelWaitingCanvas`,
        },
      },
    };

    rooms[room]
      .filter((client) => !client.isDuel)
      .forEach((client) => client.send(JSON.stringify(jsonForNoDuelHosts)));
  }

  sendPlayersList(room);
}

function endMinigame(params) {
  const room = params.code;

  if (room == null || room == "") return;

  rooms[room].gameState = "onResults";

  const json = {
    type: "finishMinigameAnimation",
    params: {
      data: {
        message: `rien`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));

  // changeScene({ code: room, sceneName: "MinigamesMenuScene" });
}

function returnToDashboard(params) {
  rooms[params.code].gameMode = "Battle";
  rooms[params.code].gameState = "onDashboard";

  changeScene({ code: params.code, sceneName: "MinigamesMenuScene" });
  changeScreen({ code: params.code, screenName: "DashboardCanvas" });
  resetDuelStatus({ code: params.code });
}

function selectDuelContester(params) {
  const room = params.code;
  const id = params.id;

  if (id == null || id == "") return;

  let duelContester = rooms[room].filter((client) => client.id == id)[0];
  duelContester.isDuel = true;

  const json = {
    type: "changedScreen",
    params: {
      data: {
        message: `MinigameSelectionCanvas`,
      },
    },
  };

  rooms[room]
    .filter((client) => client.isDuelHost)[0]
    .send(JSON.stringify(json));

  sendPlayersList(room, true);
}

function selectWinner(params) {
  const room = params.code;
  const id = params.id;

  if (room == null || id == "") return;

  const json = {
    type: "selectedWinner",
    params: {
      data: {
        message: `${id}`,
      },
    },
  };

  console.log("Winner is : " + id);

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));
}

function resetDuelStatus(params) {
  const room = params.code;

  if (room == null || room == "") return;

  rooms[room].forEach((client) => {
    client.isDuel = false;
    client.isDuelHost = false;
  });
  sendPlayersList(room);
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
        message: `MinigamesMenuScene`,
      },
    },
  };

  rooms[room].forEach((client) => client.send(JSON.stringify(json)));

  sendPlayersList(room);
}

function updatePlayerScore(params) {
  const room = params.code;
  const id = params.id;
  const score = params.score;

  if (room == null || room == "") return;

  rooms[room].filter((client) => client.id == id)[0].score = score;
  console.log("player " + id + " : " + score);
  sendPlayersList(room);
}

function resetPlayersScore(room) {
  rooms[room].forEach((client) => (client.score = 0));
  sendPlayersList(room);
}

function generalInformation(ws, isReconnecting) {
  if (!isReconnecting) ws.id = rooms[ws["room"]].length;
  ws.isReady = false;
  ws.isDuel = false;
  ws.score = 0;
  sendPlayerID(ws);
  sendPlayersList(ws["room"]);
}
