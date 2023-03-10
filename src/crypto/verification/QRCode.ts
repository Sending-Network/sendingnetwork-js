/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * QR code key verification.
 * @module crypto/verification/QRCode
 */

import { VerificationBase as Base } from "./Base";
import { newKeyMismatchError, newUserCancelledError } from './Error';
import { decodeBase64, encodeUnpaddedBase64 } from "../olmlib";
import { logger } from '../../logger';
import { VerificationRequest } from "./request/VerificationRequest";
import { SendingNetworkClient } from "../../client";
import { IVerificationChannel } from "./request/Channel";
import { SendingNetworkEvent } from "../../models/event";

export const SHOW_QR_CODE_METHOD = "m.qr_code.show.v1";
export const SCAN_QR_CODE_METHOD = "m.qr_code.scan.v1";

/**
 * @class crypto/verification/QRCode/ReciprocateQRCode
 * @extends {module:crypto/verification/Base}
 */
export class ReciprocateQRCode extends Base {
    public reciprocateQREvent: {
        confirm(): void;
        cancel(): void;
    };

    public static factory(
        channel: IVerificationChannel,
        baseApis: SendingNetworkClient,
        userId: string,
        deviceId: string,
        startEvent: SendingNetworkEvent,
        request: VerificationRequest,
    ): ReciprocateQRCode {
        return new ReciprocateQRCode(channel, baseApis, userId, deviceId, startEvent, request);
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static get NAME(): string {
        return "m.reciprocate.v1";
    }

    protected doVerification = async (): Promise<void> => {
        if (!this.startEvent) {
            // TODO: Support scanning QR codes
            throw new Error("It is not currently possible to start verification" +
                "with this method yet.");
        }

        const { qrCodeData } = this.request;
        // 1. check the secret
        if (this.startEvent.getContent()['secret'] !== qrCodeData.encodedSharedSecret) {
            throw newKeyMismatchError();
        }

        // 2. ask if other user shows shield as well
        await new Promise<void>((resolve, reject) => {
            this.reciprocateQREvent = {
                confirm: resolve,
                cancel: () => reject(newUserCancelledError()),
            };
            this.emit("show_reciprocate_qr", this.reciprocateQREvent);
        });

        // 3. determine key to sign / mark as trusted
        const keys: Record<string, string> = {};

        switch (qrCodeData.mode) {
            case Mode.VerifyOtherUser: {
                // add master key to keys to be signed, only if we're not doing self-verification
                const masterKey = qrCodeData.otherUserMasterKey;
                keys[`ed25519:${masterKey}`] = masterKey;
                break;
            }
            case Mode.VerifySelfTrusted: {
                const deviceId = this.request.targetDevice.deviceId;
                keys[`ed25519:${deviceId}`] = qrCodeData.otherDeviceKey;
                break;
            }
            case Mode.VerifySelfUntrusted: {
                const masterKey = qrCodeData.myMasterKey;
                keys[`ed25519:${masterKey}`] = masterKey;
                break;
            }
        }

        // 4. sign the key (or mark own MSK as verified in case of MODE_VERIFY_SELF_TRUSTED)
        await this.verifyKeys(this.userId, keys, (keyId, device, keyInfo) => {
            // make sure the device has the expected keys
            const targetKey = keys[keyId];
            if (!targetKey) throw newKeyMismatchError();

            if (keyInfo !== targetKey) {
                logger.error("key ID from key info does not match");
                throw newKeyMismatchError();
            }
            for (const deviceKeyId in device.keys) {
                if (!deviceKeyId.startsWith("ed25519")) continue;
                const deviceTargetKey = keys[deviceKeyId];
                if (!deviceTargetKey) throw newKeyMismatchError();
                if (device.keys[deviceKeyId] !== deviceTargetKey) {
                    logger.error("master key does not match");
                    throw newKeyMismatchError();
                }
            }
        });
    };
}

const CODE_VERSION = 0x02; // the version of binary QR codes we support
const BINARY_PREFIX = "SENDINGNETWORK"; // ASCII, used to prefix the binary format

enum Mode {
    VerifyOtherUser = 0x00, // Verifying someone who isn't us
    VerifySelfTrusted = 0x01, // We trust the master key
    VerifySelfUntrusted = 0x02, // We do not trust the master key
}

interface IQrData {
    prefix: string;
    version: number;
    mode: Mode;
    transactionId: string;
    firstKeyB64: string;
    secondKeyB64: string;
    secretB64: string;
}

export class QRCodeData {
    constructor(
        public readonly mode: Mode,
        private readonly sharedSecret: string,
        // only set when mode is MODE_VERIFY_OTHER_USER, master key of other party at time of generating QR code
        public readonly otherUserMasterKey: string | undefined,
        // only set when mode is MODE_VERIFY_SELF_TRUSTED, device key of other party at time of generating QR code
        public readonly otherDeviceKey: string | undefined,
        // only set when mode is MODE_VERIFY_SELF_UNTRUSTED, own master key at time of generating QR code
        public readonly myMasterKey: string | undefined,
        private readonly buffer: Buffer,
    ) {}

    public static async create(request: VerificationRequest, client: SendingNetworkClient): Promise<QRCodeData> {
        const sharedSecret = QRCodeData.generateSharedSecret();
        const mode = QRCodeData.determineMode(request, client);
        let otherUserMasterKey = null;
        let otherDeviceKey = null;
        let myMasterKey = null;
        if (mode === Mode.VerifyOtherUser) {
            const otherUserCrossSigningInfo =
                client.getStoredCrossSigningForUser(request.otherUserId);
            otherUserMasterKey = otherUserCrossSigningInfo.getId("master");
        } else if (mode === Mode.VerifySelfTrusted) {
            otherDeviceKey = await QRCodeData.getOtherDeviceKey(request, client);
        } else if (mode === Mode.VerifySelfUntrusted) {
            const myUserId = client.getUserId();
            const myCrossSigningInfo = client.getStoredCrossSigningForUser(myUserId);
            myMasterKey = myCrossSigningInfo.getId("master");
        }
        const qrData = QRCodeData.generateQrData(
            request, client, mode,
            sharedSecret,
            otherUserMasterKey,
            otherDeviceKey,
            myMasterKey,
        );
        const buffer = QRCodeData.generateBuffer(qrData);
        return new QRCodeData(mode, sharedSecret,
            otherUserMasterKey, otherDeviceKey, myMasterKey, buffer);
    }

    /**
     * The unpadded base64 encoded shared secret.
     */
    public get encodedSharedSecret(): string {
        return this.sharedSecret;
    }

    public getBuffer(): Buffer {
        return this.buffer;
    }

    private static generateSharedSecret(): string {
        const secretBytes = new Uint8Array(11);
        global.crypto.getRandomValues(secretBytes);
        return encodeUnpaddedBase64(secretBytes);
    }

    private static async getOtherDeviceKey(request: VerificationRequest, client: SendingNetworkClient): Promise<string> {
        const myUserId = client.getUserId();
        const otherDevice = request.targetDevice;
        const otherDeviceId = otherDevice ? otherDevice.deviceId : null;
        const device = client.getStoredDevice(myUserId, otherDeviceId);
        if (!device) {
            throw new Error("could not find device " + otherDeviceId);
        }
        return device.getFingerprint();
    }

    private static determineMode(request: VerificationRequest, client: SendingNetworkClient): Mode {
        const myUserId = client.getUserId();
        const otherUserId = request.otherUserId;

        let mode = Mode.VerifyOtherUser;
        if (myUserId === otherUserId) {
            // Mode changes depending on whether or not we trust the master cross signing key
            const myTrust = client.checkUserTrust(myUserId);
            if (myTrust.isCrossSigningVerified()) {
                mode = Mode.VerifySelfTrusted;
            } else {
                mode = Mode.VerifySelfUntrusted;
            }
        }
        return mode;
    }

    private static generateQrData(
        request: VerificationRequest,
        client: SendingNetworkClient,
        mode: Mode,
        encodedSharedSecret: string,
        otherUserMasterKey: string,
        otherDeviceKey: string,
        myMasterKey: string,
    ): IQrData {
        const myUserId = client.getUserId();
        const transactionId = request.channel.transactionId;
        const qrData = {
            prefix: BINARY_PREFIX,
            version: CODE_VERSION,
            mode,
            transactionId,
            firstKeyB64: '', // worked out shortly
            secondKeyB64: '', // worked out shortly
            secretB64: encodedSharedSecret,
        };

        const myCrossSigningInfo = client.getStoredCrossSigningForUser(myUserId);

        if (mode === Mode.VerifyOtherUser) {
            // First key is our master cross signing key
            qrData.firstKeyB64 = myCrossSigningInfo.getId("master");
            // Second key is the other user's master cross signing key
            qrData.secondKeyB64 = otherUserMasterKey;
        } else if (mode === Mode.VerifySelfTrusted) {
            // First key is our master cross signing key
            qrData.firstKeyB64 = myCrossSigningInfo.getId("master");
            qrData.secondKeyB64 = otherDeviceKey;
        } else if (mode === Mode.VerifySelfUntrusted) {
            // First key is our device's key
            qrData.firstKeyB64 = client.getDeviceEd25519Key();
            // Second key is what we think our master cross signing key is
            qrData.secondKeyB64 = myMasterKey;
        }
        return qrData;
    }

    private static generateBuffer(qrData: IQrData): Buffer {
        let buf = Buffer.alloc(0); // we'll concat our way through life

        const appendByte = (b) => {
            const tmpBuf = Buffer.from([b]);
            buf = Buffer.concat([buf, tmpBuf]);
        };
        const appendInt = (i) => {
            const tmpBuf = Buffer.alloc(2);
            tmpBuf.writeInt16BE(i, 0);
            buf = Buffer.concat([buf, tmpBuf]);
        };
        const appendStr = (s, enc, withLengthPrefix = true) => {
            const tmpBuf = Buffer.from(s, enc);
            if (withLengthPrefix) appendInt(tmpBuf.byteLength);
            buf = Buffer.concat([buf, tmpBuf]);
        };
        const appendEncBase64 = (b64) => {
            const b = decodeBase64(b64);
            const tmpBuf = Buffer.from(b);
            buf = Buffer.concat([buf, tmpBuf]);
        };

        // Actually build the buffer for the QR code
        appendStr(qrData.prefix, "ascii", false);
        appendByte(qrData.version);
        appendByte(qrData.mode);
        appendStr(qrData.transactionId, "utf-8");
        appendEncBase64(qrData.firstKeyB64);
        appendEncBase64(qrData.secondKeyB64);
        appendEncBase64(qrData.secretB64);

        return buf;
    }
}
