import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';

export namespace ATCMDHDLDXS 
{
    export class AtCmdHandler_DXS extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_DXS(uuid, name, sendCb, events);
        }
    
        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);
        }
    
        //
        // Special Callback Override
        //
    }

    //
    // AT+PDL? AT-CMD Record
    //



    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_QCC_SRC
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('DXS', AtCmdHandler_DXS.createInstance)

}  // namespace ATCMDHDLQCCSRC

