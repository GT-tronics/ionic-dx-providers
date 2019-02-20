import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';

export namespace ATCMDHDLQCCSRC 
{
    enum AddrType { public_addr, private_addr }; 
    enum ProvisionProfileType { none, hfp, a2dp, both };
    enum ConnectState { NONE = 0x0, PRIMARY = 0x1, SECONDARY = 0x2, ERROR = 0x4 };
    enum DeviceState { INIT, PWR_OFF, TEST, IDLE, CONNECTABLE, DISCOVERABLE, CONNECTING, INQUIRING, CONNECTED, CONFIG }

    export class AtCmdHandler_QCC_SRC extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_QCC_SRC(uuid, name, sendCb, events);
        }

        public atCmdPDL : AtCmdRec_PDL;
        public atCmdDS : AtCmdRec_DS;
        public atCmdCC : AtCmdRec_CC;
        public atCmdCR : AtCmdRec_CR;
        public atCmdVLQ : AtCmdRec_VLQ;
        public atCmdPDLU : AtCmdRec_PDLU;
        public atCmdDCQ : AtCmdRec_DCQ;
        public atCmdSCAN : AtCmdRec_SCAN;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);

            // AT+DS?
            this.atCmdDS = new AtCmdRec_DS(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdDS, true);

            // AT+CC?
            this.atCmdCC = new AtCmdRec_CC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdCC, false);
            
            // AT+CR?
            this.atCmdCR = new AtCmdRec_CR(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdCR, true);

            // AT+VLQ=
            this.atCmdVLQ = new AtCmdRec_VLQ(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdVLQ, false);
                                    
            // AT+DCQ=
            this.atCmdDCQ = new AtCmdRec_DCQ(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdDCQ, false);
                                    
            // AT+PDL?
            this.atCmdPDL = new AtCmdRec_PDL(this.uuid, this.atCmdRspCallback_PDL.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPDL, false);

            // AT+PDLU?
            this.atCmdPDLU = new AtCmdRec_PDLU(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPDLU, false);

            // AT+SCAN
            this.atCmdSCAN = new AtCmdRec_SCAN(this.uuid, this.atCmdRspCallback_SCAN.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdSCAN, false);
        }
    
        //
        // Special Callback Override
        //

        // Special Callback to handle PDL unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in this callback.
        // - also event broadcast is suppressed.
        // - command sequence example:
        //   AT+PDL?
        //   OK            <== result received after OK (as unsolicted notification)
        //   +PDL:0,...
        //   +PDL:1,...
        //   ...
        //   +PDL:-1
        //
        private atCmdRspCallback_PDL( params ) 
        {
            this.atCmdPDL.updateInProgress = false;
            if( params.retCode == 0 && this.atCmdPDL.resolve )
            {
                //console.log("[" + params.cmdRsp + "] completed success: " + JSON.stringify(params));
                this.atCmdPDL.cached = true;
                this.atCmdPDL.resolve(params);
            }
            else if( params.retCode < 0 && this.atCmdPDL.reject )
            {
                //console.log("[" + params.cmdRsp + "] completed failed: " + params.retCode);
                this.atCmdPDL.reject(params);
            }
            this.atCmdPDL.resolve = null;
            this.atCmdPDL.reject = null;
        }

        // Special Callback to handle SCAN unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in this callback.
        // - also event broadcast is suppressed.
        // - command sequence example:
        //   AT+SCAN (or AT+SCAN=<maxScan>,<timeout>)
        //   OK            <== result received after OK (as unsolicted notification)
        //   +SCAN:0,...
        //   +SCAN:1,...
        //   +SCAN:0,...
        //   ...
        //   +SCAN:-1
        //
        private atCmdRspCallback_SCAN( params ) 
        {
            this.atCmdSCAN.updateInProgress = false;
            if( params.retCode == 0 && this.atCmdSCAN.resolve )
            {
                //console.log("[" + params.cmdRsp + "] completed success: " + JSON.stringify(params));
                this.atCmdSCAN.cached = true;
                this.atCmdSCAN.resolve(params);
            }
            else if( params.retCode < 0 && this.atCmdSCAN.reject )
            {
                //console.log("[" + params.cmdRsp + "] completed failed: " + params.retCode);
                this.atCmdSCAN.reject(params);
            }
            this.atCmdSCAN.resolve = null;
            this.atCmdSCAN.reject = null;
    }


        //
        // Support Functions
        //

        protected findPdlIndexByAddress( addr : string ) : {idx:number,errStatus:string}
        {
            if( !this.atCmdPDL.cached )
            {
                return {idx:-1, errStatus:"invalid PDL"};
            }

            var pdlRecs : PdlRec[] = this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt];
            if( pdlRecs.length == 0 )
            {
                return {idx:-2, errStatus:"PDL is empty"};
            }

            for( var idx = 0; idx < pdlRecs.length; idx++ )
            {
                if( pdlRecs[idx].addr == addr )
                {
                    return {idx:idx, errStatus:"success"};
                }
            }

            return {idx:-3, errStatus:"address not in PDL"};
        }

        protected findPdlIndexOfPrimaryDevice() : {idx:number,errStatus:string}
        {
            return this.findPdlIndexOfConnectedDevice(0x5);
        }

        protected findPdlIndexOfSecondaryDevice() : {idx:number,errStatus:string}
        {
            return this.findPdlIndexOfConnectedDevice(0xA);
        }

        private findPdlIndexOfConnectedDevice(mask : number) : {idx:number,errStatus:string}
        {
            if( !this.atCmdPDL.cached )
            {
                return {idx:-1, errStatus:"invalid PDL"};
            }

            var pdlRecs : PdlRec[] = this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt];
            if( pdlRecs.length == 0 )
            {
                return {idx:-2, errStatus:"PDL is empty"};
            }

            for( var idx = 0; idx < pdlRecs.length; idx++ )
            {
                if( (pdlRecs[idx].connectedProfile & mask) > 0 )
                {
                    return {idx:0, errStatus:"success"};
                }
            }

            return {idx:-3, errStatus:"primary device not exists"};
        }

        //
        // Custom Functions (other than setters/getters)
        //

        public refreshPdl() : Promise<any>
        {
            console.log("[refreshPdl] ...");
            if( this.atCmdPDL.updateInProgress )
            {
                var cmd = this.atCmdPDL.cmd;
                return new Promise( (resolve, reject) => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"refresh in progress"});
                });
            }

            this.atCmdPDL.cached = false;
            this.atCmdPDL.updateInProgress = true;

            var cmd = this.atCmdPDL.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdPDL.resolve = resolve;
                this.atCmdPDL.reject = reject;
                this.atCmdRefresh(cmd).then( obj => {
                    //console.log("[" + cmd + "] sent ok");
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                    this.atCmdPDL.updateInProgress = false;
                    this.atCmdPDL.resolve = null;
                    this.atCmdPDL.reject = null;
                });
            });     
        }

        public removePDL( addr : string ) : Promise<any>
        {
            console.log("[removePDL] ...");
            var ret = this.findPdlIndexByAddress(addr);
            if( ret.idx < 0 )
            {
                return new Promise( (resolve, reject) => {
                    reject({"retCode":ret.idx,"status":ret.errStatus});
                });
            }
            
            var cmd = "AT+PDLR=" + ret.idx;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                    // Always refresh PDL after successfully removes a device
                    this.refreshPdl();
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                });
            });       
        }

        public connectPairedDevice( addr : string ) : Promise<any>
        {
            console.log("[connectPairedDevice] ...");
            var ret = this.findPdlIndexByAddress(addr);
            if( ret.idx < 0 )
            {
                return new Promise( (resolve, reject) => {
                    reject({"retCode":ret.idx,"status":ret.errStatus});
                });
            }
            
            var cmd = "AT+CN=1," + ret.idx;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                });
            });  
        }

        public connectDevice( addr : string ) : Promise<any>
        {
            var cmd = "AT+CA=" + addr.replace(/\:/g, '');;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                });
            });  
        }

        public disconnectDevice( addr : string ) : Promise<any>
        {
            console.log("[disconnectDevice] ...");
            var ret = this.findPdlIndexByAddress(addr);
            if( ret.idx < 0 )
            {
                return new Promise( (resolve, reject) => {
                    reject({"retCode":ret.idx,"status":ret.errStatus});
                });
            }
            
            var cmd = "AT+CN=0," + ret.idx;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                });
            });  
        }

        public isDeviceConnected( addr : string ) : boolean
        {
            var ret : {idx:number,errStatus:string};
            if( addr == null )
            {
                ret = this.findPdlIndexOfPrimaryDevice();
                if( ret.idx == -3 )
                {
                    ret = this.findPdlIndexOfSecondaryDevice();
                }
            }
            else
            {
                ret = this.findPdlIndexByAddress(addr);
            }
            
            if( ret.idx < 0 )
            {
                return false;
            }

            var connectedProfile = this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt][ret.idx].connectedProfile;
            if( connectedProfile > 0 )
            {
                return true;
            }

            return false;
        }

        public startScan(enableInterimResultReporting : boolean = false) : Promise<any>
        {
            console.log("[startScan] ...");
            if( this.atCmdSCAN.updateInProgress )
            {
                var cmd = this.atCmdSCAN.cmd;
                return new Promise( (resolve, reject) => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"sanning in progress"});
                });
            }

            this.atCmdSCAN.cached = false;
            this.atCmdSCAN.updateInProgress = true;
            this.atCmdSCAN.refreshScan = true;
            this.atCmdSCAN.enableInterimResultReporting = enableInterimResultReporting;

            var cmd = this.atCmdSCAN.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdSCAN.resolve = resolve;
                this.atCmdSCAN.reject = reject;
                this.atCmdRefresh(cmd).then( obj => {
                    //console.log("[" + cmd + "] sent ok");
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                    this.atCmdSCAN.updateInProgress = false;
                    this.atCmdSCAN.resolve = null;
                    this.atCmdSCAN.reject = null;
                });
            });     
        }

        public cancelScan() : Promise<any>
        {
            console.log("[cancelScan] ...");
            if( !this.atCmdSCAN.updateInProgress )
            {
                var cmd = this.atCmdSCAN.cmd;
                return new Promise( (resolve, reject) => {
                    console.log("[" + cmd + "=0] sent failed");
                    reject({"retCode":-1,"status":"sanning not in progress"});
                });
            }

            this.atCmdSCAN.updateInProgress = false;

            var cmd = this.atCmdSCAN.cmd + '=0';
            return new Promise((resolve, reject) => {
                this.atCmdSCAN.resolve = null;
                this.atCmdSCAN.reject = null;
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                });
            });    
        }

        //
        // Setters
        //

        public setPairingOnOff( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+PR=" + (onOff ? 1 :0);
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

        public setCodecMask( mask : number ) : Promise<any>
        {
            var cmd = "AT+CC=" + mask;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdCC.mask = mask;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setVolume( pdlIdx : number, vol : number ) : Promise<any>
        {
            var cmd = "AT+VL=" + pdlIdx + ",0," + vol;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    if( pdlIdx == 0 )
                    {
                        this.atCmdVLQ.vol1 = vol;
                    }
                    else if( pdlIdx == 1 )
                    {
                        this.atCmdVLQ.vol2 = vol;
                    }
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }


        public setEnableDualStream( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=1," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.enableDualStream = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }


        public setAutoReconnect2ndDevice( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=2," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.autoReconnect2ndDevice = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }


        public setForceAvrcpVolMuteSync( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=3," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.forceAvrcpVolMuteSync = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }


        public setForceAvrcpVolMuteSyncDelay( delay : number ) : Promise<any>
        {
            var cmd = "AT+DCS=4," + delay;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.forceAvrcpVolMuteSyncDelay = delay;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setEnableRoleMismatchReconnectMedia( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=5," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.enableRoleMismatchReconnectMedia = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }


        public setEnablePktSzMismatchReconnectMedia( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=6," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.enablePktSzMismatchReconnectMedia = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }


        public setEnableHfp( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=7," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.enableHfp = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setSbcMaxBitPoolSize( bitPoolSz : number ) : Promise<any>
        {
            var cmd = "AT+DCS=9," + bitPoolSz;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.sbcMaxBitPoolSz = bitPoolSz;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setForceA2dpProfile( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=11," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.forceA2dpProfile = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setEnableHfpA2dpSwitchingViaButton( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=10," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.enableHfpA2dpSwitchingViaButton = onOff;
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

        public getPdlImmediate() : any
        {
            if( this.atCmdPDL.cached )
            {
                return {"pdl" : this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt]};
            }

            return null;
        }

        public getPdl(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdPDL.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve({"pdl" : this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt]});
                });
            }

            return this.refreshPdl();
        }

        public getPrimaryDeviceAddress() : string
        {
            var ret = this.findPdlIndexOfPrimaryDevice();
            if( ret.idx < 0 )
            {
                return null;
            }

            return this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt][ret.idx].addr;
        }

        public getSecondaryDeviceAddress() : string
        {
            var ret = this.findPdlIndexOfSecondaryDevice();
            if( ret.idx < 0 )
            {
                return null;
            }

            return this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt][ret.idx].addr;
        }

        public getPrimaryDeviceRemoteName() : string
        {
            var ret = this.findPdlIndexOfPrimaryDevice();
            if( ret.idx < 0 )
            {
                return null;
            }

            return this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt][ret.idx].remoteDevName;
        }

        public getSecondaryDeviceRemoteName() : string
        {
            var ret = this.findPdlIndexOfSecondaryDevice();
            if( ret.idx < 0 )
            {
                return null;
            }

            return this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt][ret.idx].remoteDevName;
        }

        public getCodecMask(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdCC.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdCC.mask);
                });
            }

            var cmd = this.atCmdCC.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdCC.mask);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getStreamState(cache : boolean = true) : Promise<any>
        {
            if( this.atCmdCR.cached )
            {
                return new Promise ((resolve, reject) => {
                    if( this.atCmdCR.codecCode == -1 )
                    {
                        reject({"retCode":-2,"status":"not updated yet"});
                    }
                    else
                    {
                        var codecCode = this.atCmdCR.codecCode;
                        resolve({
                            "retCode" : 0,
                            'connCount' : this.atCmdCR.connCount,
                            'codecCode' : codecCode, 
                            'codecCodeStr' : this.atCmdCR.codecStrs[codecCode]
                        });
                    }
                });
            }

            return new Promise ((resolve, reject) => {
                reject({"retCode":-2,"status":"not updated yet"});
            });
        }

        public getDeviceState(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDS.cached )
            {
                return new Promise ((resolve, reject) => {
                    var stateCode = this.atCmdDS.deviceState;
                    resolve({'stateCode' : stateCode, 'state' : this.atCmdDS.deviceStateStrs[stateCode]});
                });
            }

            var cmd = this.atCmdDS.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    var stateCode = this.atCmdDS.deviceState;
                    resolve({'stateCode' : stateCode, 'state' : this.atCmdDS.deviceStateStrs[stateCode]});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getVolume(pdlIdx : number, cache : boolean = true) : Promise<any>
        {
            if( pdlIdx == 0 )
            {
                if( cache &&  this.atCmdVLQ.vol1Cached )
                {
                    return new Promise ((resolve, reject) => {
                        resolve(this.atCmdVLQ.vol1);
                    });
                }    
            }
            else if( pdlIdx == 1 )
            {
                if( cache &&  this.atCmdVLQ.vol2Cached )
                {
                    return new Promise ((resolve, reject) => {
                        resolve(this.atCmdVLQ.vol2);
                    });
                }
            }
            else
            {
                return new Promise ((resolve, reject) => {
                    reject({"retCode":-2,"status":"incorrect pdl idx"});
                });
            }

            var cmd = this.atCmdVLQ.cmd + pdlIdx;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( ret => {
                    console.log("[" + cmd + "] sent ok");
                    if( pdlIdx == 0 )
                    {
                        resolve(this.atCmdVLQ.vol1);
                    }
                    else if( pdlIdx == 1 )
                    {
                        resolve(this.atCmdVLQ.vol2);
                    }
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getEnableDualStream(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.enableDualStreamCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.enableDualStream);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "1";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.enableDualStream);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getAutoReconnect2ndDevice(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.autoReconnect2ndDeviceCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.autoReconnect2ndDevice);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "2";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.autoReconnect2ndDevice);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getForceAvrcpVolMuteSync(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.forceAvrcpVolMuteSyncCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.forceAvrcpVolMuteSync);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "3";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.forceAvrcpVolMuteSync);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getForceAvrcpVolMuteSyncDelay(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.forceAvrcpVolMuteSyncDelayCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.forceAvrcpVolMuteSyncDelay);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "4";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.forceAvrcpVolMuteSyncDelay);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getEnableRoleMismatchReconnectMedia(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.enableRoleMismatchReconnectMediaCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.enableRoleMismatchReconnectMedia);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "5";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.enableRoleMismatchReconnectMedia);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getEnablePktSzMismatchReconnectMedia(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.enablePktSzMismatchReconnectMediaCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.enablePktSzMismatchReconnectMedia);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "6";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.enablePktSzMismatchReconnectMedia);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }


        public getEnableHfp(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.enableHfpCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.enableHfp);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "7";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.enableHfp);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getSbcMaxBitPoolSize(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.sbcMaxBitPoolSzCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.sbcMaxBitPoolSz);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "9";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.sbcMaxBitPoolSz);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getForceA2dpProfile(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.forceA2dpProfileCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.forceA2dpProfile);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "11";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.forceA2dpProfile);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getEnableHfpA2dpSwitchingViaButton(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.enableHfpA2dpSwitchingViaButtonCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.enableHfpA2dpSwitchingViaButton);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "10";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.enableHfpA2dpSwitchingViaButton);
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

    export interface PdlRec 
    {
        idx : number;
        displayName : string;
        addr : string;
        addrType : AddrType;
        isSppProvisioned : boolean;
        isPhoneProvisioned : boolean;
        isMusicProvisioned : boolean;
        isPhoneConnected : ConnectState;
        isMusicConnected : ConnectState;
        provisionProfile : number;
        connectedProfile : number;
        remoteDevName : string;
        avrcpVolume : number;
        avrcpSync : boolean;
    }

    interface PdlRecMap extends Map<PdlRec[]>
    {
    }

    //
    // AT+PDL? AT-CMD Record
    //

    export class AtCmdRec_PDL extends ATCMDHDL.AtCmdRec 
    {
        static gCnt = 0;

        public pdlRecAryMap : PdlRecMap;
        public updateInProgress : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PDL?', "\\+PDL\\:(-?[0-9]+)(?:,(.+),([0-9]+),(0x[0-9a-fA-F]+),(0x[0-9a-fA-F]+),([0-9]+),([0-9]+),(.*))?", cb, events);
            this.pdlRecAryMap = <PdlRecMap>{};
        }

        match(matchAry : any[]) 
        {
            var idx = +matchAry[1];
            var pdlRec : PdlRec;

            //console.log("[AtCmdRec_PDL] match: " + matchAry[0]);

            if( idx == -1 )
            {

                // Last one received
                // - clear the previous map record.
                if( this.pdlRecAryMap[AtCmdRec_PDL.gCnt-1])
                {
                    delete this.pdlRecAryMap[AtCmdRec_PDL.gCnt-1];
                }

                this.params = { "pdl" : this.pdlRecAryMap[AtCmdRec_PDL.gCnt] };
                this.params['seqid'] = this.seqId;
                this.params['uuid'] = this.uuid;
                this.params['cmdRsp'] = "+PDL:";
                this.params['retCode'] = 0;
                this.params['status'] = "success";

                //console.log(this.params);

                // Notify
                super.match(matchAry);
                return;
            }
            else
            {
                var addr = matchAry[2];
                var addrType = <AddrType>+matchAry[3];
                var provisionProfile = parseInt(matchAry[4],16);
                var connectedProfile = parseInt(matchAry[5],16);
                var avrcpVol = +matchAry[6];
                var avrcpSync = matchAry[7] == "0" ?false :true;
                var remoteDevName = matchAry[8];
                var isSppProvisioned : boolean = false;
                var isPhoneProvisioned : boolean = false;
                var isMusicProvisioned : boolean = false;                
                var isPhoneConnected : ConnectState = ConnectState.NONE;
                var isMusicConnected : ConnectState = ConnectState.NONE;

                if( provisionProfile & 0x10 )
                {
                    isSppProvisioned = true;
                }
                else
                {
                    if( provisionProfile & 0x1 )
                    {
                        isPhoneProvisioned = true;
                    }
    
                    if( provisionProfile & 0xc )
                    {
                        isMusicProvisioned = true;
                    }
                }

                // Determine call/phone connect status
                // - only primary phone is supported
                if( (connectedProfile & 0x3) == 0x1 )
                {
                    isPhoneConnected = ConnectState.PRIMARY;
                }
                else if( (connectedProfile & 0x3) != 0x0 )
                {
                    isPhoneConnected = ConnectState.ERROR;
                }

                // Determine a2dp/music connect status
                if( (connectedProfile & 0xc) )
                {
                    isMusicConnected = ConnectState.ERROR;
                }
                else if( connectedProfile & 0x4 )
                {
                    if( connectedProfile & 0x10 )
                    {
                        isMusicConnected = ConnectState.PRIMARY;
                    }
                    else if( connectedProfile & 0x20 )
                    {
                        isMusicConnected = ConnectState.SECONDARY;
                    }
                    else
                    {
                        isMusicConnected = ConnectState.ERROR;
                    }
                }
                
                pdlRec = 
                { 
                    idx : idx,
                    displayName : remoteDevName.length > 0 ?remoteDevName :addr, 
                    addr : addr, 
                    addrType : addrType,
                    isSppProvisioned : isSppProvisioned,
                    isPhoneProvisioned : isPhoneProvisioned,
                    isMusicProvisioned : isMusicProvisioned,
                    isPhoneConnected : isPhoneConnected, 
                    isMusicConnected : isMusicConnected,
                    provisionProfile : provisionProfile, 
                    connectedProfile : connectedProfile,
                    remoteDevName : remoteDevName,
                    avrcpVolume : avrcpVol,
                    avrcpSync : avrcpSync
                };
                
                if( idx == 0 )
                {
                    AtCmdRec_PDL.gCnt++;
                }
            }

            var seqId = AtCmdRec_PDL.gCnt;
            var pdlRecAry = this.pdlRecAryMap[seqId];

            if( !pdlRecAry )
            {
                pdlRecAry = [];
                this.pdlRecAryMap[seqId] = pdlRecAry;
            }
            
            pdlRecAry.push(pdlRec);        
        }
    }

    //
    // AT+DS? AT-CMD Record
    //

    export class AtCmdRec_DS extends ATCMDHDL.AtCmdRec 
    {
        public deviceState : DeviceState;
        public deviceStateStrs : string[];

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+DS?', "\\+DS\\:([0-9]+)", cb, events);
            this.deviceState = DeviceState.INIT;
            this.deviceStateStrs = ["INIT", "PWR_OFF", "TEST", "IDLE", "CONNECTABLE", "DISCOVERABLE", "CONNECTING", "INQUIRING", "CONNECTED", "CONFIG"];
 
            // Enable broadcast
            this.eventId = "QCC_SRC_DEVICE_STATE_CHANGED";
        }

        match(matchAry : any[]) 
        {
            this.deviceState = <DeviceState>+matchAry[1];
            this.params = 
            {
                "cmdRsp" : "+DS:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0, 
                "status" : "success",
                "stateCode" : this.deviceState,
                "state" : this.deviceStateStrs[this.deviceState],
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+CC? AT-CMD Record
    //

    export class AtCmdRec_CC extends ATCMDHDL.AtCmdRec 
    {
        public mask : number;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+CC?', "\\+CC\\:(.+)", cb, events);
            this.mask = 0;
        }

        match(matchAry : any[]) 
        {
            this.mask = +matchAry[1];
            this.params = 
            {
                "cmdRsp" : "+CC:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "mask" : this.mask
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+CR? AT-CMD Record
    //

    export class AtCmdRec_CR extends ATCMDHDL.AtCmdRec 
    {
        public connCount : number;
        public codecCode : number;
        public codecStrs : string[];

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+CR? command.
            // - but will set that anyways
            super(uuid, 'AT+CR?', "\\+CR\\:([0-9]+),([0-9]+)", cb, events);
            this.connCount = 0;
            this.codecCode = -1;
            this.codecStrs = ["UNKNOWN", "SBC", "FASTSTREAM", "APTX", "APTX-LL", "APTX-HD"];

            // Enable broadcast
            this.eventId = "QCC_SRC_STREAM_STATE_CHANGED";
        }

        match(matchAry : any[]) 
        {
            this.connCount = +matchAry[1];
            this.codecCode = +matchAry[2];

            this.params = 
            {
                "cmdRsp" : "+CR:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "connCount" : this.connCount,
                "codecCode" : this.codecCode,
                "codec" : this.codecStrs[this.codecCode]
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+VL? AT-CMD Record
    //

    export class AtCmdRec_VLQ extends ATCMDHDL.AtCmdRec 
    {
        public vol1 : number;
        public vol2 : number;

        public vol1Sync : boolean = false;
        public vol2Sync : boolean = false;

        public vol1Cached : boolean = false;
        public vol2Cached : boolean = false;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+VLQ=', "\\+VLQ\\:([0-9]+),([0-9]+),([0-9]+)", cb, events);
            this.vol1 = 255;
            this.vol1 = 255;

            // Enable broadcast
            this.eventId = "QCC_SRC_VOLUME_CHANGED";
        }

        match(matchAry : any[]) 
        {
            var pdlIdx : number = +matchAry[1];
            var volume : number = 255;
            var sync : boolean = false;

            if( pdlIdx == 0 )
            {
                this.vol1Cached = true;
                this.vol1 = +matchAry[2];
                volume = this.vol1;
                this.vol1Sync = matchAry[3] == '1' ?true :false;
                sync = this.vol1Sync;
            }
            else if( pdlIdx == 1 )
            {
                this.vol2Cached = true;
                this.vol2 = +matchAry[2];
                volume = this.vol2;
                this.vol2Sync = matchAry[3] == '1' ?true :false;
                sync = this.vol2Sync;
            }

            this.params = 
            {
                "cmdRsp" : "+VL:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "pdlIdx" : pdlIdx,
                "volume" : volume,
                "sync" : sync
            }
            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+PDLU PDL Change Notifcation
    //

    export class AtCmdRec_PDLU extends ATCMDHDL.AtCmdRec 
    {
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PDLU?', "\\+PDLU\\:(.+)", cb, events);

            // Enable broadcast
            this.eventId = "QCC_SRC_PDL_CHANGED";
        }

        match(matchAry : any[]) 
        {
            var firstAddr = +matchAry[1];
            this.params = 
            {
                "cmdRsp" : "+PDLU:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "firstAddr" : firstAddr
            }
            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+DCQ AT-CMD Record
    //

    export class AtCmdRec_DCQ extends ATCMDHDL.AtCmdRec 
    {
        public enableDualStream : boolean;
        public autoReconnect2ndDevice : boolean;
        public forceAvrcpVolMuteSync : boolean;
        public forceAvrcpVolMuteSyncDelay : number;
        public enableRoleMismatchReconnectMedia : boolean;
        public enablePktSzMismatchReconnectMedia : boolean;
        public enableHfp : boolean;
        public forceA2dpProfile : boolean;
        public enableHfpA2dpSwitchingViaButton : boolean;
        public sbcMaxBitPoolSz : number;

        public enableDualStreamCached : boolean = false;
        public autoReconnect2ndDeviceCached : boolean = false;
        public forceAvrcpVolMuteSyncCached : boolean = false;
        public forceAvrcpVolMuteSyncDelayCached : boolean = false;
        public enableRoleMismatchReconnectMediaCached : boolean = false;
        public enablePktSzMismatchReconnectMediaCached : boolean = false;
        public enableHfpCached : boolean = false;
        public forceA2dpProfileCached : boolean;
        public enableHfpA2dpSwitchingViaButtonCached : boolean;
        public sbcMaxBitPoolSzCached : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+DCQ=', "\\+DCQ\\:(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            var key = +matchAry[1];
            var val;

            switch( key )
            {
                case 1: // Enable Dual Stream
                {
                    this.enableDualStream = +matchAry[2] == 0 ?false :true;
                    this.enableDualStreamCached = true;
                    val = this.enableDualStream;
                    break;
                }
                case 2: // Auto Reconnect 2nd Device
                {
                    this.autoReconnect2ndDevice = +matchAry[2] == 0 ?false :true;
                    this.autoReconnect2ndDeviceCached = true;
                    val = this.autoReconnect2ndDevice;
                    break;
                }
                case 3: // Force AVRCP Volume and Mute Sync
                {
                    this.forceAvrcpVolMuteSync = +matchAry[2] == 0 ?false :true;
                    this.forceAvrcpVolMuteSyncCached = true;
                    val = this.forceAvrcpVolMuteSync;
                    break;
                }
                case 4: // Force AVRCP Volume and Mute Sync Delay
                {
                    this.forceAvrcpVolMuteSyncDelay = +matchAry[2];
                    this.forceAvrcpVolMuteSyncDelayCached = true;
                    val = this.forceAvrcpVolMuteSyncDelay;
                    break;
                }
                case 5: // Enable Role Mismatch Reconnect Media
                {
                    this.enableRoleMismatchReconnectMedia = +matchAry[2] == 0 ?false :true;
                    this.enableRoleMismatchReconnectMediaCached = true;
                    val = this.enableRoleMismatchReconnectMedia;
                    break;
                }
                case 6: // Enable Packet Size Mismatch Reconnect Media
                {
                    this.enablePktSzMismatchReconnectMedia = +matchAry[2] == 0 ?false :true;
                    this.enablePktSzMismatchReconnectMediaCached = true;
                    val = this.enablePktSzMismatchReconnectMedia;
                    break;
                }
                case 7: // Enable HFP
                {
                    this.enableHfp = +matchAry[2] == 0 ?false :true;
                    this.enableHfpCached = true;
                    val = this.enableHfp;
                    break;
                }
                case 9: // SBC Max Bitpool Size
                {
                    this.sbcMaxBitPoolSz = +matchAry[2];
                    this.sbcMaxBitPoolSzCached = true;
                    val = this.sbcMaxBitPoolSz;
                    break;
                }
                case 10: // Enable HFP A2DP Switching Via Button
                {
                    this.enableHfpA2dpSwitchingViaButton = +matchAry[2] == 0 ?false :true;
                    this.enableHfpA2dpSwitchingViaButtonCached = true;
                    val = this.enableHfpA2dpSwitchingViaButton;
                    break;
                }
                case 11: // Force A2DP Profile
                {
                    this.forceA2dpProfile = +matchAry[2] == 0 ?false :true;
                    this.forceA2dpProfileCached = true;
                    val = this.forceA2dpProfile;
                    break;
                }
                default:
                {
                    // Unknown key - ignore
                    return;
                }
            }

            this.params = 
            {
                "cmdRsp" : "+DCQ:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "key" : val 
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    export interface ScanRec 
    {
        rank : number;
        displayName : string;
        addr : string;
        isProfileComplete : boolean;
        isA2dp : boolean;
        isHfp : boolean;
        isAvrcp : boolean;
        pathLoss : number;
        remoteDevName : string;
    }

    export interface ScanRecs extends Map<ScanRec>
    {

    }

    interface ScanRecsMap extends Map<ScanRecs>
    {
    }

    //
    // AT+SCAN AT-CMD Record
    //

    export class AtCmdRec_SCAN extends ATCMDHDL.AtCmdRec 
    {
        static gCnt = 0;

        public scanRecsMap : ScanRecsMap;
        public updateInProgress : boolean;
        public refreshScan : boolean;
        public enableInterimResultReporting : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+SCAN', "\\+SCAN\\:(-?[0-9]+)(?:,(.+),([0-9]+),([0-9]+),([0-9]+),(.*))?", cb, events);
            this.scanRecsMap = <ScanRecsMap>{};
            this.refreshScan = false;
            this.enableInterimResultReporting = false;
        }

        match(matchAry : any[]) 
        {
            var rank = +matchAry[1];
            var scanRec : ScanRec;

            //console.log("[AtCmdRec_SCAN] match: " + matchAry[0]);

            if( this.refreshScan )
            {
                this.refreshScan = false;
                AtCmdRec_PDL.gCnt++;
            }

            if( rank == -1 )
            {

                // Last one received
                // - clear the previous map record.
                if( this.scanRecsMap[AtCmdRec_SCAN.gCnt-1])
                {
                    delete this.scanRecsMap[AtCmdRec_SCAN.gCnt-1];
                }

                if( this.scanRecsMap[AtCmdRec_SCAN.gCnt] == null )
                {
                    this.params = { "scanRecs" : { "empty" : {"addr":"","remoteDevName":"empty"} } };
                }
                else
                {
                    this.params = { "scanRecs" : this.scanRecsMap[AtCmdRec_SCAN.gCnt] };
                }
                this.params['seqid'] = this.seqId;
                this.params['uuid'] = this.uuid;
                this.params['cmdRsp'] = "+SCAN:";
                this.params['retCode'] = 0;
                this.params['status'] = "success";

                //console.log(this.params);

                // Notify
                super.match(matchAry);
                return;
            }

            var addr = matchAry[2];
            var profiles = +matchAry[3];
            var isProfileComplete = matchAry[4] == "0" ?false :true;
            var pathLoss = +matchAry[5];
            var remoteDevName = matchAry[6];
            var isA2dp : boolean = (profiles & 0x1) > 0 ?true :false;
            var isHfp : boolean = (profiles & 0x2) > 0 ?true :false;
            var isAvrcp : boolean = (profiles & 0x3) > 0 ?true :false;
            
            scanRec = 
            { 
                rank : rank,
                displayName : remoteDevName.length > 0 ?remoteDevName :addr, 
                addr : addr, 
                isProfileComplete : isProfileComplete,
                isA2dp : isA2dp,
                isHfp : isHfp,
                isAvrcp : isAvrcp,
                pathLoss : pathLoss,
                remoteDevName : remoteDevName,
            };
            
            // Send interim scan result
            if( this.enableInterimResultReporting )
            {
                if( this.events != null )
                {
                    setTimeout(() => {
                        this.events.publish("QCC_SRC_NEW_SCAN_RESULT", {"scanRec" : scanRec});
                    }, 0);
                }
            }

            var seqId = AtCmdRec_SCAN.gCnt;
            var scanRecs : ScanRecs = this.scanRecsMap[seqId];

            if( !scanRecs )
            {
                scanRecs = <ScanRecs>{};
                this.scanRecsMap[seqId] = scanRecs;
            }
            
            scanRecs[scanRec.addr] = scanRec;
        }
    }


    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_QCC_SRC
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('QCC_SRC', AtCmdHandler_QCC_SRC.createInstance)

}  // namespace ATCMDHDLQCCSRC

