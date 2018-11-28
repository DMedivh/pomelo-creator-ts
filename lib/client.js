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
const protocol_1 = require("./protocol");
const protobuf_1 = require("./protobuf");
const websocket_1 = require("./sockets/websocket");
const is = __importStar(require("is"));
var RESULT_CODE;
(function (RESULT_CODE) {
    RESULT_CODE[RESULT_CODE["RES_OK"] = 200] = "RES_OK";
    RESULT_CODE[RESULT_CODE["RES_FAIL"] = 500] = "RES_FAIL";
    RESULT_CODE[RESULT_CODE["RES_OLD_CLIENT"] = 501] = "RES_OLD_CLIENT";
})(RESULT_CODE || (RESULT_CODE = {}));
class Client extends eventemitter3_1.EventEmitter {
    constructor(uri) {
        super();
        this.id = '';
        this.protoVersion = '';
        this.serverProtos = {};
        this.clientProtos = {};
        this.dict = {};
        this.routeMap = {};
        this.abbrs = {};
        this.heartbeatInterval = 0;
        this.heartbeatTimeout = 0;
        this.nextHeartbeatTimeout = 0;
        this.heartbeatTimeoutId = null;
        this.heartbeatId = null;
        this.callbacks = {};
        this.connectting = false;
        this.auth = async function () {
            return false;
        };
        this.retry = 0;
        this.retryCounter = 0;
        this.reqId = 0;
        this.handshakeBuffer = {
            sys: {
                type: 'COCOS_CREATOR',
                version: '1.0.0',
                rsa: {},
                protoVersion: ''
            },
            user: {}
        };
        this.remote = url.parse(uri);
        this.encode = (reqId, route, msg = {}) => {
            if (this.clientProtos[route]) {
                msg = protobuf_1.encode(route, msg);
            }
            else {
                msg = protocol_1.strdecode(JSON.stringify(msg));
            }
            return protocol_1.Message.encode(reqId, reqId ? protocol_1.MessageType.TYPE_REQUEST : protocol_1.MessageType.TYPE_NOTIFY, this.dict[route], this.dict[route], msg);
        };
        this.decode = (data) => {
            const msg = protocol_1.Message.decode(data);
            if (msg.id > 0) {
                msg.route = this.routeMap[msg.id];
                delete this.routeMap[msg.id];
                if (!msg.route) {
                    return;
                }
            }
            const canver = (msg) => {
                let route = msg.route;
                //Decompose route from dict
                if (msg.compressRoute) {
                    if (!this.abbrs[route]) {
                        return {};
                    }
                    route = msg.route = this.abbrs[route];
                }
                if (this.serverProtos[route]) {
                    return protobuf_1.decode(route, msg.body);
                }
                else {
                    return JSON.parse(protocol_1.strdecode(msg.body));
                }
            };
            msg.body = canver(msg);
            return msg;
        };
        this.on('retry', () => {
            this.retryCounter++;
            if (this.retryCounter >= this.retry) {
                /// 别重试了 不行了
                this.emit('getout');
                return;
            }
            setTimeout(this.connect.bind(this), 1000);
        });
    }
    async connect(opts) {
        if (this.socket && (this.socket.connectting || this.socket.connected)) {
            return Promise.reject('connecting');
        }
        switch (this.remote.protocol) {
            case 'ws:':
            case 'wss:':
                this.socket = new websocket_1.websocket(this.remote);
                break;
            default:
                return Promise.reject('invalid socket protocol!');
        }
        if (opts) {
            if (opts.auth) {
                this.auth = opts.auth;
            }
            if (opts.retry) {
                this.retry = opts.retry;
            }
            this.handshakeBuffer.user = opts.user || {};
            if (opts.encode) {
                this.encode = opts.encode;
            }
            if (opts.decode) {
                this.decode = opts.decode;
            }
        }
        const protos = this.localStorage.getItem('protos');
        if (protos) {
            this.protoVersion = protos.version || '';
            this.serverProtos = protos.server || {};
            this.clientProtos = protos.client || {};
            protobuf_1.init({
                encoderProtos: this.clientProtos,
                decoderProtos: this.serverProtos
            });
        }
        this.handshakeBuffer.sys.protoVersion = this.protoVersion;
        this.socket.once('connected', () => {
            if (this.socket) {
                this.socket.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_HANDSHAKE, protocol_1.strencode(JSON.stringify(this.handshakeBuffer))));
            }
        });
        this.socket.on('error', this.emit.bind(this, 'error'));
        this.socket.on('message', this.processPackage.bind(this));
        this.socket.once('closed', () => {
            if (this.retry && this.retryCounter < this.retry) {
                this.emit('retry');
            }
            else {
                this.emit('getout');
            }
        });
        await this.socket.connect();
    }
    async request(route, msg) {
        if (!this.socket) {
            return Promise.reject('socket hunup on request!');
        }
        if (this.socket.connectting) {
            await new Promise((s, r) => {
                const timer = setTimeout(r.bind(r, new Error('socket timeout!')), 1000);
                this.once('ready', () => {
                    clearTimeout(timer);
                    s();
                });
            });
        }
        if (!!this.encode && is.function(this.encode)) {
            const body = this.encode(this.reqId, route, msg);
            if (body) {
                await this.socket.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_DATA, body));
            }
        }
        return await new Promise((resolve, reject) => {
            this.callbacks[this.reqId] = { resolve, reject };
            this.routeMap[this.reqId] = route;
        });
    }
    async notify(route, msg = {}) {
        if (!this.socket) {
            return Promise.reject('socket hunup on request!');
        }
        if (this.socket.connectting) {
            await new Promise((s, r) => {
                const timer = setTimeout(r.bind(r, new Error('socket timeout!')), 1000);
                this.once('ready', () => {
                    clearTimeout(timer);
                    s();
                });
            });
        }
        if (this.encode) {
            const body = this.encode(0, route, msg);
            if (body) {
                await this.socket.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_DATA, body));
            }
        }
    }
    async disconnect(code, reason) {
        if (this.heartbeatId) {
            clearTimeout(this.heartbeatId);
            this.heartbeatId = null;
        }
        if (this.heartbeatTimeoutId) {
            clearTimeout(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = null;
        }
        if (this.socket) {
            this.socket.disconnect(code, reason);
            this.socket = undefined;
        }
    }
    async handshake(data) {
        data = JSON.parse(protocol_1.strdecode(data));
        if (data.code === RESULT_CODE.RES_OLD_CLIENT) {
            this.emit('error', 'client version not fullfill');
            return;
        }
        if (data.code !== RESULT_CODE.RES_OK) {
            this.emit('error', `handshake failed by ${data.code}`);
            return;
        }
        if (data.sys && data.sys.heartbeat) {
            this.heartbeatInterval = data.sys.heartbeat * 1000; // heartbeat interval
            this.heartbeatTimeout = this.heartbeatInterval * 5; // max heartbeat timeout
        }
        else {
            this.heartbeatInterval = 0;
            this.heartbeatTimeout = 0;
        }
        if (data.sys.id) {
            this.id = data.sys.id;
        }
        this.dict = data.sys.dict;
        const protos = data.sys.protos;
        //Init compress dict
        if (this.dict) {
            this.abbrs = {};
            for (let route in this.dict) {
                this.abbrs[this.dict[route]] = route;
            }
        }
        //Init protobuf protos
        if (protos) {
            this.protoVersion = protos.version || 0;
            this.serverProtos = protos.server || {};
            this.clientProtos = protos.client || {};
            //Save protobuf protos to localStorage
            this.localStorage.setItem('protos', JSON.stringify(protos));
            protobuf_1.init({ encoderProtos: protos.client, decoderProtos: protos.server });
        }
        if (this.socket) {
            this.socket.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_HANDSHAKE_ACK));
        }
        else {
            Promise.reject('invalid socket!');
        }
    }
    async processPackage(data) {
        let msgs = protocol_1.Package.decode(data);
        if (!msgs) {
            return this.disconnect();
        }
        if (!is.array(msgs)) {
            msgs = [msgs];
        }
        for (let i in msgs) {
            const msg = msgs[i];
            switch (msg.type) {
                case protocol_1.PackageType.TYPE_HANDSHAKE:
                    await this.handshake(msg.body);
                    this.emit('connected');
                    if (!!this.auth && is.function(this.auth)) {
                        const ready = await this.auth();
                        if (ready) {
                            this.emit('ready', ready);
                        }
                    }
                    break;
                case protocol_1.PackageType.TYPE_HEARTBEAT:
                    if (!this.heartbeatInterval || this.heartbeatId) {
                        return;
                    }
                    if (this.heartbeatTimeoutId) {
                        clearTimeout(this.heartbeatTimeoutId);
                        this.heartbeatTimeoutId = null;
                    }
                    this.heartbeatId = setTimeout(() => {
                        this.heartbeatId = null;
                        if (this.socket) {
                            this.socket.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_HEARTBEAT));
                        }
                        this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
                        this.heartbeatTimeoutId = setTimeout(() => {
                            this.disconnect();
                        }, this.heartbeatTimeout);
                    }, this.heartbeatInterval);
                    break;
                case protocol_1.PackageType.TYPE_DATA:
                    let body = null;
                    if (!!this.decode) {
                        body = this.decode(msg.body);
                    }
                    if (!body.id) {
                        this.emit(body.route, body.body);
                        return;
                    }
                    if (this.callbacks[body.id]) {
                        this.callbacks[body.id].resolve(body.body);
                        delete this.callbacks[body.id];
                    }
                    break;
                case protocol_1.PackageType.TYPE_KICK:
                    const reason = JSON.parse(protocol_1.strdecode(msg.body));
                    this.emit('kickout', reason);
                    this.disconnect(0, reason);
                    break;
                default:
                    break;
            }
        }
    }
}
exports.Client = Client;
