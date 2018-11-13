import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';

export namespace ATCMDHDLWIFI8266 
{
    export class AtCmdHandler_WIFI_8266 extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_WIFI_8266(uuid, name, sendCb, events);
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


        //
        // Support Functions
        //


        //
        // Custom Functions (other than setters/getters)
        //


        //
        // Setters
        //


        //
        // Getters
        //

    }

    interface Map<T> {
        [s : number] : T;
    }




    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_WIFI_8266
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('WFI', AtCmdHandler_WIFI_8266.createInstance)

}  // namespace ATCMDHDLQCCSRC

