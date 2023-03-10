/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import { SendingNetworkEvent } from "./event";
import { Direction } from "./event-timeline";

/**
 * @module models/event-context
 */
export class EventContext {
    private timeline: SendingNetworkEvent[];
    private ourEventIndex = 0;
    private paginateTokens: Record<Direction, string | null> = {
        [Direction.Backward]: null,
        [Direction.Forward]: null,
    };

    /**
     * Construct a new EventContext
     *
     * An eventcontext is used for circumstances such as search results, when we
     * have a particular event of interest, and a bunch of events before and after
     * it.
     *
     * It also stores pagination tokens for going backwards and forwards in the
     * timeline.
     *
     * @param {SendingNetworkEvent} ourEvent  the event at the centre of this context
     *
     * @constructor
     */
    constructor(ourEvent: SendingNetworkEvent) {
        this.timeline = [ourEvent];
    }

    /**
     * Get the main event of interest
     *
     * This is a convenience function for getTimeline()[getOurEventIndex()].
     *
     * @return {SendingNetworkEvent} The event at the centre of this context.
     */
    public getEvent(): SendingNetworkEvent {
        return this.timeline[this.ourEventIndex];
    }

    /**
     * Get the list of events in this context
     *
     * @return {Array} An array of SendingNetworkEvents
     */
    public getTimeline(): SendingNetworkEvent[] {
        return this.timeline;
    }

    /**
     * Get the index in the timeline of our event
     *
     * @return {Number}
     */
    public getOurEventIndex(): number {
        return this.ourEventIndex;
    }

    /**
     * Get a pagination token.
     *
     * @param {boolean} backwards   true to get the pagination token for going
     *                                  backwards in time
     * @return {string}
     */
    public getPaginateToken(backwards = false): string {
        return this.paginateTokens[backwards ? Direction.Backward : Direction.Forward];
    }

    /**
     * Set a pagination token.
     *
     * Generally this will be used only by the sendingnetwork js sdk.
     *
     * @param {string} token        pagination token
     * @param {boolean} backwards   true to set the pagination token for going
     *                                   backwards in time
     */
    public setPaginateToken(token: string, backwards = false): void {
        this.paginateTokens[backwards ? Direction.Backward : Direction.Forward] = token;
    }

    /**
     * Add more events to the timeline
     *
     * @param {Array} events      new events, in timeline order
     * @param {boolean} atStart   true to insert new events at the start
     */
    public addEvents(events: SendingNetworkEvent[], atStart = false): void {
        // TODO: should we share logic with Room.addEventsToTimeline?
        // Should Room even use EventContext?

        if (atStart) {
            this.timeline = events.concat(this.timeline);
            this.ourEventIndex += events.length;
        } else {
            this.timeline = this.timeline.concat(events);
        }
    }
}
