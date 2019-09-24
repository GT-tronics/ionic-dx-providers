import { Events } from '@ionic/angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';

export namespace ATCMDHDLCOMMON 
{
    // 
    // Base class to capture the common AT commands
    //
    export class AtCmdHandler_COMMON extends ATCMDHDL.AtCmdHandler_TEXTBASE {

        public atCmdVS : AtCmdRec_VS;
        public atCmdEC : AtCmdRec_EC;
        public atCmdNM : AtCmdRec_NM;
        
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
            this.installParserSpeedFilter("\\+[0-9A-Za-z]+[:=]{1}.+");
    
            this.seqId = 0;
            
            // AT+VS?
            // - this is the 1st command to be sent
            this.atCmdVS = new AtCmdRec_VS(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdVS, false);

            // AT+EC?
            // - don't bother to refresh because it will be set right away
            this.atCmdEC = new AtCmdRec_EC(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdEC, false);

            // AT+NM?
            // - don't bother to refresh because it will be set right away
            this.atCmdNM = new AtCmdRec_NM(this.uuid, this.atCmdRspCallbackNoBroadcast.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdNM, false);

            // Set echo off (AT+EC=0)
            // - this is the 2nd command to be sent
            this.setEcho(false).then( obj => {
                this.sendCmdAtInitStage(this.atCmdVS.cmd, this.atCmdVS.seqId++).then( ret => {
                    console.log("[AT+VS?] sent ok");
                    this.sendCmdAtInitStage(this.atCmdNM.cmd, this.atCmdNM.seqId++).then( ret => {
                        // Release all other AT command for processing
                        console.log("[AT+NM?] sent ok");
                        this.setSendReady();
                    }).catch( obj => {
                        console.log("[AT+NM?] sent failed");
                    });
                }).catch( obj => {
                    console.log("[AT+VS?] sent failed");
                });
            }).catch( obj => {
            });
        }

        //
        // Set echo on/off
        //
        setEcho( on : boolean ) : Promise<any>
        {
            var cmd = "AT+EC=" + (on ?1 :2);
            return new Promise((resolve, reject) => {
                this.sendCmdAtInitStage(cmd, this.seqId++).then( params => {
                    console.log("[" + cmd + "] sent ok");
                    this.atCmdEC.echo = on;
                    resolve({"retCode":0,"status":"success"});
                }).catch( params => {
                    console.log("[" + cmd + "] sent failed");
                    reject({"retCode":-1,"status":"timeout expired"});
                });
            });  
        }

        //
        // Get device info
        //
        getDeviceInfo() : any
        {
            if( this.atCmdNM.cached )
            {
                return this.atCmdNM.params;
            }
            return null;
        }

        //
        // Get version info
        //
        getVersionInfo() : any
        {
            if( this.atCmdVS.cached )
            {
                return this.atCmdVS.params;
            }
            return null;
        }
    }
        

    interface Map<T> {
        [s : number] : T;
    }
            
    // AT+VS?
    export class AtCmdRec_VS extends ATCMDHDL.AtCmdRec 
    {
        public swVer : string;
        public hwVer : string;
        public sysVer : string;
        public capability : string;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+VS?', "(?:AT)?\\+VS\\:([0-9\\.]+),([0-9\\.]+)(?:,(.+),(.+),.+)?", cb, events);
            this.swVer = '';
            this.hwVer = '';
            this.sysVer = '';
            this.capability = '';
        }

        match(matchAry : any[]) 
        {
            this.hwVer = matchAry[1];
            this.swVer = matchAry[2];
            this.sysVer = matchAry[3] ?matchAry[3] :"";
            this.capability = matchAry[4] ?matchAry[4] :"";

            console.log("[AtCmdRec_VS] SW Version[" + this.swVer + "] HW Version[" + this.hwVer + "]");

            // Set the parameter object for the callback
            this.params = { 
                "cmdRsp" : "+VS:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "swVer" : this.swVer, 
                "hwVer" : this.hwVer,
                'sysVer' : this.sysVer,
                'capability' : this.capability,
            };

            // Always the last
            super.match(matchAry);
        }
    }

    // AT+EC?
    export class AtCmdRec_EC extends ATCMDHDL.AtCmdRec 
    {
        public echo : boolean;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            super(uuid, 'AT+EC?', "(?:AT)?\\+EC\\:(.+)", cb, events);
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

    // AT+NM?
    export class AtCmdRec_NM extends ATCMDHDL.AtCmdRec 
    {
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

} // namespace ATCMDHDLCOMMON
