/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

export enum ThreepidMedium {
    Email = "email",
    Phone = "msisdn",
    Did = "did",
}

// TODO: Are these types universal, or specific to just /account/3pid?
export interface IThreepid {
    // eslint-disable-next-line camelcase
    user_id?: string;
    medium: ThreepidMedium;
    address: string;
    validated_at: number; // eslint-disable-line camelcase
    added_at: number; // eslint-disable-line camelcase
    bound?: boolean;
}
