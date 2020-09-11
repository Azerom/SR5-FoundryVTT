/// <reference path="../Shadowrun.ts" />
declare namespace Shadowrun {
    export type Tracks = {
        physical: TrackType & Overflow;
        stun: TrackType;
    };

    export type PhysicalTrack = TrackType & Overflow;
    export type StunTrack = TrackType;

    export type TrackType = ValueMaxPair<number> &
        LabelField &
        ModifiableValue & {
            wounds: number;
        };

    export type Overflow = {
        overflow: ValueMaxPair<number>;
    };
}
