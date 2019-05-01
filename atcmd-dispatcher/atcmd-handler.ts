import { Events } from '@ionic/angular';

export namespace ATCMDHDL 
{
    export interface LogLine
    {
        timeStamp : Date;
        textLine : string;
    }

    class RxBuf 
    {
        private _buf : ArrayBuffer;
        private _bytes : Uint8Array;
        private _ofs : number;
        private _sz : number;

        private readonly _insertReserved = 100;
        private readonly _minBufSz = 1000;

        constructor() 
        {
            this._buf = new ArrayBuffer(this._minBufSz);
            this._bytes = new Uint8Array(this._buf);
            this._ofs = this._insertReserved;
            this._sz = 0;
        }

        private appendPtr()
        {
            return this._ofs + this._sz;
        }

        private appendSize()
        {
            return this._buf.byteLength - this.appendPtr();
        }

        reset()
        {
            this._ofs = this._insertReserved;
            this._sz = 0;
        }

        push( buf : ArrayBuffer | SharedArrayBuffer )
        {
            var bytes = new Uint8Array(buf);

            if( buf.byteLength > this.appendSize() )
            {
                // Need a new buffer
                var newSz = buf.byteLength + this._sz;
                var newBufSz = (Math.round((newSz + this._minBufSz) / this._minBufSz) + 1) * this._minBufSz;

                var newBuf = new ArrayBuffer(newBufSz);
                var newBytes = new Uint8Array(newBuf);
                var p = this._insertReserved;

                for( var j = this._ofs, k = 0; k < this._sz; j++, k++ )
                {
                    newBytes[p++] = this._bytes[j];
                }

                this._buf = newBuf;
                this._bytes = newBytes;
                this._ofs = this._insertReserved;
            }

            for( var i = this.appendPtr(), j = 0; j < buf.byteLength; i++, j++ )
            {
                this._bytes[i] = bytes[j];
            }
            this._sz += buf.byteLength;
        }

        shiftOut( sz : number = this._minBufSz) : ArrayBuffer | SharedArrayBuffer
        {
            if( sz > this._sz )
            {
                sz = this._sz;
            }

            if( sz == 0 )
            {
                return new ArrayBuffer(0);
            }

            var slice = this._bytes.slice(this._ofs, this._ofs + sz);

            this._ofs += sz;
            return slice.buffer;
        }

        shiftIn( input : string | ArrayBuffer | SharedArrayBuffer )
        {
            var bytes : Uint8Array;
            var buf : ArrayBuffer | SharedArrayBuffer;

            if( typeof input == "string" )
            {
                bytes = new TextEncoder().encode(input);
                buf = bytes.buffer;
            }
            else
            {
                buf = input;
                bytes = new Uint8Array(buf);
            }

            if( buf.byteLength > this._ofs )
            {
                // Need new buffer
                var newSz = buf.byteLength + this._sz;
                var newBufSz = (Math.round((newSz + this._minBufSz) / this._minBufSz) + 1) * this._minBufSz;

                var newBuf = new ArrayBuffer(newBufSz);
                var newBytes = new Uint8Array(newBuf);
                var p = this._insertReserved;

                for( j = 0; j < buf.byteLength; j++ )
                {
                    newBytes[p++] = bytes[j];
                }

                for( var j = this._ofs, k = 0; k < this._sz; j++, k++ )
                {
                    newBytes[p++] = this._bytes[j];
                }

                this._buf = newBuf;
                this._bytes = newBytes;
                this._ofs = this._insertReserved;
                this._sz = newSz;
            }
            else
            {
                this._ofs -= buf.byteLength;
                this._sz += buf.byteLength;
                for( j = this._ofs, k = 0; k < buf.byteLength; j++, k++ )
                {
                    this._bytes[j] = bytes[k];
                }
            }
        }

        splitLine() : ArrayBuffer[]
        {
            var ofs = this._ofs;
            var bufs = [];
            var lf = 10;
            var cr = 13;

            for( var i = ofs; i < this.appendPtr(); i++ )
            {
                if( this._bytes[i] != lf )
                {
                    continue;
                }

                var ofsIdx = i;

                if( ofsIdx > 1 )
                {
                    if( this._bytes[ofsIdx-1] == cr )
                    {
                        ofsIdx--;
                    }
                }
                bufs.push( this._bytes.slice(ofs, ofsIdx).buffer );
                ofs = i + 1;
            }

            // Push the last segment
            bufs.push( this._bytes.slice(ofs, this.appendPtr()).buffer );

            return bufs;
        }

        utf8ToString() : string
        {
            return new TextDecoder().decode(this._bytes.slice(this._ofs, this.appendPtr()));
        }
    }

    // ATCMD Handler
    // - handle raw data from AtCmdDispatcher
    // - this is the based class and application should extend to include specific handling functions 
    // 
    export class AtCmdHandler {

        // global stuff
        static nmCodeClassCreateMap : { [code : string] : (uuid : string, name : string, sendCb : (uuid:string, data:string) => Promise<any>, events : Events ) => AtCmdHandler } = 
        {
        };
        static registerSubClass( code : string, fnCb : (uuid : string, name : string, sendCb : (uuid:string, data:string) => Promise<any>, event : Events ) => AtCmdHandler)
        {
            console.log("[AtCmdHandler] register subclass [" + code + "]");
            AtCmdHandler.nmCodeClassCreateMap[code] = fnCb;
        }
        static createSubClassInstance(code : string, uuid : string, name : string, sendCb : (uuid:string, data:string) => Promise<any>, events : Events ) : AtCmdHandler 
        {
            var createInstanceFnCb : (uuid : string, name : string, sendCb : (uuid:string, data:string) => Promise<any>, events : Events ) => AtCmdHandler;
            createInstanceFnCb = AtCmdHandler.nmCodeClassCreateMap[code];
            if( !createInstanceFnCb )
            {
                console.log("[AtCmdHandler] can't find subclass [" + code + "]");
                return null;
            }

            return createInstanceFnCb(uuid, name, sendCb, events);
        }

        // member variables
        uuid : string;
        name : string;
        info : {};
        rxBuf : RxBuf;
        rxLines : string[];
        sendCb : (uuid:string, data:string) => Promise<any>;
        events :  Events;

        constructor( 
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            this.uuid = uuid;
            this.name = name;
            this.info = {};
            this.rxBuf = new RxBuf();
            this.rxLines = [];
            this.sendCb = sendCb;
            this.events = events;
        }

        notifyConnected() {
            console.log('[' + this.name + ']: ' + this.uuid + ' connected');
            if( this.events != null )
            {
                console.log("----connected----");
                setTimeout(() => {
                    this.events.publish("BT_DEV_CHANGED", { 'action' : 'connect', 'name' : this.name, 'uuid' : this.uuid, 'info' : this.info });
                }, 0);
            }        
        }

        notifyDisconnected() {
            console.log('[' + this.name + ']: ' + this.uuid + ' disconnected');
            if( this.events != null )
            {
                console.log("----disconnected----");
                setTimeout(() => {
                    this.events.publish("BT_DEV_CHANGED", { 'action' : 'disconnect', 'name' : this.name, 'uuid' : this.uuid, 'info' : this.info });
                }, 0);
            }        
        }

        appendData(data:ArrayBuffer) {
            this.rxBuf.push(data);
        }
    }

    export interface CmdParserMap extends Map<AtCmdRec>{
    }

    export interface CmdQRec {
        cmd : string;
        signature : number;
        sendTimeout : number;
        resolve : (obj) => void;
        reject : (obj) => void;
    }

    //
    // Base class for any product specific AT-CMD handler
    //
    export class AtCmdHandler_TEXTBASE extends AtCmdHandler {

        static gSeqId = 0;

        private cmdParsers : CmdParserMap;
        private unrecognizedLines : string[];
        private sendQ : CmdQRec[];
        private ready : boolean;
        private initStage : boolean;
        private initSending : boolean;
        private huntForOk : boolean;
        private huntForOkTimeout : any;
        private parserSpeedFilter : string;
        private enableLogging : boolean;
        
        public logLines : LogLine[];

        private atCmdErrCodeStr : {} = 
        {
            0   : "success",
            1   : "ERR_INVALID_CMD",
            2   : "ERR_INVALID_PARA",
            3   : "ERR_CONV_OVR",
            4   : "ERR_CONV_ERR",
            5   : "ERR_INSUFF_PARA",
            6   : "ERR_TOO_MANY_PARA",
            7   : "ERR_NOT_SUPPORT",
            8   : "ERR_IOMGT_NOT_ALLOCATED",
            9   : "ERR_IOMGT_OCCUPIED",
            10   : "ERR_IOMGT_MASK_CONFLICT",
            11  : "ERR_INTERNAL",
            12  : "ERR_BACKSPACE_NOT_SUPPORT",
            13  : "ERR_PIN_ALLOC_CONFLICT",
            14  : "ERR_PARA_OUT_OF_RANGE",
            15  : "ERR_WAKE_UP_PIN_NOT_ASSIGN",
            16  : "ERR_INVALID_PIN_ID",
            17  : "ERR_ALREADY_CONNECTED",
            18  : "ERR_INVALID_INDEX",
            19  : "ERR_CONN_FULL",
            20  : "ERR_BUSY",
            21  : "ERR_INSUFF_MEM",
            22  : "ERR_READ_LEN_EXCEED_MAX",
            23  : "ERR_BUS_FAULT",
            24  : "ERR_MISSING_PARA",
            25  : "ERR_PORT_OPENED",
            26  : "ERR_PORT_CLOSED",
            27  : "ERR_FLASH_OP_FAIL",
            28  : "ERR_ALREADY_ADVERTISING",
            29  : "ERR_BUF_OVR",
            30  : "ERR_IOMGT_EXPANDER_CONFLICT",
            31  : "ERR_IOMGT_EXPANDER_I2C_NOT_OPEN",
            32  : "ERR_IOMGT_EXPANDER_I2C_ERR",
            33  : "ERR_IOMGT_EXPANDER_INT_PIN_USED",
            34  : "ERR_PIN_CONFLICT",
            35  : "ERR_OUT_OF_RANGE",
            36  : "ERR_INSUFF_RESOURCE",
            37  : "ERR_CRC",
            
            200 : "ERR_INCORRECT_STATE",
            201 : "ERR_ALREADY_IN_STATE",
            202 : "ERR_INVALID_PDL_INDEX",
            203 : "ERR_INCORRECT_PROFILE",
            204 : "ERR_HFP_NOT_CONNECTED",    
            205 : "ERR_A2DP_NOT_CONNECTED",
            206 : "ERR_DEVICE_NOT_CONNECTED",   
            207 : "ERR_INCORRECT_TIMER_VALUE",
            208 : "ERR_INVALID_RSSI",
            209 : "ERR_AUTH_FAILED",
            210 : "ERR_SPP_LE_NOT_CONNECTED",
        };

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);
            this.cmdParsers = <CmdParserMap>{};
            this.unrecognizedLines = [];
            this.sendQ = [];
            this.ready = false;
            this.initStage = true;
            this.initSending = false;
            this.huntForOk = false;
            this.huntForOkTimeout = null;
            this.parserSpeedFilter = null;
            this.enableLogging = false;
            this.logLines = [];
        }

        //
        // Register AT-CMD record 
        // - AT-CMD record (AtCmdRec) holds the cache variables and line parsing method
        //   for a particular command
        //
        addAtCmdRecToParser(atCmdRec : AtCmdRec, refresh : boolean) {
            this.cmdParsers[atCmdRec.cmd] = atCmdRec;
            atCmdRec.handler = this;
            if( refresh )
            {
                this.atCmdRefresh(atCmdRec.cmd).then( params => {
                    console.log("[" + atCmdRec.cmd + "] completed " + JSON.stringify(params));
                }).catch( params => {
                    console.log("[" + atCmdRec.cmd + "] completed " + JSON.stringify(params));
                });
            }
        }

        //
        // Overrided 
        // - find lines from rx buffer and match each registered command
        // - pace send commands by looking for OK/ERR for each sent command before sending next
        //
        appendData(data:ArrayBuffer) {
            // console.log("Before append");
            // console.log(this.rxBuf.utf8ToString());
            super.appendData(data);
            // console.log("After append");
            // console.log(this.rxBuf.utf8ToString());

            var dataBufs = this.rxBuf.splitLine();
            // console.log("Data Buffers");
            // for( var dataBuf of dataBufs )
            // {
            //     console.log(new TextDecoder().decode(dataBuf));
            // }

            this.rxBuf.reset();
            
            for (var i = 0; i < dataBufs.length; i++) {
                var dataBuf = dataBufs[i];
                var next = ((i + 1) == dataBufs.length) ? null : dataBufs[i];
                if (next === null && dataBuf.byteLength > 0) {
                    // keep residue data in buffer until linefeed reached
                    // hope this no more incoming data during processing !!! 
                    // console.log('[' + this.name + '] rx partial line: ' + new TextDecoder().decode(dataBuf));
                    // console.log("Before shift in");
                    // console.log(this.rxBuf.utf8ToString());
                    this.rxBuf.shiftIn(dataBuf);
                    // console.log("After shift in");
                    // console.log(this.rxBuf.utf8ToString());
                } else if (next !== null && next.byteLength > 0) {
                    // process linefeed terminated data chunk
                    var datastr = new TextDecoder().decode(dataBuf);
                    // console.log('[' + this.name + '] rx full line: ' + datastr);
                    this.rxLines.push(datastr);
                    if( this.enableLogging )
                    {
                        this.logLines.push({timeStamp : new Date(), textLine : datastr});
                    }
                } else {
                    // last datestr is empty/null, i.e. the previous one is residue
                }
            }

            while( this.rxLines.length > 0 )
            {
                var line = this.rxLines.shift();
                var hit = false;

                // Hunt for OK or ERR for send response
                if( this.huntForOk )
                {
                    var re = new RegExp('(?:(OK)|ERR=(-?[0-9]+))');
                    var m = re.exec(line);
                    var retCode : number = -1000;

                    if( m )
                    {
                        if( m[1] )
                        {
                            // OK
                            retCode = 0;
                        }
                        else if( m[2] )
                        {
                            retCode = +m[2];
                        }

                        this.huntForOk = false;
                        clearTimeout(this.huntForOkTimeout);
                        this.huntForOkTimeout = null;
    
                        var rec : CmdQRec = this.sendQ.shift();
                        if( retCode != 0 )
                        {
                            rec.reject({"cmd" : rec.cmd, "signature" : rec.signature, "retCode" : -retCode, "status" : this.atCmdErrCodeStr[retCode]});
                        }
                        else
                        {
                            rec.resolve({"cmd" : rec.cmd, "signature" : rec.signature, "retCode" : -retCode, "status" : this.atCmdErrCodeStr[retCode]});
                        }

                        if( this.sendQ.length > 0 && this.ready)
                        {
                            setTimeout(() => {
                                this.sendCmdInternal();
                            },0);
                        }
                        this.initSending = false;

                        continue;
                    }
                }

                if( this.parserSpeedFilter )
                {
                    if( !line.match(this.parserSpeedFilter) )
                    {
                        continue;
                    }
                }

                for( var idx in this.cmdParsers )
                {
                    //console.log("*** " + this.cmdParsers[idx].re + "***");
                    var re = new RegExp(this.cmdParsers[idx].re);
                    var m = re.exec(line);

                    if( m )
                    {
                        // AT-CMD matched
                        // - call the designated call back
                        this.cmdParsers[idx].match(m);
                        hit = true;
                        break;
                    }
                }

                if( !hit )
                {
                    this.unrecognizedLines.push(line);
                }
            }
        }

        //
        // Refresh a registered command
        // - only work for the standard query command with result received before OK response
        //   
        atCmdRefresh(cmd : string, timeout = 5000) : Promise<any> 
        {
            var atCmdRec = this.cmdParsers[cmd];
            var key = cmd;

            if( !atCmdRec )
            {
                // The query Command could be "AT+CMDQ=..."
                var re = new RegExp(/^(AT\+.+Q=).+/g);
                var m = re.exec(cmd);
                if( m )
                {
                    key = m[1];
                    // console.log("atCmdRec key [" + key + "]");
                    // console.log(Object.keys(this.cmdParsers));
                    atCmdRec = this.cmdParsers[key];
                }
            }

            if( !atCmdRec )
            {
                return new Promise( (resolve, reject) => {
                    reject({"retCode" : -1, "status" : "unknown command" });
                });
            }

            // Obtain an sequence id for this refresh
            atCmdRec.seqId = AtCmdHandler_TEXTBASE.gSeqId++;
            return this.sendCmd( cmd,  atCmdRec.seqId, timeout);
        }

        // Send AT-CMD @ init stage
        // - use this to send AT commands @ init stage
        //   - @ init stage, there is often a series of AT command which needs to be processed 
        //     before any other commands. For example, a super class want to send a series of 
        //     command before the commands from subclass. 
        // - only one command can be sent at one time @ init stage
        //
        protected sendCmdAtInitStage( cmd : string, signature : number, sendTimeout : number = 5000 ) : Promise<any>
        {
            if( !this.initStage )
            {
                return this.sendCmd( cmd, signature );
            }

            return new Promise( (resolve, reject) => {
                if( this.initSending )
                {
                    this.handleSendCmdFailure(-1, "busy");
                }
                else
                {
                    this.sendQ.unshift({cmd:cmd,signature:signature,sendTimeout:sendTimeout,resolve:resolve,reject:reject});
                    this.initSending = true;
                    this.sendCmdInternal();
                }
            });
        }

        // Send AT-CMD
        // - always use this function to send AT commands
        // - it will buffer and pace the sending request
        //
        sendCmd( cmd : string, signature : number, sendTimeout : number = 5000 ) : Promise<any>
        {
            return new Promise( (resolve, reject) => {
                this.sendQ.push({cmd:cmd,signature:signature,sendTimeout:sendTimeout,resolve:resolve,reject:reject});
                //console.log("[sendCmd] Q size [" + this.sendQ.length + "] Ready [" + this.ready + "," +"]");
                if( this.ready && this.sendQ.length == 1)
                {
                    // There is only one item in queue, so go ahead to send the command
                    this.sendCmdInternal();
                }
            });
        }

        private sendCmdInternal()
        {
            var rec : CmdQRec = this.sendQ[0];
            this.sendCb( this.uuid, rec.cmd ).then( (obj) => {
                // Now search for OK
                // - set timer as well if not found
                this.huntForOk = true;
                this.huntForOkTimeout = setTimeout(() => {
                    this.huntForOk = false;
                    this.huntForOkTimeout = null;
                    this.handleSendCmdFailure(-400, "timeout to sent");
                }, rec.sendTimeout);
            }).catch( (obj) => {
                this.handleSendCmdFailure(-401, "failed to sent");
            });
        }

        private handleSendCmdFailure(retCode : number, reason : string)
        {
            var rec : CmdQRec = this.sendQ.shift();
            rec.reject({"cmd" : rec.cmd, "signature" : rec.signature, "retCode" : retCode, "status" : reason});
            if( this.sendQ.length > 0 && this.ready )
            {
                setTimeout(() => {
                    this.sendCmdInternal();
                },0);
            }
            this.initSending = false;
        }

        protected setSendReady()
        {
            this.ready = true;
            this.initStage = false;
            if( this.sendQ.length > 0 )
            {
                setTimeout(() => {
                    this.sendCmdInternal();
                },0);
            }
        }

        protected resetSendQ()
        {
            this.rxLines = [];
            this.sendQ = [];
            this.huntForOk = false;
            clearTimeout(this.huntForOkTimeout);
            this.huntForOkTimeout = null;
        }

        protected installParserSpeedFilter( filter : string )
        {
            this.parserSpeedFilter = filter;
        }

        //
        // Standard response callback with event broadcast
        //
        atCmdRspCallback( params ) 
        {
            //console.log( "[" + this.name + "] [" + params.cmd + "]" + JSON.stringify(params));

            // Broadcast Refresh Complete
            // - FIXME
        }
    
        //
        // Standard response callback without event broadcast
        //
        atCmdRspCallbackNoBroadcast( params ) 
        {
            //console.log( "[" + this.name + "] [" + params.cmd + "]" + JSON.stringify(params));
        }
    
        //
        // Device is connected
        //
        notifyConnected() 
        {
            super.notifyConnected();
            //console.log('[' + this.name + ']: ' + this.uuid + ' connected');

            // Broadcast Handler Connected
            // - FIXME
        }

        //
        // Device is disconnected
        //
        notifyDisconnected() 
        {
            super.notifyDisconnected();
            //console.log('[' + this.name + ']: ' + this.uuid + ' disconnected');

            // Broadcast Handler Disconnected
            // - FIXME
        }

        public startLogging()
        {
            if( this.enableLogging )
            {
                return false;
            }
            this.enableLogging = true;
            this.logLines = [];
        }

        public stopLogging()
        {
            if( !this.enableLogging )
            {
                return false;
            }

            this.enableLogging = false;
            if( this.logLines.length > 0 )
            {
                // FIXME: push to file or server
            }
        }
    }

    interface Map<T> {
        [s : string] : T;
    }

    //
    // Based class for building custom AT command record
    //
    export class AtCmdRec {
        public uuid : string;
        public cmd : string;
        public re : string;
        public cb : ( obj : {} ) => void;
        public params : {};
        public seqId : number;
        public cached : boolean;
        public eventId : string;

        public handler : AtCmdHandler;
        protected events : Events;

        public resolve : ( (obj) => void);
        public reject : ( (obj) => void);

        constructor(
            uuid : string,
            cmd : string,
            re : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            this.uuid = uuid;
            this.cmd = cmd;
            this.re = re;
            this.cb = cb;
            this.params = {};
            this.cached = false;
            this.resolve = null;
            this.reject = null;
            this.eventId = null;
            this.events = events;
        }

        //
        // Match function will call the registered callback for notification
        // - if overrided, this should be put at the last
        // - use this.params to fill up the return data to the callback
        //
        match(matchAry : any[]) {
            console.log("--- matched ---");
            this.cached = true;
            this.cb(this.params);

            if( this.events != null && this.eventId != null && this.eventId != '' )
            {
                setTimeout(() => {
                    this.events.publish(this.eventId, this.params);
                }, 0);
            }
        }
    }

    
} // namespace ATCMDHDL

