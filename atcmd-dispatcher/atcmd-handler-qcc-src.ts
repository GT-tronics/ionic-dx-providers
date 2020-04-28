import { Events } from '../events';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';
import { of } from 'rxjs';

export namespace ATCMDHDLQCCSRC 
{
    enum AddrType { public_addr, private_addr }; 
    enum ProvisionProfileType { none, hfp, a2dp, both };
    enum ConnectState { NONE = 0x0, PRIMARY = 0x1, SECONDARY = 0x2, ERROR = 0x4 };
    enum DeviceState { INIT, PWR_OFF, TEST, IDLE, CONNECTABLE, DISCOVERABLE, CONNECTING, INQUIRING, CONNECTED, CONFIG }

    export interface PeqCoeffGrp
    {
        stage : number;
        b2 : number;
        b1 : number;
        b0 : number;
        a2 : number;
        a1 : number;
    }

    export interface PeqGainGrp
    {
        left : number;
        right : number;
    }

    export interface PeqParamGrp
    {
        stage : number;
        fc : number;
        q : number;
        gain : number;
        typ : string;
        leftGain? : number;
        rightGain? : number;
    }

    export class AtCmdHandler_QCC_SRC extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string | ArrayBuffer | SharedArrayBuffer) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_QCC_SRC(uuid, name, sendCb, events);
        }

        static peqTypStr : string[] = ['flat', '1-pole-lp', '1-pole-hp', 'lowpass', 'highpass', 'bandpass', 'notch', 'peak', 'lowshelf', 'highshelf'];
        static peqTypIdx = 
        {
            'flat' : 0,
            '1-pole-lp' : 1,
            '1-pole-hp' : 2,
            'lowpass' : 3,
            'highpass' : 4,
            'bandpass' : 5,
            'notch' : 6,
            'peak' : 7,
            'lowshelf' : 8,
            'highhelf' : 9,
        };

        public atCmdPDL : AtCmdRec_PDL;
        public atCmdDS : AtCmdRec_DS;
        public atCmdCC : AtCmdRec_CC;
        public atCmdCR : AtCmdRec_CR;
        public atCmdVLQ : AtCmdRec_VLQ;
        public atCmdPDLU : AtCmdRec_PDLU;
        public atCmdDCQ : AtCmdRec_DCQ;
        public atCmdSCAN : AtCmdRec_SCAN;
        public atCmdPEQC : AtCmdRec_PEQC;
        public atCmdPEQP : AtCmdRec_PEQP;
        public atCmdPEQPQ : AtCmdRec_PEQPQ;
        public atCmdPEQI : AtCmdRec_PEQI;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string | ArrayBuffer | SharedArrayBuffer) => Promise<any>,
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

            // AT+PEQC
            this.atCmdPEQC = new AtCmdRec_PEQC(this.uuid, this.atCmdRspCallback_PEQC.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPEQC, false);

            // AT+PEQP
            this.atCmdPEQP = new AtCmdRec_PEQP(this.uuid, this.atCmdRspCallback_PEQP.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPEQP, false);

            // AT+PEQPPQ
            this.atCmdPEQPQ = new AtCmdRec_PEQPQ(this.uuid, this.atCmdRspCallback_PEQPQ.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPEQPQ, false);

            // AT+PEQI
            this.atCmdPEQI = new AtCmdRec_PEQI(this.uuid, this.atCmdRspCallback.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdPEQI, false);
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

        // Special Callback to handle PEQC unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in this callback.
        // - also event broadcast is suppressed.
        // - command sequence example:
        //   AT+PEQC=<byteSzToFollow> 
        //   OK            <== result received after OK (as unsolicted notification)
        //   ...           <== sending raw bytes here
        //   +PEQC:<fail0Success1>,<bytesWritten>
        //
        private atCmdRspCallback_PEQC( params ) 
        {
            this.atCmdPEQC.writeInProgress = false;
            if( params.retCode == 0 && this.atCmdPEQC.resolve )
            {
                //console.log("[" + params.cmdRsp + "] completed success: " + JSON.stringify(params));
                this.atCmdPEQC.cached = true;
                this.atCmdPEQC.resolve(params);
            }
            else if( params.retCode < 0 && this.atCmdPEQC.reject )
            {
                //console.log("[" + params.cmdRsp + "] completed failed: " + params.retCode);
                this.atCmdPEQC.reject(params);
            }
            this.atCmdPEQC.resolve = null;
            this.atCmdPEQC.reject = null;
        }

        // Special Callback to handle PEQP unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in this callback.
        // - also event broadcast is suppressed.
        // - command sequence example:
        //   AT+PEQP=<byteSzToFollow> 
        //   OK            <== result received after OK (as unsolicted notification)
        //   ...           <== sending raw bytes here
        //   +PEQP:<fail0Success1>,<bytesWritten>
        //
        private atCmdRspCallback_PEQP( params ) 
        {
            this.atCmdPEQP.writeInProgress = false;
            if( params.retCode == 0 && this.atCmdPEQP.resolve )
            {
                //console.log("[" + params.cmdRsp + "] completed success: " + JSON.stringify(params));
                this.atCmdPEQP.cached = true;
                this.atCmdPEQP.resolve(params);
            }
            else if( params.retCode < 0 && this.atCmdPEQP.reject )
            {
                //console.log("[" + params.cmdRsp + "] completed failed: " + params.retCode);
                this.atCmdPEQP.reject(params);
            }
            this.atCmdPEQP.resolve = null;
            this.atCmdPEQP.reject = null;
        }

        // Special Callback to handle PEQPQ unsolicted notification
        // - the key issue is that "OK" is received before the return is available.
        // - therefore, the return must be handled in this callback.
        // - also event broadcast is suppressed.
        // - command sequence example:
        //   AT+PEQPQ=<byteSzToFollow> 
        //   OK            <== result received after OK (as unsolicted notification)
        //   ...           <== sending raw bytes here
        //   +PEQPQ:0,01 02 03 04 05 06 07 08 09 0a 0b 0c
        //   +PEQPQ:1,01 02 03 04 05 06 07 08 09 0a 0b 0c
        //   +PEQPQ:2,01 02 03 04 05 06 07 08 09 0a 0b 0c
        //   +PEQPQ:3,01 02 03 04 05 06 07 08 09 0a 0b 0c
        //   +PEQPQ:4,01 02 03 04 05 06 07 08 09 0a 0b 0c
        //   +PEQPQ:-1
        //
        private atCmdRspCallback_PEQPQ( params ) 
        {
            this.atCmdPEQPQ.updateInProgress = false;
            if( params.retCode == 0 && this.atCmdPEQPQ.resolve )
            {
                //console.log("[" + params.cmdRsp + "] completed success: " + JSON.stringify(params));
                this.atCmdPEQPQ.cached = true;
                
                var peqGainGrp : PeqGainGrp = { left: 0.0, right: 0.0 };

                if( params.peqParamGrps !== null )
                {
                    peqGainGrp.left = params.peqParamGrps[0].leftGain;
                    peqGainGrp.right = params.peqParamGrps[0].rightGain;
                }

                params['peqGainGrp'] = peqGainGrp;
                this.atCmdPEQPQ.resolve(params);
            }
            else if( params.retCode < 0 && this.atCmdPEQPQ.reject )
            {
                //console.log("[" + params.cmdRsp + "] completed failed: " + params.retCode);
                this.atCmdPEQPQ.reject(params);
            }
            this.atCmdPEQPQ.resolve = null;
            this.atCmdPEQPQ.reject = null;
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
                    reject({"retCode":-1,"status":"scanning in progress"});
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

        public setPEQCoeff(gainGrp : PeqGainGrp, coeffGrps : PeqCoeffGrp[], saveSlot : number = 0) : Promise<any>
        {
            return this.sendPEQCoeff(this.convertPeqCoeffsToBytes(gainGrp, coeffGrps), saveSlot);
        }

        public setPEQBypass() : Promise<any>
        {
            var buf = new ArrayBuffer(5 * 8 * 2 + 2);
            var bytes = new Uint8Array(buf);
            var ofs = 2;
            // First word is num of stage (5)
            bytes[0] = 0;
            bytes[1] = 5;

            for( var i = 0; i < 5; i++ )
            {
                bytes[ofs++] = 0x00;    // a1 Low Byte
                bytes[ofs++] = i;       // stage index
                bytes[ofs++] = 0x00;    // b2 High Byte
                bytes[ofs++] = 0x00;    // b2 Mid Byte
                bytes[ofs++] = 0x00;    // b2 Low Byte
                bytes[ofs++] = 0x00;    // b1 High Byte
                bytes[ofs++] = 0x00;    // b1 Mid Byte
                bytes[ofs++] = 0x00;    // b1 Low Byte
                bytes[ofs++] = 0x1F;    // b0 High Byte
                bytes[ofs++] = 0xFF;    // b0 Mid Byte
                bytes[ofs++] = 0xFF;    // b0 Low Byte
                bytes[ofs++] = 0x00;    // a2 High Byte
                bytes[ofs++] = 0x00;    // a2 Mid Byte
                bytes[ofs++] = 0x00;    // a2 Low Byte
                bytes[ofs++] = 0x00;    // a1 High Byte
                bytes[ofs++] = 0x00;    // a1 Mid Byte
            }

            return this.sendPEQCoeff(bytes);
        }

        public setPEQSpecial() : Promise<any>
        {
            var buf = new ArrayBuffer(5 * 8 * 2 + 2);
            var bytes = new Uint8Array(buf);
            var byteOfs = 2;
            // First word is num of stage (5)
            bytes[0] = 0;
            bytes[1] = 5;

            var codes : number[] =
            [
                0x33E7EF,
                0x8CAB31,
                0x42116A,
                0x35F95A,
                0x8CAB31,
                0x2BE882,
                0x9AF23F,
                0x4127C1,
                0x2D1044,
                0x9AF23F,
                0x1FC756,
                0xB6E2D3,
                0x3FFFFF,
                0x1FC756,
                0xB6E2D3,
                0x1D7F9A,
                0xD2A8DE,
                0x7FFFFF,
                0x1D7F9A,
                0xD2A8DE,
                0xE658C4,
                0x465179,
                0x7FFFFF,
                0xE658C4,
                0x465179,
            ];

            var stageIdx = 0;
            var a1LowByteIdx = 0;
            for( var i=0; i < codes.length * 3; i++)
            {
                var byte : number;

                if( (i % 3) == 0 )
                {
                    byte = (codes[i/3] >> 16) & 0xFF;                    
                }
                else if( (i % 3) == 1 )
                {
                    byte = (codes[i/3] >> 8) & 0xFF;                    
                } 
                else
                {
                    byte = codes[i/3] & 0xFF;                    
                }

                if( ((byteOfs-2) % 16) == 0 )
                {
                    a1LowByteIdx = byteOfs++;
                    bytes[byteOfs++] = stageIdx++;
                }

                if( (i % 15) == 14 )
                {
                    bytes[a1LowByteIdx] = byte;
                }
                else
                {
                    bytes[byteOfs++] = byte;
                }
            }
            
            return this.sendPEQCoeff(bytes);
        }

        private sendPEQCoeff( bytes : Uint8Array, saveSlot : number = 0) : Promise<any>
        {
            if( this.atCmdPEQC.writeInProgress || saveSlot < 0 || saveSlot > 5)
            {
                var errStr = (this.atCmdPEQC.writeInProgress ?"writing in progress" :"invalid save slot");
                var cmd = this.atCmdPEQC.cmd;
                return new Promise( (resolve, reject) => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"writing in progress"});
                });
            }

            this.atCmdPEQC.cached = false;
            this.atCmdPEQC.writeInProgress = true;

            var cmd = "AT+PEQC=" + bytes.length + ',' + saveSlot;
            return new Promise((resolve, reject) => {
                this.atCmdPEQC.resolve = resolve;
                this.atCmdPEQC.reject = reject;
                this.sendCmd(cmd,this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.sendCb( this.uuid, bytes.buffer ).catch( (obj) => {
                        console.log("[" + cmd + "] sent bytes failed");
                        reject({"retCode":-5,"status":"sent bytes failed"});
                        this.atCmdPEQC.writeInProgress = false;
                        this.atCmdPEQC.resolve = null;
                        this.atCmdPEQC.reject = null;
                    });
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                    this.atCmdPEQC.writeInProgress = false;
                    this.atCmdPEQC.resolve = null;
                    this.atCmdPEQC.reject = null;
                });
            });                 
        }

        private convertPeqCoeffsToBytes(gainGrp : PeqGainGrp, coeffGrps : PeqCoeffGrp[]) : Uint8Array
        {
            var bufSz = 16 * coeffGrps.length + 2;

            if( gainGrp !== null )
            {
                // left and right gain
                // - 3 bytes for frac
                // - 2 bytes for exp
                bufSz += 10;
            }
            var buf = new ArrayBuffer(bufSz);
            var bytes = new Uint8Array(buf);
            var ofs = 2;
            var frac, expL = 0, expR = 0;

            bytes[0] = (gainGrp === null ?0 :1);
            bytes[1] = coeffGrps.length;

            if( gainGrp !== null )
            {
                var left = Math.pow(10, (gainGrp.left/10.0));

                if( left > 1.0 )
                {
                    while( left > 1.0 )
                    {
                        left /= 2;
                        expL++;
                    }
                }
                else if( left < 1.0 )
                {
                    while( left < 1.0 )
                    {
                        left *= 2;
                        expL--;
                    }
                    left /= 2;
                    expL++;
                    expL = (0x10000 + expL) & 0xFFFF;
                }

                // left gain frac
                frac = this.convertDecimalToFractionBinary(left, 24, 0);
                bytes[ofs++] = (frac >> 16) & 0xFF;
                bytes[ofs++] = (frac >> 8) & 0xFF;
                bytes[ofs++] = (frac >> 0) & 0xFF;

                var right = Math.pow(10, (gainGrp.right/10.0));

                if( right > 1.0 )
                {
                    while( right > 1.0 )
                    {
                        right /= 2;
                        expR++;
                    }
                }
                else if( right < 1.0 )
                {
                    while( right < 1.0 )
                    {
                        right *= 2;
                        expR--;
                    }
                    right /= 2;
                    expR++;
                    expR = (0x10000 + expR) & 0xFFFF;
                }

                // right gain frac
                frac = this.convertDecimalToFractionBinary(right, 24, 0);
                bytes[ofs++] = (frac >> 16) & 0xFF;
                bytes[ofs++] = (frac >> 8) & 0xFF;
                bytes[ofs++] = (frac >> 0) & 0xFF;

                // left gain exp
                bytes[ofs++] = (expL >> 8) & 0xFF;
                bytes[ofs++] = (expL >> 0) & 0xFF;

                // right gain exp
                bytes[ofs++] = (expR >> 8) & 0xFF;
                bytes[ofs++] = (expR >> 0) & 0xFF;
            }

            for( var coeffGrp of coeffGrps)
            {
                bytes.set(this.convertPeqCoeffToBytes(coeffGrp), ofs);
                ofs += 16;
            }
            
            return bytes;
        }

        private convertPeqCoeffToBytes(coeffGrp : PeqCoeffGrp) : Uint8Array
        {
            var buf = new ArrayBuffer(16);
            var bytes = new Uint8Array(buf);
            var frac : number;
            var idx = 2;

            bytes[1] = coeffGrp.stage;

            frac = this.convertDecimalToFractionBinary(coeffGrp.b2, 24, 2);
            bytes[idx++] = (frac >> 16) & 0xFF;
            bytes[idx++] = (frac >> 8) & 0xFF;
            bytes[idx++] = (frac >> 0) & 0xFF;
            
            frac = this.convertDecimalToFractionBinary(coeffGrp.b1, 24, 2);
            bytes[idx++] = (frac >> 16) & 0xFF;
            bytes[idx++] = (frac >> 8) & 0xFF;
            bytes[idx++] = (frac >> 0) & 0xFF;

            frac = this.convertDecimalToFractionBinary(coeffGrp.b0, 24, 2);
            bytes[idx++] = (frac >> 16) & 0xFF;
            bytes[idx++] = (frac >> 8) & 0xFF;
            bytes[idx++] = (frac >> 0) & 0xFF;

            frac = this.convertDecimalToFractionBinary(coeffGrp.a2, 24, 2);
            bytes[idx++] = (frac >> 16) & 0xFF;
            bytes[idx++] = (frac >> 8) & 0xFF;
            bytes[idx++] = (frac >> 0) & 0xFF;

            frac = this.convertDecimalToFractionBinary(coeffGrp.a1, 24, 2);
            bytes[idx++] = (frac >> 16) & 0xFF;
            bytes[idx++] = (frac >> 8) & 0xFF;
            bytes[0] = (frac >> 0) & 0xFF;

            return bytes;
        }

        private convertDecimalToFractionBinary(decimal : number, bitSz : number, scaleDownBitSz : number) : number
        {
            var frac = 0;
            var bitIndex = bitSz + scaleDownBitSz;   
            var isNeg : boolean = false;
            var thres : number = 1 << scaleDownBitSz;
            
            if( decimal < 0.0 )
            {
                decimal = -decimal;
                isNeg = true;
            }

            if( decimal >= (1 << (bitSz - 1)) )
            {
                frac = (1 << (bitSz - 1)) - 1;
            }
            else
            {
                while( --bitIndex > 0 )
                {
                    decimal *= 2.0;
                    if( decimal >= thres )
                    {
                        frac |= (1 << (bitIndex - 1));
                        decimal -= thres;
                    }  
                }
    
                frac >>= scaleDownBitSz;
    
                if( frac >= (1 << (bitSz - scaleDownBitSz - 1)) )
                {
                    frac = (1 << (bitSz - scaleDownBitSz - 1)) - 1;    
                }    
            }

            if( isNeg )
            {
                frac = ((1 << bitSz) - frac) & ((1 << bitSz) - 1);
            }

            return frac;
        }

        public savePEQParams(gainGrp : PeqGainGrp, paramGrps : PeqParamGrp[], saveSlot : number = 1) : Promise<any>
        {
            return this.sendPEQParams(this.convertPeqPramsToBytes(gainGrp, paramGrps), saveSlot);
        }

        private convertPeqPramsToBytes(gainGrp : PeqGainGrp, paramGrps : PeqParamGrp[]) : Uint8Array
        {
            var bufSz = 12 * paramGrps.length;
            var buf = new ArrayBuffer(bufSz);
            var bytes = new Uint8Array(buf);
            var ofs = 0;
            
            for( var peqParamGrp of paramGrps)
            {
                bytes[ofs++] = (peqParamGrp.fc >> 8) & 0xFF;
                bytes[ofs++] = (peqParamGrp.fc >> 0) & 0xFF;
                bytes[ofs++] = (Math.round(peqParamGrp.q * 100) >> 8) & 0xFF;
                bytes[ofs++] = (Math.round(peqParamGrp.q * 100) >> 0) & 0xFF;
                bytes[ofs++] = (Math.round((peqParamGrp.gain + 25) * 100) >> 8) & 0xFF;
                bytes[ofs++] = (Math.round((peqParamGrp.gain + 25) * 100) >> 0) & 0xFF;
                bytes[ofs++] = 0;
                bytes[ofs++] = AtCmdHandler_QCC_SRC.peqTypIdx[peqParamGrp.typ];
                bytes[ofs++] = (Math.round((gainGrp.left + 20) * 100) >> 8) & 0xFF;
                bytes[ofs++] = (Math.round((gainGrp.left + 20) * 100) >> 0) & 0xFF;
                bytes[ofs++] = (Math.round((gainGrp.right + 20) * 100) >> 8) & 0xFF;
                bytes[ofs++] = (Math.round((gainGrp.right + 20) * 100) >> 0) & 0xFF;
            }

            return bytes;
        }

        private sendPEQParams( bytes : Uint8Array, saveSlot : number = 1) : Promise<any>
        {
            if( this.atCmdPEQP.writeInProgress || saveSlot <= 0 || saveSlot > 5 )
            {
                var errStr = (this.atCmdPEQP.writeInProgress ?"writing in progress" :"invalid save slot");
                var cmd = this.atCmdPEQP.cmd + saveSlot;
                return new Promise( (resolve, reject) => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":errStr});
                });
            }

            this.atCmdPEQP.cached = false;
            this.atCmdPEQP.writeInProgress = true;
            
            var cmd = "AT+PEQP=" + bytes.length + ',' + saveSlot;
            return new Promise((resolve, reject) => {
                this.atCmdPEQP.resolve = resolve;
                this.atCmdPEQP.reject = reject;
                this.sendCmd(cmd,this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                    this.sendCb( this.uuid, bytes.buffer ).catch( (obj) => {
                        console.log("[" + cmd + "] sent bytes failed");
                        reject({"retCode":-5,"status":"sent bytes failed"});
                        this.atCmdPEQP.writeInProgress = false;
                        this.atCmdPEQP.resolve = null;
                        this.atCmdPEQP.reject = null;
                    });
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                    this.atCmdPEQP.writeInProgress = false;
                    this.atCmdPEQP.resolve = null;
                    this.atCmdPEQP.reject = null;
                });
            });                 
        }

        public setPEQProfile(currentProfile : number, maxProfile : number, save : boolean = false) : Promise<any>
        {
            return new Promise((resolve, reject) => {
                var cmd = "AT+PEQI=" + (save ?"1," :"0,") + currentProfile + ',' + maxProfile;
                this.sendCmd( cmd, this.seqId++).then( ret => {
                    // console.log("[" + cmd + "] sent ok");
                    if( this.atCmdPEQI.cached )
                    {
                        this.atCmdPEQI.params['currentProfile'] = currentProfile;
                        this.atCmdPEQI.params['maxProfile'] = maxProfile;
                    }
                    resolve({"retCode":0,"status":"success"});
                }).catch( ret => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                })
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
                            'codecStr' : this.atCmdCR.codecStrs[codecCode]
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

        public getPEQ(slotIdx : number = 1) : Promise<any>
        {
            if( this.atCmdPEQPQ.updateInProgress || slotIdx <= 0 || slotIdx > 5 )
            {
                var errStr = (this.atCmdPEQPQ.updateInProgress ?"retrival in progress" :"invalid slot index");
                var cmd = this.atCmdPEQPQ.cmd + slotIdx;
                return new Promise( (resolve, reject) => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":errStr});
                });
            }

            this.atCmdPEQPQ.cached = false;
            this.atCmdPEQPQ.updateInProgress = true;

            var cmd = this.atCmdPEQPQ.cmd + slotIdx;
            return new Promise((resolve, reject) => {
                this.atCmdPEQPQ.resolve = resolve;
                this.atCmdPEQPQ.reject = reject;
                this.sendCmd(cmd,this.seqId++).then( obj => {
                    console.log("[" + cmd + "] sent ok");
                }).catch( obj => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
                    this.atCmdPEQPQ.updateInProgress = false;
                    this.atCmdPEQPQ.resolve = null;
                    this.atCmdPEQPQ.reject = null;
                });
            });     
        }

        public getPEQProfile(cache : boolean = true) : Promise<any>
        {
            if( cache && this.atCmdPEQI.cached )
            {
                return new Promise ((resolve, reject) => {
                    resolve(this.atCmdPEQI.params);
                });
            }
            
            return new Promise((resolve, reject) => {
                var cmd = this.atCmdPEQI.cmd;
                this.atCmdRefresh(cmd).then( ret => {
                    console.log("[" + cmd + "] sent ok");
                    resolve(this.atCmdPEQI.params);
                }).catch( ret => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-4,"status":"timeout expired"});
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
        avrcpSyncVolume : number;
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
            super(uuid, 'AT+PDL?', "(?:AT)?\\+PDL\\:(-?[0-9]+)(?:,(.+),([0-9]+),(0x[0-9a-fA-F]+),(0x[0-9a-fA-F]+),([0-9]+),([0-9]+),(.*))?", cb, events);
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
                var avrcpSyncVol = +matchAry[6];
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
                    avrcpSyncVolume : avrcpSyncVol,
                    avrcpVolume : avrcpSyncVol,
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
            super(uuid, 'AT+DS?', "(?:AT)?\\+DS\\:([0-9]+)", cb, events);
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
            super(uuid, 'AT+CC?', "(?:AT)?\\+CC\\:(.+)", cb, events);
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
            super(uuid, 'AT+CR?', "(?:AT)?\\+CR\\:([0-9]+),([0-9]+)", cb, events);
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
            super(uuid, 'AT+VLQ=', "(?:AT)?\\+VLQ\\:([0-9]+),([0-9]+),([0-9]+)", cb, events);
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
            super(uuid, 'AT+PDLU?', "(?:AT)?\\+PDLU\\:(.+)", cb, events);

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
            super(uuid, 'AT+DCQ=', "(?:AT)?\\+DCQ\\:(.+),(.+)", cb, events);
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
            super(uuid, 'AT+SCAN', "(?:AT)?\\+SCAN\\:(-?[0-9]+)(?:,(.+),([0-9]+),([0-9]+),([0-9]+),(.*))?", cb, events);
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
    // AT+PEQC AT-CMD Record
    //

    export class AtCmdRec_PEQC extends ATCMDHDL.AtCmdRec 
    {
        public writeInProgress : boolean = false;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PEQC=', "(?:AT)?\\+PEQC\\:(-?[0-9]+),([0-9]+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.params['seqid'] = this.seqId;
            this.params['uuid'] = this.uuid;
            this.params['cmdRsp'] = "+PEQC:";
            this.params['retCode'] = (matchAry[1] == "1" ?0 :-2);
            this.params['status'] = (matchAry[1] == "1" ?"success" :"failed");
            this.params['bytesWritten'] = +matchAry[2];

            super.match(matchAry);
        }
    }

    //
    // AT+PEQP AT-CMD Record
    //

    export class AtCmdRec_PEQP extends ATCMDHDL.AtCmdRec 
    {
        public writeInProgress : boolean = false;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PEQP=', "(?:AT)?\\+PEQP\\:(-?[0-9]+),([0-9]+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            this.params['seqid'] = this.seqId;
            this.params['uuid'] = this.uuid;
            this.params['cmdRsp'] = "+PEQP:";
            this.params['retCode'] = (matchAry[1] == "1" ?0 :-2);
            this.params['status'] = (matchAry[1] == "1" ?"success" :"failed");
            this.params['bytesWritten'] = +matchAry[2];

            super.match(matchAry);
        }
    }

    export interface PeqParamGrps
    {
        [index : number] : PeqParamGrp;
    }

    interface PeqParamGrpsMap extends Map<PeqParamGrps>
    {
    }    

    //
    // AT+PEQPQ Notification
    //

    export class AtCmdRec_PEQPQ extends ATCMDHDL.AtCmdRec 
    {
        static gCnt : number = 0;
        public PeqParamGrpsMap : PeqParamGrpsMap;
        public updateInProgress : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PEQPQ=', "(?:AT)?\\+PEQPQ\\:(-?[0-9]+)(?:,(.+))?", cb, events);
            this.PeqParamGrpsMap = <PeqParamGrpsMap>{};
        }

        match(matchAry : any[]) 
        {
            // console.log(matchAry[0]);

            var rank = +matchAry[1];

            if( rank == 0 )
            {
                AtCmdRec_PEQPQ.gCnt++;
                // Last one received
                // - clear the previous map record.
                if( this.PeqParamGrpsMap[AtCmdRec_PEQPQ.gCnt-1] !== undefined )
                {
                    delete this.PeqParamGrpsMap[AtCmdRec_PEQPQ.gCnt-1];
                }
            }
            else if( rank == -1 )
            {
                if( this.PeqParamGrpsMap[AtCmdRec_PEQPQ.gCnt] == null )
                {
                    this.params = { "peqParamGrps" : null };
                }
                else
                {
                    this.params = { "peqParamGrps" : this.PeqParamGrpsMap[AtCmdRec_PEQPQ.gCnt] };
                }
                this.params['seqid'] = this.seqId;
                this.params['uuid'] = this.uuid;
                this.params['cmdRsp'] = "+PEQPQ:";
                this.params['retCode'] = 0;
                this.params['status'] = "success";


                // Notify
                super.match(matchAry);
                return;
            }

            var bytesStr = matchAry[2];            

            var fc = parseInt(bytesStr.slice(0,2) + bytesStr.slice(3,5), 16);
            var q = parseInt(bytesStr.slice(6,8) + bytesStr.slice(9,11), 16) / 100.0;
            var gain = parseInt(bytesStr.slice(12,14) + bytesStr.slice(15,17), 16) / 100.0 - 25;
            var idx = parseInt(bytesStr.slice(18,20) + bytesStr.slice(21,23), 16);
            if( idx < 0 || idx > AtCmdHandler_QCC_SRC.peqTypStr.length )
            {
                idx = 0;
            }
            var typ = AtCmdHandler_QCC_SRC.peqTypStr[idx];
            var leftGain = parseInt(bytesStr.slice(24,26) + bytesStr.slice(27,29), 16) / 100.0 - 20;
            var rightGain = parseInt(bytesStr.slice(30,32) + bytesStr.slice(33,35), 16) / 100.0 - 20;

            var peqParamGrp : PeqParamGrp =
            {
                stage : rank,
                fc : fc,
                q : q,
                gain : gain,
                typ : typ,
                leftGain : leftGain,
                rightGain : rightGain
            };

            var seqId = AtCmdRec_PEQPQ.gCnt;
            var peqParamGrps : PeqParamGrps = this.PeqParamGrpsMap[seqId];

            // console.log("gCnt: ", AtCmdRec_PEQPQ.gCnt);
            // console.log("peqParamGrps: \n", JSON.stringify(peqParamGrps === undefined ?{} :peqParamGrps));

            if( !peqParamGrps )
            {
                peqParamGrps = <PeqParamGrps>[];
                this.PeqParamGrpsMap[seqId] = peqParamGrps;
            }
            
            peqParamGrps[rank] = peqParamGrp;
        }
    }

    //
    // AT+PEQI? AT-CMD Record
    //

    export class AtCmdRec_PEQI extends ATCMDHDL.AtCmdRec 
    {
        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+PEQI?', "(?:AT)?\\+PEQI\\:([0-9]+),([0-9]+),([0-9]+)", cb, events);

            // Enable broadcast
            this.eventId = "QCC_SRC_PEQ_CHANGED";
        }

        match(matchAry : any[]) 
        {
            this.params = 
            {
                "cmdRsp" : "+PEQI:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "currentProfile" : +matchAry[1],
                "savedProfile" : +matchAry[2],
                "maxProfile" : +matchAry[3],
            }
            // Always put this to last
            super.match(matchAry);
        }
    }


    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_QCC_SRC
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('QCC_SRC', AtCmdHandler_QCC_SRC.createInstance)

}  // namespace ATCMDHDLQCCSRC

