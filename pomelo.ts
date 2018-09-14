import * as url from 'url';
import { ConnectionBase } from './lib/connection';
import { websocketImpl } from './lib/connections/websocket';

export namespace pomelo {

    export let connection: ConnectionBase;

    export declare interface options {
        id?: string;
    }

    export async function create(uri: string, opts: any) {
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
        return await connection.connect(opts);
    }
}
