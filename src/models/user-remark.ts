import EventEmitter from "events";
import { EventType } from "../@types/event";
import { SendingNetworkClient } from "../client";

export type RemarkUser = {
    name?: string;
    note?: string;
    images?: string[];
};

export class RemarkStore extends EventEmitter {
    private static internalInstance: RemarkStore;
    private eventType = EventType.RemarkedUserList;
    constructor(private client: SendingNetworkClient) {
        super();
        client.on("accountData", (newEvent, oldEvent) => {
            if (
                newEvent?.getType() === this.eventType &&
                oldEvent?.getType() === this.eventType
            ) {
                this.diff(
                    oldEvent.getContent().remarked_user,
                    newEvent.getContent().remarked_user
                );
            }
        });
    }

    private diff(oldMap, newMap) {
        for (const key in newMap) {
            if (oldMap[key]?.name !== newMap[key].name) {
                this.emit("User.remark_changed", key, newMap[key]);
            }
        }
    }

    getRemarkMap(eventKey?: string, key?: string) {
        return (
            this.client
                .getAccountData(eventKey || this.eventType)
                ?.getContent()[key || "remarked_user"] || {}
        );
    }

    static stop() {
        RemarkStore.internalInstance = null;
    }

    private isEmpty(remark: RemarkUser) {
        return (
            !remark.name &&
            !remark.note &&
            (!remark.images || (remark.images && remark.images.length === 0))
        );
    }

    async setUserRemarkMap(userId: string, userRemark: RemarkUser) {
        try {
            const currentRemarkNameMap = this.getRemarkMap();

            const currentUserRemark = currentRemarkNameMap[userId];

            if (this.isEmpty(userRemark)) {
                delete currentRemarkNameMap[userId];
            } else {
                currentRemarkNameMap[userId] = {
                    ...currentUserRemark,
                    ...userRemark,
                };
            }

            await this.client.setAccountData(this.eventType, {
                remarked_user: currentRemarkNameMap,
            });

            this.emit("User.remark_changed", userId, userRemark);
        } catch (err) {
            console.error("setUserRemarkMap failed");
        }
    }

    static get(client?: SendingNetworkClient) {
        if (!RemarkStore.internalInstance && client) {
            RemarkStore.internalInstance = new RemarkStore(client);
        }
        if (!RemarkStore.internalInstance) {
            throw new Error("RemarkStore not initialized with SendingNetworkClient");
        }
        return RemarkStore.internalInstance;
    }
}
