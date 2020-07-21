import { AttributeName } from './Attribute';

export enum DamageType {
    Physical = 'physical',
    Stun = 'stun',
    Matrix = 'matrix',
}

export enum DamageElement {
    Physical = 'physical',
    Fire = 'fire',
    Cold = 'cold',
    Electricity = 'electricity',
    Radiation = 'radiation',
    Pollution = 'pollution',
    // TODO: There are more elements I am sure
}

export interface ScaleWithAttribute<TValidKeys extends AttributeName> {
    baseValue: number;
    scaleWith: TValidKeys;
    scaleFactor: number;

    // Avoiding methods for now
    // total(): number;
}
