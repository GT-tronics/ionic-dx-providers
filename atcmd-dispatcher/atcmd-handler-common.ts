import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { overrideFunction } from '@ionic-native/core';

export namespace ATCMDHDLCOMMON 
{
    // 
    // Base class to capture the common AT commands
    //
    export class AtCmdHandler_COMMON extends ATCMDHDL.AtCmdHandler_TEXTBASE {

        public atCmdVSQ : AtCmdRec_VSQ;
        public atCmdEC : AtCmdRec_EC;
        
        protected seqId : number;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);

            // Install parser speed filter 
            this.installParserSpeedFilter("\\+[A-Z]+\\:.+");
    
            this.seqId = 0;
            
            // AT+VS?
            // - this is the 1st command to be sent
            this.atCmdVSQ = new AtCmdRec_VSQ(this.uuid, this.atCmdRspCallback_VS.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdVSQ, true);

            // AT+EC?
            // - don't bother to refresh because it will be set right away
            this.atCmdEC = new AtCmdRec_EC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdEC, false);

            // Set echo off (AT+EC=0)
            // - this is the 2nd command to be sent
            this.setEcho(false);
        }

        //
        // Release all other AT command for processing
        //
        atCmdRspCallback_VS( params )
        {
            this.setSendReady();
        }

        //
        // Set echo on/off
        //
        setEcho( on : boolean ) : Promise<any>
        {
            var cmd = "AT+EC=" + (on ?1 :0);
            return new Promise((resolve, reject) => {
                this.sendCmd(cmd, this.seqId++).then( params => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdEC.echo = on;
                    resolve({"retCode":0,"status":"success"});
                }).catch( params => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });  
        }
    }
        

    interface Map<T> {
        [s : number] : T;
    }
            
    export class AtCmdRec_VSQ extends ATCMDHDL.AtCmdRec 
    {
        public swVer : string;
        public hwVer : string;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+VS?', "\\+VS\\:(.+),(.+)", cb, events);
            this.swVer = '';
            this.hwVer = '';
        }

        match(matchAry : any[]) 
        {
            this.swVer = matchAry[1];
            this.hwVer = matchAry[2];

            console.log("[AtCmdRec_VSQ] SW Version[" + this.swVer + "] HW Version[" + this.hwVer + "]");

            // Set the parameter object for the callback
            this.params = { 
                "cmdRsp" : "+VS:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "swver" : this.swVer, 
                "hwver" : this.hwVer
            };

            // Always the last
            super.match(matchAry);
        }
    }

    export class AtCmdRec_EC extends ATCMDHDL.AtCmdRec 
    {
        public echo : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+EC?', "\\+EC\\:(.+)", cb, events);
            this.echo = true;
        }

        match(matchAry : any[]) 
        {
            this.echo = +matchAry[1] == 1 ?true :false;

            // Set the parameter object for the callback
            this.params = { 
                "cmdRsp" : "+EC:",
                "uuid" : this.uuid,
                "seqid" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "echo" : this.echo, 
            };

            // Always the last
            super.match(matchAry);
        }
    }

} // namespace ATCMDHDLCOMMON
