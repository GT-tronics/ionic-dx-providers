import { Inject, Injectable } from '@angular/core';
import { Events } from 'ionic-angular';
import 'rxjs/add/operator/toPromise';
import { Platform } from 'ionic-angular';
import { AtCmdDispatcherService } from '../../providers/atcmd-dispatcher/atcmd-dispatcher.service';
import { ATCMDHDLQCCSNK } from '../../providers/atcmd-dispatcher/atcmd-handler-qcc-sink';
import { ATCMDHDLQCCSRC } from '../../providers/atcmd-dispatcher/atcmd-handler-qcc-src';

export namespace ATCMDHDL 
{
    export interface LogLine
    {
        timeStamp : Date;
        textLine : string;
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
        rxBuf : any;
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
            this.rxBuf = '';
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

        appendData(data:string) {
            this.rxBuf += data;
        }
    }

    export interface CmdParserMap extends Map<AtCmdRec>{
    }

    export interface CmdQRec {
        cmd : string;
        signature : number;
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
        private initReady : boolean;
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
            this.initReady = true;
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
        appendData(data:string) {
            super.appendData(data);
            var datastrs = this.rxBuf.replace(/\n|\r\n/g, '\n').split('\n');
            this.rxBuf = '';

            for (var i = 0; i < datastrs.length; i++) {
                var datastr = datastrs[i];
                var next = i + 1 == datastrs.length ? null : datastrs[i];
                if (next === null && datastr.length > 0) {
                    // keep residue data in buffer until linefeed reached
                    // hope this no more incoming data during processing !!! 
                    // console.log('[' + this.name + '] rx partial line: ' + datastr);
                    this.rxBuf = datastr + this.rxBuf;
                } else if (next !== null && next.length > 0) {
                    // process linefeed terminated data chunk
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
                        rec.resolve({"cmd" : rec.cmd, "signature" : rec.signature, "retCode" : -retCode, "status" : this.atCmdErrCodeStr[retCode]});
                        if( this.sendQ.length > 0 )
                        {
                            setTimeout(() => {
                                this.sendCmdInternal();
                            },0);
                        }

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
        atCmdRefresh(cmd : string) : Promise<any> 
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
            return this.sendCmd( cmd,  atCmdRec.seqId);
        }

        // 
        // Send AT-CMD
        // - always use this function to AT commands
        // - it will buffer and pace the sending request
        //
        sendCmd( cmd : string, signature : number ) : Promise<any>
        {
            return new Promise( (resolve, reject) => {
                this.sendQ.push({cmd:cmd,signature:signature,resolve:resolve,reject:reject});
                //console.log("[sendCmd] Q size [" + this.sendQ.length + "] Ready [" + this.ready + "," + this.initReady +"]");
                if( (this.ready || this.initReady) && this.sendQ.length == 1)
                {
                    // Let the 1st AT-CMD goes
                    this.initReady = false;

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
                    this.handleSendCmdFailure("timeout to sent");
                }, 5000);
            }).catch( (obj) => {
                this.handleSendCmdFailure("failed to sent");
            });
        }

        private handleSendCmdFailure(reason : string)
        {
            var rec : CmdQRec = this.sendQ.shift();
            rec.reject({"cmd" : rec.cmd, "signature" : rec.signature, "retCode" : -1, "status" : reason});
            if( this.sendQ.length > 0 )
            {
                setTimeout(() => {
                    this.sendCmdInternal();
                },0);
            }
        }

        protected setSendReady()
        {
            this.ready = true;
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
        private events : Events;

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

