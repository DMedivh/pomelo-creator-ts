
import * as EventEmitter from 'eventemitter3';

export namespace pomelo {

    export interface Client {
        request(route: string, msg: any): Promise<any>;

        notify(route: string, msg: any): Promise<any>;

        disconnec(code?: number, reason?: string): void;

        auth(): Promise<object | undefined>;

        on(event: 'error', fn: EventEmitter.ListenerFn): void;
        on(event: 'connected', fn: EventEmitter.ListenerFn): void;
        on(event: 'ready', fn: EventEmitter.ListenerFn): void;
        on(event: 'kickout', fn: EventEmitter.ListenerFn): void;
        on(event: 'getout', fn: EventEmitter.ListenerFn): void;


        once(event: 'error', fn: EventEmitter.ListenerFn): void;
        once(event: 'connected', fn: EventEmitter.ListenerFn): void;
        once(event: 'ready', fn: EventEmitter.ListenerFn): void;
        once(event: 'kickout', fn: EventEmitter.ListenerFn): void;
        once(event: 'getout', fn: EventEmitter.ListenerFn): void;

        removeListener(event: string, fn?: EventEmitter.ListenerFn, context?: any, once?: boolean): object;
        removeAllListeners(event?: string): object;
    }

    export interface Option {

        /// 认证 鉴权 成功返回 true, 失败 false
        auth(): Promise<object | undefined>;

        /// 本地缓存对象
        localStorage: {
            getItem(key: string): any;
            setItem(key: string, data: object | undefined): any;
        };

        encode?(reqId: number, route: string, msg: any): Uint8Array;
        decode?(data: string | Uint8Array): string | undefined;

        /// 重试恢复次数 (注意, 非鉴权, 属于本地缓存 session id, 当链接断开后 使用 session id 重试)
        retry?: number;
    }

    export function create(uri: string, opts: Option): Client;
}
