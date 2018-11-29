"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const eventemitter3_1 = require("eventemitter3");
const url = __importStar(require("url"));
class websocket extends eventemitter3_1.EventEmitter {
    constructor(opts) {
        super();
        this.opts = opts;
    }
    get connected() {
        if (!this.socket) {
            return 0;
        }
        return this.socket.OPEN;
    }
    get connectting() {
        if (!this.socket) {
            return 0;
        }
        return this.socket.CONNECTING;
    }
    async connect() {
        if (this.socket) {
            return this;
        }
        this.socket = new WebSocket(url.format(this.opts));
        this.socket.binaryType = 'arraybuffer';
        this.socket.onmessage = (event) => {
            this.emit('message', event.data);
        };
        this.socket.onerror = this.emit.bind(this, 'error');
        this.socket.onopen = this.emit.bind(this, 'connected');
        this.socket.onclose = this.emit.bind(this, 'closed');
        return this;
    }
    async disconnect(code, reason) {
        if (this.socket) {
            this.socket.close(code, reason);
            this.socket = undefined;
        }
    }
    async send(buffer) {
        if (this.socket) {
            return this.socket.send(buffer);
        }
        return Promise.reject('socket hunup!');
    }
}
exports.websocket = websocket;
