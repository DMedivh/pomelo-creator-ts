"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../connection");
const url = __importStar(require("url"));
class websocketImpl extends connection_1.ConnectionBase {
    constructor(uri, opts) {
        super();
        this.socket = null;
        this.id = opts.id || 'default';
        this.uri = url.parse(uri);
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
    async connect(opts) {
        super.connect(opts);
        if (this.uri.protocol === 'wss:') {
            this.socket = new WebSocket(url.format(this.uri));
        }
        else if (this.uri.protocol === 'ws:') {
            this.socket = new WebSocket(url.format(this.uri));
        }
        else {
            return Promise.reject(new Error(`un-support protocol ${this.uri.protocol} for websocket!`));
        }
        this.socket.binaryType = 'arraybuffer';
        this.socket.onmessage = (event) => {
            this.processPackage(event.data);
        };
        this.socket.onerror = (err) => {
            console.error('websocket error:', err);
            this.emit('error', err);
            this.disconnect();
        };
        this.socket.onopen = () => {
            this.handshake({
                'sys': {
                    type: 'COCOS_CREATOR_CLIENT',
                    version: opts.version || '1.0.0',
                    rsa: {},
                    protoVersion: this.protoVersion
                },
                'user': opts.user || {}
            });
        };
        this.socket.onclose = (event) => {
            console.warn('websocket closed');
            this.emit('disconnected', event);
            if (this.autoReconnect) {
                setTimeout(() => {
                    this.emit('reconnect');
                }, 1000);
            }
        };
        await new Promise((resolve, reject) => {
            const timer = setTimeout(reject, 1000);
            this.once('connected', () => {
                resolve();
                if (timer) {
                    clearTimeout(timer);
                }
            });
        });
    }
    async disconnect() {
        await super.disconnect();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
    async send(binary) {
        if (!this.connected) {
            return Promise.reject('socket hanup!');
        }
        if (this.socket) {
            this.socket.send(binary);
        }
    }
}
exports.websocketImpl = websocketImpl;
