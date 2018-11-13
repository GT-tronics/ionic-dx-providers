import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { overrideFunction } from '@ionic-native/core';

export namespace ATCMDHDLNULL 
{
    export class AtCmdHandler_NULL extends ATCMDHDL.AtCmdHandler_TEXTBASE {

        public atCmdNM : AtCmdRec_NM;

        private dxDiscovering : boolean;
        private discoveringTimeout : any;
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
            this.dxDiscovering = true;
            this.upgradeCb = upgradeCb;

            // AT+VS?
            // - this is the 1st command to be sent
            this.atCmdNM = new AtCmdRec_NM(this.uuid, this.atCmdRspCallback_NM.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdNM, true);

            // If for some reason there is no response,
            // - it will be permanently null device
            // - null device will straightly notify client and pass the raw data
            this.discoveringTimeout = setTimeout(() => {
                console.log('[' + this.name + '] DX discovering failed, keep this null handler');
                // Discovering failed
                // - keep it as null
                this.dxDiscovering = false;
                this.discoveringTimeout = null;
            }, 10000);
        }

        atCmdRspCallback_NM()
        {
            console.log('[' + this.name + '] upgrading handler ...');
            if( this.upgradeCb(this.uuid, this.atCmdNM.className) )
            {
                clearTimeout(this.discoveringTimeout);
                this.discoveringTimeout = null;
                this.dxDiscovering = false;
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

