import { Events } from '../events';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';

export namespace ATCMDHDLWIFI8266 
{
    export class AtCmdHandler_WIFI_8266 extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string | ArrayBuffer | SharedArrayBuffer) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_WIFI_8266(uuid, name, sendCb, events);
        }

        public atCmdWSCANQ : AtCmdRec_WSCANQ;
        public atCmdWNET : AtCmdRec_WNET;
        public atCmdWCP : AtCmdRec_WCP;
        public atCmdWCON : AtCmdRec_WCON;
        public atCmdWRDY : AtCmdRec_WRDY;
        public atCmdWMAC : AtCmdRec_WMAC;
        public atCmdAZON : AtCmdRec_AZON;
        public atCmdWAZC : AtCmdRec_WAZC;
        public atCmdWCLT : AtCmdRec_WCLT;
        public atCmdWUPG : AtCmdRec_WUPG;
        public atCmdTRSS : AtCmdRec_TRSS;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string | ArrayBuffer | SharedArrayBuffer) => Promise<any>,
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

            // AT+WRDY
            this.atCmdWRDY = new AtCmdRec_WRDY(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWRDY, false);

            // AT+WMAC?
            this.atCmdWMAC = new AtCmdRec_WMAC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWMAC, false);

            // AT+AZON?
            this.atCmdAZON = new AtCmdRec_AZON(this.uuid, this.atCmdRspCallback_AZON.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdAZON, false);

            // AT+WAZC?
            this.atCmdWAZC = new AtCmdRec_WAZC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWAZC, false);

            // AT+WCLT?
            this.atCmdWCLT = new AtCmdRec_WCLT(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWCLT, false);

            // AT+WUPG? (notification only)
            this.atCmdWUPG = new AtCmdRec_WUPG(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdWUPG, false);

            // AT+TRSS=
            this.atCmdTRSS = new AtCmdRec_TRSS(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdTRSS, false);
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
            else if( params.retCode < 0 && this.atCmdWSCANQ.reject )
            {
                this.atCmdWSCANQ.reject(params);
                this.atCmdWSCANQ.reject = null;
            }
        }

        private atCmdRspCallback_AZON( params )
        {
            if( params.connected && this.atCmdWUPG.upgradeInProgress )
            {
                this.atCmdWUPG.wifiReset();
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
                    if( ret.retCode == -37 )
                    {
                        // Still AT+WCP=1
                        // - wifi may have crashed
                        // - force AT+WCP=0 so the scan retry will work
                        this.setAutoConnect(false).then( ret => {
                        }).catch( ret => {
                        });
                    }
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

        public setupWifiCreditials( ssid : string, pwd : string ) : Promise<any>
        {
            var cmd = "AT+WIFI=" + ssid + "," + pwd;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( ret => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( ret => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":ret.retCode, "status":ret.status});
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

        public sendCustomCommand(cmd : string) : Promise<any>
        {
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

        public sysReset() 
        {
            this.sendCmd("AT+RST", this.seqId++).then( ret => {
            }).catch( ret => {
            });
        }

        public clearWifiCredentialsThenReset() : Promise<any>
        {
            return new Promise((resolve, reject) => {
                this.sendCmd("AT+WIFI=,", this.seqId++).then( obj => {
                    console.log("[AT+WIFI=,] sent ok");
                    this.sendCmd("AT+WCP=0", this.seqId++).then( obj => {
                        console.log("[AT+WCP=0] sent ok");
                        this.sysReset();
                        resolve({"retCode":0,"status":"success"});
                    }).catch( obj => {
                        console.log("[AT+WCP=0] sent failed");
                        reject({"retCode":-2,"status":"timeout expired"});
                    });    
                }).catch( obj => {
                    console.log("[AT+WIFI=,] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });        
        }

        public async scanAndFixProvisioning(provisionTable : any)
        {
            var tempStr = provisionTable.cloudTemplateString;

            // Find template from provision table
            if( tempStr === undefined || tempStr === null )
            {
                console.log("undefined cloudTemplateString");
                // Can't find template string in provision table
                throw {"retCode":-1,"status":"template string no found in provision table"};
            }

            try {
                var templateRef = JSON.parse(tempStr);
            }
            catch(err)
            {
                console.log("corrupted cloudTemplateString");
                throw {"retCode":-2,"status":"supplied template string corrupted"};
            }

            const wifiMac = await this.getWifiMacAddress();
            // console.log("Got mac address");

            // Verify cloud template string
            await this.verifyCloudTemplateString(templateRef);

            // Verify connection string
            await this.verifyConnectionString(provisionTable, wifiMac.addr);

            return ({retCode:0,status:"success"});  
        }

        public async verifyConnectionString(provisionTable : any, macAddr : string, loopCnt : number = 2)
        {
            try {
                this.atCmdWAZC.params = {};
                await this.atCmdRefresh(this.atCmdWAZC.cmd);
            }
            catch(err){}

            console.log("sent " + this.atCmdWAZC.cmd);
            var endpoint = this.atCmdWAZC.params['endpoint'];
            var devId = this.atCmdWAZC.params['devId'];
            //console.log("endpoint: " + endpoint);
            //console.log("devId: " + devId);
            if( endpoint === undefined || devId === undefined ||
                !endpoint.includes("azure-devices.net")  || 
                !devId.includes("WiBlue-IoT1") )
            {   
                // Invalid WAZC. Need reprovisioning
                console.log("Invalid " + this.atCmdWAZC.cmd);

                // Need to handle IoTx
                // var connStr : string = null;
                // for( var i = 1; i < 100; i++)
                // {
                //     devId = "WiBlue-IoT" + i + "-" + macAddr;
                //     //console.log( devId );
                //     connStr = provisionTable.connStrs[devId];
                //     if( connStr !== undefined && connStr !== null )
                //     {
                //         break;
                //     }
                // }

                devId = "WiBlue-IoT1-" + macAddr;
                var connStr = provisionTable.connStrs[devId];

                if( connStr === undefined || connStr === null )
                {
                    console.log(devId + " connStr not found");
                    // Can't find provision record
                    throw {"retCode":-3,"status":"provison record no found"};
                }

                var cmd = "AT+WAZC=" + connStr;
                try {
                    await this.sendCmd(cmd, this.seqId++);
                    // Mark reprovisioned
                    this.atCmdWAZC.setReprovisioned();
                } catch(err)
                {
                    if( loopCnt == 0 )
                    {
                        throw {retCode:-4,status:"fail to write connecting string"};
                    }
                    else
                    {
                        console.log("fail to send AT+WAZC=.... Retry");
                    }
                }
                    
                if( loopCnt > 0 )
                {
                    await this.verifyConnectionString(provisionTable, macAddr, loopCnt - 1);
                }
            }

            // Mark WCLT string verified
            this.atCmdWAZC.setVerified();

            // Matched. No need to anything
            return({"retCode":0,"status":"success"});            
        }

        public async verifyCloudTemplateString(templateRef : any, loopCnt : number = 2)
        {
            await this.atCmdRefresh(this.atCmdWCLT.cmd);
            console.log("sent " + this.atCmdWCLT.cmd);
            var template = this.atCmdWCLT.params['template'];
            if( template === undefined || template === null )
            {
                // Invalid WCLT. Need reprovisioning
                console.log("invalid WCLT string");

                // update WCLT
                await this.updateCloudTemplateString(templateRef);
                if( loopCnt > 0 )
                {
                    await this.verifyCloudTemplateString(templateRef, loopCnt - 1);
                }
            }
            else
            {
                // Valid WCLT. Now verify against the template string in provision table

                if( !this.deepEqual(templateRef, template) )
                {
                    // update WCLT
                    console.log("unmatch WCLT string");
                    await this.updateCloudTemplateString(templateRef);
                    
                    // Mark WCLT reprovisioned
                    this.atCmdWCLT.setReprovisioned();

                    if( loopCnt > 0 )
                    {
                        await this.verifyCloudTemplateString(templateRef, loopCnt - 1);
                    }
                }
            }

            // Mark WCLT string verified
            this.atCmdWCLT.setVerified();

            // Matched. No need to anything
            return({"retCode":0,"status":"success"});
        }

        private deepEqual(x : any, y : any) : boolean
        {
            const ok = Object.keys, tx = typeof x, ty = typeof y;
            return x && y && tx === 'object' && tx === ty ? (
              ok(x).length === ok(y).length &&
                ok(x).every(key => this.deepEqual(x[key], y[key]))
            ) : (x === y);
        }

        public updateCloudTemplateString(template : any) : Promise<any>
        {
            return new Promise( async (resolve, reject) => {
                var keys = Object.keys(template);
                var isStart : boolean = true;
    
                try {
                    for( var i=0; i < keys.length; i++ )
                    {
                        var pair : any = {};
                        var key = keys[i];
                        pair[key] = template[key];
                        var pairStr = JSON.stringify(pair);
                        var cmd = "AT+WCLT=" + (isStart ?'0,' :'1,') + pairStr;
                        await this.sendCmd(cmd, this.seqId++);
                        console.log("sent " + cmd);
                        isStart = false;
                    }
                    resolve({retCode:0,status:"success"});    
                }
                catch(e)
                {
                    console.log("fail to write template string segment");
                    reject({retCdode:-1,status:"write template string segment failed"});
                }
            });
        }

        public isReprovisionedSuccessfully() : boolean
        {
            if( this.atCmdWAZC.isReprovisioned() && this.atCmdWAZC.isVerified() &&
                this.atCmdWCLT.isReprovisioned() && this.atCmdWCLT.isVerified() )
            {
                return true;
            }
            return false;
        }

        public isProvisioningInvalid() : boolean
        {
            if( !this.atCmdWAZC.isVerified() || !this.atCmdWCLT.isVerified() )
            {
                return true;
            }
            return false;
        }

        public async startFirmwareUpgrade(fp : string, url : string, cb : (stage : number, percentComplete : number, abort? : boolean) => void)
        {
            if( this.atCmdWUPG.upgradeInProgress )
            {
                return({"retCode":-4,"status":"busy"});
            }

            var cmd;
            
            // Set finger print
            cmd = "AT+WUPGF=" + fp;
            try
            {
                await this.sendCmd(cmd, this.seqId++);
            }
            catch(err)
            {
                // AT+WUPGF is not supported for wifi firmware equal or older than 0.9.8
                // - just ignore and continue
            }

            // Set progress callback
            if( cb )
            {
                this.atCmdWUPG.startUpgrade(0, cb);
            }

            // Start upgrade progress
            cmd = "AT+WUPG=1234," + url;
            await this.sendCmd(cmd, this.seqId++);

            return({"retCode":0,"status":"success"});
        }

        public abortFirmwareUpgrade()
        {
            this.atCmdWUPG.terminateUpgrade();
        }

        public async verifyFirmwareUpgrade(ver : string)
        {
            await this.atCmdRefresh(this.atCmdVS.cmd);

            if( ver != this.atCmdVS.swVer )
            {
                throw({"retCode":-1,"status":"version incorrect","swVer":this.atCmdVS.swVer});
            }
            return({"retCode":0,"status":"success"});
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

            return new Promise((resolve, reject) => {
                this.atCmdRefresh(this.atCmdWNET.cmd).then( obj => {
                    console.log("[" + this.atCmdWNET.cmd + "] sent ok");
                    resolve(this.atCmdWNET.params);
                }).catch( obj => {
                    console.log("[" + this.atCmdWNET.cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });    
            });        
        }

        public getWifiMacAddress( cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdWMAC.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdWMAC.params);
                });
            }

            return new Promise((resolve, reject) => {
                this.atCmdRefresh(this.atCmdWMAC.cmd).then( ret => {
                    console.log("[" + this.atCmdWMAC.cmd + "] sent ok");
                    resolve(this.atCmdWMAC.params);
                }).catch( ret => {
                    console.log("[" + this.atCmdWMAC.cmd + "] sent failed");
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


    // AT+WRDY
    //
    export class AtCmdRec_WRDY extends ATCMDHDL.AtCmdRec 
    {
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WRDY', "(?:AT)?\\+WRDY", cb, events);

            // Enable broadcasr event
            this.eventId = 'WIFI_RESET';
        }

        match(matchAry : any[]) 
        {
            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WRDY",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
            };

            // Always the last
            super.match(matchAry);
        }
    }

    //
    // AT+WMAC?
    //
    export class AtCmdRec_WMAC extends ATCMDHDL.AtCmdRec 
    {
        public addr : string = "";

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WMAC?', "(?:AT)?\\+WMAC\\:(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.addr = matchAry[1].replace(/\:/g, '');

            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WMAC:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "addr" : this.addr, 
            };

            // Always the last
            super.match(matchAry);
        }
    }

    //
    // AT+AZON:
    //
    export class AtCmdRec_AZON extends ATCMDHDL.AtCmdRec 
    {
        public connected : boolean = false;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+AZON?', "(?:AT)?\\+AZON\\:(.+)", cb, events);

            // Enable broadcasr event
            this.eventId = 'CLOUD_STATUS_CHANGED';
        }

        match(matchAry : any[]) 
        {
            this.connected = (matchAry[1] == '1' ?true :false);

            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+AZON:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "connected" : this.connected, 
            };

            // Always the last
            super.match(matchAry);
        }
    }


    //
    // AT+WAZC?
    //

    export class AtCmdRec_WAZC extends ATCMDHDL.AtCmdRec 
    {
        private reprovisioned = false;
        private verified = false;
        
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WAZC?', "(?:AT)?\\+WAZC\\:(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WAZC:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "endpoint" : matchAry[1], 
                "devId" : matchAry[2], 
            };

            // Always the last
            super.match(matchAry);
        }

        isReprovisioned()
        {
            var provisoned = this.reprovisioned
            this.reprovisioned = false;
            return provisoned;
        }

        setReprovisioned()
        {
            this.reprovisioned = true;
        }

        isVerified()
        {
            var verified = this.verified
            this.verified = false;
            return verified;
        }

        setVerified()
        {
            this.verified = true;
        }
    }

    //
    // AT+WCLT?
    //
    
    export class AtCmdRec_WCLT extends ATCMDHDL.AtCmdRec 
    {
        private reprovisioned = false;
        private verified = false;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WCLT?', "(?:AT)?\\+WCLT\\:(.*)", cb, events);
        }

        match(matchAry : any[]) 
        {
            var template : any = null;
            try {
                template = JSON.parse(matchAry[1]);
            }
            catch(err)
            {
            }
            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WCLT:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "template" : template, 
            };

            // Always the last
            super.match(matchAry);
        }

        isReprovisioned()
        {
            var provisoned = this.reprovisioned
            this.reprovisioned = false;
            return provisoned;
        }

        setReprovisioned()
        {
            this.reprovisioned = true;
        }

        isVerified()
        {
            var verified = this.verified
            this.verified = false;
            return verified;
        }

        setVerified()
        {
            this.verified = true;
        }
    }

    //
    // AT+WUPG? (Notification Only)
    //
    
    export class AtCmdRec_WUPG extends ATCMDHDL.AtCmdRec 
    {
        public upgradeInProgress = false;
        private progressCb : (stage : number, percentComplete : number, abort? : boolean) => void = null;
        private writtenSz : number = 0;
        private startStage : number = 0;
        private currStage : number = 0;

        private errReasonList = 
        {
            "-100" : "HTTP_UE_TOO_LESS_SPACE",
            "-101" : "HTTP_UE_SERVER_NOT_REPORT_SIZE",
            "-102" : "HTTP_UE_SERVER_FILE_NOT_FOUND",
            "-103" : "HTTP_UE_SERVER_FORBIDDEN",
            "-104" : "HTTP_UE_SERVER_WRONG_HTTP_CODE",
            "-105" : "HTTP_UE_SERVER_FAULTY_MD5",
            "-106" : "HTTP_UE_BIN_VERIFY_HEADER_FAILED",
            "-107" : "HTTP_UE_BIN_FOR_WRONG_FLASH",
        }

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+WUPG?', "(?:AT)?\\+WUPG\\:(-?[0-9]+)(?:,([0-9]+),([0-9]+))?", cb, events);
        }

        match(matchAry : any[]) 
        {
            var code = +matchAry[1];

            // Set the parameter object for the callback
            this.params = 
            { 
                "cmdRsp" : "+WUPG:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "reason" : "",
                "stage" : 0,
                "percentComplete" : 0
            };

            if( code < 0 )
            {
                // Error
                this.params["retCode"] = -1;
                this.params["status"] = "download err";
                this.params["reason"] = this.errReasonList[code.toString()];
                this.progressCb(this.startStage + this.currStage, 0, true);
                this.terminateUpgrade();
            }
            else if( code == 0 )
            {
                // Started
                if( this.progressCb )
                {
                    this.progressCb(this.startStage + this.currStage, 0);
                }
                this.currStage++;
                this.params["stage"] = this.currStage;
                this.params["percentComplete"] = 0;
            }
            else if( code == 1 )
            {
                // Download in progress
                var writtenSz : number = +matchAry[2];
                var totalSz : number = +matchAry[3];
                var percentComplete = Math.round(writtenSz/totalSz * 100.0);

                this.params["percentComplete"] = percentComplete;

                if( writtenSz > this.writtenSz && this.progressCb )
                {
                    this.writtenSz = writtenSz;
                    this.progressCb(this.startStage + this.currStage, percentComplete);
                }
            }
            else if( code == 2 )
            {
                // Switching firmware
                this.params["stage"] = ++this.currStage;
                this.params["percentComplete"] = 0;
                if( this.progressCb )
                {
                    this.progressCb(this.startStage + this.currStage, 0);
                }
            }
        }

        wifiReset()
        {
            if( this.upgradeInProgress )
            {
                if( this.progressCb )
                {
                    if( this.currStage == 2 )
                    {
                        this.currStage++;
                        this.progressCb(this.startStage + this.currStage, 0);
                    }
                    else
                    {
                        this.progressCb(this.startStage + this.currStage, 0, true);
                    }
                }
                this.terminateUpgrade();
            }
        }

        terminateUpgrade()
        {
            this.progressCb = null;
            this.upgradeInProgress = false;
        }

        startUpgrade( startStage : number, cb : (stage : number, percentComplete : number, abort? : boolean) => void)
        {
            this.upgradeInProgress = true;
            this.progressCb = cb;
            this.startStage = startStage;
            this.currStage = 0;
        }

    }

    //
    // AT+TRSS=
    //
    
    export class AtCmdRec_TRSS extends ATCMDHDL.AtCmdRec 
    {
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+TRSS=', "AT\\+TRSS=.+", cb, events);

            // Enable broadcasr event
            this.eventId = 'CLOUD_FULL_CMD';
        }

        match(matchAry : any[]) 
        {
            this.params = 
            { 
                "cmdRsp" : "+TRSS=",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "fullCmd" : matchAry[0],
            };
            super.match(matchAry);
        }
    }

    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_WIFI_8266
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('WFI', AtCmdHandler_WIFI_8266.createInstance)

}  // namespace ATCMDHDLQCCSRC

