/* ProtocolBuffer client 0.1.0*/

/**
 * pomelo-protobuf
 * @author <zhang0935@gmail.com>
 */

/**
 * Protocol buffer root
 * In browser, it will be window.protbuf
 */
export function init(opts: any) {
    //On the serverside, use serverProtos to encode messages send to client
    MsgEncoder.init(opts.encoderProtos);

    //On the serverside, user clientProtos to decode messages receive from clients
    MsgDecoder.init(opts.decoderProtos);
}

export function encode(key: string, msg: any) {
    return MsgEncoder.encode(key, msg);
}

export function decode(key: string, msg: any) {
    return MsgDecoder.decode(key, msg);
}

/**
 * constants
 */
namespace constants {

    export const TYPES: any = {
        uInt32: 0,
        sInt32: 0,
        int32: 0,
        double: 1,
        string: 2,
        message: 2,
        float: 5
    };
}

function isSimpleType(type: string) {
    return (type === 'uInt32' ||
        type === 'sInt32' ||
        type === 'int32' ||
        type === 'uInt64' ||
        type === 'sInt64' ||
        type === 'float' ||
        type === 'double');
}

/**
 * codec module
 */
namespace Codec {

    const buffer = new ArrayBuffer(8);
    const float32Array = new Float32Array(buffer);
    const float64Array = new Float64Array(buffer);
    const uInt8Array = new Uint8Array(buffer);

    export function encodeUInt32(n: any) {
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

    export function encodeSInt32(n: any) {
        n = parseInt(n);
        if (isNaN(n)) {
            return null;
        }
        n = n < 0 ? (Math.abs(n) * 2 - 1) : n * 2;

        return Codec.encodeUInt32(n);
    }

    export function decodeUInt32(bytes: any) {
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

    export function decodeSInt32(bytes: any) {
        let n = decodeUInt32(bytes);
        let flag = ((n % 2) === 1) ? -1 : 1;

        n = ((n % 2 + n) / 2) * flag;

        return n;
    }

    export function encodeFloat(float: number) {
        float32Array[0] = float;
        return uInt8Array;
    }

    export function decodeFloat(bytes: any, offset: number) {
        if (!bytes || bytes.length < (offset + 4)) {
            return null;
        }

        for (let i = 0; i < 4; i++) {
            uInt8Array[i] = bytes[offset + i];
        }

        return float32Array[0];
    }

    export function encodeDouble(double: number) {
        float64Array[0] = double;
        return uInt8Array.subarray(0, 8);
    }

    export function decodeDouble(bytes: any, offset: number) {
        if (!bytes || bytes.length < (offset + 8)) {
            return null;
        }

        for (let i = 0; i < 8; i++) {
            uInt8Array[i] = bytes[offset + i];
        }

        return float64Array[0];
    }

    export function encodeStr(bytes: any, offset: number, str: string) {
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

    /**
     * Decode string from utf8 bytes
     */
    export function decodeStr(bytes: any, offset: number, length: number) {
        const array = [];
        const end = offset + length;

        while (offset < end) {
            let code = 0;

            if (bytes[offset] < 128) {
                code = bytes[offset];

                offset += 1;
            } else if (bytes[offset] < 224) {
                code = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
                offset += 2;
            } else {
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

    /**
     * Return the byte length of the str use utf8
     */
    export function byteLength(str: string) {
        if (typeof(str) !== 'string') {
            return -1;
        }

        let length = 0;

        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            length += codeLength(code);
        }

        return length;
    };

    /**
     * Encode a unicode16 char code to utf8 bytes
     */
    function encode2UTF8(charCode: number) {
        if (charCode <= 0x7f) {
            return [charCode];
        } else if (charCode <= 0x7ff) {
            return [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)];
        } else {
            return [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)];
        }
    }

    function codeLength(code: number) {
        if (code <= 0x7f) {
            return 1;
        } else if (code <= 0x7ff) {
            return 2;
        } else {
            return 3;
        }
    }
}

/**
 * encoder module
 */
namespace MsgEncoder {

    export let protos: any = {};

    export function init(ps: any) {
        protos = ps || {};
    }

    export function encode(route: any, msg: any) {
        //Get protos from protos map use the route as key
        const proto = protos[route];

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

    /**
     * Check if the msg follow the defination in the protos
     */
    function checkMsg(msg: any, protos: any) {
        if (!protos) {
            return false;
        }

        for (let name in protos) {
            const proto = protos[name];

            //All required element must exist
            switch (proto.option) {
                case 'required' :
                    if (typeof(msg[name]) === 'undefined') {
                        console.warn('no property exist for required! name: %j, proto: %j, msg: %j', name, proto, msg);
                        return false;
                    }
                case 'optional' :
                    if (typeof(msg[name]) !== 'undefined') {
                        var message = protos.__messages[proto.type] || MsgEncoder.protos['message ' + proto.type];
                        if (!!message && !checkMsg(msg[name], message)) {
                            console.warn('inner proto error! name: %j, proto: %j, msg: %j', name, proto, msg);
                            return false;
                        }
                    }
                    break;
                case 'repeated' :
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

    function encodeMsg(buffer: any, offset: number, protos: any, msg: any) {
        for (let name in msg) {
            if (!!protos[name]) {
                const proto = protos[name];

                switch (proto.option) {
                    case 'required' :
                    case 'optional' :
                        offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
                        offset = encodeProp(msg[name], proto.type, offset, buffer, protos);
                        break;
                    case 'repeated' :
                        if (msg[name].length > 0) {
                            offset = encodeArray(msg[name], proto, offset, buffer, protos);
                        }
                        break;
                }
            }
        }

        return offset;
    }

    function encodeProp(value: any, type: string, offset: number, buffer: any, protos?: any) {
        switch (type) {
            case 'uInt32':
                offset = writeBytes(buffer, offset, Codec.encodeUInt32(value));
                break;
            case 'int32' :
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
            case 'string':
                const length = Codec.byteLength(value);

                //Encode length
                offset = writeBytes(buffer, offset, Codec.encodeUInt32(length));
                //write string
                Codec.encodeStr(buffer, offset, value);
                offset += length;
                break;
            default :
                const message = protos.__messages[type] || MsgEncoder.protos['message ' + type];
                if (!!message) {
                    //Use a tmp buffer to build an internal msg
                    const tmpBuffer: any = new ArrayBuffer(Codec.byteLength(JSON.stringify(value)) * 2);
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
    function encodeArray(array: any, proto: any, offset: number, buffer: any, protos: any) {
        let i = 0;

        if (isSimpleType(proto.type)) {
            offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
            offset = writeBytes(buffer, offset, Codec.encodeUInt32(array.length));

            for (i = 0; i < array.length; i++) {
                offset = encodeProp(array[i], proto.type, offset, buffer);
            }
        } else {
            for (i = 0; i < array.length; i++) {
                offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
                offset = encodeProp(array[i], proto.type, offset, buffer, protos);
            }
        }

        return offset;
    }

    function writeBytes(buffer: any, offset: number, bytes: any) {
        for (let i = 0; i < bytes.length; i++, offset++) {
            buffer[offset] = bytes[i];
        }

        return offset;
    }

    function encodeTag(type: string, tag: number) {
        const value: number = constants.TYPES[type] || 2;

        return Codec.encodeUInt32((tag << 3) | value);
    }
}

/**
 * decoder module
 */
namespace MsgDecoder {

    let buffer: any = null;
    let offset = 0;

    export let protos: any = {};

    export function init(protos: any) {
        MsgDecoder.protos = protos || {};
    }

    export function setProtos(protos: any) {
        if (!!protos) {
            MsgDecoder.protos = protos;
            MsgDecoder.protos = protos;
        }
    }

    export function decode(route: any, buf: any) {
        const protos = MsgDecoder.protos[route];

        buffer = buf;
        offset = 0;

        if (!!protos) {
            return decodeMsg({}, protos, buffer.length);
        }

        return null;
    }

    function decodeMsg(msg: any, protos: any, length: number) {
        while (offset < length) {
            const head = getHead();
            const type = head.type;
            const tag = head.tag;
            const name = protos.__tags[tag];

            switch (protos[name].option) {
                case 'optional' :
                case 'required' :
                    msg[name] = decodeProp(protos[name].type, protos);
                    break;
                case 'repeated' :
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
    function isFinish(msg: any, protos: any) {
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

    function decodeProp(type: string, protos?: any) {
        switch (type) {
            case 'uInt32':
                return Codec.decodeUInt32(getBytes());
            case 'int32' :
            case 'sInt32' :
                return Codec.decodeSInt32(getBytes());
            case 'float' :
                const float = Codec.decodeFloat(buffer, offset);
                offset += 4;
                return float;
            case 'double' :
                const double = Codec.decodeDouble(buffer, offset);
                offset += 8;
                return double;
            case 'string' :
                const length = Codec.decodeUInt32(getBytes());

                const str = Codec.decodeStr(buffer, offset, length);
                offset += length;

                return str;
            default :
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

    function decodeArray(array: any, type: string, protos: any) {
        if (isSimpleType(type)) {
            const length = Codec.decodeUInt32(getBytes());

            for (let i = 0; i < length; i++) {
                array.push(decodeProp(type));
            }
        } else {
            array.push(decodeProp(type, protos));
        }
    }

    function getBytes(flag?: boolean) {
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

}
