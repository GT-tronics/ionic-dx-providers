# ionic-dx-providers
Ionic DataExchanger Provider Submodule

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

