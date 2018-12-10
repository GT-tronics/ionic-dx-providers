import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { overrideFunction } from '@ionic-native/core';

export namespace ATCMDHDLNULL 
{
    export class AtCmdHandler_NULL extends ATCMDHDL.AtCmdHandler_TEXTBASE {

        public atCmdNM : AtCmdRec_NM;

        private upgradeCb : (uuid:string, className:string) => void;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>, 
            upgradeCb : (uuid:string, className:string) => void,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);
            this.upgradeCb = upgradeCb;

            // AT+VS?
            // - this is the 1st command to be sent
            // - don't refresh by default
            this.atCmdNM = new AtCmdRec_NM(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdNM, false);

            // Send the NM command here
            // - try to send the 2nd time after not receiving OK for 5s (determined in ATCMDHDL.sendCmdInternal)
            this.sendCmd(this.atCmdNM.cmd, this.atCmdNM.seqId++).then( ret => {
                // Sent is ok. Do nothing just let atCmdRspCallback_NM to handle the rest
                console.log('[' + this.name + '] sent AT+NM? ok');
                this.readyToLaunchTheNewHandler();
            }).catch( obj => {
                // Send the 2nd time
                console.log('[' + this.name + '] sending AT+NM? the 2nd time ...');
                this.sendCmd(this.atCmdNM.cmd, this.atCmdNM.seqId++).then( ret => {
                    // Resent is ok. Do nothing just let atCmdRspCallback_NM to handle the rest
                    console.log('[' + this.name + '] sent AT+NM? ok (2nd time)');
                    this.readyToLaunchTheNewHandler();
                }).catch( obj => {
                    // If for some reason there is no response,
                    // - it will be permanently null device
                    // - null device will straightly notify client and pass the raw data
                    console.log('[' + this.name + '] DX discovering failed, keep this null handler');
                });
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
            super(uuid, 'AT+NM?', "\\+NM:(.+),(.+),(.+),(.+)", cb, events);
        }

        match(matchAry : any[]) 
        {
            console.log(JSON.stringify(matchAry));
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

    export class AtCmdHandler_NULL_CMD extends AtCmdHandler_NULL {

        constructor(
            uuid : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            upgradeCb : (uuid:string, className:string) => void,
            events : Events
        )
        {
            super(uuid, 'AtCmdHandler_NULL_CMD', sendCb, upgradeCb, events);
        }
    }

    export class AtCmdHandler_NULL_DATA extends AtCmdHandler_NULL {

        constructor(
            uuid : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            upgradeCb : (uuid:string, className:string) => void,
            events : Events
        )
        {
            super(uuid, 'AtCmdHandler_NULL_DATA', sendCb, upgradeCb, events);
        }
    }

} // namespace ATCMDHDLNULL

