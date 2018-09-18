import * as url from 'url';
import { ConnectionBase } from './lib/connection';
import { websocketImpl } from './lib/connections/websocket';

export namespace pomelo {

    export let connection: ConnectionBase;

    export declare interface Options {
        id?: string;
        auth(): PromiseLike<boolean>;
        encode?(reqId: number, route: string, msg: any): Uint8Array;
        decode?(data: string | Uint8Array): string | undefined;
        autoReconnect?: boolean;
    }

    export async function create(uri: string, opts: Options) {
        const uri_desc: url.UrlWithStringQuery = url.parse(uri);
        switch (uri_desc.protocol) {
            case 'ws:':
            case 'wss:':
                connection = new websocketImpl(uri, opts);
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
        if (!connection) {
            return Promise.reject(`un-implements connectin by protocol ${uri_desc.protocol}`);
        }
        await connection.connect(opts);
        return connection;
    }
}
