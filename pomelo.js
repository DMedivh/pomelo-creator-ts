"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const url = __importStar(require("url"));
const websocket_1 = require("./lib/connections/websocket");
var pomelo;
(function (pomelo) {
    async function create(uri, opts) {
        const uri_desc = url.parse(uri);
        switch (uri_desc.protocol) {
            case 'ws:':
            case 'wss:':
                pomelo.connection = new websocket_1.websocketImpl(uri, opts);
                break;
            case 'socketio':
                break;
            case 'tcp':
                break;
            case 'udp:':
                break;
            case 'mqtt':
                break;
        }
        if (!pomelo.connection) {
            return Promise.reject(`un-implements connectin by protocol ${uri_desc.protocol}`);
        }
        return await pomelo.connection.connect(opts);
    }
    pomelo.create = create;
})(pomelo = exports.pomelo || (exports.pomelo = {}));
