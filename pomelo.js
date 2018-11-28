"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./lib/client");
var pomelo;
(function (pomelo) {
    function create(uri, opts) {
        const c = new client_1.Client(uri);
        c.connect(opts);
        return c;
    }
    pomelo.create = create;
    ;
})(pomelo = exports.pomelo || (exports.pomelo = {}));
