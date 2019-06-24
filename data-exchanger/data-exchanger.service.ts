import { Injectable } from "@angular/core";
import { Platform, AlertController } from '@ionic/angular';

declare var cordova: any;

//DataExchanger service
@Injectable({
    providedIn: 'root'
})

export class DataExchangerService {
    // data-exchnager status
    STORAGE_DEVICE_ID_KEY = 'deviceId';
    inited: any;
    isResetBle: any;
    params: any;
    deviceUUID: any;
    isConnected: any;
    isScanning: any;
    isBtDisabled: any;
    bufferRxDataCRLF: any;
    rxDataBuffer: any;
    dxDataList: any;
    rxLastDate: any;
    progress: any;
    rxCmdBuffer: any;
    dxCmdList: any;
    receiveCmdForceStopTime: any;
    receiveDataForceStopTime: any;
    readyDelayTimeout : any;

    isSpp : boolean = false;

    errorUnsupported = {};

    b64RvsLkup : Uint8Array;

    constructor(
        private platform: Platform,
        public alertCtrl: AlertController
        //public storage: NativeStorage,
    ) 
    {
        this.errorUnsupported = {
            error: "unsupported",
            message: "Operation unsupported"
        };
        // init data
        this.inited = false;
        this.isResetBle = false;
        // this.params = {};
        this.deviceUUID = null;
        this.isConnected = null;
        this.isScanning = null;
        this.isBtDisabled = null;
        this.bufferRxDataCRLF = null;
        this.rxDataBuffer = null;
        this.rxLastDate = null;
        this.rxCmdBuffer = null;
        this.dxDataList = [];
        this.dxCmdList = [];
        this.progress = null;
        this.readyDelayTimeout = null;

        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        // Use a lookup table to find the reverse base64 index.
        this.b64RvsLkup = new Uint8Array(256);
        for (var i = 0; i < chars.length; i++) 
        {
          this.b64RvsLkup[chars.charCodeAt(i)] = i;
        }
          
    }

    showErrorAlert(title, message) {
        this.alertCtrl.create({
            message: title,
            subHeader: message,
            buttons: ['Ok']
        }).then( prompt => prompt.present());
    }

    init(sysEvtCb : (obj) => void, useSpp : boolean) : Promise<any> {
        return new Promise((resolve,reject)=>{
            this.platform.ready().then(() => {
                // TODO: to remove after upgrading to Dx plugin that takes care of this
                this.rxCmdBuffer = '';
                if(this.inited) {
                    this.isConnected && this.disconnect(this.deviceUUID);
                    this.isConnected = false;
                    this.stopScan();
                    resolve({"state":"init"});
                    return;
                }
                this.isConnected = false;
                this.isScanning = false;
                this.isBtDisabled = true;
                this.inited = true;
                this.deviceUUID = null;
                this.rxDataBuffer = '';
                this.rxCmdBuffer = '';
        
                if (cordova.plugin.dx === undefined) {
                    reject({"retCode":-1,"status":"plugin not loaded"});
                } else {
                    cordova.plugin.dx.init(
                        1,          // number of devices can be connected
                        -127.0,     // proximity power level (disabled)
                        10.0,       // active scan timeout
                        false,      // auto connect (must be false)
                        true,       // enable command channel
                        false,      // enable scrambler
                        true,       // enable TX backpressure
                        [
                            // Insert your BLE Service UUID String
                        ],
                        useSpp,
                        function(obj) {
                            // success
                            // typeof success !== 'undefined' && success(obj);
                            // console.log('[DX] BT init success');
                            if(obj.state == 'init') {
                                console.log('[DX] init success');
                                if( obj.isSpp )
                                {
                                    this.isSpp = obj.isSpp;
                                }
                            } else if(obj.state == 'syson' || obj.state == 'sysoff') {
                                console.log('[DX] Event: ' + obj.state);
                                this.isBtDisabled = obj.state == 'sysoff' ? true : false;
                                //this.onSysEvent(obj.state);
                                if( resolve && obj.state == 'syson' )
                                {
                                    resolve(obj);
                                }
                                typeof sysEvtCb(obj) !== 'undefined' && sysEvtCb(obj);
                            } else if(obj.state == 'sysreset') {
                                console.log('[DX] BT system reset');
                                // TODO: is it really = false?
                                this.isBtDisabled = false;
                                //this.onSysEvent(obj.state);
                                typeof sysEvtCb(obj) !== 'undefined' && sysEvtCb(obj);
                            } else {
                                console.log('[DX] Unknown DX init event!!!');
                            }
                        }.bind(this),
                        function(obj) {
                            if(typeof obj === 'string' && obj == 'already initialized') {
                                console.log('[DX] already initialized');
                                resolve({"state":"init"});
                            } else {
                                console.log('[DX] init error');
                                this.inited = false;
                                reject({"retCode":-2,"status":obj});
                            }
                        }.bind(this)
                    )
                }
            });
        });
    }

    startScan(success, failure) {
        this.platform.ready().then(() => {
            this.isScanning = true;
            cordova.plugin.dx.startScan(
                // success
                function(obj) {
                    // possible bug: obj could be {} (empty but not null)
                    if( obj != null &&
                        obj.info != null &&
                        obj.info.NAME != null &&
                        obj.info.RSSI != null && 
                        obj.state != null ) {
                        console.log ('[DX] BT Scanned: ' + obj.info.NAME + '[' + obj.info.RSSI + ']' + '[' + obj.state + ']' );
                        this.deviceUUID && console.log('[DX] already connected to UUID: ' + this.deviceUUID);
                        typeof success(obj) !== 'undefined' && success(obj);
                    }
                }.bind(this),
                // failure
                function(obj) {
                    // console.log("startScan fail");
                    // console.log(obj);
                    console.log ('[DX] BT scan error');
                    this.isScanning = false;
                    typeof failure(obj) !== 'undefined' && failure(obj);
                }.bind(this)
            );
        });
    }

    // stop scanning for DataExchange devices.
    //
    stopScan() : Promise<any> {
        return new Promise((resolve, reject) => {
            this.platform.ready().then(() => {
                this.isScanning = false;
                cordova.plugin.dx.stopScan(
                    function(obj) 
                    {
                        resolve(obj);
                    },
                    function(obj) 
                    {
                        reject(obj);
                    }
                );
            });
        });
    }

    // connect to DataExchanger device.
    connect(devUUID : string, success, failure, rxData, rxCmdRsp) {
        this.platform.ready().then(() => {
            cordova.plugin.dx.connect(
                devUUID,
                function(obj) {
                    //success
                    // typeof success !== 'undefined' && resolve(obj);
                    if (obj.state == 'connected') {
                        console.log ('[DX] Connected device UUID - ' + obj.info.UUID);
                        this.isConnected = true;
                        this.deviceUUID = obj.info.UUID;
                        this.rxDataBuffer = '';
                        this.rxCmdBuffer = '';
                        this.bufferRxDataCRLF = true;
        
                        // Enable Rx Data Notification
                        cordova.plugin.dx.enableRxDataNotification(
                            devUUID,
                            //success
                            function(obj) {
                                obj['bytes'] = this.base64ToBytes(obj.data.data);
                                //console.log('[DX] RxData (' + data.length + ') and put into buffer: ' + this.rxDataBuffer);
                                typeof rxData(obj) !== 'undefined' && rxData(obj);
                            }.bind(this),
                            //failure
                            function(obj) {
                                console.log("enableRxDataNotification failure");
                                console.log(obj);
                                typeof failure(obj) !== 'undefined' && failure(obj);
                            }
                        );

                        // Enable Rx Cmd Notification
                        cordova.plugin.dx.enableRxCmdNotification(
                            devUUID,
                            // Success
                            function(obj) {
                                obj['bytes'] = this.base64ToBytes(obj.data.data);
                                //console.log('[DX] RxCmd (' + data.length + ') and put into buffer: ' + this.rxCmdBuffer);
                                typeof rxCmdRsp(obj) !== 'undefined' && rxCmdRsp(obj);
                            }.bind(this),
                            function(obj) {
                                //failure
                                // do nothing if failure
                                //reject(obj);
                                typeof failure(obj) !== 'undefined' && failure(obj);
                            }
                        );

                        this.isBtDisabled = false;
                        this.onConnected();
                    } else {
                        console.log ('[DX] Disconnected deviceUUID - ' +obj.info.UUID);
                        this.isBtDisabled = false;
                        this.isConnected = false;
                        this.isResetBle = true;
                        this.deviceUUID = null;
                        this.rxDataBuffer = '';
                        // TODO: to remove after upgrading to Dx plugin this takes care of this
                        this.rxCmdBuffer = '';
                        this.onDisconnected();
                    }

                    // Delay the callback (to declare ready)
                    // - FIXME: this is a design bug in DX library this it prematurely declare ready
                    //   right after all LE characteristics are discovered. Rather, it should wait
                    //   for all notifications (rx, rx2, txc) enabled before declaring ready.
                    // - as a workaround, we will delay the callback response by 2s. 

                    // mleung 20181210
                    // - can bypass the 2s waiting for classic SPP
                    if( this.isSpp )
                    {
                        typeof success(obj) !== 'undefined' && success(obj);    
                    }
                    else
                    {
                        this.readyDelayTimeout = setTimeout(() => {
                            typeof success(obj) !== 'undefined' && success(obj);
                            this.readyDelayTimeout = null;
                        }, 2000);
                    }

                }.bind(this),
                function(obj) {
                    //failure
                    console.log ('[DX] BT connect error');
                    typeof failure(obj) !== 'undefined' && failure(obj);
                    if( this.readyDelayTimeout )
                    {
                        clearTimeout(this.readyDelayTimeout);
                        this.readyDelayTimeout = null;
                    }
                }.bind(this)
            );
        });
    }

    // disconnect from DataExchanger device.
    disconnect(uuid : string) : Promise<any> {
        return new Promise((resolve, reject) => {
            this.platform.ready().then(() => {
                var devUUID = (uuid == null ?this.deviceUUID :uuid);
                this.isConnected = false;
                this.deviceUUID = null;
                this.rxDataBuffer = '';
                this.rxCmdBuffer = '';

                if( devUUID == null )
                {
                    reject({"retCode":-1,"status":"device uuid is null"});
                    return;
                }
    
                cordova.plugin.dx.disconnect(
                    devUUID,
                    // Success (request sent)
                    function(obj) {
                        resolve({"retCode":0,"status":"success"});
                    },
                    // Failed
                    function(obj) {
                        console.log ('[DX] BT disconnect request error');
                        reject(obj);
                    }
                )
            });
        });

    }

    sendDxCmd(devUUID : string, input : string | ArrayBuffer | SharedArrayBuffer) : Promise<any> {
        return new Promise( (resolve, reject) => {
            this.platform.ready().then(() => {
                var bytes : any = input;
                if( typeof input == "string" )
                {
                    bytes = this.stringToBytes(input + '\r\n');
                }
                var params = {
                    uuid: devUUID == null ?this.deviceUUID :devUUID,
                    cmd: bytes
                };
                if (bytes.byteLength == 0) {
                    resolve(params);
                    return;
                }
                else if( params.uuid == null )
                {
                    reject(params);
                    return;
                }
                cordova.plugin.dx.sendCmd(
                    params.uuid,
                    params.cmd,
                    function(obj) {
                        if( typeof input == "string" )
                        {
                            console.log('[DX] TxCmd: ' + input);
                        }
                        resolve(params);
                    },
                    function(obj) {
                        reject(params)
                    }
                );
            });
        });
    }

    sendDxData(devUUID : string, input : string | ArrayBuffer | SharedArrayBuffer) : Promise<any> {
        return new Promise( (resolve, reject) => {
            this.platform.ready().then(() => {
                var bytes : any = input;
                if( typeof input == "string" )
                {
                    bytes = this.stringToBytes(input + '\r\n');
                }
                var params = {
                    uuid: devUUID == null ?this.deviceUUID :devUUID,
                    data: bytes
                };
                if (bytes.byteLength == 0) {
                    resolve(params);
                    return;
                }
                else if( params.uuid == null )
                {
                    reject(params);
                    return;
                }
                cordova.plugin.dx.sendData(
                    params.uuid,
                    params.data,
                    function(obj) {
                        if( typeof input == "string" )
                        {
                            console.log('[DX] TxData: ' + input);
                        }
                        resolve(params);
                    },
                    function(obj) {
                        reject(params)
                    }
                );
            });
        });
    }

    // Prime DataExchanger BLE firmware into flash storage.
    // Upgrade procedure - prime, verify, switch
    //
    // Parameter :
    // firmBinaryData = firmware binary blob data
    // firmNameStr = firmware name
    //
    primeDxFirmware(devUUID : string, firmCode : string, firmBin : ArrayBuffer, firmName : string, success : (obj) => void, failure : (obj) => void, progress : (obj) => void) {
        this.platform.ready().then(() => {
            var params = {
                uuid: devUUID == null ?this.deviceUUID :devUUID,
                firmCode : firmCode,
                firmBin: firmBin,
                firmName: firmName,
                ilCmd: null,
                ilCnt: 0,
            };
    
            this.progress = 0;
    
            console.log('[DX] priming DX firmware ...');
            cordova.plugin.dx.primeFirmwareBinary(
                params.uuid,
                params.firmCode,
                params.firmBin,
                params.firmName,
                params.ilCmd,
                params.ilCnt,
                (obj) => {
                    //success
                    if(!obj.isdone) {
                        /// report priming progress every 10%
                        obj.progress = Number(obj.progress * 10) / 10;
                        if(obj.progress > this.progress) {
                            this.progress = obj.progress;
                            typeof progress(obj) !== 'undefined' && progress(obj);
                        }
                    } else {
                        // priming completed
                        if(obj.status == 'OK') {
                            // prime function is successful. 
                            console.log('[DX] firmware priming successfull');
                            typeof success(obj) !== 'undefined' && success(obj);
                        }
                        else
                        {
                            console.log('[DX] firmware priming failed');
                            typeof failure(obj) !== 'undefined' && failure(obj);
                        }
                    }
                    // resolve(obj);
                },
                (obj) => {
                    //failure
                    console.log('[DX] error priming FirmwareMeta');
                    console.log(obj);
                    typeof failure(obj) !== 'undefined' && failure(obj);
                    // reject(obj);
                }
            );
        });
    }

    // Switch DataExchanger BLE firmware to image stored in flash.
    // Upgrade procedure - prime, verify, switch
    //
    // Parameter :
    // slotIndex = slot index in flash storage
    // firmNameStr = firmware name
    //
    switchDxFirmware(devUUID : string, firmCode : string, slotIndex : number, keepConfigData : boolean) {
        return new Promise( (resolve, reject) => {
            this.platform.ready().then(() => {
                var params = {
                    uuid: devUUID == null ?this.deviceUUID :devUUID,
                    firmCode: firmCode,
                    slotIdx: slotIndex,
                    keepConfig: keepConfigData
                };
    
                cordova.plugin.dx.switchFirmwareToSlot(
                    params.uuid,
                    params.firmCode,
                    params.slotIdx,
                    params.keepConfig,
                    function(obj) {
                        //success
                        console.log('[DX] switching firmware success');
                        console.log(obj);
                        resolve(obj);
                    },
                    function(obj) {
                        //failure
                        console.log('[DX] switching firmware error');
                        console.log(obj);
                        reject(obj);
                    }
                );
            });
        });
    }

    // On DataExchanger response received from Command Channel.
    //
    // Parameter :
    // data = AT response string received 
    //
    onDxCmdResponse(data) {
        this.dxCmdList.push(data);
    }

    // On DataExchanger data received from Data Channel.
    //
    // Parameter :
    // data = serial data string received 
    //
    onDxDataResponse(data) {
        this.dxDataList.push(data);
    }

    // On DataExchanger connection established 
    //
    onConnected() {
        //this.storage.setItem(this.STORAGE_DEVICE_ID_KEY, this.deviceUUID);
    }

    // On DataExchanger connection lost 
    //
    onDisconnected() {
    }

    // On BT system change events.
    //
    // Parameter :
    // state = state of system 
    //
    onSysEvent(state) {
        var alertTitle;
        var alertMessage;
        if (state == 'sysoff') {
            alertTitle = "BT Error";
            alertMessage = "Please make sure your Bluetooth is turned on, otherwise it will not work properly.";
            this.showErrorAlert(alertTitle,alertMessage);
        } else if (state == 'sysreset') {
            alertTitle = "BT Reset";
            alertMessage = "The Bluetooth system already reset";
            this.showErrorAlert(alertTitle,alertMessage);
        }
    }

    public bytesToString(buf : ArrayBuffer) : string 
    {
        // return String.fromCharCode.apply(null, new Uint8Array(buffer));
        return new TextDecoder().decode(new Uint8Array(buf));
    }

    public stringToBytes(utf16Str : string) : ArrayBuffer | SharedArrayBuffer
    {
        // var array = new Uint8Array(string.length);
        // for (var i=0;i<string.length;i++) {
        //     array[i] = string.charCodeAt(i);
        // }
        var array = new TextEncoder().encode(utf16Str);
        return array.buffer;
    }

    public base64ToBytes(b64 : string) : ArrayBuffer 
    {
        var bufLen = b64.length * 0.75;
    
        if (b64[b64.length - 1] === "=") 
        {
            bufLen--;
            if (b64[b64.length - 2] === "=") 
            {
                bufLen--;
            }
        }
    
        var arraybuffer = new ArrayBuffer(bufLen);
        var bytes = new Uint8Array(arraybuffer);
        var encoded1, encoded2, encoded3, encoded4;
        var p = 0;
    
        for (var i = 0; i < b64.length; i += 4) 
        {
            encoded1 = this.b64RvsLkup[b64.charCodeAt(i)];
            encoded2 = this.b64RvsLkup[b64.charCodeAt(i+1)];
            encoded3 = this.b64RvsLkup[b64.charCodeAt(i+2)];
            encoded4 = this.b64RvsLkup[b64.charCodeAt(i+3)];
    
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
    
        return arraybuffer;
    };

    public base64ToString(b64 : string) : string 
    {
        return this.bytesToString(this.base64ToBytes(b64));
    }

}
