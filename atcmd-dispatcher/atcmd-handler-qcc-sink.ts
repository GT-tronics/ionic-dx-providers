import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';
import { Platform } from 'ionic-angular';

export namespace ATCMDHDLQCCSNK {
    
    enum SleepMode { NORMAL = 0, LED_OFF }
    enum VolSync { VOL_SYNC_OFF = 0, VOL_SYNC_ON }
    enum AddrType { PUB_ADDR = 0, PRV_ADDR }
    enum ConnectState { NONE = 0x0, PRIMARY = 0x1, SECONDARY = 0x2, BOTH = 0x3 };
    enum PairingTimeoutTo { CONNECTABLE = 0, IDLE = 1 }
    enum ConnectPolicy { CONNECT_TO_LAST = 0, CONNECT_TO_LIST }
    enum DeviceState { IDLE, CONNECTABLE, DISCOVERABLE, CONNECTED, OCE, ICE, ACTIVE_CALL, TEST, TWC_WAIT, TWC_ON_HOLD, TWC_MULTI_CALL, ACTIVE_CALL_NO_SCO, A2DP_STREAMING, IN_CONFIG_MODE }
    enum PlayState { PAUSE, PLAYING };
    enum TrackDir { PREV = 0, NEXT = 1 };
    enum CodecMask
    {
        APTX    = 0x01,
        APTX_LL = 0x02,
        APTX_HD = 0x04,
        AAC     = 0x08
    };
    enum TimerKey { };

    export class AtCmdHandler_QCC_SNK extends ATCMDHDLCOMMON.AtCmdHandler_COMMON 
    {
        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any> ,
            events : Events
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_QCC_SNK(uuid, name, sendCb, events);
        }

        public atCmdPDL : AtCmdRec_PDL;
        public atCmdRNQ : AtCmdRec_RNQ;
        public atCmdDN : AtCmdRec_DN;
        public atCmdDC : AtCmdRec_DC;
        public atCmdDCQ : AtCmdRec_DCQ;
        public atCmdDS : AtCmdRec_DS;
        public atCmdPP : AtCmdRec_PP;
        public atCmdVL : AtCmdRec_VL;
        public atCmdCC : AtCmdRec_CC;
        public atCmdCR : AtCmdRec_CR;
        public atCmdRSQ : AtCmdRec_RSQ;
        public atCmdEQB : AtCmdRec_EQB;
        public atCmdEQC : AtCmdRec_EQC;
        public atCmdEQPQ : AtCmdRec_EQPQ;
        public atCmdTMQ : AtCmdRec_TMQ;
    
        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);

            // AT+DN?
            this.atCmdDN = new AtCmdRec_DN(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdDN, true);

            // AT+DC?
            this.atCmdDC = new AtCmdRec_DC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdDC, true);

            // AT+DCQ=
            this.atCmdDCQ = new AtCmdRec_DCQ(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdDCQ, false);

            // AT+DS?
            this.atCmdDS = new AtCmdRec_DS(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdDS, true);

            // AT+PP?
            this.atCmdPP = new AtCmdRec_PP(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPP, true);
            
            // AT+VL?
            this.atCmdVL = new AtCmdRec_VL(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdVL, true);
            
            // AT+CC?
            this.atCmdCC = new AtCmdRec_CC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdCC, true);
            
            // AT+CR?
            this.atCmdCR = new AtCmdRec_CR(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdCR, false);
            
            // AT+EQB?
            this.atCmdEQB = new AtCmdRec_EQB(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdEQB, true);
            
            // AT+EQC?
            this.atCmdEQC = new AtCmdRec_EQC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdEQC, true);
            
            // AT+EQPQ=
            this.atCmdEQPQ = new AtCmdRec_EQPQ(this.uuid, this.atCmdRspCallback_EQPQ.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdEQPQ, false);
            
            // AT+TMQ=
            this.atCmdTMQ = new AtCmdRec_TMQ(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdTMQ, false);
            
            // AT+PDL?
            this.atCmdPDL = new AtCmdRec_PDL(this.uuid, this.atCmdRspCallback_PDL.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPDL, false);

            // AT+RNQ=
            this.atCmdRNQ = new AtCmdRec_RNQ(this.uuid, this.atCmdRspCallback_RNQ.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdRNQ, false);

            // AT+RSQ=
            this.atCmdRSQ = new AtCmdRec_RSQ(this.uuid, this.atCmdRspCallback_RSQ.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdRSQ, false);

            this.refreshPdl();
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
        //   +PDL-1
        //
        private atCmdRspCallback_PDL( params ) 
        {
            console.log("[" + params.cmdRsp + "] completed");
            this.atCmdPDL.updateInProgress = false;
            if( params.retCode == 0 && this.atCmdPDL.resolve )
            {
                this.atCmdPDL.cached = true;
                this.atCmdPDL.resolve(params);
                this.atCmdPDL.resolve = null;
            }
            if( params.retCode < 0 && this.atCmdPDL.reject )
            {
                this.atCmdPDL.reject(params);
                this.atCmdPDL.reject = null;
            }
        }

        // Special Callback to handle Remote Name unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in the callback.
        // - also event broadcast is suppressed.
        //
        private atCmdRspCallback_RNQ( params ) 
        {
            console.log("[" + params.cmdRsp + "] completed");
            if( params.retCode == 0 && this.atCmdRNQ.resolve )
            {
                this.atCmdRNQ.resolve(params);
                this.atCmdRNQ.resolve = null;
            }
            if( params.retCode < 0 && this.atCmdRNQ.reject )
            {
                this.atCmdRNQ.reject(params);
                this.atCmdRNQ.reject = null;
            }
        }

        // Special Callback to handle RSSI unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in the callback.
        // - also event broadcast is suppressed.
        //
        private atCmdRspCallback_RSQ( params ) 
        {
            console.log("[" + params.cmdRsp + "] completed");
            if( params.retCode == 0 && this.atCmdRSQ.resolve )
            {
                this.atCmdRSQ.resolve(params);
                this.atCmdRSQ.resolve = null;
            }
            if( params.retCode < 0 && this.atCmdRSQ.reject )
            {
                this.atCmdRSQ.reject(params);
                this.atCmdRSQ.reject = null;
            }
        }

        // Special Callback to handle EQ PEQ Parameters return as unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in the callback.
        // - also event broadcast is suppressed.
        //
        private atCmdRspCallback_EQPQ( params ) 
        {
            console.log("[" + params.cmdRsp + "] completed");
            if( params.retCode == 0 && this.atCmdEQPQ.resolve )
            {
                this.atCmdEQPQ.resolve(params);
                this.atCmdEQPQ.resolve = null;
            }
            if( params.retCode < 0 && this.atCmdEQPQ.reject )
            {
                this.atCmdEQPQ.reject(params);
                this.atCmdEQPQ.reject = null;
            }
        }

        //
        // Support Functions
        //

        protected findPdlRecordByAddress( addr : string ) : PdlRec
        {
            if( !this.atCmdPDL.cached )
            {
                return <PdlRec>null;
            }

            var pdlRecs : PdlRec[] = this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt];

            if( !pdlRecs || pdlRecs.length == 0 )
            {
                return <PdlRec>null;
            }

            for( var idx = 0; idx < pdlRecs.length; idx++ )
            {
                if( pdlRecs[idx].addr == addr )
                {
                    return pdlRecs[idx];
                }
            }

            return <PdlRec>null;
        }

        protected findPdlIndexByAddress( addr : string ) : {idx:number,errStatus:string}
        {
            if( !this.atCmdPDL.cached )
            {
                return {idx:-1, errStatus:"invalid PDL"};
            }

            var pdlRecs : PdlRec[] = this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt];

            if( !pdlRecs )
            {
                return {idx: -4, errStatus:"PDL error"};
            }

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

            if( !pdlRecs )
            {
                return {idx: -4, errStatus:"PDL error"};
            }

            if( pdlRecs.length == 0 )
            {
                return {idx:-2, errStatus:"PDL is empty"};
            }

            for( var idx = 0; idx < pdlRecs.length; idx++ )
            {
                if( (pdlRecs[idx].connectedProfile & mask) > 0 )
                {
                    return {idx:idx, errStatus:"success"};
                }
            }

            return {idx:-3, errStatus:"primary device not exists"};
        }

        //
        // Should only unused by AtCmdRec_RNQ
        public getDeviceRemoteName(pdlIdx : number) : Promise<any>
        {
            // if( cache && this.atCmdPDL.cached )
            // {
            //     return new Promise ((resolve, reject) => {
            //         var pdlRecAry : PdlRec[] = this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt];
            //         if( pdlRecAry.length <= pdlIdx )
            //         {
            //             reject({"retCode":-2,"status":"pdlIdx out of range"});
            //         }
            //         else
            //         {
            //             resolve(pdlRecAry[pdlIdx].remoteDevName);
            //         }
            //     });
            // }

            var cmd = this.atCmdRNQ.cmd + pdlIdx;
            return new Promise((resolve, reject) => {
                this.atCmdRNQ.resolve = resolve;
                this.atCmdRNQ.reject = reject;
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject(obj);
                    this.atCmdRNQ.resolve = null;
                    this.atCmdRNQ.reject = null;
                });
            });        
        }

        //
        // Custom Functions (other than setters/getters)
        //

        public refreshPdl() : Promise<any>
        {
            console.log("[refreshPdl] ...");
            if( this.atCmdPDL.updateInProgress )
            {
                return new Promise( (resolve, reject) => {
                    console.log("refresh PDL in progress");
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

        public refreshPdlRssi() : boolean
        {
            return this.atCmdPDL.enumerateActiveDevicesByAddress(this.refreshRssi.bind(this), (obj) => {
                if( obj.retCode == 0 )
                {
                    console.log("[refreshPdlRssi] " + obj.addr + "," + obj.rssi + "dBm");
                    var pdlRec = this.findPdlRecordByAddress(obj.addr);
                    pdlRec.rssi = obj.rssi;
                }
            }, (obj) => {
                console.log("[refreshPdlRssi] " + JSON.stringify(obj));
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

        public connectDevice( addr : string ) : Promise<any>
        {
            console.log("[connectDevice] ...");
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

        public refreshRssi( addr : string = null ) : Promise<any>
        {
            console.log("[refreshRssi] " + addr + " ...");
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
                return new Promise( (resolve, reject) => {
                    reject({"retCode":ret.idx,"status":ret.errStatus});
                });
            }
            
            var cmd = this.atCmdRSQ.cmd + ret.idx;
            return new Promise((resolve, reject) => {
                this.atCmdRSQ.resolve = resolve;
                this.atCmdRSQ.reject = reject;
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                    this.atCmdRSQ.resolve = null;
                    this.atCmdRSQ.reject = null;
                });
            });       
        }

        //
        // Setters
        //
    
        public setLocalBluetoothName( deviceName : string) : Promise<any>
        {
            var cmd = "AT+DN=" + deviceName;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDN.deviceName = deviceName;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }
    
        public setVolumeSync( volSync : VolSync) : Promise<any>
        {
            var cmd = "AT+DC=" + this.atCmdDC.volSync + "," + (volSync == VolSync.VOL_SYNC_ON ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDC.volSync = volSync;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }
    
        public setSleepMode( sleepMode : SleepMode) : Promise<any>
        {
            var cmd = "AT+DC=" + (sleepMode == SleepMode.LED_OFF ?"1" :"0") + "," + this.atCmdDC.sleepMode;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDC.sleepMode = sleepMode;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setPowerOnPairing( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=13," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.powerOnPairing = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setPowerOnConnect( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=14," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.powerOnPairing = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setRemainOnPairing( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+DCS=9," + (onOff ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.remainOnPairing = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setReconnectLastAttempt( attempt : number ) : Promise<any>
        {
            var cmd = "AT+DCS=25," + attempt;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.reconnectLastAttempt = attempt;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setConnectAttemptRepeat( repeat : number ) : Promise<any>
        {
            var cmd = "AT+DCS=0," + repeat;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.connectAttemptRepeat = repeat;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setPairingTimeoutTo( pairingTimeoutTo : PairingTimeoutTo ) : Promise<any>
        {
            var cmd = "AT+DCS=4," + pairingTimeoutTo;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.pairingTimeoutTo = pairingTimeoutTo;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
       }

       public setConnectPolicy( connectPolicy : ConnectPolicy ) : Promise<any>
        {
            var cmd = "AT+DCS=5," + (connectPolicy == ConnectPolicy.CONNECT_TO_LIST ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdDCQ.connectPolicy = connectPolicy;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setPlayState( playState : PlayState ) : Promise<any>
        {
            var cmd = "AT+PP=" + (playState == PlayState.PLAYING ?"1" :"0");
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdPP.playState = playState;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setVolume( vol : number ) : Promise<any>
        {
            var cmd = "AT+VL=0," + vol;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdVL.vol = vol;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setAudioTrack( trackDir : TrackDir ) : Promise<any>
        {
            var cmd = "AT+TR=" + (trackDir == TrackDir.NEXT ? 1 :0);
            return this.sendCmd(cmd, this.seqId++);
        }

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
        
        public setEqBankIndex( bankIdx : number ) : Promise<any>
        {
            var cmd = "AT+EQB=" + bankIdx;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdEQB.bankIdx = bankIdx;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }
        
        public setEqBass( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+EQC=" + (onOff ?1 :0) + "," + (this.atCmdEQC.enable3D ?1 :0) + "," + (this.atCmdEQC.enableUserEq ? 1 :0);
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdEQC.enableBass = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }
        
        public setEq3D( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+EQC=" + (this.atCmdEQC.enableBass ?1 :0) + "," + (onOff ?1 :0) + "," + (this.atCmdEQC.enableUserEq ? 1 :0);
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdEQC.enable3D = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }
        
        public setEqUserEq( onOff : boolean ) : Promise<any>
        {
            var cmd = "AT+EQC=" + (this.atCmdEQC.enableBass ?1 :0)  + "," + (this.atCmdEQC.enable3D ? 1 :0) + "," + (onOff ?1 :0);
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdEQC.enableUserEq = onOff;
                    resolve({"retCode":0,"status":"success"});
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });       
        }

        public setTimer( timer : TimerKey, val : number ) : Promise<any>
        {
            var cmd = "AT+TM=" + timer + ',' + val;
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdTMQ.key = timer;
                    this.atCmdTMQ.val = val;
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
                return this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt];
            }

            return null;
        }

        public getPdl(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdPDL.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdPDL.pdlRecAryMap[AtCmdRec_PDL.gCnt]);
                });
            }

            return this.refreshPdl();
        }


        public getLocalBluetoothName(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDN.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDN.deviceName);
                });
            }

            var cmd = this.atCmdDN.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDN.deviceName);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });        
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

        public getSleepMode(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDC.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDC.sleepMode);
                });
            }

            var cmd = this.atCmdDC.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDC.sleepMode);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getVolumeSync(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDC.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDC.volSync);
                });
            }

            var cmd = this.atCmdDC.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDC.volSync);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getPowerOnPairing(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdDCQ.powerOnPairingCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.powerOnPairing);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "13";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.powerOnPairing);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getPowerOnConnect(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDCQ.powerOnConnectCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.powerOnConnect);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "14";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.powerOnConnect);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getRemainOnPairing(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDCQ.remainOnPairingCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.remainOnPairing);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "9";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.remainOnPairing);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }
        
        public getReconnectLastAttempt(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDCQ.reconnectLastAttemptCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.reconnectLastAttempt);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "25";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.reconnectLastAttempt);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }
        
        public getConnectAttemptRepeat(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDCQ.connectAttemptRepeatCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.connectAttemptRepeat);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "0";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.connectAttemptRepeat);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }
        
        public getPairingTimeoutTo(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDCQ.pairingTimeoutToCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.pairingTimeoutTo);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "4";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.pairingTimeoutTo);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getConnectPolicy(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdDCQ.connectPolicyCached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdDCQ.connectPolicy);
                });
            }

            var cmd = this.atCmdDCQ.cmd + "5";
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdDCQ.connectPolicy);
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
                    if( this.atCmdCR.addr == null || this.atCmdCR.action == null )
                    {
                        reject({"retCode":-2,"status":"not updated yet"});
                    }
                    else
                    {
                        var codecCode = this.atCmdCR.codecCode;
                        resolve({
                            "retCode" : 0,
                            'addr' : this.atCmdCR.addr,
                            'action' : this.atCmdCR.action,
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

        public getPlayState(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdPP.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdPP.playState);
                });
            }

            var cmd = this.atCmdPP.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdPP.playState);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getVolume(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdVL.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdVL.vol);
                });
            }

            var cmd = this.atCmdVL.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdVL.vol);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
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

        public getEqBankIndex(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdEQB.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdCC.mask);
                });
            }

            var cmd = this.atCmdEQB.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdEQB.bankIdx);
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getEqEnableParameters(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdEQB.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve
                    ({
                        "3D" : this.atCmdEQC.enable3D,
                        "bass" : this.atCmdEQC.enableBass,
                        "userEq" : this.atCmdEQC.enableUserEq
                    });
                });
            }

            var cmd = this.atCmdEQC.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve
                    ({
                        "3D" : this.atCmdEQC.enable3D,
                        "bass" : this.atCmdEQC.enableBass,
                        "userEq" : this.atCmdEQC.enableUserEq
                    });
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getEqPEQParameters(cache : boolean = true) : Promise<any>
        {
            if( cache &&  this.atCmdEQPQ.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve
                    ({
                        "bank" : this.atCmdEQPQ.bankIdx,
                        "byteStr" : this.atCmdEQPQ.byteStr
                    });
                });
            }

            var cmd = this.atCmdEQPQ.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });
        }

        public getTimerValue(timer : TimerKey) : Promise<any>
        {
            var cmd = this.atCmdTMQ.cmd + timer;
            return new Promise((resolve, reject) => {
                this.atCmdRefresh(cmd).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    resolve
                    ({
                        "timer" : this.atCmdTMQ.key,
                        "value" : this.atCmdTMQ.val
                    });
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
        isPhoneProvisioned : boolean;
        isMusicProvisioned : boolean;
        isPhoneConnected : ConnectState;
        isMusicConnected : ConnectState;
        provisionProfile : number;
        connectedProfile : number;
        remoteDevName : string;
        rssi : number;
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
        static gRemoteDevNames = {};

        public pdlRecAryMap : PdlRecMap;
        public updateInProgress : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PDL?', "\\+PDL\\:(-?[0-9]+)(?:,(.+),([0-9]+),(0x[0-9a-fA-F]+),(0x[0-9a-fA-F]+))?", cb, events);
            this.pdlRecAryMap = <PdlRecMap>{};

            // Enable broadcasr event
            this.eventId = 'QCC_SNK_PDL_CHANGED';
        }

        match(matchAry : any[]) 
        {
            var idx = +matchAry[1];
            //console.log("[AtCmdRec_PDL] match: " + matchAry[0]);
            var pdlRec : PdlRec;

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
                var isPhoneProvisioned : boolean = false;
                var isMusicProvisioned : boolean = false;                
                var isPhoneConnected : ConnectState = ConnectState.NONE;
                var isMusicConnected : ConnectState = ConnectState.NONE;

                if( provisionProfile & 0x1 )
                {
                    isPhoneProvisioned = true;
                }

                if( provisionProfile & 0x2 )
                {
                    isMusicProvisioned = true;
                }

                if( (connectedProfile & 0x3) == 0x3 )
                {
                    isPhoneConnected = ConnectState.BOTH;
                }
                else if( connectedProfile & 0x1 )
                {
                    isPhoneConnected = ConnectState.PRIMARY;
                }
                else if( connectedProfile & 0x2 )
                {
                    isPhoneConnected = ConnectState.SECONDARY;
                }

                if( (connectedProfile & 0xc) == 0xc )
                {
                    isMusicConnected = ConnectState.BOTH;
                }
                else if( connectedProfile & 0x4 )
                {
                    isMusicConnected = ConnectState.PRIMARY;
                }
                else if( connectedProfile & 0x8 )
                {
                    isMusicConnected = ConnectState.SECONDARY;
                }
                
                var remoteName = !AtCmdRec_PDL.gRemoteDevNames.hasOwnProperty(addr) ?"Unknown" :AtCmdRec_PDL.gRemoteDevNames[addr];

                pdlRec = 
                { 
                    idx : idx, 
                    displayName : addr,
                    addr : addr, 
                    addrType : addrType,
                    isPhoneProvisioned : isPhoneProvisioned,
                    isMusicProvisioned : isMusicProvisioned,
                    isPhoneConnected : isPhoneConnected, 
                    isMusicConnected : isMusicConnected,
                    provisionProfile : provisionProfile, 
                    connectedProfile : connectedProfile,
                    remoteDevName : remoteName,
                    rssi : -127
                };

                if( idx == 0 )
                {
                    AtCmdRec_PDL.gCnt++;
                }

                if( connectedProfile > 0 )
                {
                    var handler = <AtCmdHandler_QCC_SNK>this.handler;
                    handler.getDeviceRemoteName(idx).then( obj => {
                        AtCmdRec_PDL.gRemoteDevNames[obj.addr] = obj.name;
                    }).catch( obj => {
                        console.log("[AtCmdRec_PDL] not able to get remote name [" +JSON.stringify(obj) + "]");
                    });
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

        enumerateActiveDevicesByAddress( runCb : (addr : string) => Promise<any>, successCb : (obj) => void, failCb : (obj) => void) : boolean
        {
            var pdlRecAry = this.pdlRecAryMap[AtCmdRec_PDL.gCnt];
            if( !pdlRecAry )
            {
                return false;
            }

            for( var i = 0; i < pdlRecAry.length; i++ )
            {
                var pdlRec = pdlRecAry[i];
                if( pdlRec.isMusicConnected || pdlRec.isPhoneConnected )
                {
                    runCb(pdlRec.addr).then((obj) => {
                        successCb(obj);
                    }).catch((obj) => {
                        failCb(obj);
                    });
                }
            }

            return true;
        }

    }

    export class AtCmdRec_RNQ extends ATCMDHDL.AtCmdRec 
    {
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+RNQ=', "\\+RNQ\\:(.+),([0-9]+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            var addr = matchAry[1];
            var name = matchAry[3];

            name.trim();

            this.params = 
            {
                "cmdRsp" : "+RNQ:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "addr" : addr, 
                "name" : name
            }

            // Always put this to last
            super.match(matchAry);
        }
    }
    
    //
    // AT+DN? AT-CMD Record
    //

    export class AtCmdRec_DN extends ATCMDHDL.AtCmdRec 
    {
        public deviceName : string;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+DN?', "\\+DN\\:(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.deviceName = matchAry[1];

            this.params = 
            {
                "cmdRsp" : "+DN:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "name" : this.deviceName 
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+DC? AT-CMD Record
    //

    export class AtCmdRec_DC extends ATCMDHDL.AtCmdRec 
    {
        public sleepMode : SleepMode;
        public volSync : VolSync;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+DC?', "\\+DC\\:(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.sleepMode = <SleepMode>+matchAry[1];
            this.volSync = <VolSync>+matchAry[2];

            this.params = 
            {
                "cmdRsp" : "+DC:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "sleepMode" : this.sleepMode,
                "volSync" : this.volSync 
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
        public powerOnPairing : boolean;
        public powerOnConnect : boolean;
        public remainOnPairing : boolean;
        public reconnectLastAttempt : number;
        public connectAttemptRepeat : number;
        public pairingTimeoutTo : PairingTimeoutTo;
        public connectPolicy : ConnectPolicy;

        public powerOnPairingCached : boolean = false;
        public powerOnConnectCached : boolean = false;
        public remainOnPairingCached : boolean = false;
        public reconnectLastAttemptCached : boolean = false;
        public connectAttemptRepeatCached : boolean = false;
        public pairingTimeoutToCached : boolean = false;
        public connectPolicyCached : boolean = false;

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
                case 13: // Power On Pairing
                {
                    this.powerOnPairing = +matchAry[2] == 0 ?false :true;
                    this.powerOnPairingCached = true;
                    val = this.powerOnPairing;
                    break;
                }
                case 14: // Power On Connect
                {
                    this.powerOnConnect = +matchAry[2] == 0 ?false :true;
                    this.powerOnConnectCached = true;
                    val = this.powerOnConnect;
                    break;
                }
                case 9: // Remain On Pairing
                {
                    this.remainOnPairing = +matchAry[2] == 0 ?false :true;
                    this.remainOnPairingCached = true;
                    val = this.remainOnPairing;
                    break;
                }
                case 25: // Stop Connect Attempt
                {
                    this.reconnectLastAttempt = +matchAry[2];
                    this.reconnectLastAttemptCached = true;
                    val = this.reconnectLastAttempt;
                    break;
                }
                case 0: // Connect Attempt Repeat
                {
                    this.connectAttemptRepeat = +matchAry[2];
                    this.connectAttemptRepeatCached = true;
                    val = this.connectAttemptRepeat;
                    break;
                }
                case 4: // Pairing Timeout To
                {
                    this.pairingTimeoutTo = <PairingTimeoutTo>+matchAry[2];
                    this.pairingTimeoutToCached = true;
                    val = this.pairingTimeoutTo;
                    break;
                }
                case 5: // Connect Policy
                {
                    this.connectPolicy = <ConnectPolicy>+matchAry[2];
                    this.connectPolicyCached = true;
                    val = this.connectPolicy;
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
            super(uuid, 'AT+DS?', "\\+DS\\:([0-9]+),([0-9]+),([0-9]+)", cb, events);
            this.deviceState = DeviceState.IDLE;
            this.deviceStateStrs = ["IDLE", "CONNECTABLE", "DISCOVERABLE", "CONNECTED", "OUTGOING_CALL_ESTABLISH", "INCOMING_CALL_ESTABLISH", "ACTIVE_CALL", "TEST", "TWC_WAIT", "TWC_ON_HOLD", "TWC_MULTI_CALL", "INCOMING_CALL_ON_HOLD", "ACTIVE_CALL_NO_SCO", "A2DP_STREAMING", "IN_CONFIG_MODE"];
 
            // Enable broadcast
            this.eventId = "QCC_SNK_DEVICE_STATE_CHANGED";
        }

        match(matchAry : any[]) 
        {
            this.deviceState = <DeviceState>+matchAry[1];
            var connect : boolean = +matchAry[2] == 1 ?true :false;
            var primary : boolean = +matchAry[3] == 1 ?false :true;
            this.params = 
            {
                "cmdRsp" : "+DS:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0, 
                "status" : "success",
                "stateCode" : this.deviceState,
                "state" : this.deviceStateStrs[this.deviceState],
                "action" : connect ?"connect" :"disconnect", 
                "primary" : primary
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+PP? AT-CMD Record
    //

    export class AtCmdRec_PP extends ATCMDHDL.AtCmdRec 
    {
        public playState : PlayState;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PP?', "\\+PP\\:(.+)", cb, events);
            this.playState = PlayState.PAUSE;
        }

        match(matchAry : any[]) 
        {
            this.playState = <PlayState>+matchAry[1];
            this.params = 
            {
                "cmdRsp" : "+PP:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "playing" : this.playState == PlayState.PLAYING ?true :false
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+VL? AT-CMD Record
    //

    export class AtCmdRec_VL extends ATCMDHDL.AtCmdRec 
    {
        public vol : number;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+VL?', "\\+VL\\:(.+)", cb, events);
            this.vol = 0;

            // Enable broadcast
            this.eventId = "QCC_SNK_VOLUME_CHANGED";
        }

        match(matchAry : any[]) 
        {
            this.vol = +matchAry[1];
            this.params = 
            {
                "cmdRsp" : "+VL:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "volume" : this.vol
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
        public addr : string;
        public action : string;
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
            super(uuid, 'AT+CR?', "\\+CR\\:(.+),([0-9]+),([0-9]+),([0-9]+)", cb, events);
            this.addr = null;
            this.action = null;
            this.codecCode = -1;
            this.codecStrs = ["SBC", "MP3", "AAC", "APTX", "APTX-LL", "FASTSTREAM"];

            // Enable broadcast
            this.eventId = "QCC_SNK_STREAM_STATE_CHANGED";
        }

        match(matchAry : any[]) 
        {
            this.addr = matchAry[1];
            var primary = +matchAry[2] == 1 ?false :true;
            this.action = +matchAry[3] == 1 ?"connect" :"disconnect";
            this.codecCode = +matchAry[4];

            this.params = 
            {
                "cmdRsp" : "+CR:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "addr" : this.addr,
                "primary" : primary,
                "action" : this.action,
                "codecCode" : this.codecCode,
                "codec" : this.codecStrs[this.codecCode]
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+RSQ= AT-CMD Record
    //

    export class AtCmdRec_RSQ extends ATCMDHDL.AtCmdRec 
    {
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+CR? command.
            // - but will set that anyways
            super(uuid, 'AT+RSQ=', "\\+RSQ\\:([0-9]+),(.+),(.+)", cb, events);
 
            // Enable broadcast
            this.eventId = "QCC_SNK_RSSI_CHANGED";
        }

        match(matchAry : any[]) 
        {
            var retCode = +matchAry[1];
            var rssi = +matchAry[2];
            var addr = matchAry[3];

            this.params = 
            {
                "cmdRsp" : "+RSQ:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : retCode > 0 ?-5 :0, 
                "status" : retCode > 0 ?"invalid rssi" :"success",
                "addr" : addr,
                "rssi" : rssi
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+EQB? AT-CMD Record
    //

    export class AtCmdRec_EQB extends ATCMDHDL.AtCmdRec 
    {
        public maxBank : number;
        public bankIdx : number;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+CR? command.
            // - but will set that anyways
            super(uuid, 'AT+EQB?', "\\+EQB\\:(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.maxBank = +matchAry[1];
            this.bankIdx = +matchAry[2];

            this.params = 
            {
                "cmdRsp" : "+EQB:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "max" : this.maxBank,
                "bank" : this.bankIdx
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+EQC? AT-CMD Record
    //

    export class AtCmdRec_EQC extends ATCMDHDL.AtCmdRec 
    {
        public enableBass : boolean;
        public enable3D : boolean;
        public enableUserEq : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+CR? command.
            // - but will set that anyways
            super(uuid, 'AT+EQC?', "\\+EQC\\:(.+),(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.enableBass = +matchAry[1] == 1 ?true :false;
            this.enable3D = +matchAry[2] == 1 ?true :false;
            this.enableUserEq = +matchAry[3] == 1 ?true :false;

            this.params = 
            {
                "cmdRsp" : "+EQC:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "bass" : this.enableBass,
                "3D" : this.enable3D,
                "userEq" : this.enableUserEq
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+EQPQ= AT-CMD Record
    //

    export class AtCmdRec_EQPQ extends ATCMDHDL.AtCmdRec 
    {
        public bankIdx : number;
        public byteStr : string;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+CR? command.
            // - but will set that anyways
            super(uuid, 'AT+EQPQ=', "\\+EQPQ\\:(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.bankIdx = matchAry[1];
            this.byteStr = matchAry[2];

            this.params = 
            {
                "cmdRsp" : "+EQPQ:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "bank" : this.bankIdx,
                "byteStr" : this.byteStr,
            }

            // Always put this to last
            super.match(matchAry);
        }
    }

    //
    // AT+TMQ= AT-CMD Record
    //

    export class AtCmdRec_TMQ extends ATCMDHDL.AtCmdRec 
    {
        public key : number;
        public val : number;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+CR? command.
            // - but will set that anyways
            super(uuid, 'AT+TMQ=', "\\+TMQ\\:(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.key = matchAry[1];
            this.val = matchAry[2];

            this.params = 
            {
                "cmdRsp" : "+TMQ:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "timer" : this.key,
                "value" : this.val
            }

            // Always put this to last
            super.match(matchAry);
        }
    }



    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_QCC_SNK
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('QCC_SNK', AtCmdHandler_QCC_SNK.createInstance)
      

}  // namespace ATCMDHDLQCCSINK

