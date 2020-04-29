import { ATCMDHDLCOMMON } from './atcmd-dispatcher/atcmd-handler-common';

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

// BT Device Info Class
// - this is the main class to hold everything about the device
// - in addition to the member variable, generalInfo contains common data such as version, firmware status, etc
// - customInfo contain app specifc data
// - e.g. purifier's wifi info status is stored within
// - e.g. purifier's aqi is stored within
export class BtDeviceInfo {
    public uuid : string;
    public name : string;
    public customName : string;
    public btClassicName : string;
    public displayName : string;
    public rssi : number;
    public mfg : string;
    public pinCode : number;
    public isPinSetup : boolean;
    public regId : number;
    public isRegIdRevoked : boolean;
    public isRegIdSupported : boolean;
    public active : boolean;
    public orderIdx : number;
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
    public scratchPad : any;
    public noTermination : boolean;

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
        this.isPinSetup = false;
        this.regId = 0xFFFFFFFF;
        this.isRegIdRevoked = false;
        this.isRegIdSupported = false;
        this.orderIdx = -1;
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
        this.noTermination = false;
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
        console.log("[BT-DEVICE] update data channel general info");
        if( this.generalInfo.dataCh.deviceId == "Unknown" )
        {
            var info = this.getChannelRemoteDeviceGeneralInfo(this.dataChHandler);
            if( !info )
            {
                if( this.isConnected() )
                {
                    setTimeout( () => {
                        this.updateDataChannelRemoteDeviceGeneralInfo();
                    }, 5000);
                }
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
        console.log("[BT-DEVICE] update cmd channel general info");
        if( this.generalInfo.cmdCh.deviceId == "Unknown" )
        {
            var info = this.getChannelRemoteDeviceGeneralInfo(this.cmdChHandler);
            if( !info )
            {
                if( this.isConnected() )
                {
                    setTimeout( () => {
                        this.updateCommandChannelRemoteDeviceGeneralInfo();
                    }, 5000);
                }
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

    public serialize(json : {} = {}) : string
    {
        json['uuid'] = this.uuid;
        json['name'] = !this.name ?"" :this.name;
        json['customName'] = !this.customName ?"" :this.customName;
        json['btClassicName'] = !this.btClassicName ?"" :this.btClassicName;
        json['displayName'] = !this.displayName ?"" :this.displayName;
        json['rssi'] = this.rssi;
        json['pinCode'] = this.pinCode;
        json['isPinSetup'] = this.isPinSetup;
        json['regId'] = this.regId;
        json['isRegIdRevoked'] = this.isRegIdRevoked;
        json['isRegIdSupported'] = this.isRegIdSupported;
        json['orderIdx'] = this.orderIdx;
        json['generalInfo'] = !this.generalInfo ?{} :this.generalInfo;
        json['customInfo'] = !this.customInfo ?{} :this.customInfo;

        return JSON.stringify(json);
    }

    public deserialize( jsonStr : string)
    {
        var json = JSON.parse(jsonStr);

        this.uuid = json.uuid;
        this.name = json.name;
        this.customName = json.customName == "" ?null :json.customName;
        this.btClassicName = json.btClassicName == "" ?null :json.btClassicName;
        this.displayName = json.displayName == "" ?null :json.displayName;
        this.rssi = json.rssi;
        this.pinCode = json.pinCode;
        this.isPinSetup = json.isPinSetup;
        this.regId = json.regId;
        this.isRegIdRevoked = json.isRegIdRevoked;
        this.isRegIdSupported = json.isRegIdSupported;
        this.orderIdx = json.orderIdx;
        this.generalInfo = json.generalInfo;
        this.customInfo = json.customInfo;
    }
  
}
