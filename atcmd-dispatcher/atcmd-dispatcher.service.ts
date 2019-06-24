import { Injectable } from "@angular/core";
import { Platform, Events } from '@ionic/angular';
import { DataExchangerService } from '../../providers/data-exchanger/data-exchanger.service';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';
import { ATCMDHDLNULL } from '../../providers/atcmd-dispatcher/atcmd-handler-null';
import { ATCMDHDLGLOBAL } from '../../atcmd-handler-global';

declare var cordova: any;

export interface GeneralInfo
{
    firmwareStatus : string;
    firmwareStatusCode : number;
    deviceId : string;
    modelNo : string;
    manufacturer : string;
    swVer : string;
    hwVer : string;
    sysVer : string;
    capability : string;
}

export enum DevState
{
    IDLE = 0,
    CONNECTING,
    CONNECTED,
};

export class BtDeviceInfo {
    public uuid : string;
    public name : string;
    public customName : string;
    public btClassicName : string;
    public displayName : string;
    public rssi : number;
    public pinCode : number;
    public active : boolean;
    //public connected : boolean;
    //public connecting : boolean;
    public state : DevState;
    public connectedStartDate : Date;
    public connectedEndDate : Date;
    public connectTimer : any;
    public dxDiscoverTimer : any;
    public promiseResolve : any;
    public promiseReject : any;
    public generalInfo : any;
    public customInfo : any;

    public dataChHandler : ATCMDHDLCOMMON.AtCmdHandler_COMMON = null;
    public cmdChHandler : ATCMDHDLCOMMON.AtCmdHandler_COMMON = null;

    constructor()
    {
        this.uuid = '';
        this.name = '';
        this.btClassicName = '';
        this.displayName = '';
        this.customName = null;
        this.rssi = -127;
        this.active = false;
        this.pinCode = 0xFFFF;
        //this.connecting = false;
        //this.connected = false;
        this.connectTimer = null;
        this.dxDiscoverTimer = null;
        this.connectedStartDate = null;
        this.connectedEndDate = null;
        this.promiseResolve = null;
        this.promiseReject = null;
        this.state = DevState.IDLE;
        this.generalInfo = 
        {
            dataCh: this.setDefaultGeneralInfo(),
            cmdCh: this.setDefaultGeneralInfo(),
        };
        this.customInfo = null;
    }

    clearConnectTimer()
    {
        if( this.connectTimer )
        {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
        }
    }

    setConnectTimer(callback : () => void, timeout : number)
    {
        this.clearConnectTimer();
        this.connectTimer = setTimeout(callback, timeout);
    } 

    isConnected()
    {
        return (this.state == DevState.CONNECTED);
    }

    isIdle()
    {
        return (this.state == DevState.IDLE);
    }

    isConnecting()
    {
        return (this.state == DevState.CONNECTING);
    }

    private getChannelRemoteDeviceGeneralInfo(handler : ATCMDHDLCOMMON.AtCmdHandler_COMMON) : GeneralInfo
    {
        if( !handler )
        {
            return null;            
        }

        var params : GeneralInfo = null;
        var di = handler.getDeviceInfo();
        var vi = handler.getVersionInfo();

        if( di && vi )
        {
            params = 
            {
                deviceId: di.deviceId,
                modelNo: di.modelNo,
                manufacturer: di.manufacturer,
                swVer: vi.swVer,
                hwVer: vi.hwVer,
                sysVer: vi.sysVer,
                capability: vi.capability,
                firmwareStatus: "Up-to-date",
                firmwareStatusCode: 0,
            };
        }

        return params;
    }

    updateDataChannelRemoteDeviceGeneralInfo()
    {
        console.log("[Dispatcher] update data channel general info");
        if( this.generalInfo.dataCh.deviceId == "Unknown" )
        {
            var info = this.getChannelRemoteDeviceGeneralInfo(this.dataChHandler);
            if( !info )
            {
                setTimeout( () => {
                    this.updateDataChannelRemoteDeviceGeneralInfo();
                }, 5000);
                return;
            }

            if( !this.generalInfo )
            {
                this.generalInfo = {};
            }
            if( !this.generalInfo.dataCh )
            {
                this.generalInfo['dataCh'] = {};
            }
            this.generalInfo.dataCh = info;
        }
    }

    updateCommandChannelRemoteDeviceGeneralInfo()
    {
        console.log("[Dispatcher] update cmd channel general info");
        if( this.generalInfo.cmdCh.deviceId == "Unknown" )
        {
            var info = this.getChannelRemoteDeviceGeneralInfo(this.cmdChHandler);
            if( !info )
            {
                setTimeout( () => {
                    this.updateCommandChannelRemoteDeviceGeneralInfo();
                }, 5000);
                return;
            }

            if( !this.generalInfo )
            {
                this.generalInfo = {};
            }
            if( !this.generalInfo.cmdCh )
            {
                this.generalInfo['cmdCh'] = {};
            }
            this.generalInfo.cmdCh = info;
        }
    }

    private setDefaultGeneralInfo() : any 
    {
      var generalInfo : GeneralInfo = 
      {
        firmwareStatus : 'Up-to-date',
        firmwareStatusCode : 0,
        deviceId : "Unknown",
        modelNo : "Unknown",
        manufacturer : "Unknown",
        swVer : "Unknown",
        hwVer : "Unknown",
        sysVer : "Unknown",
        capability : "Unknown",
      };
  
      return generalInfo;
    }
  
}

interface Map<T> {
    [s : string] : T;
}

interface BtDeviceInfoMap extends Map<BtDeviceInfo>{
}

interface AtCmdHandlerMap extends Map<ATCMDHDL.AtCmdHandler> {
}

enum  SysState
{
    sysoff,
    sysreset,
    syson,
}

// ATCMD Dispatcher service
// - scan device and handle scan device list
// - make connection 
// - dispatch (raw and accummulated) data to AtCmd handlers
// 
@Injectable({
    providedIn: 'root'
})
export class AtCmdDispatcherService {

    // member variables
    private btDevLinkedList : BtDeviceInfoMap;
    private btDevUnlinkList : BtDeviceInfoMap;
    private dataChHandlerList : AtCmdHandlerMap;
    private cmdChHandlerList : AtCmdHandlerMap;

    private scanSuccessCb : (obj) => void;
    private scanFailureCb : (obj) => void;
    private sysEvtCb    : (obj) => void;

    private state : SysState = SysState.sysoff;
    private restartScan : boolean = false;

    constructor(
        private platform: Platform,
        public events : Events,
        public dx: DataExchangerService
    ) 
    {
        // The list holds all the AT-CMD handlers
        this.dataChHandlerList = <AtCmdHandlerMap>{};
        this.cmdChHandlerList = <AtCmdHandlerMap>{};

        // Ths list holds all the discovered but unlinked device info
        this.btDevUnlinkList = <BtDeviceInfoMap>{};

        // Ths list holds all the discovered and linked device info
        this.btDevLinkedList = <BtDeviceInfoMap>{};
        
        // Instantiate ATCMD handler sub classes via AtCmdHandlerGlobal
        ATCMDHDLGLOBAL.AtCmdHandler_GLOBAL.registerAllSubClasses();
    }

    //
    // Initialization
    //

    init(sysEvtCb : (obj) => void, useSpp : boolean = true) : Promise<any> 
    {
        return new Promise((resolve, reject) => {
            console.log("[Dispatcher] initiating DX ...");
            this.sysEvtCb = sysEvtCb;
            this.dx.init(this.sysEventCallback.bind(this), useSpp).catch((obj)=> {
              console.log("[Dispatcher] init failed");
              console.log(obj);
            }).then((obj) => {
              if( obj.state == 'init' ) {
                console.log("[Dispatcher] init success");
                // Reset device lists
                this.btDevLinkedList = <BtDeviceInfoMap>{};
                this.btDevUnlinkList = <BtDeviceInfoMap>{};
                resolve(obj);
              }
            }).catch((obj) => {
                reject(obj);
            });
        });
    }

    isInit() 
    {
        return this.dx.inited;
    }

    //
    // Device Managment APIs
    //

    removeLinkedDevice(uuid : string) {
        var devInfo = this.btDevLinkedList[uuid];
        if( devInfo ) {
            //if( devInfo.connected ) 
            if( devInfo.state == DevState.CONNECTED) 
            {
                this.disconnect(uuid);
            }
            delete this.btDevLinkedList[uuid];
            return true;
        }
        return false;
    }

    removeAllUnlinkDevices() 
    {
        let keys = [];
        for( var key in this.btDevUnlinkList )
        {
            var devInfo = this.btDevUnlinkList[key];
            if( devInfo.state == DevState.IDLE )
            {
                keys.push(key);
            }
        }
        for( var key in keys )
        {
            delete this.btDevUnlinkList[key];
        }
    }

    renameDevice(uuid : string, name: string) 
    {
        var devInfo = this.btDevLinkedList[uuid];
        if( !devInfo )
        {
            devInfo = this.btDevUnlinkList[uuid];
        }
        if( devInfo ) {
            devInfo.customName = name;
            return true;
        }
        return false;
    }

    getLinkedDevices() : BtDeviceInfo[] {
        let values = [];
        for( var key in this.btDevLinkedList )
        {
            values.push(this.btDevLinkedList[key]);
        }
        return values;
    }

    getUnlinkDevices() : BtDeviceInfo[] 
    {
        let values = [];
        for( var key in this.btDevUnlinkList )
        {
            values.push(this.btDevUnlinkList[key]);
        }
        return values;
    }

    private internalStartScan()
    {
        // Start BLE scanning
        // - the success and failure functions will be called repeatively.
        // - for any new device found, it will be added in a list (btDevices)
        // - app should refresh the screen with the list.
        this.dx.startScan(
            // success
            this.scanSuccessCallback.bind(this),
            // failure
            ((obj) => {
                console.log("[Dispatcher] scan failed");
                //console.log(obj);
                return this.scanFailureCb({"retCode":-1,"status":obj.ErrMsg});
            }).bind(this)
        );
    }

    //
    // BLE Connection Managmenet APIs
    //

    startScan(success, failure) 
    {
        if (!this.dx.inited ) {
            failure({"retCode":-1,"status":"DX is not initialized"});
            return false;
        }
        
        if( this.dx.isScanning ) {
            failure({"retCode":-2,"status":"DX is already in scanning mode"});
            return false;
        }

        this.scanSuccessCb = success;
        this.scanFailureCb = failure;

        // Clear the unlink list 1st
        this.btDevUnlinkList = <BtDeviceInfoMap>{};

        // We don't need to touch the linked list 
        // - as the list is persistent
        if( this.state != SysState.syson )
        {
            this.restartScan = true;
        }
        else
        {
            this.restartScan = false;
            this.internalStartScan();
        }

        return true;
    }

    stopScan() : Promise<any> 
    {
        this.restartScan = false;
        return this.dx.stopScan();
    }

    connect(uuid: string, timeout:number) : Promise<any>
    {
        return new Promise( (resolve, reject) => {
            if (!this.dx.inited ) {
                // Notify the connect's promise that the connect is not successful
                reject({"retCode":-1,"status":"DX not initialized"});
                return;
            }

            if( this.state != SysState.syson )
            {
                // Notify the connect's promise that the connect is not successful
                reject({"retCode":-7,"status":"BT is off"});
                return;
            }

            var devInfo : BtDeviceInfo = this.btDevUnlinkList[uuid];
    
            if( !devInfo )
            {
                devInfo = this.btDevLinkedList[uuid];
            }
            
            if( !devInfo )
            {
                // uuid is not in either device list
                //  - notify the connect's promise that the connect is not successful
                reject({"retCode":-2,"status":"UUID not in scan list"});
                return;
            }
            
            // if( devInfo.connecting )
            if( devInfo.state == DevState.CONNECTING )
            {
                // already connecting
                //  - notify the connect's promise that the connect is not successful
                console.log("[connect] 2");
                reject({"retCode":-3,"status":"still connecting"});
                return;
            }
    
            devInfo.state = DevState.CONNECTING;
    
            // console.log( devInfo );

            // Clear up previous timer if any
            devInfo.setConnectTimer((() => {
                // Need to issue disconnect to DX
                // - just in case it is in between CONNECTED and CONNECTED_READY
                // - and we have seen that with BLE device (CC2640 SDK 1.45)
                this.dx.disconnect(devInfo.uuid).then( ret => {
                    // Notify the connect's promise that the connect is not successful
                    // reject({"retCode":-4,"status":"connect time out"});    
                }).catch( ret => {
                    // Notify the connect's promise that the connect is not successful
                    // reject({"retCode":-5,"status":"connect time out"});    
                });
                reject({"retCode":-7,"status":"connect time out"});    
                devInfo.state = DevState.IDLE;

            }).bind(this),timeout);
    
            // Stop scanning
            // - FIXME: may not stop scan if supporting multiple device concurrently
            if( this.dx.isScanning ) {
                this.dx.stopScan();
            }
    
            // Remember the promise resolve and reject
            // - use in connectSuccessCallback
            devInfo.promiseResolve = resolve;
            devInfo.promiseReject = reject;

            this.dx.connect(uuid,
                // Success
                this.connectSuccessCallback.bind(this),
                // Failure
                (obj) => {
                    //devInfo.connecting = false;
                    //devInfo.connected = false;
                    devInfo.state = DevState.IDLE;
                    devInfo.clearConnectTimer();
    
                    // Notify the connect's promise that the connect is not successful
                    reject({"retCode":-6,"status":"attempt but not successful"});    
                },
                // Rx Data Callback
                this.connectRxDataCallback.bind(this),
                // Rx Cmd Rsp
                this.connectRxCmdRspCallback.bind(this),
            );             
        });
    }

    disconnect(uuid : string):Promise<any> 
    {
        var devInfo : BtDeviceInfo;
    
        if( this.btDevUnlinkList[uuid] )
        {
            devInfo = this.btDevUnlinkList[uuid];
        }
        else if( this.btDevLinkedList[uuid] )
        {
            devInfo = this.btDevLinkedList[uuid];
        }
        else
        {
            // uuid is not in either device list
            //  - notify the connect's promise that the connect is not successful
            return new Promise((resolve, reject) => {
                reject({"retCode":-1,"status":"UUID not in scan list"});
            });
        }
        
        return new Promise((resolve, reject) => {
            // Flush the queues of ATCMD handler
            var cmdChHdlr = this.getCmdChHandler(uuid);
            var dataChHdlr = this.getDataChHandler(uuid);

            if( dataChHdlr && dataChHdlr instanceof ATCMDHDL.AtCmdHandler_TEXTBASE )
            {
                (<ATCMDHDL.AtCmdHandler_TEXTBASE>dataChHdlr).flushSendQ();
            }
            if( cmdChHdlr && cmdChHdlr instanceof ATCMDHDL.AtCmdHandler_TEXTBASE )
            {
                (<ATCMDHDL.AtCmdHandler_TEXTBASE>cmdChHdlr).flushSendQ();
            }

            this.dx.disconnect(uuid).then( ret => {
                resolve(ret);
            }).catch( ret => {
                //devInfo.connecting = false;
                //devInfo.connected = false;
                devInfo.state = DevState.IDLE;
                devInfo.clearConnectTimer(); 
                reject(ret);       
            });
        });
    }

    recoverStaleDisconnect(uuid : string)
    {
        var devInfo : BtDeviceInfo;
    
        if( this.btDevUnlinkList[uuid] )
        {
            devInfo = this.btDevUnlinkList[uuid];
        }
        else if( this.btDevLinkedList[uuid] )
        {
            devInfo = this.btDevLinkedList[uuid];
        }
        else
        {
            return;
        }

        devInfo.state = DevState.IDLE;
        devInfo.clearConnectTimer(); 
    }

    upgradeFirmware(uuid : string, firmCode : string, firmBin : ArrayBuffer, firmName : string, success : (obj) => void, failure : (obj) => void, progress : (obj) => void)
    {
        this.dx.primeDxFirmware(uuid, firmCode, firmBin, firmName, success, failure, progress);
    }

    //
    // BLE Callbacks
    //

    sysEventCallback(obj) 
    {
        if( obj.state == 'syson' )
        {
            this.state = SysState.syson;

            if( this.restartScan )
            {
                this.restartScan = false;
                this.internalStartScan();
            }
        }
        else if( obj.state == 'sysoff' )
        {
            this.state = SysState.sysoff;
            if( this.dx.isScanning )
            {
                this.restartScan = true;
            }
            this.dx.stopScan();
        }
        else if( obj.state == 'sysreset' )
        {
            this.state = SysState.sysreset;
            if( this.dx.isScanning )
            {
                this.restartScan = true;
            }
            this.dx.stopScan();
        }

        //console.log("[Dispatcher] SysEvt: " + obj.state);
        this.sysEvtCb(obj);
    }
    
    scanSuccessCallback(obj) 
    {
        //console.log("scan success");
        //console.log(obj);
        var devInfo : BtDeviceInfo = null;
    
        if( this.btDevLinkedList[obj.info.UUID] ) 
        {
            // already in linked list
            devInfo = this.btDevLinkedList[obj.info.UUID];
        }
        else if( this.btDevUnlinkList[obj.info.UUID] ) 
        {
            // already in unlink list
            devInfo = this.btDevUnlinkList[obj.info.UUID];
        }
        
        if (obj.state == 'active') 
        {
            // Active
            if( devInfo == null) 
            {
                // not exist anywhere
                // - add it into the unlink list
                var newDevInfo : BtDeviceInfo = new BtDeviceInfo();
                newDevInfo.name = obj.info.NAME;
                newDevInfo.uuid = obj.info.UUID;
                newDevInfo.rssi = obj.info.RSSI;
                newDevInfo.active = true;
    
                this.btDevUnlinkList[obj.info.UUID] = newDevInfo;
                this.scanSuccessCb(obj);
            }
            else if( devInfo.isIdle() )
            {
                devInfo.active = true;
                devInfo.name = obj.info.NAME;
                devInfo.rssi = obj.info.RSSI;
                this.scanSuccessCb(obj);
            }
        }
        else 
        {
            if( devInfo && devInfo.isIdle() )
            {
                devInfo.active = false;
                devInfo.name = obj.info.NAME;
                devInfo.rssi = obj.info.RSSI;
                this.scanSuccessCb(obj);
            }
        }
    }

    private createAndRunNullHandlers(devInfo : BtDeviceInfo)
    {
        // Locate AT-CMD handler for command channel
        // - notify connect
        // - if new, create a null handler 1st
        // - null handler will determine how to create the correct AT-CMD handler eventually
        var cmdChHandler : ATCMDHDL.AtCmdHandler = this.cmdChHandlerList[devInfo.uuid];
        if( !cmdChHandler )
        {
            cmdChHandler = new ATCMDHDLNULL.AtCmdHandler_NULL_CMD(devInfo.uuid, devInfo.pinCode, this.events, this.dx, this.sendDxCmd.bind(this), this.upgradeCmdChHandler.bind(this), this.terminateConnection.bind(this));
            this.cmdChHandlerList[devInfo.uuid] = cmdChHandler
        }
        cmdChHandler.notifyConnected();

        // Locate AT-CMD handler for data channel
        // - notify connect
        // - if new, create a null handler 1st
        // - null handler will determine how to create the correct AT-CMD handler eventually
        // var dataChHandler : ATCMDHDL.AtCmdHandler = this.dataChHandlerList[devInfo.uuid];
        // if( !dataChHandler )
        // {
        //     dataChHandler = new ATCMDHDLNULL.AtCmdHandler_NULL_DATA(devInfo.uuid, devInfo.pinCode, this.events, this.dx, this.sendDxData.bind(this), this.upgradeDataChHandler.bind(this), this.terminateConnection.bind(this));
        //     this.dataChHandlerList[devInfo.uuid] = dataChHandler
        // }

        // dataChHandler.notifyConnected();
    }

    connectSuccessCallback(obj) 
    {
        if( obj.state == 'connected' ) {
            console.log("[Dispatcher] " + obj.info.UUID + " connected");
            console.log(obj);

            var devInfo : BtDeviceInfo;
            var isLinked = true;

            devInfo = this.btDevLinkedList[obj.info.UUID];
            if( !devInfo ) 
            {
                // must be 1st time connected
                isLinked = false;
                devInfo = this.btDevUnlinkList[obj.info.UUID];
                if( !devInfo ) {
                    // FIXME: any special handling??
                    console.log("[Dispatcher] " + obj.info.UUID + " forced disconnected [1]");
                    this.disconnect(obj.info.UUID);
                    return;
                }
            }

            // Check if not connecitng
            // - this has been cancelled
            // - issue disconnect
            // - ignore notification
            //if( !devInfo.connecting )
            if( devInfo.state != DevState.CONNECTING)
            {
                // Connect must be cancelled
                // - should not happen but just in case
                // - disconnect
                //devInfo.connected = false;
                console.log("[Dispatcher] " + obj.info.UUID + " forced disconnected [2] state=" + devInfo.state + (isLinked ?" linked" :"unlink"));
                // console.log( devInfo );
                this.disconnect(devInfo.uuid);
                devInfo.state = DevState.IDLE;
                devInfo.clearConnectTimer();

                // Notify the connect's promise that the connect is not successful
                devInfo.promiseReject({"retCode":-7,"status":"not in connecting state"});
                return;
            }

            //devInfo.connected = true;
            //devInfo.connecting = false;
            devInfo.state = DevState.CONNECTED;
            devInfo.connectedStartDate = new Date;
            devInfo.connectedEndDate = null;

            if( !isLinked )
            {
                // Add to the linked list
                this.btDevLinkedList[obj.info.UUID] = devInfo;
                // Remove from the unlink list
                delete this.btDevUnlinkList[obj.info.UUID];
            }

            // Clear connect timer
            devInfo.clearConnectTimer();

            {
                // Library doesn't support security
                // - just create and run the NULL handlers
                this.createAndRunNullHandlers(devInfo);
            }

            // Notify the connect's promise that the device is now connected
            devInfo.promiseResolve({"retCode":0,"status":"success"});            
        }
        else if( obj.state == 'disconnected' ) {
            console.log("[Dispatcher] " + obj.info.UUID + " disconnected");
            //console.log(obj);

            var devInfo : BtDeviceInfo;

            devInfo = this.btDevLinkedList[obj.info.UUID];
            if( !devInfo ) {
                // Device must be removed

                // Double check if it is in the unlink list
                // - shouldn't happen but just in case
                // - clean up the state
                devInfo = this.btDevUnlinkList[obj.info.UUID];
                // if( devInfo )
                // {
                //     //devInfo.connected = false;
                //     //devInfo.connecting = false;
                //     devInfo.state = DevState.IDLE;
                //     devInfo.clearConnectTimer();
                // }
                if( !devInfo )
                {
                    return;
                }
            }
            
            //var wasConnected = devInfo.connected;
            var wasConnected = devInfo.state == DevState.CONNECTED;

            //devInfo.connected = false;
            //devInfo.connecting = false;
            devInfo.state = DevState.IDLE;
            devInfo.cmdChHandler = null;
            devInfo.dataChHandler = null;
            devInfo.connectedEndDate = new Date; 
            devInfo.clearConnectTimer();

            // Don't generation notification if it was not connected
            if( wasConnected )
            {
                console.log("[Dispatcher] removing AT-CMD handlers for [" + devInfo.uuid + "] ... ");

                var cmdH : ATCMDHDL.AtCmdHandler = this.cmdChHandlerList[devInfo.uuid];
                var dataH : ATCMDHDL.AtCmdHandler = this.dataChHandlerList[devInfo.uuid];
                if( !cmdH )
                {
                    // Something wrong here
                    // - FIXME: special handling??                    
                }
                else 
                {
                    // Notify handler the device is now disconnected
                    cmdH.notifyDisconnected();
                    delete this.cmdChHandlerList[devInfo.uuid];
                }
                if( !dataH )
                {

                    // Something wrong here
                    // - FIXME: special handling??                    
                }
                else 
                {
                    // Notify handler the device is now disconnected
                    dataH.notifyDisconnected();
                    delete this.dataChHandlerList[devInfo.uuid];
                }
            }
            else
            {
                // This is where the android (not iOS) device will land here
                devInfo.promiseReject({"retCode":-5,"status":"attempt but not successful"});    
            }
        }
        else
        {
            console.log("[connectSuccessCallback] 1");
        }
    }

    connectRxDataCallback(obj) 
    {
        var dataChHdl : ATCMDHDL.AtCmdHandler = this.dataChHandlerList[obj.info.UUID];
        if( !dataChHdl )
        {
            // Something wrong 
            // - FIXME: any special handling??
            return;
        }
        
        dataChHdl.appendData(obj.bytes);

        // Broadcast RX data received
        // - FIXME
    }

    connectRxCmdRspCallback(obj) 
    {
        var cmdChHdl : ATCMDHDL.AtCmdHandler = this.cmdChHandlerList[obj.info.UUID];
        if( !cmdChHdl )
        {
            // Something wrong 
            // - FIXME: any special handling??
            return;
        }
        
        cmdChHdl.appendData(obj.bytes);

        // Broadcast RX cmd response received
        // - FIXME        
    }

    //
    // AT-CMD Handler APIs
    //

    getDataChHandler(uuid : string) : ATCMDHDL.AtCmdHandler 
    {
        return this.dataChHandlerList[uuid];
    }

    getCmdChHandler(uuid : string) : ATCMDHDL.AtCmdHandler 
    {
        return this.cmdChHandlerList[uuid];
    }

    //
    // AT-CMD Handler Callbacks
    //

    sendDxData(uuid:string, data:string) : Promise<any> 
    {
        return this.dx.sendDxData(uuid, data);
    }

    sendDxCmd(uuid:string, data:string) : Promise<any> 
    {
        return this.dx.sendDxCmd(uuid, data);
    }

    private upgradeDataChHandler(uuid : string, className : string) : boolean
    {
        var devInfo = this.btDevLinkedList[uuid];
        if( !devInfo )
        {
            // FIXME: anything special handling??
            return false;
        }

        var handler = this.dataChHandlerList[uuid];
        if( !handler )
        {
            // FIXME: anything special handling??
            return false;
        }

        // Dynamically create the specific AT-CMD handler class instance
        // - className is the name of the class  to be created.
        // var newHandler = null;
        // if( className.includes("QCC_SNK") )
        // {
        //     newHandler = Object.create(ATCMDHDLQCCSNK[className].prototype);
        // }
        // else if( className.includes("QCC_SNK") )
        // {
        //     newHandler = Object.create(ATCMDHDLQCCSRC[className].prototype);
        // }
    
        // if( !newHandler )
        // {
        //     // FIXME: anything special handling??
        //     console.log("[Dispatcher]: can't create data handler [" + className + "]");
        //     return false;
        // }
        // newHandler.constructor.apply(newHandler, devInfo.uuid, className, this.sendDxData.bind(this));
        var newHandler = ATCMDHDL.AtCmdHandler.createSubClassInstance(className, devInfo.uuid, className, this.sendDxData.bind(this), this.events);
        newHandler.notifyConnected();
        this.dataChHandlerList[uuid] = newHandler;

        // Bind handler to devInfo
        var devInfo = this.btDevLinkedList[uuid];
        if( !devInfo ) {
            // Device must be removed

            // Double check if it is in the unlink list
            // - shouldn't happen but just in case
            // - clean up the state
            devInfo = this.btDevUnlinkList[uuid];
            // if( devInfo )
            // {
            //     //devInfo.connected = false;
            //     //devInfo.connecting = false;
            //     devInfo.state = DevState.IDLE;
            //     devInfo.clearConnectTimer();
            // }
        }
        if( devInfo )
        {
            devInfo.dataChHandler = <ATCMDHDLCOMMON.AtCmdHandler_COMMON>newHandler;
            setTimeout( () => {
                devInfo.updateDataChannelRemoteDeviceGeneralInfo();
            }, 2000);
        }

        return true;
    }

    private upgradeCmdChHandler(uuid : string, className : string) : boolean
    {
        var devInfo = this.btDevLinkedList[uuid];
        if( !devInfo )
        {
            // FIXME: anything special handling??
            return false;
        }

        var handler = this.cmdChHandlerList[uuid];
        if( !handler )
        {
            // FIXME: anything special handling??
            return false;
        }

        // Dynamically create the specific AT-CMD handler class instance
        // - className is the name of the class  to be created.
        // var newHandler = null;
        // if( className.includes("QCC_SNK") )
        // {
        //     newHandler = Object.create(ATCMDHDLQCCSNK[className].prototype);
        // }
        // else if( className.includes("QCC_SNK") )
        // {
        //     newHandler = Object.create(ATCMDHDLQCCSRC[className].prototype);
        // }
 
        // if( !newHandler )
        // {
        //     // FIXME: anything special handling??
        //     console.log("[Dispatcher]: can't create cmd handler [" + className + "]");
        //     return false;
        // }
        // newHandler.constructor.apply(newHandler, [devInfo.uuid, className, this.sendDxCmd.bind(this)]);
        var newHandler = ATCMDHDL.AtCmdHandler.createSubClassInstance(className, devInfo.uuid, className, this.sendDxCmd.bind(this), this.events);
        newHandler.notifyConnected();
        this.cmdChHandlerList[uuid] = newHandler;

        // Bind handler to devInfo
        var devInfo = this.btDevLinkedList[uuid];
        if( !devInfo ) {
            // Device must be removed

            // Double check if it is in the unlink list
            // - shouldn't happen but just in case
            // - clean up the state
            devInfo = this.btDevUnlinkList[uuid];
            // if( devInfo )
            // {
            //     //devInfo.connected = false;
            //     //devInfo.connecting = false;
            //     devInfo.state = DevState.IDLE;
            //     devInfo.clearConnectTimer();
            // }
        }
        if( devInfo )
        {
            devInfo.cmdChHandler = <ATCMDHDLCOMMON.AtCmdHandler_COMMON>newHandler;
            setTimeout( () => {
                devInfo.updateCommandChannelRemoteDeviceGeneralInfo();
            }, 2000);
        }

        return true;
    }

    private terminateConnection(uuid : string, info : any)
    {
        var devInfo : BtDeviceInfo;

        devInfo = this.btDevLinkedList[uuid];
        if( !devInfo ) {
            // Device must be removed

            // Double check if it is in the unlink list
            // - shouldn't happen but just in case
            // - clean up the state
            devInfo = this.btDevUnlinkList[uuid];
            // if( devInfo )
            // {
            //     //devInfo.connected = false;
            //     //devInfo.connecting = false;
            //     devInfo.state = DevState.IDLE;
            //     devInfo.clearConnectTimer();
            // }
            if( !devInfo )
            {
                return;
            }
        }

        var cmdH : ATCMDHDL.AtCmdHandler = this.cmdChHandlerList[devInfo.uuid];
        var dataH : ATCMDHDL.AtCmdHandler = this.dataChHandlerList[devInfo.uuid];

        if( cmdH )
        {
            cmdH.info = info;
        }

        if( dataH )
        {
            dataH.info = info;
        }

        this.disconnect(uuid).then( obj => {
        }).catch( obj => {
        });
    }

    //
    // Utilties
    //

    bytesToString(buffer) 
    {
        return String.fromCharCode.apply(null, new Uint8Array(buffer));
    }

    stringToBytes(string) 
    {
        var array = new Uint8Array(string.length);
        for (var i=0;i<string.length;i++) {
            array[i] = string.charCodeAt(i);
        }
        return array.buffer;
    }

    base64ToString(b64) 
    {
        return atob(b64.data);
    }
}
