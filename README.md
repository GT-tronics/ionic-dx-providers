# ionic-dx-providers
Ionic DataExchanger Provider Submodule

# V5 R4
* added a few placeholder variables in BtDevInfo
* clear rssi of linked devices when start scanning

# V5 R3
* merged with ionic-dx-providers-private ionic-v4 R30

# V5 R2
* rewrote events.ts
* added the support of AtCmdHandler_NULL handler being instantiated as standalone

# V5 R1
* branched from V4 R11
* added the changes to support ionic v5
    * Events is no longer supported in @ionic/angular
    * added custom evetns.ts with compatible API
    * only declaration is required to change in each component which use Events

# V4 R11
* merged with ionic-dx-providers-private ionic-v4 R27

## V4 R10
* merged with ionic-dx-providers-private ionic-v4 R19

## V4 R9
* merged with ionic-dx-providers-private ionic-v4 R18

## V4 R8
* merged with ionic-dx-providers-private ionic-v4 R17

## V4 R7
* merged with ionic-dx-providers-private ionic-v4 R12

## V4 R6
* merged with ionic-dx-providers-private ionic-v4 R10

## V4 R5
* merged with ionic-dx-providers-private ionic-v4 R8

## V4 R4
* removed babylon.js

## V4 R3
* added page-params-passing services (copied from ionic-dx-providers-private ionic-v4 branch)

## V4 R2
* turned on AtCmdHandle for QCC and turned off for BLE and WIFI as default

## V4 R1
* branched from Master R8
* merged with ionic-dx-providers-private ionic-v4 R5

## R8
* if null handlers fails to spawn the application handler, it will terminate the connection and notify disconnect rather than hanging
* rewrote the common handler to use sendCmdAtInitStage() to send the initial commands before releasing other commands in the queue.
* fixed minor bug in AtCmdHandler_QCC_SRC.getVolume()
* added DX security support (just support no DX security) 

## R7
* added support functions for HFP for QCC SRC

## R6 
* added WebGL BabylonJS

## R5
* improved the connect speed (by 2s) for classic SPP
* improved the robustness of the null AT command handler when handling AT+NM? command

## R4
* support AT+SCAN commad for QCC_SRC
* fixed the speed filter to include numeric characters

## R3
* support spp provision in AT+PDL? command

## R2
* changed AT+VL? to AT+VLQ= for QCC source to support multiple device AVRCP volume sync

## R1
* splitted from ionic-dx-qcc/src/providers as a seperated git repository for ionic-dx-qcc and other project to include it as a git submodule
* commit point: [1429797](https://github.com/GT-tronics/ionic-dx-qcc/commit/1429797563c895c8fa7475a267c29a1db437135f)

