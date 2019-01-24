import { Events } from 'ionic-angular';
import { ATCMDHDL } from '../../providers/atcmd-dispatcher/atcmd-handler';
import { ATCMDHDLCOMMON } from '../../providers/atcmd-dispatcher/atcmd-handler-common';

export namespace ATCMDHDLIMU 
{
    export class AtCmdHandler_IMU extends ATCMDHDLCOMMON.AtCmdHandler_COMMON {

        static createInstance(
            uuid : string, 
            name : string, 
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events 
        ) : ATCMDHDL.AtCmdHandler
        {
            return new AtCmdHandler_IMU(uuid, name, sendCb, events);
        }
    
        public atCmdGAM : AtCmdRec_GAM;

        constructor(
            uuid : string, 
            name : string,
            sendCb : (uuid:string, data:string) => Promise<any>,
            events : Events
        ) 
        {
            super(uuid, name, sendCb, events);

            // AT+GAM (unsolicted response only)
            this.atCmdGAM = new AtCmdRec_GAM(this.uuid, this.atCmdRspCallback_GAM.bind(this), events);
            this.addAtCmdRecToParser(this.atCmdGAM, false);
        }
    
        //
        // Special Callback Override
        //

        private atCmdRspCallback_GAM( params ) 
        {
            if( this.atCmdGAM.resolve != null )
            {
                this.atCmdGAM.resolve(params);
            }
        }

        //
        // Support Functions
        //

        public startProcessImu(func : any) 
        {
            this.atCmdGAM.resolve = func;
            this.atCmdGAM.reject = null;
        }

        public stopProcessImu()
        {
            this.atCmdGAM.resolve = null;
            this.atCmdGAM.reject = null;
        }
    }

    //
    // AT+PDL? AT-CMD Record
    //

    export class AtCmdRec_GAM extends ATCMDHDL.AtCmdRec 
    {
        public currTs : number = 0;
        public lastTs : number = 0;
        public acc : number [];
        public gyo : number [];
        public mag : number [];
        public accOfs : number [];
        public gyoOfs : number [];
        public magOfs : number [];

        // Madgwick Quaternion
        public beta : number = 0.1;
        public q0 :number = 1.0;
        public q1 : number = 0.0;
        public q2 : number = 0.0;
        public q3 : number = 0.0;
        
        public readCount : number = 0;

        constructor(
            uuid : string,
            cb : ( obj : {} ) => void,
            events : Events
        )
        {
            // Notification only
            // - there is no AT+GAM command.
            // - but will set that anyways
            super(uuid, 'AT+GAM', "\\+GAM\\:(.+),(.+),(.+),(.+)", cb, events);
            this.eventId = 'IMU_GAM_NOTI';

            this.reset();
        }

        public reset()
        {
            this.accOfs = [0,0,0];
            this.gyoOfs = [0,0,0];
            this.magOfs = [0,0,0];
            this.readCount = 0;
            this.q0 = 1.0;
            this.q1 = 0.0;
            this.q2 = 0.0;
            this.q3 = 0.0;
        }

        private hexToBytes(hex : string) : number[] 
        {
            for (var bytes = [], c = 0; c < hex.length; c += 2)
            {
                bytes.push(parseInt(hex.substr(c, 2), 16));
            }
            return bytes;
        }

        private symbolLookup(idx: number) : string
        {
            if( idx >= 37 )
            {
                return String.fromCharCode(0x60 + idx - 37);
            }
            else if( idx >= 10 )
            {
                return String.fromCharCode(0x40 + idx - 10);
            }
            return String.fromCharCode(0x30 + idx);
        }

        private reverseSymbolLookup(symbol : string) : number
        {
            var char = symbol.charCodeAt(0);

            if( char >= 0x60 )
            {
                return 37 + char - 0x60;
            }
            else if( char >= 0x40)
            {
                return 10 + char - 0x40;
            }

            return char - 0x30;
        }

        private convert( base64Str : string) : number[]
        {
            var x, y, z : number;
            var idx64s : number[] = base64Str.split('').map(this.reverseSymbolLookup);
            var zl, yl, xl, zh, yh, xh : number;
            var x, y, z : number;

            // console.log("HEX: " + idx64s.map((a)=>{return a.toString(16);}));

            zh = (idx64s[0] << 2) + (idx64s[1] >> 4);
            zl = ((idx64s[1] & 0xF) << 4) + (idx64s[2] >> 2);
            yh = ((idx64s[2] & 0x3) << 6) + idx64s[3];
            yl = (idx64s[4] << 2) + (idx64s[5] >> 4);
            xh = ((idx64s[5] & 0xF) << 4) + (idx64s[6] >> 2);
            xl = ((idx64s[6] & 0x3) << 6) + idx64s[7];

            // console.log("HEX:" + xl.toString(16) + " " + xh.toString(16) + " " + yl.toString(16) + " " + yh.toString(16) + " " + zl.toString(16) + " " + zh.toString(16))

            z = (zh << 7) + zl;
            z = zh >= 128 ?z-32768 :z;

            y = (yh << 7) + yl;
            y = yh >= 128 ?y-32768 :y;

            x = (xh << 7) + xl;
            x = xh >= 128 ?x-32768 :x;

            return [x, y, z];
        }

        match(matchAry : any[]) 
        {
            // console.log("TimeStamp: " + matchAry[1] + "," + matchAry[2] + "," + matchAry[3] + "," + matchAry[4]);
            if( this.currTs > 0 )
            {
                this.lastTs = this.currTs;
            }
            this.currTs = parseInt(matchAry[1],16);
            this.gyo = this.convert(matchAry[2]);
            this.acc = this.convert(matchAry[3]);
            this.mag = this.convert(matchAry[4]);

            {
                // Scale the gyro value - +250 full range
                // this.gyo = this.gyo.map((a)=>{return (a * 0.00875 * Math.PI / 180.0);});
                
                // Scale the gyro value - +500 full range
                // this.gyo = this.gyo.map((a)=>{return (a * 0.0175 * Math.PI / 180.0);});

                // Scale the gyro value - +2000 full range
                this.gyo = this.gyo.map((a)=>{return (a * 0.07 * Math.PI / 180.0);});
            }

            {
                // Scale the accel value - +2g full range
                this.acc = this.acc.map((a)=>{return (a * 0.000061);});
                
                // Scale the accel value - +4g full range
                // this.acc = this.acc.map((a)=>{return (a * 0.000122);});
                
                // Scale the accel value - +8g full range
                // this.acc = this.acc.map((a)=>{return (a * 0.000244);});
                
                // Scale the accel value - +16g full range
                // this.acc = this.acc.map((a)=>{return (a * 0.000732);});                
            }

            {
                // Scale the accel value - +4 guass full range
                this.acc = this.mag.map((a)=>{return (a * 0.00014);});
                
                // Scale the accel value - +8 guass full range
                // this.acc = this.mag.map((a)=>{return (a * 0.00029);});
                
                // Scale the accel value - +12 guass full range
                // this.acc = this.mag.map((a)=>{return (a * 0.00043);});
                
                // Scale the accel value - +16 guass full range
                // this.acc = this.mag.map((a)=>{return (a * 0.00058);});            
            }

            // console.log("TM:" + (this.currTs - this.lastTs) + " ACC:" + this.acc + " GYO:" + this.gyo + " MAG:" + this.mag);

            if( this.readCount < 50 )
            {
                var accFn = function(a : number,i : number){return (a + this.acc[i]);}.bind(this);
                var gyoFn = function(a : number,i : number){return (a + this.gyo[i]);}.bind(this);
                var magFn = function(a : number,i : number){return (a + this.mag[i]);}.bind(this);

                // Find the offset for calibration
                this.accOfs = this.accOfs.map(accFn);
                this.gyoOfs = this.gyoOfs.map(gyoFn);
                this.magOfs = this.magOfs.map(magFn);

                this.readCount++;

                if( this.readCount == 50 )
                {
                    var accFn = function(a : number,i : number){return (a / this.readCount);}.bind(this);
                    var gyoFn = function(a : number,i : number){return (a / this.readCount);}.bind(this);
                    var magFn = function(a : number,i : number){return (a / this.readCount);}.bind(this);
    
                    this.accOfs = this.accOfs.map(accFn);
                    this.gyoOfs = this.gyoOfs.map(gyoFn);
                    this.magOfs = this.magOfs.map(magFn);
                }

                return;
            }
            

            this.gyo = this.gyo.map(function(a : number,i : number){return a - this.gyoOfs[i];}.bind(this));

            console.log("TM:" + (this.currTs - this.lastTs) + " ACC:" + this.acc + " GYO:" + this.gyo + " MAG:" + this.mag);

            this.MadgwickQuaternionUpdate((this.currTs - this.lastTs) / 1000);

            this.params = 
            {
                "cmdRsp" : "+GAM:",
                "uuid" : this.uuid,
                "seqId" : this.seqId,
                "retCode" : 0,
                "status" : "success",
                "timeStamp" : this.currTs,
                "timeDiff" : this.currTs - this.lastTs,
                "acc" : this.acc,
                "gyo" : this.gyo,
                "mag" : this.mag,
                "q0" : this.q0,
                "q1" : this.q1,
                "q2" : this.q2,
                "q3" : this.q3
            }

            // Always put this to last
            super.match(matchAry);
        }

        MadgwickQuaternionUpdate(timeDiff : number)
        {
            var gx : number = this.gyo[0]; 
            var gy : number = this.gyo[1];
            var gz : number = this.gyo[2]; 
            var ax : number = this.acc[0]; 
            var ay : number = this.acc[1];
            var az : number = this.acc[2];
            var mx : number = this.mag[0];
            var my : number = this.mag[1];
            var mz : number = this.mag[2];

            var q1 = this.q0, q2 = this.q1, q3 = this.q2, q4 = this.q3;   // short name local variable for readability
            var norm;
            var hx, hy, _2bx, _2bz;
            var s1, s2, s3, s4;
            var qDot1, qDot2, qDot3, qDot4;

            // Auxiliary variables to avoid repeated arithmetic
             var _2q1mx;
             var _2q1my;
             var _2q1mz;
             var _2q2mx;
             var _4bx;
             var _4bz;
             var _2q1 = 2.0 * q1;
             var _2q2 = 2.0 * q2;
             var _2q3 = 2.0 * q3;
             var _2q4 = 2.0 * q4;
             var _2q1q3 = 2.0 * q1 * q3;
             var _2q3q4 = 2.0 * q3 * q4;
             var q1q1 = q1 * q1;
             var q1q2 = q1 * q2;
             var q1q3 = q1 * q3;
             var q1q4 = q1 * q4;
             var q2q2 = q2 * q2;
             var q2q3 = q2 * q3;
             var q2q4 = q2 * q4;
             var q3q3 = q3 * q3;
             var q3q4 = q3 * q4;
             var q4q4 = q4 * q4;

            // Normalise accelerometer measurement
            norm = Math.sqrt(ax * ax + ay * ay + az * az);
            if (norm == 0.0) 
            {
                return; // handle NaN
            }
            norm = 1.0/norm;
            ax *= norm;
            ay *= norm;
            az *= norm;

            // Normalise magnetometer measurement
            norm = Math.sqrt(mx * mx + my * my + mz * mz);
            if (norm == 0.0) 
            {
                return; // handle NaN
            }
            norm = 1.0/norm;
            mx *= norm;
            my *= norm;
            mz *= norm;

            // Reference direction of Earth's magnetic field
            _2q1mx = 2.0 * q1 * mx;
            _2q1my = 2.0 * q1 * my;
            _2q1mz = 2.0 * q1 * mz;
            _2q2mx = 2.0 * q2 * mx;
            hx = mx * q1q1 - _2q1my * q4 + _2q1mz * q3 + mx * q2q2 + _2q2 * my * q3 + _2q2 * mz * q4 - mx * q3q3 - mx * q4q4;
            hy = _2q1mx * q4 + my * q1q1 - _2q1mz * q2 + _2q2mx * q3 - my * q2q2 + my * q3q3 + _2q3 * mz * q4 - my * q4q4;
            _2bx = Math.sqrt(hx * hx + hy * hy);
            _2bz = -_2q1mx * q3 + _2q1my * q2 + mz * q1q1 + _2q2mx * q4 - mz * q2q2 + _2q3 * my * q4 - mz * q3q3 + mz * q4q4;
            _4bx = 2.0 * _2bx;
            _4bz = 2.0 * _2bz;

            // Gradient decent algorithm corrective step
            s1 = -_2q3 * (2.0 * q2q4 - _2q1q3 - ax) + _2q2 * (2.0 * q1q2 + _2q3q4 - ay) - _2bz * q3 * (_2bx * (0.5 - q3q3 - q4q4) + _2bz * (q2q4 - q1q3) - mx) + (-_2bx * q4 + _2bz * q2) * (_2bx * (q2q3 - q1q4) + _2bz * (q1q2 + q3q4) - my) + _2bx * q3 * (_2bx * (q1q3 + q2q4) + _2bz * (0.5 - q2q2 - q3q3) - mz);
            s2 = _2q4 * (2.0 * q2q4 - _2q1q3 - ax) + _2q1 * (2.0 * q1q2 + _2q3q4 - ay) - 4.0 * q2 * (1.0 - 2.0 * q2q2 - 2.0 * q3q3 - az) + _2bz * q4 * (_2bx * (0.5 - q3q3 - q4q4) + _2bz * (q2q4 - q1q3) - mx) + (_2bx * q3 + _2bz * q1) * (_2bx * (q2q3 - q1q4) + _2bz * (q1q2 + q3q4) - my) + (_2bx * q4 - _4bz * q2) * (_2bx * (q1q3 + q2q4) + _2bz * (0.5 - q2q2 - q3q3) - mz);
            s3 = -_2q1 * (2.0 * q2q4 - _2q1q3 - ax) + _2q4 * (2.0 * q1q2 + _2q3q4 - ay) - 4.0 * q3 * (1.0 - 2.0 * q2q2 - 2.0 * q3q3 - az) + (-_4bx * q3 - _2bz * q1) * (_2bx * (0.5 - q3q3 - q4q4) + _2bz * (q2q4 - q1q3) - mx) + (_2bx * q2 + _2bz * q4) * (_2bx * (q2q3 - q1q4) + _2bz * (q1q2 + q3q4) - my) + (_2bx * q1 - _4bz * q3) * (_2bx * (q1q3 + q2q4) + _2bz * (0.5 - q2q2 - q3q3) - mz);
            s4 = _2q2 * (2.0 * q2q4 - _2q1q3 - ax) + _2q3 * (2.0 * q1q2 + _2q3q4 - ay) + (-_4bx * q4 + _2bz * q2) * (_2bx * (0.5 - q3q3 - q4q4) + _2bz * (q2q4 - q1q3) - mx) + (-_2bx * q1 + _2bz * q3) * (_2bx * (q2q3 - q1q4) + _2bz * (q1q2 + q3q4) - my) + _2bx * q2 * (_2bx * (q1q3 + q2q4) + _2bz * (0.5 - q2q2 - q3q3) - mz);
            norm = Math.sqrt(s1 * s1 + s2 * s2 + s3 * s3 + s4 * s4);    // normalise step magnitude
            norm = 1.0/norm;
            s1 *= norm;
            s2 *= norm;
            s3 *= norm;
            s4 *= norm;

            // Compute rate of change of quaternion
            qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz) - this.beta * s1;
            qDot2 = 0.5 * (q1 * gx + q3 * gz - q4 * gy) - this.beta * s2;
            qDot3 = 0.5 * (q1 * gy - q2 * gz + q4 * gx) - this.beta * s3;
            qDot4 = 0.5 * (q1 * gz + q2 * gy - q3 * gx) - this.beta * s4;

            // Integrate to yield quaternion
            q1 += qDot1 * timeDiff;
            q2 += qDot2 * timeDiff;
            q3 += qDot3 * timeDiff;
            q4 += qDot4 * timeDiff;
            norm = Math.sqrt(q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4);    // normalise quaternion
            norm = 1.0/norm;
            this.q0 = q1 * norm;
            this.q1 = q2 * norm;
            this.q2 = q3 * norm;
            this.q3 = q4 * norm;
        }
    }


    //
    // Register subclass with base class
    // - this will allow AtCmdHandler to create an instance of AtCmdHandler_QCC_SRC
    //
    ATCMDHDL.AtCmdHandler.registerSubClass('IMU', AtCmdHandler_IMU.createInstance)

}  // namespace ATCMDHDLQCCSRC

