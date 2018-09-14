
import { ConnectionBase } from "../connection";
import * as url from 'url';
import * as is from 'is';

export class websocketImpl extends ConnectionBase {
    protected uri: url.UrlObjectCommon;
    protected autoReconnect: boolean = true;

    protected socket: WebSocket;
    constructor(uri: string, opts: any) {
        super();

        this.id = opts.id || 'default';
        this.uri = url.parse(uri);
        if (!is.undefined(opts.autoReconnect)) {
            this.autoReconnect = !!opts.autoReconnect;
        }
    }

    public get connected() {
        if (!this.socket) {
            return 0;
        }
        return this.socket.OPEN;
    }

    public get connectting() {
        if (!this.socket) {
            return 0;
        }
        return this.socket.CONNECTING;
    }

    public async connect(opts: any) {
        super.connect(opts);

        if (this.uri.protocol === 'wss:') {
            this.socket = new WebSocket(url.format(this.uri));
        } else if (this.uri.protocol === 'ws:') {
            this.socket = new WebSocket(url.format(this.uri));
        } else {
            return Promise.reject(new Error(`un-support protocol ${this.uri.protocol} for websocket!`));
        }

        this.socket.binaryType = 'arraybuffer';

        this.socket.onmessage = (event) => {
            this.processPackage(event.data);
        }

        this.socket.onerror = (err) => {
            console.error('websocket error:', err);
            this.emit('error', err);
            this.disconnect();
        }

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
        }

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

    public async disconnect() {
        await super.disconnect();
        if (this.socket) {
            this.socket.close();

            this.socket = null;
        }
    }

    public async send(binary: any) {
        if (!this.connected) {
            return Promise.reject('socket hanup!');
        }
        this.socket.send(binary);
    }
}