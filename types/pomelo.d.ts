
import * as EventEmitter from 'eventemitter3';

export namespace pomelo {

    export interface Client extends EventEmitter {

        request(route: string, msg: any): Promise<any>;

        notify(route: string, msg: any): Promise<any>;

        disconnec(code?: number, reason?: string): void;

        auth(): Promise<object | undefined>;

        /// 报错
        // on(event: 'error', fn: EventEmitter.ListenerFn): void;

        /// 链接初始化完成
        // on(event: 'connected', fn: EventEmitter.ListenerFn): void;

        /// 鉴权完成, 内容为 auth 函数的返回值
        // on(event: 'ready', fn: EventEmitter.ListenerFn): void;

        /// 服务器断开链接
        // on(event: 'kickout', fn: EventEmitter.ListenerFn): void;

        /// 重试 retry 次数后都失败, 触发该事件后不再重试!
        // on(event: 'getout', fn: EventEmitter.ListenerFn): void;
    }

    export interface Option {

        /// 认证 鉴权 成功返回 true, 失败 false
        auth(): Promise<object | undefined>;

        /// 本地缓存对象
        localStorage: {
            getItem(key: string): any;
            setItem(key: string, data: object | undefined, ttl?: number): any;
        };

        encode?(reqId: number, route: string, msg: any): Uint8Array;
        decode?(data: string | Uint8Array): string | undefined;

        /// 重试恢复次数 (注意, 非鉴权, 属于本地缓存 session id, 当链接断开后 使用 session id 重试)
        retry?: number;
    }

    export function create(uri: string, opts: Option): Client;
}
