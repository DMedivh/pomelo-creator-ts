import { Client } from "./lib/client";

export namespace pomelo {
    export function create(uri: string, opts: any): Client {
        const c = new Client(uri);
        c.connect(opts);
        return c;
    };
}
