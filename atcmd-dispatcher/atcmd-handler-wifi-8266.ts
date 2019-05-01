import { Events } from '@ionic/angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';

export namespace ATCMDHDLWIFI8266 
{
    export class AtCmdHandler_WIFI_8266 extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_WIFI_8266(uuid, name, sendCb, events);
        }

        public atCmdWSCANQ : AtCmdRec_WSCANQ;
        public atCmdWNET : AtCmdRec_WNET;
        public atCmdWCP : AtCmdRec_WCP;
        public atCmdWCON : AtCmdRec_WCON;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);

            // AT+WSCAN?
            this.atCmdWSCANQ = new AtCmdRec_WSCANQ(this.uuid, this.atCmdRspCallback_WSCANQ.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWSCANQ, false);

            // AT+WNET?
            this.atCmdWNET = new AtCmdRec_WNET(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWNET, false);

            // AT+WCP?
            this.atCmdWCP = new AtCmdRec_WCP(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWCP, false);

            // AT+WCON?
            this.atCmdWCON = new AtCmdRec_WCON(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWCON, false);
        }
    
        //
        // Special Callback Override
        //

        private atCmdRspCallback_WSCANQ( params ) 
        {
            console.log("[" + params.cmdRsp + "] completed");
            this.atCmdWSCANQ.updateInProgress = false;
            if( params.retCode == 0 && this.atCmdWSCANQ.resolve )
            {
                this.atCmdWSCANQ.cached = true;
                this.atCmdWSCANQ.resolve(params);
                this.atCmdWSCANQ.resolve = null;
            }
            if( params.retCode < 0 && this.atCmdWSCANQ.reject )
            {
                this.atCmdWSCANQ.reject(params);
                this.atCmdWSCANQ.reject = null;
            }
        }

        //
        // Support Functions
        //


        //
        // Custom Functions (other than setters/getters)
        //

        public scanWifi(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdWSCANQ.cached )
            {
                return new Promise( (resolve, reject) => {
                    resolve(this.atCmdWSCANQ.params);
                });
            }
            
            if( this.atCmdWSCANQ.updateInProgress )
            {
                return new Promise( (resolve, reject) => {
                    console.log("refresh WiFi scan in progress");
                    reject({"retCode":-1,"status":"refresh in progress"});
                });
            }

            this.atCmdWSCANQ.cached = false;
            this.atCmdWSCANQ.updateInProgress = true;

            var cmd = "AT+WSCAN";
            return new Promise((resolve, reject) => {
                this.atCmdWSCANQ.resolve = resolve;
                this.atCmdWSCANQ.reject = reject;
                this.sendCmd(cmd,this.atCmdWSCANQ.seqId++).then( ret => {
                    cmd = this.atCmdWSCANQ.cmd;
                    this.atCmdRefresh(cmd, 10000).then( obj => {
                        //console.log("[" + cmd + "] sent ok");
                    }).catch( obj => {
                        console.log("[" + cmd + "] sent failed");
                        reject({"retCode":-4,"status":"timeout expired"});
                        this.atCmdWSCANQ.updateInProgress = false;
                        this.atCmdWSCANQ.resolve = null;
                        this.atCmdWSCANQ.reject = null;
                    });    
                }).catch( ret => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-5,"status":"timeout expired"});
                    this.atCmdWSCANQ.updateInProgress = false;
                    this.atCmdWSCANQ.resolve = null;
                    this.atCmdWSCANQ.reject = null;
                });
            });     
        }

        public connectWifiByIndex( idx : number, pwd : string ) : Promise<any>
        {
            var cmd = "AT+WCONI=" + idx + "," + pwd;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });         
        }

        public connectWifiByName( ssid : string, security : number, timeoutMs : number, pwd : string ) : Promise<any>
        {
            var cmd = "AT+WCONN=" + ssid + "," + security + "," + timeoutMs + ',' + pwd;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });         
        }

        public disconnectWifi() : Promise<any>
        {
            var cmd = "AT+WSTOP";
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });         
        }


        //
        // Setters
        //

        public setAutoConnect( onOff : boolean = true) : Promise<any>
        {
            var cmd = "AT+WCP=" + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdWCP.isAutoConnect = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        //
        // Getters
        //

        public getAutoConnect( cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdWCP.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdWCP.params);
                });
            }

            var cmd = this.atCmdWCP.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdWCP.params);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });        
        }

        public getWifConnectStatus( cache : boolean = false) : Promise<any>
        {
            if( cache && this.atCmdWCON.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdWCON.params);
                });
            }

            var cmd = this.atCmdWCON.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdWCON.params);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });        
        }

        public getWifiInfo( cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdWNET.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdWNET.params);
                });
            }

            var cmd = this.atCmdWNET.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdWNET.params);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });        
        }
    }

    interface Map<T> {
        [s : number] : T;
    }

    export interface WifiScanRec 
    {
        idx : number;
        ssid : string;
        isOpenNetwork : boolean;
        rssi : number;
        isConnected : boolean;
        discoverIdx : number;
        imgSrc : string;
        ipAddr : string;
        subnetMask : string;
        gtwyAddr : string;
        security : number;
    }

    interface WifiScanRecMap extends Map<WifiScanRec[]>
    {
    }

    // AT+PDL? AT-CMD Record
    //

    export class AtCmdRec_WSCANQ extends ATCMDHDL.AtCmdRec 
    {
        static gCnt = 0;
        static gRemoteDevNames = {};

        public wifiScanRecAryMap : WifiScanRecMap;
        public updateInProgress : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WSCAN?', "(?:AT)?\\+WSCAN\\:(-?[0-9]+)(?:,(.+),(.+),(.+),(.+),(.+))?", cb, events);
            this.wifiScanRecAryMap = <WifiScanRecMap>{};
            this.updateInProgress = false;

            // Enable broadcasr event
            // this.eventId = 'WIFI_SCAN_CHANGED';
        }

        match(matchAry : any[]) 
        {
            var idx = +matchAry[1];

            if( idx == -1 )
            {

                // Last one received
                // - clear the previous map record.
                if( this.wifiScanRecAryMap[AtCmdRec_WSCANQ.gCnt-1])
                {
                    delete this.wifiScanRecAryMap[AtCmdRec_WSCANQ.gCnt-1];
                }

                this.params = { "wifiScanRecs" : this.wifiScanRecAryMap[AtCmdRec_WSCANQ.gCnt] };
                this.params['seqid'] = this.seqId;
                this.params['uuid'] = this.uuid;
                this.params['cmdRsp'] = "+WSCAN:";
                this.params['retCode'] = 0;

                // Notify
                super.match(matchAry);
                return;
            }
            else
            {
                var ssid = matchAry[2];
                var security = +matchAry[3];
                var isOpenNetwork = security > 0 ?false :true;
                var rssi = +matchAry[4];
                var isConnected = +matchAry[5] > 0 ?true :false;
                var discoverIdx = +matchAry[6];
                var imgSrc = 'signal-low';

                if( rssi > -70 )
                {
                    imgSrc = 'signal-excel';
                }
                else if( rssi > -80 )
                {
                    imgSrc = 'signal-good';
                }
                else if( rssi > -88 )
                {
                    imgSrc = 'signal-fair';
                }

                if( isConnected )
                {
                    imgSrc += '-connected';
                }

                var wifiScanRec : WifiScanRec = 
                { 
                    idx : idx, 
                    ssid : ssid,
                    isOpenNetwork : isOpenNetwork,
                    rssi : rssi,
                    isConnected : isConnected,
                    discoverIdx : discoverIdx,
                    imgSrc : imgSrc,
                    ipAddr : "",
                    subnetMask : "",
                    gtwyAddr : "",
                    security : security,
                };
                // console.log(JSON.stringify(wifiScanRec));

                if( idx == 0 )
                {
                    AtCmdRec_WSCANQ.gCnt++;
                }
            }

            var seqId = AtCmdRec_WSCANQ.gCnt;
            var wifiScanRecAry = this.wifiScanRecAryMap[seqId];

            if( !wifiScanRecAry )
            {
                wifiScanRecAry = [];
                this.wifiScanRecAryMap[seqId] = wifiScanRecAry;
            }
            
            wifiScanRecAry.push(wifiScanRec);        
        }
    }


    // AT+WCP?
    //
    export class AtCmdRec_WCP extends ATCMDHDL.AtCmdRec 
    {
        public isAutoConnect : boolean = false;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WCP?', "(?:AT)?\\+WCP\\:(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.isAutoConnect = matchAry[1] == '1' ?true :false;

            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WNET:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "isAutoConnect" : this.isAutoConnect, 
            };

            // Always the last
            super.match(matchAry);
        }
    }

    // AT+WCON?
    //
    export class AtCmdRec_WCON extends ATCMDHDL.AtCmdRec 
    {
        public connectStatusCode : number = 0;
        public connectStatusStrs : string[] = [ 'idle', 'connecting_ack', 'connected', 'disconnecting', 'auto_connect', 'idle_ready', 'connecting', 'connecting_timeout', 'disconnecting_by_user', 'unknown'];
        public ssid : string = "";

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WCON?', "(?:AT)?\\+WCON\\:([0-9]+)(?:,(.+))?", cb, events);

            // Enable broadcasr event
            this.eventId = 'WIFI_CONNECT_STATUS_CHANGED';
        }

        match(matchAry : any[]) 
        {
            this.connectStatusCode = +matchAry[1];
            if( this.connectStatusCode > this.connectStatusStrs.length - 1 )
            {
                this.connectStatusCode = this.connectStatusStrs.length - 1;
            }
            this.ssid = this.connectStatusCode == 0 ?"" :matchAry[2];

            // console.log("[AtCmdRec_WCON]" + matchAry[1] + " " + matchAry[2]);

            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WCON:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "connectStatusCode" : this.connectStatusCode,
                "connectStatusStr" : this.connectStatusStrs[this.connectStatusCode],
                "ssid" : this.ssid 
            };

            // Always the last
            super.match(matchAry);
        }
    }

    // AT+WNET?
    //
    export class AtCmdRec_WNET extends ATCMDHDL.AtCmdRec 
    {
        public wifiStatusCode : number = 0;
        public wifiStatusStrs : { [idx: number]: string; } = 
        { 
            0: 'idle', 
            1: 'no_ssid', 
            2: 'scan_completed',
            3: 'connected',
            4: 'connect_fail',
            5: 'connect_lost',
            6: 'disconnected',
            255: 'no_wifi'
        };
        public ipAddr : string;
        public subnetMask : string;
        public gtwyAddr : string;
        public ssid : string;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WNET?', "(?:AT)?\\+WNET\\:(.+),(.+),(.+),(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.wifiStatusCode = +matchAry[1];
            this.ipAddr = matchAry[2];
            this.subnetMask = matchAry[3];
            this.gtwyAddr = matchAry[4];
            this.ssid = matchAry[5];

            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WNET:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "wifiStatusCode" : this.wifiStatusCode, 
                "wifiStatusStr" : this.wifiStatusStrs[this.wifiStatusCode],
                "ipAddr" : this.ipAddr,
                "subnetMask" : this.subnetMask,
                "gtwyAddr" : this.gtwyAddr,
                "ssid" : this.ssid,
            };

            // Always the last
            super.match(matchAry);
        }
    }


    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_WIFI_8266
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('WFI', AtCmdHandler_WIFI_8266.createInstance)

}  // namespace ATCMDHDLQCCSRC

