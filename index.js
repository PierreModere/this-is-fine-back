const express = require("express");
const { createServer } = require("http");
const WebSocket = require("ws");

const app = express();
const port = 1234;

const server = createServer(app);

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
      case "delete":
        deleteRoom(params);
        break;
      case "join":
        join(params);
        break;
      case "leave":
        leave(params);
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

  var int = 0;

  function IncrementInteger() {
    int++;
    // rooms["WSYQ7"].forEach((cl) => cl.send(JSON.stringify(int)));
    const json = {
      type: "action",
      params: { action: "IncrementInteger", data: "message" },
    };
    rooms["WSYQ7"].forEach((cl) => cl.send(JSON.stringify(json)));
  }

  function create(params) {
    const room = genKey(5);
    rooms[room] = [ws];
    ws["room"] = room;
    generalInformation(ws);
    console.log(`Room with pin code ${room} created!`);
    const json = {
      type: "createdRoom",
      params: { action: null, data: `${room}` },
    };
    ws.send(JSON.stringify(json));
  }

  function deleteRoom(params) {
    const room = params.code;
    delete rooms[room];
  }

  function join(params) {
    const room = params.code;
    if (!Object.keys(rooms).includes(room)) {
      console.warn(`Room ${room} does not exist!`);
      return;
    }

    if (rooms[room].length >= maxClients) {
      console.warn(`Room ${room} is full!`);
      return;
    }

    rooms[room].push(ws);
    ws["room"] = room;
    generalInformation(ws);

    const json = {
      type: "joinedRoom",
      params: { action: null, data: `${room}` },
    };
    ws.send(JSON.stringify(json));
  }

  function leave(params) {
    const room = ws.room;
    rooms[room] = rooms[room].filter((so) => so !== ws);
    ws["room"] = undefined;

    if (rooms[room].length == 0) close(room);
  }

  function close(room) {
    rooms = rooms.filter((key) => key !== room);
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

function generalInformation(ws) {
  let obj;
  if (ws["room"] === undefined)
    obj = {
      type: "info",
      params: {
        room: ws["room"],
        "no-clients": rooms[ws["room"]].length,
      },
    };
  else
    obj = {
      type: "info",
      params: {
        room: "no room",
      },
    };

  // ws.send(JSON.stringify(obj));
}
