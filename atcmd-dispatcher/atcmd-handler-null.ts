import { Events } from '@ionic/angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { DataExchangerService } from '../../providers/data-exchanger/data-exchanger.service';

export namespace ATCMDHDLNULL 
{
    export class AtCmdHandler_NULL extends ATCMDHDL.AtCmdHandler_TEXTBASE {

        public atCmdNM : AtCmdRec_NM;
        public atCmdKY : AtCmdRec_KY;

        private upgradeCb : (uuid:string, className:string) => boolean;
        private terminateConnectionCb : (uuid:string, info:any) => void;
        private dx : DataExchangerService;

        constructor(
            uuid : string, 
            pinCode : number,
            name : string,
            skipAuth : boolean,
            events : Events,
            dx : DataExchangerService,
            sendCb : (uuid:string, data:string) => Promise<any>, 
            upgradeCb : (uuid:string, className:string) => boolean,
            terminateConnectionCb : (uuid:string, info:any) => void,
        ) 
        {
            super(uuid, name, sendCb, events);
            this.upgradeCb = upgradeCb;
            this.terminateConnectionCb = terminateConnectionCb;
            this.dx = dx;

            // AT+NM?
            // - this is the 1st command to be sent
            // - don't refresh by default
            this.atCmdNM = new AtCmdRec_NM(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdNM, false);

            // AT+KY
            // - this is the 2nd command to be sent
            // - don't refresh by default
            this.atCmdKY = new AtCmdRec_KY(this.uuid, this.atCmdRspCallback_KY.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdKY, false);

            // Send the NM command here
            // - try to send the 2nd time after not receiving OK for 5s (determined in ATCMDHDL.sendCmdInternal)
            this.sendCmdAtInitStage(this.atCmdNM.cmd, this.atCmdNM.seqId++).then( ret => {
                console.log('[' + this.name + '] sent AT+NM? ok');
                if( !skipAuth )
                {
                    // Start authentication process
                    this.authenicate(pinCode);
                }
                else
                {
                    this.readyToLaunchTheNewHandler();
                }
            }).catch( obj => {
                // Reset the send Q 1st
                this.resetSendQ();
                // Send the 2nd time
                console.log('[' + this.name + '] sending AT+NM? the 2nd time ...');
                this.sendCmdAtInitStage(this.atCmdNM.cmd, this.atCmdNM.seqId++).then( ret => {
                    console.log('[' + this.name + '] sent AT+NM? ok');
                    if( !skipAuth )
                    {
                        // Start authentication process
                        this.authenicate(pinCode);
                    }
                    else
                    {
                        this.readyToLaunchTheNewHandler();
                    }
                }).catch( obj => {
                    // Reset the send Q
                    this.resetSendQ();
                    // If for some reason there is no response,
                    // - it will be permanently null device
                    // - null device will straightly notify client and pass the raw data
                    console.log('[' + this.name + '] DX discovering failed, keep this null handler');
                    this.terminateConnectionCb(this.uuid, { "retCode":-2, "status":"discovering failed"});
                });
            });                
        }

        private atCmdRspCallback_KY( params ) 
        {
            if( params.retCode == 0 && this.atCmdKY.resolve )
            {
                //console.log("[" + params.cmdRsp + "] completed success: " + JSON.stringify(params));
                this.atCmdKY.resolve(params);
            }
            else if( params.retCode < 0 && this.atCmdKY.reject )
            {
                //console.log("[" + params.cmdRsp + "] completed failed: " + params.retCode);
                this.atCmdKY.reject(params);
            }
            this.atCmdKY.resolve = null;
            this.atCmdKY.reject = null;
        }
    
        private getEncryptedKey() : Promise<any>
        {
            var cmd = this.atCmdKY.cmd;
            return new Promise((resolve, reject) => {
                this.atCmdKY.resolve = resolve;
                this.atCmdKY.reject = reject;
                this.sendCmdAtInitStage(this.atCmdKY.cmd, this.atCmdKY.seqId++, 2000).then( ret => {
                    console.log("[" + cmd + "] sent ok");
                }).catch( ret => {
                    console.log("[" + cmd + "] sent failed");
                    reject(ret);
                    this.atCmdKY.resolve = null;
                    this.atCmdKY.reject = null;
                });
            });     
        }
    
        private authenicate(pinCode : number)
        {
            if( this.dx["decryptKey"] == null )
            {
                // Library doesn't support security
                // - just continue as normal
                this.readyToLaunchTheNewHandler();
                return;
            }

            // Send AT+KY command
            // - it may be failed because device does not support AT+KY.
            // - if so, just continue as normal (handled in the catch block)
            this.getEncryptedKey().then( ret => {
                // The device does support AT+KY
                // - now decrypt the key using DX service
                // console.log('[' + this.name + '] received encrypted key: ' + this.atCmdKY.seed + ',' + this.atCmdKY.key);
                this.dx["decryptKey"](this.atCmdKY.seed, this.atCmdKY.key, pinCode).then( obj => {
                    // Send the key to unlock the device
                    // console.log('[' + this.name + '] decrypted key: ' + obj.key);
                    // Compare only the 1st 10 bytes 
                    // - AT command parsing max parameters length is 20 characters 
                    var key = obj.key.substring(0,20);
                    this.sendCmdAtInitStage("AT+UL=" + key, 0).then( ret => {
                        // AT+UL is successfully
                        console.log('[' + this.name + '] unlock ok');
                        this.readyToLaunchTheNewHandler();
                    }).catch( obj => {
                        console.log('[' + this.name + '] unlock failed [' + obj.status + ']. Will be disconnected soon');
                        var info = {};
                        if( pinCode == 0xFFFF )
                        {
                            // failure likely is because of no pin
                            info = { "retCode":-4, "status":"pin missing"};
                        }
                        else
                        {
                            // failure likely is because of wrong pin
                            info = { "retCode":-5, "status":"incorrect pin"};
                        }
                        this.terminateConnectionCb(this.uuid, info);
                    });
                }).catch( obj => {
                    console.log('[' + this.name + '] key extraction failed. Will be disconnected soon');
                    this.terminateConnectionCb(this.uuid, { "retCode":-3, "status":"key decrypted failed"});
                }); 
            }).catch( obj => {
                // The device doesn't support AT+KY
                // - just continue as normal
                console.log('[' + this.name + '] sent AT+KY failed: ' + JSON.stringify(obj));
                this.readyToLaunchTheNewHandler();
            });
        }

        private readyToLaunchTheNewHandler()
        {
            console.log('[' + this.name + '] upgrading handler ...');
            if( !this.upgradeCb(this.uuid, this.atCmdNM.className) )
            {
                console.log('[' + this.name + '] upgrading handler not successful [check codding]');
                // FIXME: this should be coding error. Should raise exception here.
            }
        }
    }


    // AT+NM?
    export class AtCmdRec_NM extends ATCMDHDL.AtCmdRec 
    {
        className : string;
        firmCode : string;
        modelNo : string;
        deviceId : string;
        manufacturer : string;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            //super(uuid, 'AT+NM?', "\\+NM\\:(.+),(.+),(.+)", cb);
            super(uuid, 'AT+NM?', "(?:AT)?\\+NM:(.+),(.+),(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            //console.log(JSON.stringify(matchAry));
            this.firmCode = matchAry[1];
            this.modelNo = matchAry[2];
            this.deviceId = matchAry[3];
            this.manufacturer = matchAry[4];

            if( this.firmCode == 'SRC' )
            {
                this.className = "QCC_SRC";
            }
            else if( this.firmCode == 'SNK' )
            {
                this.className = "QCC_SNK";
            }
            else if( this.firmCode == 'TRS' )
            {
                this.className = "BLE";
            }
            else if( this.firmCode == 'WFI' )
            {
                this.className = "WIFI";
            }
            else
            {
                this.className = this.firmCode;
            }

            // Set the parameter object for the callback
            this.params = { 
                "cmdRsp" : "+NM:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "firmCode" : this.firmCode,
                "modelNo" : this.modelNo,
                "deviceId" : this.deviceId,
                "manufacturer" : this.manufacturer
            };

            // Always the last
            super.match(matchAry);
        }
    }

    // AT+KY
    export class AtCmdRec_KY extends ATCMDHDL.AtCmdRec 
    {
        seed : number;
        key : string;
        isPinSet : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+KY', "(?:AT)?\\+KY:(.+),(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            //console.log(JSON.stringify(matchAry));
            this.seed = parseInt(matchAry[1],16);
            this.key = matchAry[2];
            this.isPinSet = (matchAry[3] == '1' ?true :false);
    
            // Set the parameter object for the callback
            this.params = { 
                "cmdRsp" : "+KY:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "seed" : this.seed,
                "key" : this.key,
                "isPinSet" : this.isPinSet
            };

            // Always the last
            super.match(matchAry);
        }
    }

    export class AtCmdHandler_NULL_CMD extends AtCmdHandler_NULL {

        constructor(
            uuid : string,
            pinCode : number,
            events : Events,
            dx : DataExchangerService,
            sendCb : (uuid:string, data:string) => Promise<any>,
            upgradeCb : (uuid:string, className:string) => boolean,
            terminateConnectionCb : (uuid:string, info:any) => void,
        )
        {
            super(uuid, pinCode, 'AtCmdHandler_NULL_CMD', false, events, dx, sendCb, upgradeCb, terminateConnectionCb);
        }
    }

    export class AtCmdHandler_NULL_DATA extends AtCmdHandler_NULL {

        constructor(
            uuid : string,
            pinCode : number,
            events : Events,
            dx : DataExchangerService,
            sendCb : (uuid:string, data:string) => Promise<any>,
            upgradeCb : (uuid:string, className:string) => boolean,
            terminateConnectionCb : (uuid:string, info:any) => void,
        )
        {
            super(uuid, pinCode, 'AtCmdHandler_NULL_DATA', true, events, dx, sendCb, upgradeCb, terminateConnectionCb);
        }
    }

} // namespace ATCMDHDLNULL

