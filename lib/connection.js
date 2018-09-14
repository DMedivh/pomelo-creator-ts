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
const is = __importStar(require("is"));
const moment = __importStar(require("moment"));
const protocol_1 = require("./protocol");
const protobuf_1 = require("./protobuf");
exports.handshakeBuffer = {
    sys: {
        type: 'COCOS_CREATOR',
        version: '1.0.0',
        rsa: {}
    },
    user: {}
};
var RESULT_CODE;
(function (RESULT_CODE) {
    RESULT_CODE[RESULT_CODE["RES_OK"] = 200] = "RES_OK";
    RESULT_CODE[RESULT_CODE["RES_FAIL"] = 500] = "RES_FAIL";
    RESULT_CODE[RESULT_CODE["RES_OLD_CLIENT"] = 501] = "RES_OLD_CLIENT";
})(RESULT_CODE || (RESULT_CODE = {}));
class ConnectionBase extends eventemitter3_1.EventEmitter {
    constructor() {
        super();
        this.serverProtos = {};
        this.clientProtos = {};
        this.dict = {};
        this.routeMap = {};
        this.abbrs = {};
        this.maxReconnectAttempts = 10;
        this.heartbeatInterval = 0;
        this.heartbeatTimeout = 0;
        this.nextHeartbeatTimeout = 0;
        this.callbacks = {};
        this.reqId = 0;
        this.auth_route = 'connector.session.connect';
    }
    setItem(key, value, ttl) {
        const localStorage = window ? window.localStorage : cc.sys.localStorage;
        if (!localStorage) {
            console.error("找不到本地存储 api localStorage!");
            return;
        }
        if (is.empty(value)) {
            localStorage.removeItem(key);
        }
        else {
            if (!!ttl) {
                localStorage.setItem(key, JSON.stringify({ value, expireat: moment().add(ttl, 'minute').format('YYYY-MM-DD hh:mm:dd') }));
            }
            else {
                localStorage.setItem(`connection.cookie.${this.id}.${key}`, JSON.stringify({ value }));
            }
        }
    }
    getItem(key) {
        const localStorage = window ? window.localStorage : cc.sys.localStorage;
        if (!localStorage) {
            console.error("找不到本地存储 api localStorage!");
            return;
        }
        let data = localStorage.getItem(`connection.cookie.${this.id}.${key}`);
        if (data) {
            try {
                data = JSON.parse(data);
            }
            catch (_) {
            }
            if (data.expireat) {
                const expireat = moment(data.expireat);
                if (expireat.isValid() && expireat.isBefore(moment())) {
                    this.setItem(key);
                    return;
                }
            }
        }
        if (data && data.value) {
            return data.value;
        }
        return;
    }
    /**
     * 获取连接状态是否是正常连接状态
     */
    get connected() {
        return 0;
    }
    /**
     * 获取连接状态 是否是连接中状态
     */
    get connectting() {
        return 0;
    }
    /**
     * 发起连接初始化,并等待完成, 如果超时会触发 Promise.reject
     *
     * @param opts
     */
    async connect(opts) {
        if (this.connectting) {
            return Promise.reject('connecting');
        }
        this.encode = opts.encode || this.defaultEncode;
        this.decode = opts.decode || this.defaultDecode;
        if (opts.auth_route) {
            this.auth_route = opts.auth_route;
        }
        if (opts.maxReconnectAttempts) {
            this.maxReconnectAttempts = opts.maxReconnectAttempts;
        }
        const protos = this.getItem('protos');
        if (protos) {
            this.protoVersion = protos.version || '';
            this.serverProtos = protos.server || {};
            this.clientProtos = protos.client || {};
            protobuf_1.init({
                encoderProtos: this.clientProtos,
                decoderProtos: this.serverProtos
            });
        }
    }
    async auth(certificate, auto) {
        if (!certificate) {
            certificate = this.getItem('certificate');
        }
        if (certificate) {
            return;
        }
        const ok = await this.request(this.auth_route, { certificate }).catch(err => {
            this.setItem('certificate');
        });
        if (ok) {
            this.emit('ready');
            if (auto) {
                /// 每次登陆成功缓存证书一周
                this.setItem('certificate', certificate, 7 * 24 * 60);
            }
        }
        return ok;
    }
    /**
     * 向服务器发起一个请求, 并等待完成后的返回值
     *
     * @param {string}route
     * @param {object}msg
     * @returns {Promise<object>}
     */
    async request(route, msg = {}) {
        if (this.connectting || !this.connected) {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(reject, 5000);
                this.once('ready', () => {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    resolve();
                });
            });
        }
        this.reqId++;
        const body = this.encode(this.reqId, route, msg);
        if (body) {
            await this.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_DATA, body));
        }
        return await new Promise((resolve, reject) => {
            this.callbacks[this.reqId] = { resolve, reject };
            this.routeMap[this.reqId] = route;
        });
    }
    /**
     * 通知服务器 --不关心返回值
     *
     * @param {string}route 消息rpc路由
     * @param {object}msg 消息内容, 默认值 {}
     * @returns {Promise<void>}
     */
    async notify(route, msg = {}) {
        if (this.connectting || !this.connected) {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(reject, 5000);
                this.once('ready', () => {
                    if (timer) {
                        clearTimeout(timer);
                    }
                    resolve();
                });
            });
        }
        const body = this.encode(0, route, msg);
        if (body) {
            await this.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_DATA, body));
        }
    }
    async disconnect() {
        if (this.heartbeatId) {
            clearTimeout(this.heartbeatId);
            this.heartbeatId = null;
        }
        if (this.heartbeatTimeoutId) {
            clearTimeout(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = null;
        }
    }
    defaultEncode(reqId, route, msg = {}) {
        if (this.clientProtos[route]) {
            msg = protobuf_1.encode(route, msg);
        }
        else {
            msg = protocol_1.strdecode(JSON.stringify(msg));
        }
        return protocol_1.Message.encode(reqId, reqId ? protocol_1.MessageType.TYPE_REQUEST : protocol_1.MessageType.TYPE_NOTIFY, !!this.dict[route], this.dict[route], msg, {});
    }
    defaultDecode(data) {
        const msg = protocol_1.Message.decode(data);
        if (msg.id > 0) {
            msg.route = this.routeMap[msg.id];
            delete this.routeMap[msg.id];
            if (!msg.route) {
                return;
            }
        }
        msg.body = function (msg) {
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
        }.bind(this)(msg);
        return msg;
    }
    async handshake(buffer) {
        const binary = protocol_1.Package.encode(protocol_1.PackageType.TYPE_HANDSHAKE, buffer ? protocol_1.strencode(JSON.stringify(buffer)) : undefined);
        return await this.send(binary);
    }
    async send(binary) {
        return Promise.reject('un-implements connection!');
    }
    async reset() {
    }
    async clear() {
        this.setItem('certificate');
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
                    {
                        const body = JSON.parse(protocol_1.strdecode(msg.body));
                        if (body.code === RESULT_CODE.RES_OLD_CLIENT) {
                            this.emit('error', 'client version not fullfill');
                            return;
                        }
                        if (body.code !== RESULT_CODE.RES_OK) {
                            this.emit('error', `handshake failed by ${body.code}`);
                            return;
                        }
                        if (body.sys && body.sys.heartbeat) {
                            this.heartbeatInterval = body.sys.heartbeat * 1000;
                            this.heartbeatTimeout = this.heartbeatInterval * 5;
                        }
                        else {
                            this.heartbeatInterval = 0;
                            this.heartbeatTimeout = 0;
                        }
                        this.dict = body.sys.dict;
                        if (this.dict) {
                            this.abbrs = {};
                            for (let i in this.dict) {
                                this.abbrs[this.dict[i]] = i;
                            }
                        }
                        if (body.sys.protos) {
                            this.protoVersion = body.sys.protos.version || '';
                            this.serverProtos = body.sys.protos.server || {};
                            this.clientProtos = body.sys.protos.client || {};
                            this.setItem('protos', body.sys.protos);
                            protobuf_1.init({
                                encoderProtos: this.clientProtos,
                                decoderProtos: this.serverProtos
                            });
                        }
                        this.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_HANDSHAKE_ACK));
                        this.emit('connected');
                        const ok = await this.auth();
                        if (ok && ok.code !== 200) {
                            this.clear();
                        }
                    }
                    break;
                case protocol_1.PackageType.TYPE_HEARTBEAT:
                    {
                        if (!this.heartbeatInterval || this.heartbeatId) {
                            return;
                        }
                        if (this.heartbeatTimeoutId) {
                            clearTimeout(this.heartbeatTimeoutId);
                            this.heartbeatTimeoutId = null;
                        }
                        this.heartbeatId = setTimeout(() => {
                            this.heartbeatId = null;
                            this.send(protocol_1.Package.encode(protocol_1.PackageType.TYPE_HEARTBEAT));
                            this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
                            this.heartbeatTimeoutId = setTimeout(() => {
                                this.emit('timeout');
                                this.disconnect();
                            }, this.heartbeatTimeout);
                        }, this.heartbeatInterval);
                    }
                    break;
                case protocol_1.PackageType.TYPE_DATA:
                    {
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
                    }
                    break;
                case protocol_1.PackageType.TYPE_KICK:
                    {
                        this.emit('onKick', JSON.parse(protocol_1.strdecode(msg.body)));
                    }
                    break;
                default:
                    console.error('un-support protocol', msg);
                    break;
            }
        }
    }
}
exports.ConnectionBase = ConnectionBase;
