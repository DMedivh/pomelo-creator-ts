"use strict";
/* ProtocolBuffer client 0.1.0*/
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * pomelo-protobuf
 * @author <zhang0935@gmail.com>
 */
/**
 * Protocol buffer root
 * In browser, it will be window.protbuf
 */
function init(opts) {
    //On the serverside, use serverProtos to encode messages send to client
    MsgEncoder.init(opts.encoderProtos);
    //On the serverside, user clientProtos to decode messages receive from clients
    MsgDecoder.init(opts.decoderProtos);
}
exports.init = init;
function encode(key, msg) {
    return MsgEncoder.encode(key, msg);
}
exports.encode = encode;
function decode(key, msg) {
    return MsgDecoder.decode(key, msg);
}
exports.decode = decode;
/**
 * constants
 */
var constants;
(function (constants) {
    constants.TYPES = {
        uInt32: 0,
        sInt32: 0,
        int32: 0,
        double: 1,
        string: 2,
        message: 2,
        float: 5,
        boolean: 6,
        object: 7
    };
})(constants || (constants = {}));
function isSimpleType(type) {
    return (type === 'uInt32' ||
        type === 'sInt32' ||
        type === 'int32' ||
        type === 'uInt64' ||
        type === 'sInt64' ||
        type === 'float' ||
        type === 'double' ||
        type === 'boolean' ||
        type === 'object');
}
/**
 * codec module
 */
var Codec;
(function (Codec) {
    const buffer = new ArrayBuffer(8);
    const float32Array = new Float32Array(buffer);
    const float64Array = new Float64Array(buffer);
    const uInt8Array = new Uint8Array(buffer);
    function encodeBytes(n) {
    }
    Codec.encodeBytes = encodeBytes;
    function encodeUInt32(n) {
        n = parseInt(n);
        if (isNaN(n) || n < 0) {
            return null;
        }
        const result = [];
        do {
            var tmp = n % 128;
            var next = Math.floor(n / 128);
            if (next !== 0) {
                tmp = tmp + 128;
            }
            result.push(tmp);
            n = next;
        } while (n !== 0);
        return result;
    }
    Codec.encodeUInt32 = encodeUInt32;
    function encodeSInt32(n) {
        n = parseInt(n);
        if (isNaN(n)) {
            return null;
        }
        n = n < 0 ? (Math.abs(n) * 2 - 1) : n * 2;
        return Codec.encodeUInt32(n);
    }
    Codec.encodeSInt32 = encodeSInt32;
    function decodeUInt32(bytes) {
        let n = 0;
        for (let i = 0; i < bytes.length; i++) {
            let m = parseInt(bytes[i]);
            n = n + ((m & 0x7f) * Math.pow(2, (7 * i)));
            if (m < 128) {
                return n;
            }
        }
        return n;
    }
    Codec.decodeUInt32 = decodeUInt32;
    function decodeSInt32(bytes) {
        let n = decodeUInt32(bytes);
        let flag = ((n % 2) === 1) ? -1 : 1;
        n = ((n % 2 + n) / 2) * flag;
        return n;
    }
    Codec.decodeSInt32 = decodeSInt32;
    function encodeFloat(float) {
        float32Array[0] = float;
        return uInt8Array;
    }
    Codec.encodeFloat = encodeFloat;
    function decodeFloat(bytes, offset) {
        if (!bytes || bytes.length < (offset + 4)) {
            return null;
        }
        for (let i = 0; i < 4; i++) {
            uInt8Array[i] = bytes[offset + i];
        }
        return float32Array[0];
    }
    Codec.decodeFloat = decodeFloat;
    function encodeDouble(double) {
        float64Array[0] = double;
        return uInt8Array.subarray(0, 8);
    }
    Codec.encodeDouble = encodeDouble;
    function decodeDouble(bytes, offset) {
        if (!bytes || bytes.length < (offset + 8)) {
            return null;
        }
        for (let i = 0; i < 8; i++) {
            uInt8Array[i] = bytes[offset + i];
        }
        return float64Array[0];
    }
    Codec.decodeDouble = decodeDouble;
    function encodeStr(bytes, offset, str) {
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            const codes = encode2UTF8(code);
            for (var j = 0; j < codes.length; j++) {
                bytes[offset] = codes[j];
                offset++;
            }
        }
        return offset;
    }
    Codec.encodeStr = encodeStr;
    /**
     * Decode string from utf8 bytes
     */
    function decodeStr(bytes, offset, length) {
        const array = [];
        const end = offset + length;
        while (offset < end) {
            let code = 0;
            if (bytes[offset] < 128) {
                code = bytes[offset];
                offset += 1;
            }
            else if (bytes[offset] < 224) {
                code = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
                offset += 2;
            }
            else {
                code = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
                offset += 3;
            }
            array.push(code);
        }
        let str = '';
        for (let i = 0; i < array.length;) {
            str += String.fromCharCode.apply(null, array.slice(i, i + 10000));
            i += 10000;
        }
        return str;
    }
    Codec.decodeStr = decodeStr;
    /**
     * Return the byte length of the str use utf8
     */
    function byteLength(str) {
        if (typeof (str) !== 'string') {
            return -1;
        }
        let length = 0;
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            length += codeLength(code);
        }
        return length;
    }
    Codec.byteLength = byteLength;
    ;
    /**
     * Encode a unicode16 char code to utf8 bytes
     */
    function encode2UTF8(charCode) {
        if (charCode <= 0x7f) {
            return [charCode];
        }
        else if (charCode <= 0x7ff) {
            return [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)];
        }
        else {
            return [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)];
        }
    }
    function codeLength(code) {
        if (code <= 0x7f) {
            return 1;
        }
        else if (code <= 0x7ff) {
            return 2;
        }
        else {
            return 3;
        }
    }
})(Codec || (Codec = {}));
/**
 * encoder module
 */
var MsgEncoder;
(function (MsgEncoder) {
    MsgEncoder.protos = {};
    function init(ps) {
        MsgEncoder.protos = ps || {};
    }
    MsgEncoder.init = init;
    function encode(route, msg) {
        //Get protos from protos map use the route as key
        const proto = MsgEncoder.protos[route];
        //Check msg
        if (!checkMsg(msg, proto)) {
            return null;
        }
        //Set the length of the buffer 2 times bigger to prevent overflow
        const length = Codec.byteLength(JSON.stringify(msg));
        //Init buffer and offset
        const buffer = new ArrayBuffer(length);
        const uInt8Array = new Uint8Array(buffer);
        let offset = 0;
        if (!!proto) {
            offset = encodeMsg(uInt8Array, offset, proto, msg);
            if (offset > 0) {
                return uInt8Array.subarray(0, offset);
            }
        }
        return null;
    }
    MsgEncoder.encode = encode;
    /**
     * Check if the msg follow the defination in the protos
     */
    function checkMsg(msg, protos) {
        if (!protos) {
            return false;
        }
        for (let name in protos) {
            const proto = protos[name];
            //All required element must exist
            switch (proto.option) {
                case 'required':
                    if (typeof (msg[name]) === 'undefined') {
                        console.warn('no property exist for required! name: %j, proto: %j, msg: %j', name, proto, msg);
                        return false;
                    }
                case 'optional':
                    if (typeof (msg[name]) !== 'undefined') {
                        var message = protos.__messages[proto.type] || MsgEncoder.protos['message ' + proto.type];
                        if (!!message && !checkMsg(msg[name], message)) {
                            console.warn('inner proto error! name: %j, proto: %j, msg: %j', name, proto, msg);
                            return false;
                        }
                    }
                    break;
                case 'repeated':
                    //Check nest message in repeated elements
                    var message = protos.__messages[proto.type] || MsgEncoder.protos['message ' + proto.type];
                    if (!!msg[name] && !!message) {
                        for (var i = 0; i < msg[name].length; i++) {
                            if (!checkMsg(msg[name][i], message)) {
                                return false;
                            }
                        }
                    }
                    break;
            }
        }
        return true;
    }
    function encodeMsg(buffer, offset, protos, msg) {
        for (let name in msg) {
            if (!!protos[name]) {
                const proto = protos[name];
                switch (proto.option) {
                    case 'required':
                    case 'optional':
                        offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
                        offset = encodeProp(msg[name], proto.type, offset, buffer, protos);
                        break;
                    case 'repeated':
                        if (msg[name].length > 0) {
                            offset = encodeArray(msg[name], proto, offset, buffer, protos);
                        }
                        break;
                }
            }
        }
        return offset;
    }
    function encodeProp(value, type, offset, buffer, protos) {
        switch (type) {
            case 'boolean':
                offset = writeBytes(buffer, offset, value ? '1' : '0');
            case 'uInt32':
                offset = writeBytes(buffer, offset, Codec.encodeUInt32(value));
                break;
            case 'int32':
            case 'sInt32':
                offset = writeBytes(buffer, offset, Codec.encodeSInt32(value));
                break;
            case 'float':
                writeBytes(buffer, offset, Codec.encodeFloat(value));
                offset += 4;
                break;
            case 'double':
                writeBytes(buffer, offset, Codec.encodeDouble(value));
                offset += 8;
                break;
            case 'object':
                value = JSON.stringify(value);
            case 'string':
                const length = Codec.byteLength(value);
                //Encode length
                offset = writeBytes(buffer, offset, Codec.encodeUInt32(length));
                //write string
                Codec.encodeStr(buffer, offset, value);
                offset += length;
                break;
            default:
                const message = protos.__messages[type] || MsgEncoder.protos['message ' + type];
                if (!!message) {
                    //Use a tmp buffer to build an internal msg
                    const tmpBuffer = new ArrayBuffer(Codec.byteLength(JSON.stringify(value)) * 2);
                    let length = 0;
                    length = encodeMsg(tmpBuffer, length, message, value);
                    //Encode length
                    offset = writeBytes(buffer, offset, Codec.encodeUInt32(length));
                    //contact the object
                    for (let i = 0; i < length; i++) {
                        buffer[offset] = tmpBuffer[i];
                        offset++;
                    }
                }
                break;
        }
        return offset;
    }
    /**
     * Encode reapeated properties, simple msg and object are decode differented
     */
    function encodeArray(array, proto, offset, buffer, protos) {
        let i = 0;
        if (isSimpleType(proto.type)) {
            offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
            offset = writeBytes(buffer, offset, Codec.encodeUInt32(array.length));
            for (i = 0; i < array.length; i++) {
                offset = encodeProp(array[i], proto.type, offset, buffer);
            }
        }
        else {
            for (i = 0; i < array.length; i++) {
                offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
                offset = encodeProp(array[i], proto.type, offset, buffer, protos);
            }
        }
        return offset;
    }
    function writeBytes(buffer, offset, bytes) {
        for (let i = 0; i < bytes.length; i++, offset++) {
            buffer[offset] = bytes[i];
        }
        return offset;
    }
    function encodeTag(type, tag) {
        const value = constants.TYPES[type] || 2;
        return Codec.encodeUInt32((tag << 3) | value);
    }
})(MsgEncoder || (MsgEncoder = {}));
/**
 * decoder module
 */
var MsgDecoder;
(function (MsgDecoder) {
    let buffer = null;
    let offset = 0;
    MsgDecoder.protos = {};
    function init(protos) {
        MsgDecoder.protos = protos || {};
    }
    MsgDecoder.init = init;
    function setProtos(protos) {
        if (!!protos) {
            MsgDecoder.protos = protos;
            MsgDecoder.protos = protos;
        }
    }
    MsgDecoder.setProtos = setProtos;
    function decode(route, buf) {
        const protos = MsgDecoder.protos[route];
        buffer = buf;
        offset = 0;
        if (!!protos) {
            return decodeMsg({}, protos, buffer.length);
        }
        return null;
    }
    MsgDecoder.decode = decode;
    function decodeMsg(msg, protos, length) {
        while (offset < length) {
            const head = getHead();
            const type = head.type;
            const tag = head.tag;
            const name = protos.__tags[tag];
            switch (protos[name].option) {
                case 'optional':
                case 'required':
                    msg[name] = decodeProp(protos[name].type, protos);
                    break;
                case 'repeated':
                    if (!msg[name]) {
                        msg[name] = [];
                    }
                    decodeArray(msg[name], protos[name].type, protos);
                    break;
            }
        }
        return msg;
    }
    /**
     * Test if the given msg is finished
     */
    function isFinish(msg, protos) {
        return (!protos.__tags[peekHead().tag]);
    }
    /**
     * Get property head from protobuf
     */
    function getHead() {
        const tag = Codec.decodeUInt32(getBytes());
        return {
            type: tag & 0x7,
            tag: tag >> 3
        };
    }
    /**
     * Get tag head without move the offset
     */
    function peekHead() {
        const tag = Codec.decodeUInt32(peekBytes());
        return {
            type: tag & 0x7,
            tag: tag >> 3
        };
    }
    function decodeProp(type, protos) {
        switch (type) {
            case 'boolean':
                const boolean = Codec.decodeStr(buffer, offset, 1);
                offset += 1;
                return parseInt(boolean) !== 0;
            case 'uInt32':
                return Codec.decodeUInt32(getBytes());
            case 'int32':
            case 'sInt32':
                return Codec.decodeSInt32(getBytes());
            case 'float':
                const float = Codec.decodeFloat(buffer, offset);
                offset += 4;
                return float;
            case 'double':
                const double = Codec.decodeDouble(buffer, offset);
                offset += 8;
                return double;
            case 'object':
            case 'string':
                const length = Codec.decodeUInt32(getBytes());
                const str = Codec.decodeStr(buffer, offset, length);
                offset += length;
                if (type === 'object') {
                    return JSON.parse(str);
                }
                return str;
            default:
                const message = protos && (protos.__messages[type] || MsgDecoder.protos['message ' + type]);
                if (!!message) {
                    const length = Codec.decodeUInt32(getBytes());
                    const msg = {};
                    decodeMsg(msg, message, offset + length);
                    return msg;
                }
                break;
        }
    }
    function decodeArray(array, type, protos) {
        if (isSimpleType(type)) {
            const length = Codec.decodeUInt32(getBytes());
            for (let i = 0; i < length; i++) {
                array.push(decodeProp(type));
            }
        }
        else {
            array.push(decodeProp(type, protos));
        }
    }
    function getBytes(flag) {
        const bytes = [];
        let pos = offset;
        flag = flag || false;
        let b;
        do {
            b = buffer[pos];
            bytes.push(b);
            pos++;
        } while (b >= 128);
        if (!flag) {
            offset = pos;
        }
        return bytes;
    }
    function peekBytes() {
        return getBytes(true);
    }
})(MsgDecoder || (MsgDecoder = {}));
